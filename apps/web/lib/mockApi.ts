export type Trip = {
  id: string;
  owner_id: string;
  title: string;
  start_date: string;
  end_date: string;
  estimated_budget: number | null;
  currency: string;
  status: string;
  days: Array<any>;
  expenses: Array<any>;
  estimated_budget_consumed?: number;
  estimated_budget_remaining?: number | null;
};

const demoTrip: Trip = {
  id: 'trip_123',
  owner_id: 'user_abc',
  title: '东京亲子美食游',
  start_date: '2025-12-10',
  end_date: '2025-12-15',
  estimated_budget: 10000,
  currency: 'CNY',
  status: 'generated',
  days: [
    {
      date: '2025-12-10',
      items: [
        {
          id: 'item_1',
          type: 'flight',
          title: '北京 - 东京',
          start: '2025-12-10T08:00:00+08:00',
          end: '2025-12-10T12:30:00+09:00',
          location: null,
          est_cost: 2000,
          actual_cost: 2000,
          currency: 'CNY',
          notes: '建议选择直飞'
        },
        {
          id: 'item_2',
          type: 'poi',
          title: '浅草寺',
          start: '2025-12-10T15:00:00+09:00',
          end: '2025-12-10T16:30:00+09:00',
          location: { lat: 35.7148, lng: 139.7967, address: '浅草 2-3-1' },
          est_cost: 0,
          actual_cost: 120,
          currency: 'CNY',
          notes: '适合带孩子'
        }
      ]
    }
  ],
  expenses: [
    {
      id: 'exp_1',
      itinerary_item_id: 'item_2',
      user_id: '00000000-0000-0000-0000-000000000001',
      payer_id: '00000000-0000-0000-0000-000000000001',
      amount: 120,
      currency: 'CNY',
      category: 'meal',
      date: '2025-12-10',
      note: '浅草拉面',
      vendor: '浅草拉面店',
      payment_method: 'credit_card',
      status: 'cleared',
      recorded_via: 'manual'
    }
  ],
  estimated_budget_consumed: 2120,
  estimated_budget_remaining: 7880,
};

export async function getTrips(): Promise<Trip[]> {
  // placeholder for actual API
  return [demoTrip];
}

export async function getTrip(id: string): Promise<Trip | null> {
  if (id === demoTrip.id) return demoTrip;
  return null;
}

export async function addExpense(tripId: string, expense: any) {
  // in prototype just log
  console.log('mock addExpense', tripId, expense);
  return { ok: true };
}
