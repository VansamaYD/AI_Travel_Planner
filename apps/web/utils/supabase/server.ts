import { createClient } from '@supabase/supabase-js';

// For simple local testing we use the same public anon key on server side in this demo.
// In production you should use a SERVICE_ROLE key (never commit it to repo) and only call server-side.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 为构建时提供默认值，避免构建失败
// 实际运行时会从环境变量读取正确值
const safeUrl = url || 'https://placeholder.supabase.co';
const safeKey = key || 'placeholder-key';

if (!url || !key) {
  // 只在非构建环境显示警告
  if (process.env.NODE_ENV !== 'production' || process.env.SKIP_ENV_VALIDATION !== 'true') {
    console.warn('[supabase/server] missing SUPABASE env vars');
  }
}

export const supabaseServer = createClient(safeUrl, safeKey, {
  // server options could go here
});

export default supabaseServer;
