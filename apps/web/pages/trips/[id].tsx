import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import VoiceRecorder from '../../components/VoiceRecorder';
import { getTrip, addExpense } from '../../lib/api';

export default function TripDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { data: trip, error, mutate } = useSWR(id ? `trip:${id}` : null, () => getTrip(String(id)));
  const [transcript, setTranscript] = useState('');

  if (error) return <div>加载失败</div>;
  if (!trip) return <div>加载中...</div>;

  const handleResult = (text: string) => {
    setTranscript(text);
  };

  const onAddExpense = async () => {
    // For prototype, we'll just call mock API and console.log
    // If there are items, attach to the first item's second child as a demo; otherwise leave unassigned
    const itemId = (Array.isArray(trip.days) && trip.days.length > 0 && trip.days[0].items && trip.days[0].items[1]) ? trip.days[0].items[1].id : null;
    const expense = { itinerary_item_id: itemId, amount: 50, currency: trip.currency, note: transcript };
    const res = await addExpense(trip.id, expense);
    if ((res as any).ok) {
      // refresh trip data so the new expense appears in the UI
      await mutate();
      const created = (res as any).data ?? expense;
      alert('已记录: ' + JSON.stringify(created));
      setTranscript('');
    } else {
      alert('记录失败: ' + JSON.stringify(res));
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>{trip.title}</h1>
      <div>
        <strong>预算：</strong> {trip.estimated_budget} {trip.currency}
      </div>

      {/* Compute expense maps once so rendering is consistent */}
      {(() => {
        // compute maps from trip.expenses
        const expensesByItem: Record<string, any[]> = {};
        const unassigned: any[] = [];
        (trip.expenses || []).forEach((e:any) => {
          if (e.itinerary_item_id) {
            expensesByItem[e.itinerary_item_id] = expensesByItem[e.itinerary_item_id] || [];
            expensesByItem[e.itinerary_item_id].push(e);
          } else {
            unassigned.push(e);
          }
        });
        // expose via memoized variables using closure
        (trip as any)._expensesByItem = expensesByItem;
        (trip as any)._unassignedExpenses = unassigned;
        return null;
      })()}
      {((trip as any)._unassignedExpenses && (trip as any)._unassignedExpenses.length > 0) ? (
        <div style={{ marginTop: 12 }}>
          <h4>其他费用（未关联到具体行程项）</h4>
          <ul>
            {(trip as any)._unassignedExpenses.map((e:any) => (
              <li key={e.id}>{e.note} — {e.amount}{trip.currency}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div style={{ marginTop: 12 }}>
        <h3>行程</h3>
        {Array.isArray(trip.days) && trip.days.length > 0 ? (
          trip.days.map((d:any) => (
            <div key={d.date} style={{ marginBottom: 12 }}>
              <div><strong>{d.date}</strong></div>
              <ul>
                {d.items.map((it:any) => (
                  <li key={it.id} style={{ marginBottom: 6 }}>
                    <div>{it.title} — 预计 {it.est_cost}{trip.currency} / 实际 {it.actual_cost}{trip.currency}</div>
                    {/* render expenses for this item if any */}
                    {((trip as any)._expensesByItem && (trip as any)._expensesByItem[it.id]) ? (
                      <ul style={{ marginTop: 6, marginLeft: 16 }}>
                        {(trip as any)._expensesByItem[it.id].map((e:any) => (
                          <li key={e.id} style={{ fontSize: 13, color: '#444' }}>{e.note} — {e.amount}{trip.currency}</li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
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
        <div style={{ color: '#666' }}>{(trip.expenses || []).length === 0 ? '此行程暂无费用记录。你可以使用下方语音录入来添加一条（模拟）。' : '行程项目下的费用会显示在对应条目下；未关联到条目的费用列在上方。'} </div>
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
