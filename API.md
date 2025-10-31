
# API 与 数据模型（完整版）

本文件为 AI Travel Planner 的 API 与数据契约总览，目标是：
- 明确定义后端 REST 接口（请求/响应/错误码）
- 提供可直接用于实现的 DB 表结构（Postgres DDL 示例）和字段语义
- 说明并发控制、分页、权限与审计策略
- 覆盖行程、行程条目、费用（支持绑定到具体行程项）、生成作业与用户记忆

仓库中相关文件：
- migrations/001_init_schema.sql（DDL）
- migrations/002_seed_example.sql（示例 seed）
- openapi.yaml（OpenAPI v3 草案）

假设：使用 Supabase（Postgres + Auth + Storage），LLM 使用 OpenAI，地图使用 AMap。文中 UUID 字段使用 gen_random_uuid() 生成。

---

## 设计要点（简要）

- 所有用户原始交互（prompts）与 LLM 返回都要存档，便于回放与审计
- 费用（expenses）可以直接关联至 `itinerary_items`，也可仅关联到 `trips`（非必填 itinerary_item_id）
- 每次 LLM 生成为一个异步 job（generate_jobs），worker 负责调用 LLM 并写回解析后的结构化行程
- 使用乐观锁（updated_at / ETag）避免并发覆盖

---

## 目录（快速跳转）
- 数据库表概览（DDL 摘要）
- 认证与通用规范
- REST API 端点细节（含示例）
- JSON Schema 与 LLM 返回校验
- 并发、分页与错误码
- RLS / 权限与审计建议

---

## 数据库表（核心摘要）

详细 DDL 已放在 `migrations/001_init_schema.sql`，此处为字段与语义摘要：

- `users`：保存 user profile（与 Supabase Auth 关联），字段：id, auth_user_id, email, display_name, preferences(jsonb)
- `trips`：行程元信息，字段：id, owner_id, title, start_date, end_date, estimated_budget, currency, status, visibility, collaborators(jsonb), metadata(jsonb)
- `itinerary_items`：行程条目，字段：id, trip_id, day_index, date, start_time, end_time, title, type, description, location(jsonb), est_cost, currency, sequence, extra(jsonb)
- `expenses`：费用记录，字段：id, trip_id, itinerary_item_id (nullable), user_id, amount, currency, category, date, note, recorded_via, raw_transcript
- `generate_jobs`：异步生成任务，字段：id, trip_id, user_id, status, prompt(jsonb), llm_response(jsonb), validation_errors(jsonb), attempts
- `prompts_history`：记录每次用户/系统消息，字段：id, user_id, trip_id, direction, content, metadata
- `memories`：用户长期记忆（偏好、过敏等），字段：id, user_id, key, value(jsonb), score
- `attachments`：附件元数据（文件存储在 Supabase Storage），字段：id, trip_id, uploaded_by, url, mime, size

索引建议：`trips(owner_id)`, `itinerary_items(trip_id, date, sequence)`, `expenses(trip_id, itinerary_item_id)`。

---

## 认证与通用规范

- 认证：前端使用 Supabase JS / OAuth 登录，后端接口通过 Authorization: Bearer <JWT> 验证。所有受保护接口返回 401 则表示未授权或 token 无效。
- 返回格式统一：

  { "status": "ok" | "error", "data": <any>, "error": {"code": "SOME_CODE", "message": "..."} }

- 时间/货币约定：所有时间使用 ISO 8601（时区显式），货币使用 ISO 4217（例如 CNY）。
- Content-Type: application/json

---

## REST API 端点（详尽）

注意：示例均为简化版本，真实实现应结合 `openapi.yaml`。

认证头：

  Authorization: Bearer <JWT>


### POST /api/trips
创建新行程（owner 为当前用户）

请求体（示例）：

```json
{
  "title":"东京亲子美食游",
  "description":"适合带孩子的 5 天路线",
  "start_date":"2025-12-10",
  "end_date":"2025-12-15",
  "estimated_budget":10000,
  "currency":"CNY",
  "prefs": {"interests":["美食","动漫"], "travel_with":"child"}
}
```

成功响应 201：

```json
{ "status":"ok", "data": { "trip": {"id":"...","owner_id":"...","title":"...","start_date":"...","updated_at":"..." } } }
```

错误：400 (参数错误)、401 (未授权)


### GET /api/trips
列出当前用户可见的行程（owner 或 collaborator）。支持分页与过滤。

查询参数：
- limit (默认 20), offset, q (模糊搜索 title/description), status, start_date,end_date

响应示例：

```json
{ "status":"ok", "data": { "trips": [ /* trip array */ ], "total": 42 } }
```


### GET /api/trips/{id}
获取行程详情，支持 include 参数控制关联资源加载

参数： include=items,expenses,attachments,prompts

响应示例（包含 items 与 expenses）：

```json
{
  "status":"ok",
  "data": {
  "trip": { "id":"...","title":"...","start_date":"...","days":[ {"date":"...","items":[/*...*/]} ], "expenses":[/*...*/] /* expenses 可包含 itinerary_item_id 字段以绑定到具体行程项 */ }
  }
}
```


### PUT /api/trips/{id}
替换更新行程元信息。要求带 If-Unmodified-Since 或 If-Match(ETag) 进行乐观并发控制。

请求示例：

```http
If-Unmodified-Since: 2025-10-31T12:00:00Z
```

Body：完整 trip 元信息（同创建）。返回 200 并带最新 trip 对象；若冲突返回 409，并返回最新资源。


### PATCH /api/trips/{id}
局部更新（JSON Merge Patch 风格），带上 If-Unmodified-Since 做冲突检测。


### DELETE /api/trips/{id}
删除行程（建议逻辑删除，可通过 metadata 或专用 history 表保存历史）。返回 204。


### POST /api/trips/{id}/g enerate  （注意实际路径：/api/trips/{id}/generate 或 /api/generate）
提交 LLM 生成任务（异步）——建议使用 /api/trips/{id}/generate

请求体示例：

```json
{
  "user_input":"我想去日本，5 天，预算 1 万元，喜欢美食和动漫，带孩子",
  "mode":"detailed", 
  "options": { "language":"zh-CN" }
}
```

响应 202：

```json
{ "status":"ok", "data": { "job_id":"..." } }
```

生成流程（后端说明）：
1) 入库 `generate_jobs` (status=queued)，并在 `prompts_history` 记录 user prompt
2) Worker 拉取任务，调用 LLM（OpenAI）并把原始 `llm_response` 存回 `generate_jobs`
3) Worker 解析 JSON -> 写入 `itinerary_items`/`expenses` 等表；若解析失败记录 `validation_errors` 并 status=failed
4) 前端通过 GET /api/generate/{job_id} 或 Supabase Realtime 获取结果


### GET /api/generate/{job_id}
获取作业状态与结果，若 done 返回解析后的差异或完整 trip。响应示例：

```json
{ "status":"ok", "data": { "job_id":"...", "status":"done", "result": { /* parsed trip */ } } }
```


### POST /api/trips/{id}/itinerary_items
在指定行程中创建一条行程项（可用于 LLM 结果拆分后写入）

请求体示例：

```json
{
  "day_index":0,
  "date":"2025-12-10",
  "start_time":"09:00:00",
  "end_time":"11:00:00",
  "title":"浅草寺",
  "type":"poi",
  "location": {"lat":35.7148, "lng":139.7967, "address":"浅草 2-3-1"},
  "est_cost":0,
  "currency":"CNY",
  "sequence":1,
  "extra": {"poi_id":"amap_12345"}
}
```

响应 201：返回完整的 `ItineraryItem` 对象。


### PATCH /api/trips/{trip_id}/itinerary_items/{item_id}
更新单条行程项（支持局部更新、乐观锁）。


### DELETE /api/trips/{trip_id}/itinerary_items/{item_id}
删除（建议逻辑删除：在 `extra.deleted=true` 或 move 到 history 表）。返回 204。


### POST /api/trips/{id}/expenses
添加费用记录，关键点：可以把费用绑定到 `itinerary_item_id`，从而紧密映射到每天/时间段的预算。

请求示例（关联到行程项）：

```json
{
  "itinerary_item_id":"22222222-2222-2222-2222-222222222223",
  "user_id":"00000000-0000-0000-0000-000000000001",
  "amount":120,
  "currency":"CNY",
  "category":"meal",
  "date":"2025-12-10",
  "note":"浅草拉面",
  "recorded_via":"voice",
  "raw_transcript":"一家好吃的拉面店，花了 120 元"
}
```

成功响应 201，返回 `expense` 对象，并建议后端触发 trip 的预算 recalculation（更新 trips.estimated_budget_consumed 等元信息，如果你实现此字段）。


### GET /api/trips/{id}/expenses
列出行程相关费用，支持 ?start_date=&end_date=&category=


### POST /api/attachments
上传附件元数据（文件先上传到 Supabase Storage，再写附件表），返回附件对象。


### GET /api/users/{id}/memories
获取用户长期记忆（用于 prompt 个性化），支持分页与筛选 key 前缀。


### POST /api/users/{id}/memories
新增或更新 memory（key/value）。示例：

```json
{ "key":"diet.preferences", "value": {"no_pork":true, "likes_spicy":false} }
```


### GET /api/prompts/{id}
管理员/用户可查看单次 prompt 与 LLM 原始返回（审计）。


---

## JSON Schema 与 LLM 输出校验

建议后端使用 `ajv` (Node) 对 LLM 返回进行 JSON Schema 校验（schema 存于 /packages/llm/schemas 或独立目录）。失败策略：
1. 将原始 llm_response 存至 `generate_jobs.llm_response` 和 `prompts_history`
2. 在 `generate_jobs.validation_errors` 写明错误并尝试一次更严格的 prompt 重试
3. 若仍失败，将 job 标记为 failed 并返回给前端由用户手动编辑

简化版 LLM 输出 schema 已存在于仓库顶部 `API.md` 早期版本，可复制到 `openapi.yaml` 或单独 schema 文件。

---

## 并发、分页、错误码（汇总）

- 分页：支持 limit/offset 或 cursor，建议使用 cursor（性能更好）
- 并发控制：使用 `If-Unmodified-Since` (基于 updated_at RFC 1123/ISO) 或 `If-Match: <etag>`，冲突返回 409，并返回最新资源和冲突字段
- 常见错误码：
  - 400 Bad Request：参数/格式错误
  - 401 Unauthorized：未授权或 token 过期
  - 403 Forbidden：无权限访问资源
  - 404 Not Found：资源不存在
  - 409 Conflict：并发冲突
  - 422 Unprocessable Entity：LLM 结果校验失败（validation_errors 在 generate_jobs）
  - 500 Internal Server Error：服务端异常

---

## RLS / 权限与审计建议（Supabase）

- 对 `trips` 启用 RLS：仅允许 owner 或 collaborators 读取/写入
- 对 `itinerary_items`、`expenses`、`attachments` 基于 trip 的访问控制过滤（JOIN trips 判定权限）
- `prompts_history` 仅允许用户本人读取，管理员有审计权限（管理员权限单独管控）

示例（伪 SQL policy）：

```sql
-- trips: 仅 owner 或在 collaborators 中的用户可查询
CREATE POLICY "trip_select" ON trips FOR SELECT USING (
  owner_id = auth.uid() OR (collaborators::jsonb \? auth.uid())
);
```

注意：Supabase 的 RLS policy 需考虑 JSONB collaborators 的角色结构（例如 {"user_id":"role"}）。

---

## 审计、备份与合规

- prompts_history 与 generate_jobs 需保留完整记录（至少 30 天或课程要求），并限制导出权限
- 数据库定期备份，保存策略依据作业要求

---

## 示例流程（端到端）

用例：用户通过语音提交需求并保存费用

1. 前端通过 Web Speech API 获取转写文本，展示给用户并允许编辑
2. 前端调用 POST /api/trips 创建 trip（或在已有 trip 上 POST /generate）
3. 前端调用 POST /api/trips/{id}/generate 提交生成 job，后端写 `generate_jobs` 且在 `prompts_history` 保存原始
4. Worker 完成后向 `itinerary_items` 与 `expenses` 写入结构化条目（若 LLM 提供了费用分项），并更新 trip 状态
5. 当用户在行程项中用语音记录消费时，客户端创建 expense 并将 `itinerary_item_id` 设为当前项的 id

示例：将费用与 itinerary_item 绑定的 expense 请求见上文 `POST /api/trips/{id}/expenses`。

---

## 下一步建议（可选）

我可以为你做以下任意项（或全部）：
- A: 将 `migrations/001_init_schema.sql` 转成 Prisma schema + migration（便于在 Node.js/Next.js 项目中直接使用）
- B: 把 `openapi.yaml` 扩展为完整 spec（添加缺失的路径、请求/响应示例与 components schemas）
- C: 生成一个最小项目骨架（Next.js + Supabase 集成，包含 migrations 脚本与 Dockerfile）

请从 A/B/C 中选择一项或组合（例如 A+B）。

---

## 概览与设计目标

目标是保证：
- 所有用户数据和历史会话/生成结果可追溯（保存原始 prompt 与 LLM 返回）
- 行程数据细粒度到“天/时间段/地点/预算项”，方便按需检索和修改
- 支持多份行程、多人协作（共享/只读权限）与审计
- 使用多表设计，避免单表 JSON 黑盒，便于统计与索引

---

## 数据库表（核心）

下面给出主要表的 DDL（Postgres）示例与字段解释。字段名与类型可依据 ORM 调整。

注意：示例使用 snake_case。

### users

用户基本信息（Supabase Auth 保存用户凭证，表中保存 profile）

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id text UNIQUE, -- Supabase Auth 的用户 ID
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  preferences jsonb DEFAULT '{}'
);
```

索引：email、auth_user_id

### trips

一次旅行计划的元信息（每次“聊天”或规划会生成一条 trip）

```sql
CREATE TABLE trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES users(id) ON DELETE CASCADE,
  title text,
  description text,
  start_date date,
  end_date date,
  estimated_budget numeric, -- 以主要货币为准
  currency text DEFAULT 'CNY',
  status text DEFAULT 'draft', -- draft|generated|confirmed|archived
  visibility text DEFAULT 'private', -- private|shared|public
  collaborators jsonb DEFAULT '[]', -- list of user ids with access and roles
  -- 自动聚合字段：由数据库触发器或后端任务维护，表示已消费预算与剩余预算（可为 null，表示未计算）
  estimated_budget_consumed numeric DEFAULT 0,
  estimated_budget_remaining numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);
```

索引：owner_id, start_date, end_date

### itinerary_items

行程条目，关联到 trips。每个 item 表示某一天的某个时间段动作（交通/景点/餐饮/住宿等）

```sql
CREATE TABLE itinerary_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  day_index int, -- 0..n-1，表示第几天
  date date, -- 具体日期
  start_time time, -- 可为空
  end_time time, -- 可为空
  title text,
  type text, -- transport|accommodation|poi|meal|activity|note
  description text,
  location jsonb, -- {"lat":..., "lng":..., "address":"...", "poi_id":"..."}
  est_cost numeric,
  -- 实际花销（由 expenses 表变更触发器维护，表示已与该 item 关联的费用总和）
  actual_cost numeric DEFAULT 0,
  currency text DEFAULT 'CNY',
  sequence int DEFAULT 0, -- 同日内排序
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  extra jsonb DEFAULT '{}' -- 用于存放供应商信息、票号等复杂结构
);
CREATE INDEX idx_itinerary_trip_day ON itinerary_items(trip_id, date, sequence);
```

### expenses

费用记录，用于跟踪花销和预算对比

```sql
CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  -- 可选地关联到具体的行程条目（itinerary_items.id），以便把费用精确映射到某天/某时间段
  itinerary_item_id uuid NULL REFERENCES itinerary_items(id) ON DELETE SET NULL,
  user_id uuid REFERENCES users(id),
  amount numeric NOT NULL,
  currency text DEFAULT 'CNY',
  category text, -- transport|meal|accommodation|ticket|other
  date date,
  note text,
  payer_id uuid NULL REFERENCES users(id), -- 记录实际付款人（可选）
  status text DEFAULT 'pending', -- pending|cleared|refunded
  payment_method text NULL,
  vendor text NULL,
  recorded_via text DEFAULT 'manual', -- manual|voice
  raw_transcript text, -- 若通过语音录入，存原始转写
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_expenses_trip ON expenses(trip_id, date);

## 预算与数据库触发器（自动聚合）

为了保证行程和行程项中的预算聚合（例如 `itinerary_items.actual_cost` 与 `trips.estimated_budget_consumed`）在费用变更时保持一致，我们在仓库中提供了一个针对该功能的迁移与脚本：

- migrations/003_budget_triggers.sql：包含 ALTER TABLE（为 expenses 添加 itinerary_item_id、为 itinerary_items 添加 actual_cost、为 trips 添加 estimated_budget_consumed / estimated_budget_remaining）以及 PL/pgSQL 函数和触发器（在 expenses INSERT/UPDATE/DELETE 后，自动重计算对应 itinerary_item 的 actual_cost 并进而重算 trips 的 estimated_budget_consumed）。
- scripts/recalculate_budgets.sql：一份可在后台或管理员界面运行的全量重算脚本，用于数据修复或批量校正（建议在部署后初次运行以确保旧数据一致）。

触发器设计要点：
- 在 expenses 表的 AFTER INSERT/UPDATE/DELETE 触发器中，按关联的 itinerary_item_id 进行分组汇总，写入对应 itinerary_items.actual_cost（如果没有关联 itinerary_item_id，可只更新 trips 聚合）。
- 在更新 itinerary_items.actual_cost 后，同步更新 trips.estimated_budget_consumed（SUM 所有该 trip 下 expenses.amount）并计算 estimated_budget_remaining = trips.estimated_budget - estimated_budget_consumed（若 estimated_budget 为 NULL 则跳过或设为 NULL）。
- 为避免重复计算与性能问题，触发函数可采用局部聚合与管道化更新（先计算受影响 item 列表，再批量更新 item 与 trip）。

注意事项：
- 触发器提供强一致性，但对大批量导入可能造成性能开销，建议在导入时暂时禁用触发器或使用批量重算脚本。若使用 Supabase Edge Functions 或后端任务，也可选择在写入 expenses 后由后端触发一次异步重算（事务外）。

示例：我们在仓库中已实现 `migrations/003_budget_triggers.sql`，并在 `scripts/recalculate_budgets.sql` 中保留了一个可执行的全量重算 SQL。

### POST /api/trips/:id/budget/recalculate

用途：提供一个由前端或管理员触发的手动重算端点，执行 `scripts/recalculate_budgets.sql` 针对单个 trip 的重算，返回新的聚合值。

请求：无 body（受保护端点，仅 owner 或管理员可调用）

响应示例 200：

```json
{ "status":"ok", "data": { "trip_id": "...", "estimated_budget_consumed": 1234.5, "estimated_budget_remaining": 8765.5 } }
```

错误：401（未授权），403（无权限），500（重算失败，返回详细错误）。

实现建议：该端点应在事务外调用重算脚本（或使用 DB 的函数），并在长耗时任务中返回 202 + job_id 的异步执行也可接受（前端可轮询 job 状态）。

### generate_jobs
```

### generate_jobs

异步任务表：记录每次 LLM 生成作业的状态与输入/输出

```sql
CREATE TABLE generate_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  status text DEFAULT 'queued', -- queued|running|done|failed
  prompt jsonb, -- 原始 prompt + metadata
  llm_response jsonb, -- 原始 LLM 返回
  validation_errors jsonb, -- 若有 schema 校验错误
  attempts int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_jobs_user ON generate_jobs(user_id, status);
```

### prompts_history

保存用户每次与系统交互的原始记录（用于审计、回放、个人记忆）

```sql
CREATE TABLE prompts_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  trip_id uuid NULL,
  direction text, -- user|system
  content text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_prompts_user ON prompts_history(user_id, created_at DESC);
```

### memories (user memory)

用于存储用户偏好或长期记忆（例如：常去城市、饮食偏好、过敏信息）

```sql
CREATE TABLE memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  key text,
  value jsonb,
  score numeric DEFAULT 1.0, -- 用于权重/优先级
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX uq_memories_user_key ON memories(user_id, key);
```

### attachments

行程的图片/票据等附件元数据（实际文件存储建议使用 Supabase Storage）

```sql
CREATE TABLE attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES users(id),
  url text,
  mime text,
  size int,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
```

---

## RLS（Row Level Security）与访问控制建议（Supabase 场景）

- 对 `trips` 表启用 RLS，仅允许 owner 或 collaborators 访问/修改：
  - policy: 允许 owner_id = auth.uid() 的行读写
  - policy: 允许 JSONB 中 collaborators 含 auth.uid() 的行为读/写（需字段记录 role）
- 对 `itinerary_items`, `expenses`, `attachments` 应限制为关联 trip 可访问
- `prompts_history` 默认仅 user 可见，管理员可审计

示例（伪 SQL）：

```sql
-- trips: 仅 owner 或 collaborators 可 select
CREATE POLICY "trip_select" ON trips FOR SELECT USING (
  owner_id = auth.uid() OR (metadata->'collaborators')::jsonb ? auth.uid()
);
```

---

## REST API 详细契约（请求/响应/错误/并发）

统一规则：
- 所有受保护接口需要 Authorization: Bearer <JWT>
- 返回格式统一：{ status: "ok"|"error", data: ..., error?: {code, message} }
- 列表接口支持分页：?limit=20&offset=0 或 cursor 分页
- 所有写接口返回最新资源对象与 etag-like 字段（updated_at 或 version）用于乐观并发控制

### Auth（由 Supabase 管理）
- 前端推荐使用 Supabase JS 直接处理登录/注册/会话，服务器侧不需处理密码。

### POST /api/trips
- 创建行程
- 请求：

```json
{
  "title":"东京亲子美食游",
  "start_date":"2025-12-10",
  "end_date":"2025-12-15",
  "prefs": {"interests":["美食","动漫"], "travel_with":"child"},
  "estimated_budget":10000,
  "currency":"CNY",
  "visibility":"private"
}
```

- 响应 201：

```json
{
  "status":"ok",
  "data": { "trip": { ...trip fields... } }
}
```

错误码示例：
- 400 BAD REQUEST：字段缺失或格式错误
- 401 UNAUTHORIZED：未登录或 token 无效

### GET /api/trips
- 功能：列举用户可见的行程（owner 或被共享）
- 支持参数：?limit=&offset=&q=（按 title 或 description 搜索）

响应 200：{ status: 'ok', data: { trips: [...], total: n } }

### GET /api/trips/:id
- 功能：获取行程详情（可选 ?include=items,expenses,attachments）
- 响应：包含 trip 与相关资源数组

### PUT /api/trips/:id
- 功能：更新行程元信息（乐观锁）
- 请求头：If-Unmodified-Since: <updated_at timestamp> 或 If-Match: <version>
- 若条件不满足返回 409 Conflict 并提供最新资源

### POST /api/trips/:id/generate
- 功能：提交 LLM 生成作业（异步）
- 请求：{ user_input: string, mode?: 'draft'|'detailed', options?: {} }
- 响应 202：{ status:'ok', data: { job_id } }

服务端处理流程：
1. 将作业写入 `generate_jobs`（status=queued），把 prompt 存入 prompts_history
2. Worker 拉取任务，调用 LLM（OpenAI），把原始 llm_response 写入 generate_jobs.llm_response
3. 校验并解析后写入 trips/itinerary_items/expenses 如有
4. job.status = done 或 failed，将结果通过 Supabase Realtime 或 API 通知前端

错误处理：若 LLM 返回无法解析的 JSON，worker 在 generate_jobs.validation_errors 写具体错误并 status=failed

### GET /api/generate/:job_id
- 返回 job 状态与可能的结果（若 done，包含解析后的 trip 对象或差异 patch）

### POST /api/trips/:id/itinerary_items
- 创建/插入一条行程项
- 请求：

```json
{
  "day_index":0,
  "date":"2025-12-10",
  "start_time":"09:00",
  "end_time":"11:00",
  "title":"浅草寺",
  "type":"poi",
  "location": {"lat":35.7148, "lng":139.7967, "address":"浅草 2-3-1"},
  "est_cost":50,
  "currency":"CNY",
  "extra": {"poi_id":"amap_12345"}
}
```

响应 201：返回插入的 item

### PATCH /api/trips/:trip_id/itinerary_items/:item_id
- 局部更新，采用乐观锁字段 updated_at

### DELETE /api/trips/:trip_id/itinerary_items/:item_id
- 删除条目（逻辑删除建议：将 extra.deleted = true 或迁移到历史表）

### POST /api/trips/:id/expenses
- 同之前：支持 recorded_via=voice 时保存 raw_transcript

### GET /api/users/:id/memories
- 获取用户长期记忆（偏好）

### POST /api/users/:id/memories
- 添加/更新记忆（key/value）用于 LLM prompt 个性化

### GET /api/prompts/:id
- 查看某次 prompt 与原始 LLM 返回（审计）

### POST /api/attachments
- 上传附件元数据（实际文件通过 Supabase Storage 上传后返回 url 并写入表）

---

## JSON 示例：完整 trip object（建议用于前端渲染/存储）

```json
{
  "id":"trip_123",
  "owner_id":"user_abc",
  "title":"东京亲子美食游",
  "start_date":"2025-12-10",
  "end_date":"2025-12-15",
  "estimated_budget":10000,
  "currency":"CNY",
  "status":"generated",
  "days":[
    {
      "date":"2025-12-10",
      "items":[
        {
          "id":"item_1",
          "type":"flight",
          "title":"北京 - 东京",
          "start":"2025-12-10T08:00:00+08:00",
          "end":"2025-12-10T12:30:00+09:00",
          "location":null,
          "est_cost":2000,
          "actual_cost":2000,
          "currency":"CNY",
          "notes":"建议选择直飞"
        },
        {
          "id":"item_2",
          "type":"poi",
          "title":"浅草寺",
          "start":"2025-12-10T15:00:00+09:00",
          "end":"2025-12-10T16:30:00+09:00",
          "location":{"lat":35.7148,"lng":139.7967,"address":"浅草 2-3-1"},
          "est_cost":0,
          "actual_cost":120,
          "currency":"CNY",
          "notes":"适合带孩子"
        }
      ]
    }
  ],
  "expenses":[
    {
      "id":"exp_1",
      "itinerary_item_id":"item_2",
      "user_id":"00000000-0000-0000-0000-000000000001",
      "payer_id":"00000000-0000-0000-0000-000000000001",
      "amount":120,
      "currency":"CNY",
      "category":"meal",
      "date":"2025-12-10",
      "note":"浅草拉面",
      "vendor":"浅草拉面店",
      "payment_method":"credit_card",
      "status":"cleared",
      "recorded_via":"manual"
    }
  ],
  "estimated_budget_consumed":2120,
  "estimated_budget_remaining":7880,
  "metadata":{},
  "created_at":"2025-10-31T12:00:00Z",
  "updated_at":"2025-10-31T12:10:00Z"
}
```

---

## 并发与冲突解决策略

- 乐观锁：写操作要求带上 If-Unmodified-Since 或 If-Match（基于 updated_at 或 version），若冲突返回 409 并附带最新资源。
- 合并策略：前端可在冲突时展示差异（字段级），让用户选择合并或覆盖。
- 批量编辑：对批量修改提供事务接口（后端在一次事务中提交），并记录变更历史（audit trail）

---

## 备份、审计与合规

- 定期备份 Postgres（建议每日增量、每周全量），并保留 30 天快照
- prompts_history 与 generate_jobs 为审计关键表，应限制访问并记录管理员操作日志

---

## 迁移与示例工具

- 推荐使用 prisma / knex / flyway 等进行 schema migration 并版本化
- 提供 seeds 脚本用于快速演示数据

---


