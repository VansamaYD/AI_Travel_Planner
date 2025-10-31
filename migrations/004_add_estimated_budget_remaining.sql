-- Migration: 004_add_estimated_budget_remaining.sql
-- 添加 trips.estimated_budget_remaining 列并进行回填（若尚未存在）

ALTER TABLE IF EXISTS trips
  ADD COLUMN IF NOT EXISTS estimated_budget_remaining numeric;

-- 回填已存在的 trips：若有 estimated_budget_consumed 则按 estimated_budget - consumed 计算 remaining
UPDATE trips
SET estimated_budget_remaining = CASE WHEN estimated_budget IS NULL THEN NULL ELSE (estimated_budget - COALESCE(estimated_budget_consumed,0)) END,
    last_budget_recalc_at = now()
WHERE TRUE;

-- NOTE: 运行此 migration 后，可运行 scripts/recalculate_budgets.sql 以确保 item.actual_cost 与 trip.estimated_budget_consumed 的全面一致性。
