import { createClient } from '@supabase/supabase-js';

// For simple local testing we use the same public anon key on server side in this demo.
// In production you should use a SERVICE_ROLE key (never commit it to repo) and only call server-side.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!url || !key) {
  console.warn('[supabase/server] missing SUPABASE env vars');
}

export const supabaseServer = createClient(url, key, {
  // server options could go here
});

export default supabaseServer;
