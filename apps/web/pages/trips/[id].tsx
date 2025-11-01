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
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [expandedExpenses, setExpandedExpenses] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [newAmount, setNewAmount] = useState<number | null>(50);
  const [newCurrency, setNewCurrency] = useState<string>('CNY');
  const [newPayerId, setNewPayerId] = useState<string | null>(null);

  React.useEffect(() => {
    if (trip && trip.currency) setNewCurrency(trip.currency);
  }, [trip]);

  if (error) return <div>加载失败</div>;
  if (!trip) return <div>加载中...</div>;

  const handleResult = (text: string) => {
    setTranscript(text);
  };

  const onAddExpense = async () => {
    // For prototype, we'll just call mock API and console.log
    // If there are items, attach to the first item's second child as a demo; otherwise leave unassigned
    const itemId = (Array.isArray(trip.days) && trip.days.length > 0 && trip.days[0].items && trip.days[0].items[1]) ? trip.days[0].items[1].id : null;
    const amount = (newAmount === null || newAmount === undefined) ? 50 : newAmount;
    const currency = newCurrency || trip.currency || 'CNY';
    if (!amount) {
      alert('请输入金额');
      return;
    }
    const expense = { itinerary_item_id: itemId, amount, currency, payer_id: newPayerId ?? undefined, note: transcript };
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

  const saveItemEdits = async (item: any) => {
    setSaving(true);
    try {
      const res = await fetch('/api/dev/updateItem', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: item.id, updates: item }),
      });
      if (!res.ok) throw new Error('保存失败');
      await mutate();
      setEditingItem(null);
    } catch (e:any) {
      alert('保存出错: ' + String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const saveExpenseEdits = async (exp: any) => {
    setSaving(true);
    try {
      const res = await fetch('/api/dev/updateExpense', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: exp.id, updates: exp }),
      });
      if (!res.ok) throw new Error('保存失败');
      await mutate();
      setEditingExpense(null);
    } catch (e:any) {
      alert('保存出错: ' + String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>{trip.title}</h1>
      <div>
        <strong>预算：</strong> {trip.estimated_budget} {trip.currency}
      </div>

      {/* Edit modal for itinerary item */}
      {editingItem && (
        <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: 16, width: 720, maxHeight: '80vh', overflow: 'auto', borderRadius: 8 }}>
            <h3>编辑行程项</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label>标题<input value={editingItem.title || ''} onChange={e => setEditingItem((s:any) => ({ ...s, title: e.target.value }))} /></label>
              <label>类型<input value={editingItem.type || ''} onChange={e => setEditingItem((s:any) => ({ ...s, type: e.target.value }))} /></label>
              <label>日期<input value={editingItem.date || ''} onChange={e => setEditingItem((s:any) => ({ ...s, date: e.target.value }))} /></label>
              <label>开始时间<input value={editingItem.start_time || ''} onChange={e => setEditingItem((s:any) => ({ ...s, start_time: e.target.value }))} /></label>
              <label>结束时间<input value={editingItem.end_time || ''} onChange={e => setEditingItem((s:any) => ({ ...s, end_time: e.target.value }))} /></label>
              <label>估计费用<input value={editingItem.est_cost ?? ''} onChange={e => setEditingItem((s:any) => ({ ...s, est_cost: e.target.value ? Number(e.target.value) : null }))} /></label>
              <label>实际费用<input value={editingItem.actual_cost ?? ''} onChange={e => setEditingItem((s:any) => ({ ...s, actual_cost: e.target.value ? Number(e.target.value) : null }))} /></label>
              <label>货币<input value={editingItem.currency || ''} onChange={e => setEditingItem((s:any) => ({ ...s, currency: e.target.value }))} /></label>
            </div>
            <div style={{ marginTop: 8 }}>
              <label>描述/备注<textarea style={{ width: '100%' }} value={editingItem.description || editingItem.notes || ''} onChange={e => setEditingItem((s:any) => ({ ...s, description: e.target.value, notes: e.target.value }))} /></label>
            </div>
            <div style={{ marginTop: 8 }}>
              <label>位置 (JSON) <textarea style={{ width: '100%' }} value={typeof editingItem.location === 'string' ? editingItem.location : JSON.stringify(editingItem.location || {}, null, 2)} onChange={e => setEditingItem((s:any) => {
                let parsed:any = e.target.value;
                try { parsed = JSON.parse(e.target.value); } catch (err) { parsed = e.target.value; }
                return { ...s, location: parsed };
              })} /></label>
            </div>
            <div style={{ marginTop: 8 }}>
              <label>额外 (JSON) <textarea style={{ width: '100%' }} value={JSON.stringify(editingItem.extra || {}, null, 2)} onChange={e => setEditingItem((s:any) => {
                let parsed:any = {};
                try { parsed = JSON.parse(e.target.value); } catch (err) { parsed = e.target.value; }
                return { ...s, extra: parsed };
              })} /></label>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditingItem(null)} disabled={saving}>取消</button>
              <button onClick={() => saveItemEdits(editingItem)} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal for expense */}
      {editingExpense && (
        <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: 16, width: 720, maxHeight: '80vh', overflow: 'auto', borderRadius: 8 }}>
            <h3>编辑费用</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label>金额<input value={editingExpense.amount ?? ''} onChange={e => setEditingExpense((s:any) => ({ ...s, amount: e.target.value ? Number(e.target.value) : null }))} /></label>
              <label>货币<input value={editingExpense.currency || ''} onChange={e => setEditingExpense((s:any) => ({ ...s, currency: e.target.value }))} /></label>
              <label>分类<input value={editingExpense.category || ''} onChange={e => setEditingExpense((s:any) => ({ ...s, category: e.target.value }))} /></label>
              <label>日期<input value={editingExpense.date || ''} onChange={e => setEditingExpense((s:any) => ({ ...s, date: e.target.value }))} /></label>
              <label>商家<input value={editingExpense.vendor || ''} onChange={e => setEditingExpense((s:any) => ({ ...s, vendor: e.target.value }))} /></label>
              <label>支付方式<input value={editingExpense.payment_method || ''} onChange={e => setEditingExpense((s:any) => ({ ...s, payment_method: e.target.value }))} /></label>
            </div>
            <div style={{ marginTop: 8 }}>
              <label>备注<textarea style={{ width: '100%' }} value={editingExpense.note || ''} onChange={e => setEditingExpense((s:any) => ({ ...s, note: e.target.value }))} /></label>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditingExpense(null)} disabled={saving}>取消</button>
              <button onClick={() => saveExpenseEdits(editingExpense)} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Compute expense maps once so rendering is consistent */}
      {(() => {
        // compute maps from trip.expenses
            const expensesByItem: Record<string, any[]> = {};
            const unassigned: any[] = [];
            (trip.expenses || []).forEach((e:any) => {
              if (e.itinerary_item_id) {
                const key = String(e.itinerary_item_id);
                expensesByItem[key] = expensesByItem[key] || [];
                expensesByItem[key].push(e);
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
                    <li key={e.id} style={{ marginBottom: 6 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>{e.note} — {e.amount}{trip.currency}</div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <button style={{ fontSize: 12 }} onClick={() => {
                            const sid = String(e.id);
                            setExpandedExpenses(prev => prev.includes(sid) ? prev.filter(x => x !== sid) : [...prev, sid]);
                          }}>{expandedExpenses.includes(String(e.id)) ? '收起' : '详情'}</button>
                          <button style={{ fontSize: 12 }} onClick={() => setEditingExpense({ ...e })}>编辑</button>
                        </div>
                      </div>
                      {expandedExpenses.includes(String(e.id)) && (
                        <div style={{ marginTop: 6, marginLeft: 12, background: '#f7f7f7', padding: 8, borderRadius: 6 }}>
                          <div><strong>日期:</strong> {e.date}</div>
                          <div><strong>分类:</strong> {e.category}</div>
                          <div><strong>付款人:</strong> {e.payer_name || e.payer_id || e.user_id}</div>
                          <div><strong>商家:</strong> {e.vendor}</div>
                          <div><strong>支付方式:</strong> {e.payment_method}</div>
                          <div><strong>记录方式:</strong> {e.recorded_via}</div>
                          <div><strong>创建时间:</strong> {e.created_at}</div>
                          {e.raw_transcript ? <div><strong>转写:</strong> {e.raw_transcript}</div> : null}
                          {e.note ? <div><strong>备注:</strong> {e.note}</div> : null}
                        </div>
                      )}
                    </li>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>{it.title} — 预计 {it.est_cost}{trip.currency} / 实际 {it.actual_cost}{trip.currency}</div>
                      <div>
                        <button style={{ fontSize: 12 }} onClick={() => {
                          const sid = String(it.id);
                          setExpandedItems(prev => prev.includes(sid) ? prev.filter(x => x !== sid) : [...prev, sid]);
                        }}>{expandedItems.includes(String(it.id)) ? '收起行程详情' : '查看行程详情'}</button>
                      </div>
                    </div>
                    {/* render expenses for this item if any */}
                    {((trip as any)._expensesByItem && (trip as any)._expensesByItem[String(it.id)]) ? (
                      <ul style={{ marginTop: 6, marginLeft: 16 }}>
                        {(trip as any)._expensesByItem[String(it.id)].map((e:any) => (
                          <li key={e.id} style={{ fontSize: 13, color: '#444', marginBottom: 6 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <div>{e.note} — {e.amount}{trip.currency}</div>
                              <button style={{ fontSize: 12 }} onClick={() => {
                                const sid = String(e.id);
                                setExpandedExpenses(prev => prev.includes(sid) ? prev.filter(x => x !== sid) : [...prev, sid]);
                              }}>{expandedExpenses.includes(String(e.id)) ? '收起' : '详情'}</button>
                            </div>
                            {expandedExpenses.includes(String(e.id)) && (
                              <div style={{ marginTop: 6, marginLeft: 12, background: '#f7f7f7', padding: 8, borderRadius: 6 }}>
                                <div><strong>日期:</strong> {e.date}</div>
                                <div><strong>分类:</strong> {e.category}</div>
                                <div><strong>付款人:</strong> {e.payer_name || e.payer_id || e.user_id}</div>
                                <div><strong>商家:</strong> {e.vendor}</div>
                                <div><strong>支付方式:</strong> {e.payment_method}</div>
                                <div><strong>记录方式:</strong> {e.recorded_via}</div>
                                <div><strong>创建时间:</strong> {e.created_at}</div>
                                {e.raw_transcript ? <div><strong>转写:</strong> {e.raw_transcript}</div> : null}
                                {e.note ? <div><strong>备注:</strong> {e.note}</div> : null}
                                <div style={{ marginTop: 6 }}>
                                  <button style={{ fontSize: 12, marginRight: 8 }} onClick={() => setEditingExpense({ ...e })}>编辑</button>
                                </div>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {expandedItems.includes(String(it.id)) && (
                      <div style={{ marginTop: 8, marginLeft: 12, background: '#f0f4ff', padding: 10, borderRadius: 6 }}>
                        {it.description ? <div><strong>描述:</strong> {it.description}</div> : null}
                        {it.location ? <div><strong>位置:</strong> {typeof it.location === 'string' ? it.location : JSON.stringify(it.location)}</div> : null}
                        <div><strong>开始:</strong> {it.date || ''} {it.start_time || ''}</div>
                        <div><strong>结束:</strong> {it.date || ''} {it.end_time || ''}</div>
                        {it.notes ? <div><strong>笔记:</strong> {it.notes}</div> : null}
                        {it.extra ? <div style={{ marginTop: 6 }}><strong>额外:</strong> <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(it.extra, null, 2)}</pre></div> : null}
                        <div style={{ marginTop: 8 }}>
                          <button style={{ fontSize: 12 }} onClick={() => setEditingItem({ ...it })}>编辑</button>
                        </div>
                      </div>
                    )}
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
        <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>金额
            <input type="number" value={newAmount ?? ''} onChange={e => setNewAmount(e.target.value ? Number(e.target.value) : null)} style={{ width: 120 }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column' }}>货币
            <input value={newCurrency} onChange={e => setNewCurrency(e.target.value)} style={{ width: 120 }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column' }}>付款人（可选）
            <input value={newPayerId || ''} onChange={e => setNewPayerId(e.target.value || null)} style={{ width: 180 }} />
          </label>
          <button onClick={onAddExpense} style={{ marginTop: 8 }}>记录（模拟）</button>
        </div>
      </div>
    </div>
  );
}
