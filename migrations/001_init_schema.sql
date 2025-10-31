-- Migration: 001_init_schema.sql
-- 初始化数据库 schema，用于本项目的 Postgres（Supabase）

-- 启用扩展以支持 gen_random_uuid
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- users
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id text UNIQUE,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  preferences jsonb DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- trips
CREATE TABLE IF NOT EXISTS trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES users(id) ON DELETE CASCADE,
  title text,
  description text,
  start_date date,
  end_date date,
  estimated_budget numeric,
  currency text DEFAULT 'CNY',
  status text DEFAULT 'draft',
  visibility text DEFAULT 'private',
  collaborators jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_trips_owner ON trips(owner_id);
CREATE INDEX IF NOT EXISTS idx_trips_dates ON trips(start_date, end_date);

-- itinerary_items
CREATE TABLE IF NOT EXISTS itinerary_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  day_index int,
  date date,
  start_time time,
  end_time time,
  title text,
  type text,
  description text,
  location jsonb,
  est_cost numeric,
  currency text DEFAULT 'CNY',
  sequence int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  extra jsonb DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_itinerary_trip_day ON itinerary_items(trip_id, date, sequence);

-- expenses: 现在可关联到 itinerary_items（若关联为特定项），或仅关联 trip
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  itinerary_item_id uuid REFERENCES itinerary_items(id) ON DELETE SET NULL,
  user_id uuid REFERENCES users(id),
  amount numeric NOT NULL,
  currency text DEFAULT 'CNY',
  category text,
  date date,
  note text,
  recorded_via text DEFAULT 'manual',
  raw_transcript text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expenses_trip ON expenses(trip_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_item ON expenses(itinerary_item_id);

-- generate_jobs
CREATE TABLE IF NOT EXISTS generate_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  status text DEFAULT 'queued',
  prompt jsonb,
  llm_response jsonb,
  validation_errors jsonb,
  attempts int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jobs_user ON generate_jobs(user_id, status);

-- prompts_history
CREATE TABLE IF NOT EXISTS prompts_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  trip_id uuid,
  direction text,
  content text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prompts_user ON prompts_history(user_id, created_at DESC);

-- memories
CREATE TABLE IF NOT EXISTS memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  key text,
  value jsonb,
  score numeric DEFAULT 1.0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_memories_user_key ON memories(user_id, key);

-- attachments
CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES users(id),
  url text,
  mime text,
  size int,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- 示例：为 Supabase 启用 RLS 的建议（注释，实际策略通过管理界面或 migration 脚本添加）
-- ANCHOR: RLS policies should be added in deployment environment
