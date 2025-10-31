-- Migration: 003_budget_triggers.sql
-- 1) 增加 expenses 与 trips / itinerary_items 的扩展字段
-- 2) 增加触发器函数，在 expenses 插入/更新/删除时自动重算 item.actual_cost 与 trip.estimated_budget_consumed

-- 1. 增加字段（若尚未存在）
ALTER TABLE IF EXISTS expenses
  ADD COLUMN IF NOT EXISTS itinerary_item_id uuid REFERENCES itinerary_items(id),
  ADD COLUMN IF NOT EXISTS payer_id uuid REFERENCES users(id),
  -- 与文档保持一致：默认状态设为 'pending'（如已结清可设为 'cleared' 或 'paid'）
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS vendor text,
  ADD COLUMN IF NOT EXISTS receipt_url text,
  ADD COLUMN IF NOT EXISTS split jsonb;

CREATE INDEX IF NOT EXISTS idx_expenses_itinerary_item ON expenses(itinerary_item_id);

ALTER TABLE IF EXISTS trips
  ADD COLUMN IF NOT EXISTS estimated_budget_consumed numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_budget_recalc_at timestamptz;

ALTER TABLE IF EXISTS itinerary_items
  ADD COLUMN IF NOT EXISTS actual_cost numeric DEFAULT 0;

-- 2. 创建重算函数
CREATE OR REPLACE FUNCTION recalc_item_cost(p_item_id uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_item_id IS NULL THEN
    RETURN;
  END IF;
  UPDATE itinerary_items SET actual_cost = COALESCE((
    SELECT SUM(amount) FROM expenses WHERE itinerary_item_id = p_item_id AND (status IS NULL OR status <> 'refunded')
  ),0) WHERE id = p_item_id;
END;
$$;

CREATE OR REPLACE FUNCTION recalc_trip_budget(p_trip_id uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_trip_id IS NULL THEN
    RETURN;
  END IF;
  -- 计算已消费总额，并更新 remaining（若 estimated_budget 为空则 remaining 设为 NULL）
  DECLARE v_consumed numeric;
  BEGIN
    SELECT COALESCE(SUM(amount),0) INTO v_consumed FROM expenses WHERE trip_id = p_trip_id AND (status IS NULL OR status <> 'refunded');
    UPDATE trips SET
      estimated_budget_consumed = v_consumed,
      estimated_budget_remaining = CASE WHEN estimated_budget IS NULL THEN NULL ELSE (estimated_budget - v_consumed) END,
      last_budget_recalc_at = now()
    WHERE id = p_trip_id;
  END;
END;
$$;

-- 3. 创建 expenses 变化触发器，处理 INSERT/UPDATE/DELETE
CREATE OR REPLACE FUNCTION expenses_after_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_old_item uuid;
  v_new_item uuid;
  v_old_trip uuid;
  v_new_trip uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new_item := NEW.itinerary_item_id;
    v_new_trip := NEW.trip_id;
    PERFORM recalc_item_cost(v_new_item);
    PERFORM recalc_trip_budget(v_new_trip);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_item := OLD.itinerary_item_id;
    v_new_item := NEW.itinerary_item_id;
    v_old_trip := OLD.trip_id;
    v_new_trip := NEW.trip_id;
    -- 如果关联的 item/trip 发生变化，需要重算旧的和新的
    IF v_old_item IS NOT NULL THEN PERFORM recalc_item_cost(v_old_item); END IF;
    IF v_new_item IS NOT NULL THEN PERFORM recalc_item_cost(v_new_item); END IF;
    IF v_old_trip IS NOT NULL THEN PERFORM recalc_trip_budget(v_old_trip); END IF;
    IF v_new_trip IS NOT NULL THEN PERFORM recalc_trip_budget(v_new_trip); END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_old_item := OLD.itinerary_item_id;
    v_old_trip := OLD.trip_id;
    IF v_old_item IS NOT NULL THEN PERFORM recalc_item_cost(v_old_item); END IF;
    IF v_old_trip IS NOT NULL THEN PERFORM recalc_trip_budget(v_old_trip); END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_expenses_after_change ON expenses;
CREATE TRIGGER trg_expenses_after_change
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW EXECUTE PROCEDURE expenses_after_change();

-- 4. 在写入前校验/填充：确保当 expense 指定了 itinerary_item_id 时，expense.trip_id 与该 item 的 trip_id 一致
CREATE OR REPLACE FUNCTION expenses_before_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_item_trip uuid;
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.itinerary_item_id IS NOT NULL THEN
      SELECT trip_id INTO v_item_trip FROM itinerary_items WHERE id = NEW.itinerary_item_id;
      IF v_item_trip IS NULL THEN
        RAISE EXCEPTION 'itinerary_item not found: %', NEW.itinerary_item_id;
      END IF;
      -- 若未提供 trip_id，则自动填充；若提供但不一致则抛错，避免跨 trip 的不一致数据
      IF NEW.trip_id IS NULL THEN
        NEW.trip_id := v_item_trip;
      ELSIF NEW.trip_id <> v_item_trip THEN
        RAISE EXCEPTION 'expense.trip_id (%) must match itinerary_item.trip_id (%) for itinerary_item_id %', NEW.trip_id, v_item_trip, NEW.itinerary_item_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expenses_before_change ON expenses;
CREATE TRIGGER trg_expenses_before_change
  BEFORE INSERT OR UPDATE ON expenses
  FOR EACH ROW EXECUTE PROCEDURE expenses_before_change();

-- 备注：触发器会在 expenses 表变更后即时更新 itinerary_items.actual_cost 与 trips.estimated_budget_consumed。
