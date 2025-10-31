# AI Travel Planner — Web Prototype

This folder contains a minimal Next.js prototype used for UI/demo purposes.

Run locally:

```bash
cd apps/web
npm install
npm run dev
```

Notes:
- This prototype uses a mock API (`lib/mockApi.ts`) and demo data. Replace with real API calls when backend ready.
- Voice recording uses the browser Web Speech API; make sure to run in a secure context (https or localhost) and use a browser that supports it (Chrome, Edge).
# Supabase wiring

This prototype now includes a Supabase adapter. To enable real API calls:

1. Create a Supabase project and the database schema (you can re-use the SQL migrations under `migrations/`).
2. In your local environment, set the following env vars (for Next.js client):

```bash
export NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
```

3. Restart the dev server (`npm run dev`). The app will call Supabase for `getTrips`, `getTrip` and `addExpense` if env vars are present. If they are not present, the app will fall back to the demo mock data.

Notes on auth:
- The header includes a minimal email/password sign-in control that uses Supabase Auth. For a demo, create a user in your Supabase project's Auth > Users panel, or enable signups.
- This is minimal wiring for prototype/demo; for production you should add proper session handling, RLS policies and server-side protections.
# AI Travel Planner — Web (Minimal Skeleton)

这是一个最小的 Next.js 前端骨架，用于演示和开发。

快速开始（本地）：

```bash
cd apps/web
npm install
npm run dev
```

项目包含一个健康检查 API 和一个首页示例。请在开发时按需接入 Supabase、AMap SDK 与语音功能。
