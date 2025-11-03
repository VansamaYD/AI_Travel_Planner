import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 为构建时提供默认值，避免构建失败
// 实际运行时会从环境变量读取正确值
const safeUrl = url || 'https://placeholder.supabase.co';
const safeKey = anonKey || 'placeholder-key';

if (!url || !anonKey) {
  // 只在非构建环境显示警告
  if (typeof window !== 'undefined' || process.env.NODE_ENV !== 'production' || process.env.SKIP_ENV_VALIDATION !== 'true') {
    console.warn('[supabase/client] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set');
  }
}

export const supabaseClient = createClient(safeUrl, safeKey);

export default supabaseClient;
