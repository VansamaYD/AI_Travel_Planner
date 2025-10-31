## PR: 改进预算触发器与添加全量重算脚本

目标
- 审计并改进 `migrations/003_budget_triggers.sql`，保证 `expenses` 与 `itinerary_items`/`trips` 之间的数据一致性，计算并写回 `estimated_budget_remaining`，并避免常见的不一致场景。
- 添加一个可执行的全量重算脚本 `scripts/recalculate_budgets.sql`，便于在部署后对历史数据进行修复或批量校正。

变更的文件
- `migrations/003_budget_triggers.sql` (已修改)
  - 改进 `recalc_trip_budget`：先计算 `v_consumed`，再写回 `estimated_budget_consumed` 与 `estimated_budget_remaining`，并设置 `last_budget_recalc_at`。
  - 新增 `expenses_before_change()` BEFORE INSERT/UPDATE 触发器：当 `itinerary_item_id` 存在时，自动填充或校验 `trip_id` 与 item 的 `trip_id` 一致，防止跨行程不一致数据。
  - 保留 `expenses_after_change()` AFTER trigger 用于逐行触发重算（可按需改为异步批量策略）。
  - 将 `expenses.status` 默认值调整为 `'pending'`（与文档一致）。

- `scripts/recalculate_budgets.sql` (已新增/更新)
  - 全量重算：重新计算 `itinerary_items.actual_cost`，重新计算 `trips.estimated_budget_consumed` 与 `estimated_budget_remaining`，并设置 `last_budget_recalc_at`。
  - 使用事务与 `pg_advisory_lock` 来降低并发冲突风险。

- `openapi.yaml`、`API.md`（此前已同步更新）
  - 将 OpenAPI schema 与 API 文档与数据库 DDL 对齐（增加 `actual_cost`、`estimated_budget_consumed`、`estimated_budget_remaining` 与 `expenses` 的辅助字段等），并为 `GET /api/trips/{id}` 添加示例响应。

变更原因与好处
- 防止不一致：`expenses_before_change` 在写入前验证/填充 `trip_id`，阻止了 expense 指向不同 trip 的 item，从源头上降低数据错误。
- 数据可观测性：将 `estimated_budget_remaining` 写回 `trips`，让查询端（前端、报表）能快速读取无需额外计算。
- 恢复能力：提供 `scripts/recalculate_budgets.sql`，便于在批量导入或回滚后立即恢复聚合数据。

数据库迁移与运行步骤（建议在 staging 先测试）

1) 备份

在真实生产环境执行前请务必先备份数据库（快照或导出）。

2) 在 staging 环境执行迁移

假设使用 psql：

```
psql -h <HOST> -U <USER> -d <DB> -f migrations/003_budget_triggers.sql
```

3) 运行全量重算脚本（如果需要修复历史数据）

```
psql -h <HOST> -U <USER> -d <DB> -f scripts/recalculate_budgets.sql
```

验证（示例 SQL）

- 验证单个 item 的 actual_cost:

```
SELECT id, actual_cost FROM itinerary_items WHERE id = '<item-id>';
SELECT SUM(amount) FROM expenses WHERE itinerary_item_id = '<item-id>' AND (status IS NULL OR status <> 'refunded');
```

- 验证 trip 的聚合:

```
SELECT id, estimated_budget, estimated_budget_consumed, estimated_budget_remaining, last_budget_recalc_at FROM trips WHERE id = '<trip-id>';
SELECT SUM(amount) FROM expenses WHERE trip_id = '<trip-id>' AND (status IS NULL OR status <> 'refunded');
```

回滚策略
- 若迁移导致问题，可用备份恢复整库（推荐）。
- 若需要回退单个变更，可手动编辑/撤销已添加的列与触发器（慎用）。示例：

```
-- 删除 BEFORE trigger
DROP TRIGGER IF EXISTS trg_expenses_before_change ON expenses;
DROP FUNCTION IF EXISTS expenses_before_change();

-- 删除 AFTER trigger
DROP TRIGGER IF EXISTS trg_expenses_after_change ON expenses;
DROP FUNCTION IF EXISTS expenses_after_change();
```

风险与性能注意
- 当前实现仍为 per-row AFTER trigger，会在每次 expense 写入时执行聚合查询。对于高吞吐或批量导入场景，这会成为性能瓶颈。
- 推荐在大批量导入时：
  1) 临时禁用触发器 -> 批量导入 -> 运行 `scripts/recalculate_budgets.sql`。
  2) 或将 AFTER trigger 的逻辑改为将受影响的 trip_id/item_id 写入轻量队列表（pending_recalc 表），并由后台 worker 批量处理（示例实现可在后续 PR 中提供）。

后续建议（可分多步实现）
1. （短期）将 `scripts/recalculate_budgets.sql` 纳入部署文档与运维 playbook，作为数据修复工具。
2. （中期）实现异步批量重算：替换 per-row AFTER trigger 为写入 `pending_recalc` 的轻量触发器，并在后台运行 worker 批量更新（降低锁竞争）。我可以提供一个 Node.js worker 示例和 DB schema（pending_recalc 表 + polling worker）。
3. （长期）在 CI 中增加一个 SQL 验证脚本（测试迁移），确保在未来变更中不引入回归。

PR 描述建议（可直接复制到 GitHub PR body）

```
Summary:
- Audit and improve budget triggers: ensure integrity between expenses, itinerary_items and trips; compute and store estimated_budget_remaining; add before-trigger to validate/fill trip_id when itinerary_item_id is set.
- Add scripts/recalculate_budgets.sql to allow full recalculation of item.actual_cost and trip aggregates.

Files changed:
- migrations/003_budget_triggers.sql
- scripts/recalculate_budgets.sql
- openapi.yaml (schemas updated)
- API.md (examples updated)

Testing steps:
1. Run migrations on staging.
2. Insert/update/delete expenses with/without itinerary_item_id and verify item.actual_cost and trip aggregates.
3. Run full recalculation script and verify consistency.

Notes:
- Keep triggers as-is for now; consider async bulk recalculation for high-throughput scenarios.
```

---
Created by automated repo assistant as PR notes for migration 003 and recalculation script.
