import React, { useState } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import VoiceRecorder from '../../components/VoiceRecorder';
import { getTrip, addExpense } from '../../lib/api';

export default function TripDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { data: trip, error } = useSWR(id ? `trip:${id}` : null, () => getTrip(String(id)));
  const [transcript, setTranscript] = useState('');

  if (error) return <div>加载失败</div>;
  if (!trip) return <div>加载中...</div>;

  const handleResult = (text: string) => {
    setTranscript(text);
  };

  const onAddExpense = async () => {
    // For prototype, we'll just call mock API and console.log
    const expense = { itinerary_item_id: trip.days[0].items[1].id, amount: 50, currency: trip.currency, note: transcript };
    await addExpense(trip.id, expense);
    alert('已记录（模拟）: ' + JSON.stringify(expense));
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>{trip.title}</h1>
      <div>
        <strong>预算：</strong> {trip.estimated_budget} {trip.currency}
      </div>
      <div style={{ marginTop: 12 }}>
        <h3>行程</h3>
        {Array.isArray(trip.days) && trip.days.length > 0 ? (
          trip.days.map((d:any) => (
            <div key={d.date} style={{ marginBottom: 12 }}>
              <div><strong>{d.date}</strong></div>
              <ul>
                {d.items.map((it:any) => (
                  <li key={it.id}>{it.title} — 预计 {it.est_cost}{trip.currency} / 实际 {it.actual_cost}{trip.currency}</li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <div style={{ color: '#666' }}>此行程暂无行程项（items）。你可以在 Supabase 中导入数据或使用回退 mock 数据。</div>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <h3>费用</h3>
        {Array.isArray(trip.expenses) && trip.expenses.length > 0 ? (
          <ul>
            {trip.expenses.map((e:any) => (
              <li key={e.id}>{e.note} — {e.amount}{trip.currency}</li>
            ))}
          </ul>
        ) : (
          <div style={{ color: '#666' }}>此行程暂无费用记录。你可以使用下方语音录入来添加一条（模拟）。</div>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        <h4>语音记录消费（原型）</h4>
        <VoiceRecorder onResult={handleResult} />
        <div style={{ marginTop: 8 }}>转写: {transcript}</div>
        <button onClick={onAddExpense} style={{ marginTop: 8 }}>记录（模拟）</button>
      </div>
    </div>
  );
}
