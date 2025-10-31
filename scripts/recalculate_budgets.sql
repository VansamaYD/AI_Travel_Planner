-- scripts/recalculate_budgets.sql
-- 用于一次性/定期重算所有 trips 和 itinerary_items 的预算与实际费用

BEGIN;

-- 可选：获取 advisory lock，防止与触发器或并发重算冲突
SELECT pg_advisory_lock(1001);

-- 1) 重算每个 itinerary_item 的 actual_cost
-- 先将所有项置为 0，随后用聚合结果覆盖有值的项（避免残留旧值）
UPDATE itinerary_items SET actual_cost = 0;

WITH item_sums AS (
  SELECT itinerary_item_id AS id, SUM(amount) AS total
  FROM expenses
  WHERE itinerary_item_id IS NOT NULL AND (status IS NULL OR status <> 'refunded')
  GROUP BY itinerary_item_id
)
UPDATE itinerary_items i
SET actual_cost = COALESCE(item_sums.total, 0)
FROM item_sums
WHERE i.id = item_sums.id;

-- 2) 重算每个 trip 的 estimated_budget_consumed 与 estimated_budget_remaining
WITH trip_sums AS (
  SELECT trip_id, SUM(amount) AS total
  FROM expenses
  WHERE trip_id IS NOT NULL AND (status IS NULL OR status <> 'refunded')
  GROUP BY trip_id
)
UPDATE trips t
SET
  estimated_budget_consumed = COALESCE(ts.total, 0),
  estimated_budget_remaining = CASE WHEN t.estimated_budget IS NULL THEN NULL ELSE (t.estimated_budget - COALESCE(ts.total,0)) END,
  last_budget_recalc_at = now()
FROM trip_sums ts
WHERE t.id = ts.trip_id;

-- 对于没有任何 expense 的 trips，确保 consumed=0，remaining 根据 estimated_budget 更新
UPDATE trips
SET estimated_budget_consumed = 0,
    estimated_budget_remaining = CASE WHEN estimated_budget IS NULL THEN NULL ELSE estimated_budget END,
    last_budget_recalc_at = now()
WHERE id NOT IN (
  SELECT DISTINCT trip_id FROM expenses WHERE trip_id IS NOT NULL AND (status IS NULL OR status <> 'refunded')
);

-- 释放 advisory lock 并提交事务
SELECT pg_advisory_unlock(1001);

COMMIT;
