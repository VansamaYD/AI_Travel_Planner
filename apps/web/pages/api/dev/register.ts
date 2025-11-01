import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';

// Dev register endpoint. If Supabase auth is configured, attempt to sign up the user.
// Otherwise create a fallback dev id derived from email.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      try {
        const resp = await supabase.auth.signUp({ email, password });
        // @ts-ignore
        if (resp.error) {
          const fallbackEnabled = (process.env.DEV_AUTH_FALLBACK ?? 'true') !== 'false';
          console.warn('[dev register] supabase signUp failed', resp.error, 'DEV_AUTH_FALLBACK=', process.env.DEV_AUTH_FALLBACK);
          // Map some common Supabase AuthApiError codes to friendlier Chinese messages
          const code = resp.error?.code || resp.error?.name || '';
          const friendlyMap: Record<string, string> = {
            email_address_invalid: '邮箱地址无效，请填写正确的邮箱',
            "duplicate": '该邮箱已被注册',
            'user_already_registered': '该邮箱已被注册',
            'invalid_password': '密码不符合要求',
          };
          const friendly = friendlyMap[String(code)] || resp.error?.message || '注册失败';
          if (!fallbackEnabled) {
            const errBody: any = { error: friendly };
            if (process.env.NODE_ENV !== 'production') errBody._raw = resp;
            // Use 400 for bad requests, preserve Supabase status if available
            const status = resp.error?.status || 400;
            return res.status(status).json(errBody);
          }
          // otherwise fall through to fallback dev id
        } else {
          // Attempt to read created user id
          // @ts-ignore
          const userId = resp?.data?.user?.id || resp?.data?.user?.user?.id || null;
          if (userId) {
            // If a SUPABASE_SERVICE_ROLE_KEY is provided, attempt to create a matching profile row
            // using the service role (server-side privileged) client. This ensures auth.users and
            // public.profiles stay in sync in prod/integration.
            try {
              const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
              let appUserId: string | null = null;
              if (serviceKey && process.env.NEXT_PUBLIC_SUPABASE_URL) {
                const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey);
                // Upsert and request the row back so we can get the application-level uuid `id`.
                // We upsert by `auth_user_id` and request `id` in the returning select.
                try {
                  // upsert then select the id; .select().maybeSingle() returns the upserted/updated row
                  // Note: depending on PostgREST behavior, .upsert(...).select('id').maybeSingle() should return the row
                  const upsert = await admin
                    .from('users')
                    .upsert(
                      {
                        auth_user_id: String(userId),
                        email,
                        display_name: email.split('@')[0],
                      },
                      { onConflict: 'auth_user_id' }
                    )
                    .select('id,auth_user_id')
                    .maybeSingle();

                  // @ts-ignore
                  if (upsert?.data && upsert.data.id) appUserId = upsert.data.id;
                  // Some Supabase/PostgREST setups return data directly on the call
                  // @ts-ignore
                  if (!appUserId && upsert?.id) appUserId = upsert.id;
                } catch (e) {
                  console.warn('[dev register] admin upsert/select returned error', e);
                }
              }

              // If we didn't get an application user id via service role, try to query using the
              // newly-created user's access token (user-scoped client). This works when your
              // RLS policies allow the authenticated user to read/insert their own profile.
              if (!appUserId) {
                try {
                  // Try to read access token from the signUp response
                  // @ts-ignore
                  const accessToken = resp?.data?.session?.access_token || resp?.data?.access_token || null;
                  if (accessToken && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
                    const userClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
                      global: { headers: { Authorization: `Bearer ${accessToken}` } },
                    });
                    try {
                      // Try selecting existing profile
                      const sel = await userClient.from('users').select('id').eq('auth_user_id', String(userId)).maybeSingle();
                      // @ts-ignore
                      if (sel?.data?.id) appUserId = sel.data.id;
                      // If not found, try inserting (will work only if RLS allows authenticated inserts)
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
                          console.warn('[dev register] user-scoped insert into public.users failed (likely RLS):', ie?.message || ie);
                        }
                      }
                    } catch (qe) {
                      console.warn('[dev register] user-scoped select failed', qe?.message || qe);
                    }
                  }
                } catch (e) {
                  console.warn('[dev register] failed to resolve app user id via access token', e?.message || e);
                }
              }

              // Fallback: if we couldn't resolve application user id, fall back to auth user id
              const cookieActorId = appUserId || String(userId);
              res.setHeader('Set-Cookie', `actorId=${cookieActorId}; Path=/; HttpOnly; Max-Age=${60 * 60 * 24 * 30}`);
              return res.status(200).json({ ok: true, user: { id: cookieActorId, email } });
            } catch (err) {
              console.warn('[dev register] failed to create profile via service role', err);
              // If profile creation failed unexpectedly, still return auth id as fallback
              res.setHeader('Set-Cookie', `actorId=${userId}; Path=/; HttpOnly; Max-Age=${60 * 60 * 24 * 30}`);
              return res.status(200).json({ ok: true, user: { id: userId, email } });
            }
          }
        }
      } catch (e:any) {
        console.warn('[dev register] supabase signUp threw', e?.message || e);
        const fallbackEnabled = (process.env.DEV_AUTH_FALLBACK ?? 'true') !== 'false';
        if (!fallbackEnabled) return res.status(500).json({ error: String(e?.message || e) });
      }
    }

    // Fallback dev id when Supabase isn't configured or signup failed
    const fallbackId = `dev_${Buffer.from(email).toString('hex').slice(0, 24)}`;
    res.setHeader('Set-Cookie', `actorId=${fallbackId}; Path=/; Max-Age=${60 * 60 * 24 * 30}`);
    return res.status(200).json({ ok: true, user: { id: fallbackId, email } });
  } catch (e:any) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
