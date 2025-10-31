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
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
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
  const { data: items } = await supabase
    .from('itinerary_items')
    .select('*')
    .eq('trip_id', id)
    // order by date then start_time (the schema uses `date` and `start_time`, not `start`)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });

  // build days grouped by date (use start date substring)
  const daysMap: Record<string, any[]> = {};
  (items || []).forEach((it: any) => {
    const date = it.start ? it.start.slice(0, 10) : (it.date || 'unknown');
    if (!daysMap[date]) daysMap[date] = [];
    daysMap[date].push({
      id: it.id,
      type: it.type,
      title: it.title,
      start: it.start,
      end: it.end,
      location: it.location,
      est_cost: it.est_cost,
      actual_cost: it.actual_cost,
      currency: it.currency,
      notes: it.notes,
    });
  });

  const days = Object.keys(daysMap).sort().map(d => ({ date: d, items: daysMap[d] }));

  // fetch expenses
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('trip_id', id)
    .order('date', { ascending: true });

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
    expenses: expenses || [],
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
    itinerary_item_id: expense.itinerary_item_id || null,
    user_id: expense.user_id || null,
    payer_id: expense.payer_id || null,
    amount: expense.amount,
    currency: expense.currency || 'CNY',
    category: expense.category || null,
    date: expense.date || new Date().toISOString().slice(0, 10),
    note: expense.note || expense.note || null,
    vendor: expense.vendor || null,
    payment_method: expense.payment_method || null,
    status: expense.status || 'pending',
    recorded_via: expense.recorded_via || 'web',
  };

  const { data, error } = await supabase.from('expenses').insert([toInsert]).select().single();
  if (error) {
    console.warn('supabase addExpense error', error);
    return { ok: false, error };
  }
  return { ok: true, data };
}
