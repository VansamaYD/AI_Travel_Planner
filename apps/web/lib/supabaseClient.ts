import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 为构建时提供默认值，避免构建失败
// 实际运行时会从环境变量读取正确值
const safeUrl = supabaseUrl || 'https://placeholder.supabase.co';
const safeKey = supabaseAnonKey || 'placeholder-key';

if (!supabaseUrl || !supabaseAnonKey) {
  // We allow runtime fallback when env vars are missing; callers should handle empty client behavior.
  // 只在非构建环境（开发/生产运行时）显示警告
  if (typeof window !== 'undefined' || process.env.NODE_ENV !== 'production' || process.env.SKIP_ENV_VALIDATION !== 'true') {
    console.warn('[supabaseClient] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Supabase calls will fail if used.');
  }
}

export const supabase = createClient(safeUrl, safeKey);

export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export function onAuthChange(cb: (event: string, session: any) => void) {
  return supabase.auth.onAuthStateChange(cb);
}
