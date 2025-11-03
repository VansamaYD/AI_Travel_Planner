import { createClient } from '@supabase/supabase-js';

// 在客户端和服务器端都支持读取环境变量
// Next.js 会在构建时将 NEXT_PUBLIC_* 变量嵌入到客户端代码中
// 注意：在浏览器端，只能访问 NEXT_PUBLIC_* 变量，不能访问其他环境变量
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 为构建时提供默认值，避免构建失败
// 实际运行时会从环境变量读取正确值
const safeUrl = supabaseUrl || 'https://placeholder.supabase.co';
const safeKey = supabaseAnonKey || 'placeholder-key';

// 只在真正缺少配置时显示警告
// 检查是否使用了占位符值或完全为空
const isUsingPlaceholder = 
  !supabaseUrl || 
  supabaseUrl === 'https://placeholder.supabase.co' ||
  !supabaseAnonKey ||
  supabaseAnonKey === 'placeholder-key';

if (isUsingPlaceholder) {
  // 只在浏览器端显示警告（避免服务器端日志污染）
  if (typeof window !== 'undefined') {
    console.warn('[supabaseClient] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Supabase calls will fail if used.', {
      hasUrl: !!supabaseUrl && supabaseUrl !== 'https://placeholder.supabase.co',
      hasKey: !!supabaseAnonKey && supabaseAnonKey !== 'placeholder-key',
      urlValue: supabaseUrl ? (supabaseUrl.substring(0, 30) + '...') : 'missing'
    });
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
