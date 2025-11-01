import type { NextApiRequest, NextApiResponse } from 'next';
import { signInWithEmail } from '../../../lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';

// Simple dev login endpoint. If Supabase auth is configured, attempt sign in.
// Otherwise fallback to a mock user id for local dev.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    // If supabase is configured, use it
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const resp = await signInWithEmail(email, password);
      // signInWithEmail returns { data, error }
      // If error: DO NOT fall back to a dev id — return a clear auth error
      // @ts-ignore
      if (resp.error) {
        console.warn('[dev login] supabase signIn failed, returning auth error', resp.error);
        // Return a user-friendly message in Chinese for failed credentials
        const errBody: any = { error: '账号或密码错误' };
        if (process.env.NODE_ENV !== 'production') errBody._raw = resp;
        return res.status(401).json(errBody);
      }

      // success path
      // @ts-ignore
      const userId = resp?.data?.user?.id || resp?.data?.user?.user?.id || null;
      if (userId) {
        try {
          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          let appUserId: string | null = null;
          if (serviceKey && process.env.NEXT_PUBLIC_SUPABASE_URL) {
            const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey);
            try {
              const upsert = await admin
                .from('users')
                .upsert({ auth_user_id: String(userId), email, display_name: email.split('@')[0] }, { onConflict: 'auth_user_id' })
                .select('id,auth_user_id')
                .maybeSingle();
              // @ts-ignore
              if (upsert?.data && upsert.data.id) appUserId = upsert.data.id;
              // @ts-ignore
              if (!appUserId && upsert?.id) appUserId = upsert.id;
            } catch (e) {
              console.warn('[dev login] admin upsert/select failed', e);
            }
          }

          // If we still don't have an app user id, try using the user's access token
          // to query/insert the profile (works if your RLS policies allow it).
          if (!appUserId) {
            try {
              // @ts-ignore
              const accessToken = resp?.data?.session?.access_token || resp?.data?.access_token || null;
              if (accessToken && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
                const userClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
                  global: { headers: { Authorization: `Bearer ${accessToken}` } },
                });
                try {
                  const sel = await userClient.from('users').select('id').eq('auth_user_id', String(userId)).maybeSingle();
                  // @ts-ignore
                  if (sel?.data?.id) appUserId = sel.data.id;
                  if (!appUserId) {
                    try {
                      const ins = await userClient
                        .from('users')
                        .insert({ auth_user_id: String(userId), email, display_name: email.split('@')[0] })
                        .select('id')
                        .maybeSingle();
                      // @ts-ignore
                      if (ins?.data?.id) appUserId = ins.data.id;
                    } catch (ie) {
                      console.warn('[dev login] user-scoped insert failed (likely RLS):', ie?.message || ie);
                    }
                  }
                } catch (qe) {
                  console.warn('[dev login] user-scoped select failed', qe?.message || qe);
                }
              }
            } catch (e) {
              console.warn('[dev login] failed to resolve app user id via access token', e?.message || e);
            }
          }

          const cookieActorId = appUserId || String(userId);
          res.setHeader('Set-Cookie', `actorId=${cookieActorId}; Path=/; HttpOnly; Max-Age=${60 * 60 * 24 * 30}`);
          return res.status(200).json({ ok: true, user: { id: cookieActorId, email } });
        } catch (e:any) {
          console.warn('[dev login] failed to resolve app user id', e?.message || e);
          res.setHeader('Set-Cookie', `actorId=${userId}; Path=/; HttpOnly; Max-Age=${60 * 60 * 24 * 30}`);
          return res.status(200).json({ ok: true, user: { id: userId, email } });
        }
      }
      // If supabase returned no explicit user id, treat as error
      return res.status(500).json({ error: '登录失败，未能获取用户信息' });
    }

    // Fallback: create or reuse a mock dev user id derived from email
    const fallbackId = email === 'owner@example.com' ? '00000000-0000-0000-0000-000000000001' : `dev_${Buffer.from(email).toString('hex').slice(0, 24)}`;
    res.setHeader('Set-Cookie', `actorId=${fallbackId}; Path=/; Max-Age=${60 * 60 * 24 * 30}`);
    return res.status(200).json({ ok: true, user: { id: fallbackId, email } });
  } catch (e:any) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
