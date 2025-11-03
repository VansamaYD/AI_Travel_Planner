import { supabase } from './supabaseClient';
import * as fallback from './mockApi.fallback';

export type Trip = fallback.Trip;

function hasSupabase() {
  try {
    // detect if supabase was initialized with envs
    // @ts-ignore
    return Boolean(supabase && (supabase as any)._supabaseAdmin === undefined);
  } catch (e) {
    return false;
  }
}

export async function getTrips(): Promise<Trip[]> {
  // If Supabase not configured, return fallback demo data
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return fallback.getTrips();
  }

  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .limit(100);

  if (error) {
    console.warn('supabase getTrips error', error);
    return fallback.getTrips();
  }

  // map rows to Trip shape; we'll attach empty days/expenses for now and let the detail API fetch specifics
  return (data || []).map((r: any) => ({
    id: r.id,
    owner_id: r.owner_id,
    title: r.title,
    start_date: r.start_date,
    end_date: r.end_date,
    estimated_budget: r.estimated_budget || null,
    currency: r.currency || 'CNY',
    status: r.status || 'draft',
    days: r.days || [],
    expenses: [],
    estimated_budget_consumed: r.estimated_budget_consumed || 0,
    estimated_budget_remaining: r.estimated_budget_remaining ?? null,
  } as Trip));
}

export async function getTrip(id: string): Promise<Trip | null> {
  // 在服务器端也检查环境变量（兼容 Docker 运行时注入）
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[api.getTrip] Supabase not configured, using fallback. URL:', !!supabaseUrl, 'Key:', !!supabaseAnonKey);
    return fallback.getTrip(id);
  }

  const { data: trips, error: tripErr } = await supabase
    .from('trips')
    .select('*')
    .eq('id', id)
    .limit(1);

  if (tripErr) {
    console.warn('supabase getTrip error', tripErr);
    return fallback.getTrip(id);
  }

  const tripRow = Array.isArray(trips) && trips.length ? trips[0] : null;
  // 如果 Supabase 中未找到指定行程，回退到本地 demo（方便开发与调试）
  if (!tripRow) {
    return fallback.getTrip(id);
  }

  // fetch itinerary items
  const { data: items, error: itemsErr } = await supabase
    .from('itinerary_items')
    .select('*')
    .eq('trip_id', id)
    // order by date then start_time (the schema uses `date` and `start_time`, not `start`)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });

  if (itemsErr) {
    console.warn('supabase itinerary_items error', itemsErr);
  }

  // build days grouped by date
  const daysMap: Record<string, any[]> = {};
  (items || []).forEach((it: any) => {
    const date = it.date || (it.start ? String(it.start).slice(0, 10) : 'unknown');
    const key = String(date);
    if (!daysMap[key]) daysMap[key] = [];
    daysMap[key].push({
      id: it.id,
      type: it.type,
      title: it.title,
      date: date,
      start_time: it.start_time || it.start || null,
      end_time: it.end_time || it.end || null,
      description: it.description || it.notes || null,
      location: it.location,
      est_cost: it.est_cost,
      actual_cost: it.actual_cost,
      currency: it.currency,
      sequence: it.sequence,
      extra: it.extra || null,
    });
  });

  // debugging telemetry to help trace why frontend may show empty days
  try {
    console.log('[api.getTrip] itinerary_items fetched:', (items || []).length, 'days built:', Object.keys(daysMap).length);
  } catch (e) {}

  const days = Object.keys(daysMap).sort().map(d => ({ date: d, items: daysMap[d] }));

  // fetch expenses
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('trip_id', id)
    .order('date', { ascending: true });
  // if there are payer/user ids, try to fetch display names from profiles or users table
  const expensesWithNames = (expenses || []).slice();
  try {
    const ids = Array.from(new Set((expenses || []).flatMap((e: any) => [e.payer_id, e.user_id].filter(Boolean))));
    if (ids.length) {
      // try profiles first (common in Supabase), then fall back to users table if profiles missing
      let profiles: any[] | null = null;
      try {
        const { data } = await supabase.from('profiles').select('id,display_name').in('id', ids);
        profiles = data as any[] | null;
      } catch (err) {
        profiles = null;
      }

      if (!profiles || !profiles.length) {
        // fall back to `users` table present in migrations
        try {
          const { data } = await supabase.from('users').select('id,display_name').in('id', ids);
          profiles = data as any[] | null;
        } catch (err) {
          profiles = null;
        }
      }

      const map: Record<string, string> = {};
      (profiles || []).forEach((p: any) => {
        if (p && p.id) map[String(p.id)] = p.display_name || p.name || '';
      });
      expensesWithNames.forEach((ex: any) => {
        if (ex.payer_id && map[String(ex.payer_id)]) ex.payer_name = map[String(ex.payer_id)];
        if (!ex.payer_name && ex.user_id && map[String(ex.user_id)]) ex.payer_name = map[String(ex.user_id)];
        // also expose user_name for clarity
        if (ex.user_id && map[String(ex.user_id)]) ex.user_name = map[String(ex.user_id)];
      });
    }
  } catch (e) {
    // non-fatal: if profiles/users lookup fails, continue with raw ids
    try { console.warn('[api.getTrip] profiles/users lookup failed', e); } catch (ignored) {}
  }

  const trip: Trip = {
    id: tripRow.id,
    owner_id: tripRow.owner_id,
    title: tripRow.title,
    start_date: tripRow.start_date,
    end_date: tripRow.end_date,
    estimated_budget: tripRow.estimated_budget || null,
    currency: tripRow.currency || 'CNY',
    status: tripRow.status || 'draft',
    days,
    expenses: expensesWithNames || [],
    estimated_budget_consumed: tripRow.estimated_budget_consumed || 0,
    estimated_budget_remaining: tripRow.estimated_budget_remaining ?? null,
  };

  return trip;
}

export async function addExpense(tripId: string, expense: any) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return fallback.addExpense(tripId, expense);
  }

  const toInsert = {
    trip_id: tripId,
    // accept multiple possible input names for item id to be forgiving from clients
    itinerary_item_id:
      expense.itinerary_item_id ?? expense.item_id ?? expense.itineraryItemId ?? null,
    user_id: expense.user_id || null,
    payer_id: expense.payer_id || null,
    amount: expense.amount,
    currency: expense.currency || 'CNY',
    category: expense.category || null,
    date: expense.date || new Date().toISOString().slice(0, 10),
    // map either `note` or `description` from client to the DB `note` column
    note: typeof expense.note === 'string' ? expense.note : (typeof expense.description === 'string' ? expense.description : null),
    vendor: expense.vendor || null,
    payment_method: expense.payment_method || null,
    status: expense.status || 'pending',
    recorded_via: expense.recorded_via || 'web',
    // preserve optional fields that may be submitted
    raw_transcript: expense.raw_transcript || null,
    receipt_url: expense.receipt_url || null,
    split: expense.split || null,
  };

  const { data, error } = await supabase.from('expenses').insert([toInsert]).select().single();
  if (error) {
    console.warn('supabase addExpense error', error);
    return { ok: false, error };
  }
  return { ok: true, data };
}

export async function createTrip(payload: any) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // fallback: echo back with an id
    return { ok: true, data: { id: `trip_mock_${Date.now()}`, ...payload } };
  }

  // Prepare insert object. Some Supabase/PostgREST schemas may not have a `days` column
  // (we store itinerary items separately). Try inserting including `days` if present,
  // but on a schema-mismatch error retry without it to be resilient across dev/prod DBs.
  const baseInsert: any = {
    title: payload.title,
    start_date: payload.start_date,
    end_date: payload.end_date,
    owner_id: payload.owner_id || null,
    description: typeof payload.description === 'string' ? payload.description : null,
    estimated_budget: payload.estimated_budget || null,
    // if an estimated budget is provided, initialize remaining and record recalculation time
    estimated_budget_remaining: typeof payload.estimated_budget === 'number' ? payload.estimated_budget : null,
    last_budget_recalc_at: typeof payload.estimated_budget === 'number' ? new Date().toISOString() : null,
    currency: payload.currency || 'CNY',
    status: payload.status || 'draft',
    visibility: payload.visibility || null,
    collaborators: Array.isArray(payload.collaborators) ? payload.collaborators : null,
    metadata: payload.metadata || null,
  };

  // first attempt: include days if provided
  const tryInsert = async (obj: any) => {
    const { data, error } = await supabase.from('trips').insert([obj]).select().single();
    return { data, error };
  };

  let toInsert = Object.assign({}, baseInsert);
  if (payload.days) toInsert.days = payload.days;

  let resp = await tryInsert(toInsert);
  if (resp.error) {
    const msg = String(resp.error.message || resp.error);
    // If PostgREST complains about missing 'days' column in the schema cache, retry without days
    if (msg.includes("Could not find the 'days' column") || msg.includes('could not find the') || (resp.error.code === 'PGRST204')) {
      try {
        console.warn('[api.createTrip] retrying insert without days due to schema mismatch');
        const fallbackInsert = Object.assign({}, baseInsert);
        const retry = await tryInsert(fallbackInsert);
        if (retry.error) {
          console.warn('supabase createTrip retry error', retry.error);
          return { ok: false, error: retry.error };
        }
        return { ok: true, data: retry.data };
      } catch (e:any) {
        console.warn('supabase createTrip retry threw', e?.message || e);
        return { ok: false, error: e };
      }
    }
    // If foreign key constraint fails for owner_id, do NOT silently retry without owner_id
    // because that would drop the provided owner information. Surface the error so the
    // caller can decide how to proceed (e.g., provide a valid owner id or create the user).
    if (String(resp.error.message || '').includes('violates foreign key constraint') || resp.error.code === '23503') {
      console.warn('[api.createTrip] foreign key constraint error on insert', resp.error);
      return { ok: false, error: resp.error };
    }
    console.warn('supabase createTrip error', resp.error);
    return { ok: false, error: resp.error };
  }

  return { ok: true, data: resp.data };
}

export async function addItineraryItem(tripId: string, item: any) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { ok: true, data: { id: `item_mock_${Date.now()}`, trip_id: tripId, ...item } };
  }

  const toInsert = {
    trip_id: tripId,
    title: item.title,
    date: item.date,
    start_time: item.start_time || null,
    end_time: item.end_time || null,
    description: item.description || item.notes || null,
    type: item.type || null,
    location: item.location || null,
    // preserve numeric zeros by checking for undefined
    est_cost: typeof item.est_cost === 'number' ? item.est_cost : (item.est_cost ?? null),
    actual_cost: typeof item.actual_cost === 'number' ? item.actual_cost : (item.actual_cost ?? null),
    currency: item.currency || null,
    sequence: typeof item.sequence === 'number' ? item.sequence : (item.sequence ?? null),
    extra: item.extra || null,
  };

  const { data, error } = await supabase.from('itinerary_items').insert([toInsert]).select().single();
  if (error) {
    console.warn('supabase addItineraryItem error', error);
    return { ok: false, error };
  }
  return { ok: true, data };
}

export async function updateItineraryItem(itemId: string, updates: any) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // fallback: just return ok
    return { ok: true, data: { id: itemId, ...updates } };
  }
  const { data, error } = await supabase.from('itinerary_items').update(updates).eq('id', itemId).select().single();
  if (error) {
    console.warn('supabase updateItineraryItem error', error);
    return { ok: false, error };
  }
  return { ok: true, data };
}

export async function updateExpense(expenseId: string, updates: any) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { ok: true, data: { id: expenseId, ...updates } };
  }
  const { data, error } = await supabase.from('expenses').update(updates).eq('id', expenseId).select().single();
  if (error) {
    console.warn('supabase updateExpense error', error);
    return { ok: false, error };
  }
  return { ok: true, data };
}

export async function updateTrip(tripId: string, updates: any) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // fallback: return merged object for local dev
    return { ok: true, data: { id: tripId, ...updates } };
  }

  // If estimated_budget is being changed, keep remaining and recalc time consistent
  const toUpdate: any = Object.assign({}, updates);
  if (Object.prototype.hasOwnProperty.call(updates, 'estimated_budget')) {
    const eb = updates.estimated_budget;
    if (typeof eb === 'number') {
      toUpdate.estimated_budget_remaining = eb;
      toUpdate.last_budget_recalc_at = new Date().toISOString();
    } else if (eb === null) {
      toUpdate.estimated_budget_remaining = null;
      toUpdate.last_budget_recalc_at = null;
    }
  }

  // map description if provided as notes
  if (typeof toUpdate.notes === 'string' && !toUpdate.description) toUpdate.description = toUpdate.notes;

  const { data, error } = await supabase.from('trips').update(toUpdate).eq('id', tripId).select().single();
  if (error) {
    console.warn('supabase updateTrip error', error);
    return { ok: false, error };
  }
  return { ok: true, data };
}
