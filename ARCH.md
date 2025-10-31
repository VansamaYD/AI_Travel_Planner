# AI Travel Planner — Architecture

## 概览

本项目采用单一仓库（monorepo）模式，使用 Next.js (React + TypeScript) 作为前端与轻量后端（API Routes）。数据与认证使用 Supabase（Postgres + Auth + Storage）。LLM 集成使用 OpenAI（provider 抽象），地图采用高德（AMap JS SDK），语音优先使用浏览器 Web Speech API，必要时支持科大讯飞 SDK。

高层组件：
- Web 客户端（Next.js）
- API 层（Next.js API Routes 或独立后端）
- Worker 服务（异步 job 处理 LLM，基于 Redis + BullMQ，可部署为单独容器）
- 数据库与存储（Supabase/Postgres + Storage）
- 第三方服务（OpenAI, AMap, iFlyTek）

## 数据流（简要）
1. 用户通过浏览器在 Web 客户端录入语音或文字。
2. 前端将转写文本发送到后端生成接口（/api/generate），后端创建生成 job 并入队。
3. Worker 从队列取出 job 并调用 LLM（OpenAI），使用 prompt 模板与 JSON Schema 约束输出，校验结果后写入数据库（trips, itinerary_items）。
4. 前端通过 REST API 或 Supabase Realtime 获取生成结果并展示在日历与地图上，用户可编辑并保存。

## 主要组件说明
- Next.js (apps/web)
  - 页面：登录/注册、仪表盘、行程详情、地图视图、设置
  - API Routes：/api/auth (可选)、/api/trips、/api/generate、/api/expenses
  - 语音组件：封装 Web Speech API，提供回退到 iFlyTek SDK
  - 地图组件：AMap 封装，用于 POI 搜索、路线绘制、标注

- Worker
  - 语言：Node.js
  - 功能：拉取生成任务、调用 LLM、结果校验与写库
  - 依赖：Redis (队列)、ajv (JSON Schema 验证)

- Supabase
  - 存储用户、行程、费用等结构化数据
  - Auth：用户注册/登录、JWT
  - Storage：行程图片/附件

## 异步与实时
- 使用 Redis + BullMQ 管理 LLM 生成任务，避免前端阻塞。
- 可选 Supabase Realtime 或 WebSocket 用于实时推送生成状态。

## 部署与 CI/CD
- Docker multi-stage 镜像（前端构建 -> 后端运行）
- GitHub Actions：lint -> test -> build -> docker build -> push to ACR（使用 GitHub Secrets 管理凭证）

## 安全要点
- 所有第三方密钥放在环境变量或 GitHub Secrets 中；UI 提供设置页以供用户输入可选第三方 key（仅在运行时使用）。
- 对 LLM 输出进行 JSON Schema 严格校验，避免注入无效/危险内容。

## 目录建议
- /apps/web
- /apps/api (可选)
- /workers/llm-worker
- /packages/llm
- /docker
- /scripts

---
Generated for stack: Next.js + Supabase + OpenAI + AMap + Web Speech API
