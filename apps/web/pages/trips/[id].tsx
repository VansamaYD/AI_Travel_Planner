import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import VoiceRecorder from '../../components/VoiceRecorder';
import { getTrip, addExpense, updateTrip } from '../../lib/api';
import MapView from '../../components/MapView';

export default function TripDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { data: trip, error, mutate } = useSWR(id ? `trip:${id}` : null, () => getTrip(String(id)));
  const [transcript, setTranscript] = useState('');
  // AI panel state
  const [aiInput, setAiInput] = useState('');
  const [aiMessages, setAiMessages] = useState<{role: string, text: string}[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [lastParsed, setLastParsed] = useState<any | null>(null);
  const [lastRawModelText, setLastRawModelText] = useState<string | null>(null);
  const [preparedJson, setPreparedJson] = useState<string | null>(null);
  const [intendedCalls, setIntendedCalls] = useState<any[] | null>(null);
  const [applying, setApplying] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [expandedExpenses, setExpandedExpenses] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [newAmount, setNewAmount] = useState<number | null>(50);
  const [newCurrency, setNewCurrency] = useState<string>('CNY');
  const [newPayerId, setNewPayerId] = useState<string | undefined>(undefined);

  // 移除开发阶段 JSON 导出/发送能力

  // 稳定地图输入数据，避免无关状态（悬停/展开）导致 items 引用变化触发地图重建
  const itemsForMap = React.useMemo(() => {
    const days = (trip as any)?.days;
    if (!Array.isArray(days)) return [] as any[];
    const arr = days.flatMap((d:any) => (d.items || []));
    return arr.map((it:any) => ({ ...it, id: String(it.id || '') }));
  }, [trip?.id, (trip as any)?.days]);

  React.useEffect(() => {
    if (trip && trip.currency) setNewCurrency(trip.currency);
  }, [trip]);

  if (error) return <div>加载失败</div>;
  if (!trip) return <div>加载中...</div>;

  // 无 JSON 导出/发送逻辑

  const handleResult = (text: string) => {
    setTranscript(text);
  };

  // AI helper: append message
  const aiAppend = (m: {role: string, text: string}) => setAiMessages(prev => [...prev, m]);

  // 语音识别结果实时更新输入框（智能追加模式）
  const handleAiVoice = (text: string) => {
    setAiInput(prev => {
      // 如果输入框为空，直接使用新文本
      if (!prev || prev.trim() === '') {
        return text;
      }
      
      // 如果新文本包含了旧文本的全部内容（可能是前缀），说明是累积更新
      // 检查：新文本是否以旧文本开头（考虑空格）
      const prevTrimmed = prev.trim();
      const textTrimmed = text.trim();
      
      if (textTrimmed.startsWith(prevTrimmed)) {
        // 累积更新：使用新文本（完整的累积结果）
        return text;
      }
      
      // 如果旧文本包含了新文本的全部内容，说明新文本可能是临时结果的变化
      // 使用新文本（更完整的累积结果）
      if (prevTrimmed.includes(textTrimmed) && textTrimmed.length < prevTrimmed.length) {
        // 这种情况不应该发生（新文本应该更长），但为了安全保留旧文本
        return prev;
      }
      
      // 否则，追加到现有内容后面（用户手动输入的内容 + 新的语音识别结果）
      return prev + (prev.endsWith(' ') || text.startsWith(' ') ? '' : ' ') + text;
    });
  };

  const sendAiMessage = async (mode: 'chat' | 'plan' = 'chat') => {
    const text = aiInput.trim();
    if (!text) return alert('请输入要发送给 AI 的内容或使用语音输入');
    aiAppend({ role: 'user', text });
    setAiInput('');
    setAiLoading(true);
    try {
      const apiKey = typeof window !== 'undefined' ? localStorage.getItem('tongyi_api_key') : null;
      if (mode === 'plan') {
        // Call new modify endpoint which expects { user_input, current_trip }
        const res = await fetch('/api/ai/modify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_input: text, current_trip: trip, apiKey }),
        });
        const data = await res.json();
        if (!res.ok) {
          const msg = data?.message || data?.error || '调用失败';
          if (msg.includes('model_returned_non_json') || msg.includes('无法解析') || msg.includes('JSON')) {
            aiAppend({ role: 'assistant', text: '模型返回格式有误，无法解析为 JSON。请重试或重新表述需求。' });
          } else {
            aiAppend({ role: 'assistant', text: '调用失败：' + String(msg) });
          }
          setAiLoading(false);
          return;
        }
        // data.parsed is the normalized { new_items, update_items, ... }
        const parsed = data?.parsed ?? null;
        const raw = data?.rawModelText ?? null;
        const calls = data?.intendedCalls ?? null;
        setLastParsed(parsed);
        setLastRawModelText(raw);
        setIntendedCalls(calls);
        const pretty = parsed ? JSON.stringify(parsed, null, 2) : String(data);
        setPreparedJson(pretty);
        aiAppend({ role: 'assistant', text: '已生成结构化建议，正在应用更新…' });
        try {
          if (calls && calls.length) {
            const ownerId = (trip && trip.owner_id) ? trip.owner_id : (typeof window !== 'undefined' ? localStorage.getItem('actorId') : null);
            setApplying(true);
            for (const c of calls) {
              const payload = { ...(c.body || {}) };
              if ((c.endpoint || '').includes('addItineraryItem') || (c.endpoint || '').includes('addExpense')) {
                if (!payload.owner_id && ownerId) payload.owner_id = ownerId;
                if (!payload.trip_id && trip && trip.id) payload.trip_id = trip.id;
              }
              await fetch(c.endpoint, { method: c.method || 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
            }
            setApplying(false);
            aiAppend({ role: 'system', text: '已应用模型建议。' });
            try { await mutate(); } catch (e) {}
          }
        } catch (e:any) {
          setApplying(false);
          aiAppend({ role: 'assistant', text: '应用建议时出错：' + String(e?.message || e) });
        }
        return;
      } else {
        // chat mode unchanged
        const res = await fetch('/api/ai/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, apiKey, mode }),
        });
        const data = await res.json();
        if (!res.ok) {
          const msg = data?.message || data?.error || '调用失败';
          if (msg.includes('model_returned_non_json') || msg.includes('无法解析') || msg.includes('JSON')) {
            aiAppend({ role: 'assistant', text: '模型返回格式有误，无法解析为 JSON。请重试或重新表述需求。' });
          } else {
            aiAppend({ role: 'assistant', text: '调用失败：' + String(msg) });
          }
          return;
        }
        const txt = data?.text || data?.rawModelText || JSON.stringify(data);
        aiAppend({ role: 'assistant', text: String(txt) });
      }
    } catch (e:any) {
      aiAppend({ role: 'assistant', text: '调用异常：' + String(e?.message || e) });
    } finally {
      setAiLoading(false);
    }
  };

  // Try to parse last assistant message as JSON and apply to current trip via updateTrip
  const applyAiUpdateToTrip = async () => {
    const lastAssistant = [...aiMessages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistant) return alert('没有 AI 的回复可用于更新');
    let parsed: any = null;
    try { parsed = JSON.parse(lastAssistant.text); } catch (e) {
      // try to extract JSON substring
      const m = lastAssistant.text.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch (err) { parsed = null; }
      }
    }
    if (!parsed) return alert('AI 返回的文本无法解析为 JSON，请在对话中要求模型返回 JSON（或使用计划模式）。');
    try {
      const resp = await updateTrip(trip.id, parsed as any);
      if (!resp.ok) {
        alert('更新失败: ' + JSON.stringify(resp.error));
        return;
      }
      aiAppend({ role: 'system', text: '行程已更新' });
      await mutate();
    } catch (e:any) {
      alert('更新请求失败: ' + String(e?.message || e));
    }
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
  const expense = { itinerary_item_id: itemId, amount, currency, payer_id: newPayerId || undefined, note: transcript };
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
      // sanitize updates: drop nulls and only include known DB columns for itinerary_items
      const allowedItemKeys = ['day_index','date','start_time','end_time','title','type','description','location','est_cost','currency','sequence','extra'];
      const updates: any = {};
      for (const k of Object.keys(item)) {
        if (!allowedItemKeys.includes(k)) continue;
        const v = item[k];
        if (v === null || typeof v === 'undefined') continue;
        updates[k] = v;
      }
      const res = await fetch('/api/dev/updateItem', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: item.id, updates }),
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
      // sanitize expense updates: only include known expense columns and drop null/undefined
      const allowedExpenseKeys = ['itinerary_item_id','amount','currency','payer_id','user_id','description','category','date','note','recorded_via','raw_transcript','vendor','payment_method','split','status'];
      const updates: any = {};
      for (const k of Object.keys(exp)) {
        if (!allowedExpenseKeys.includes(k)) continue;
        const v = exp[k];
        if (v === null || typeof v === 'undefined') continue;
        updates[k] = v;
      }
      const res = await fetch('/api/dev/updateExpense', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: exp.id, updates }),
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

      {/* 两栏布局：左列表 + 右地图 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start', marginTop: 12 }}>
        <div>
          <div style={{ marginTop: 16, padding: 12, border: '1px solid #eee', borderRadius: 12, background: '#f9fafb', position: 'relative' }}>
            <h3 style={{ marginTop: 0 }}>AI 助手</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <VoiceRecorder onResult={handleAiVoice} />
              <input value={aiInput} onChange={e => setAiInput(e.target.value)} placeholder="例如：降低强度，增加适合老人和孩子的餐饮安排" style={{ flex: 1 }} />
              <button onClick={() => sendAiMessage('plan')} disabled={aiLoading}>{aiLoading ? '生成中…' : '智能生成并应用'}</button>
            </div>
            <div style={{ maxHeight: 240, overflowY: 'auto', padding: 8, background: '#ffffff', border: '1px solid #eee', borderRadius: 10 }}>
              {aiMessages.map((m, i) => (
                <div key={i} style={{ display: 'flex', marginBottom: 10, justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '80%', padding: '8px 10px', borderRadius: 10, background: m.role === 'user' ? '#2563eb' : '#f3f4f6', color: m.role === 'user' ? '#fff' : '#111827', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                    <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>{m.role}</div>
                    <div style={{ wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap' }}>{m.text}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button onClick={() => { setAiMessages([]); setAiInput(''); }}>清空</button>
            </div>
            {(aiLoading || applying) && (
              <div style={{ position: 'absolute', right: 12, top: 12, display: 'flex', alignItems: 'center', gap: 8, color: '#6b7280' }}>
                <div style={{ width: 16, height: 16, border: '2px solid #ddd', borderTopColor: '#111827', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                正在与模型交互…
              </div>
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            <h3>行程</h3>
            {Array.isArray(trip.days) && trip.days.length > 0 ? (
              trip.days.map((d:any) => (
                <div key={d.date} style={{ marginBottom: 12 }}>
                  <div><strong>{d.date}</strong></div>
                  <ul>
                    {d.items.map((it:any) => (
                      <li key={it.id} style={{ marginBottom: 6 }}
                        onMouseEnter={() => setHoveredItemId(String(it.id))}
                        onMouseLeave={() => setHoveredItemId(s => (s === String(it.id) ? null : s))}
                        onClick={() => { const sid = String(it.id); setSelectedItemId(sid); setExpandedItems(prev => prev.includes(sid) ? prev.filter(x => x !== sid) : [...prev, sid]); }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: hoveredItemId === String(it.id) ? '#f3f4f6' : 'transparent', padding: '6px 8px', borderRadius: 6, cursor: 'pointer' }}>
                          <div>{it.title} — 预计 {it.est_cost}{trip.currency} / 实际 {it.actual_cost}{trip.currency}</div>
                          <div>
                            <button style={{ fontSize: 12 }} onClick={(e) => { e.stopPropagation(); const sid = String(it.id); setExpandedItems(prev => prev.includes(sid) ? prev.filter(x => x !== sid) : [...prev, sid]); setSelectedItemId(sid); }}>{expandedItems.includes(String(it.id)) ? '收起' : '详情'}</button>
                          </div>
                        </div>
                        {/* render expenses for this item if any */}
                        {((trip as any)._expensesByItem && (trip as any)._expensesByItem[String(it.id)]) ? (
                          <ul style={{ marginTop: 6, marginLeft: 16 }}>
                            {(trip as any)._expensesByItem[String(it.id)].map((e:any) => (
                              <li key={e.id} style={{ fontSize: 13, color: '#444', marginBottom: 6 }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <div>{e.note} — {e.amount}{trip.currency}</div>
                                  <button style={{ fontSize: 12 }} onClick={(ev) => { ev.stopPropagation(); const sid = String(e.id); setExpandedExpenses(prev => prev.includes(sid) ? prev.filter(x => x !== sid) : [...prev, sid]); }}>{expandedExpenses.includes(String(e.id)) ? '收起' : '详情'}</button>
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
                        ) : null}
                        {expandedItems.includes(String(it.id)) && (
                          <div style={{ marginTop: 8, marginLeft: 12, background: '#f0f4ff', padding: 10, borderRadius: 6 }}>
                            {it.description ? <div style={{ marginBottom: 6 }}><strong>描述:</strong> {it.description}</div> : null}
                            {it.location ? (
                              <div style={{ marginBottom: 6 }}>
                                <strong>位置:</strong> {typeof it.location === 'string' ? it.location : (it.location.address || JSON.stringify(it.location))}
                              </div>
                            ) : null}
                            <div style={{ display: 'flex', gap: 12 }}>
                              <div><strong>开始:</strong> {it.date || ''} {it.start_time || ''}</div>
                              <div><strong>结束:</strong> {it.date || ''} {it.end_time || ''}</div>
                            </div>
                            {it.notes ? <div><strong>笔记:</strong> {it.notes}</div> : null}
                            {it.extra ? <div style={{ marginTop: 6 }}><strong>额外:</strong> <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(it.extra, null, 2)}</pre></div> : null}
                            <div style={{ marginTop: 8 }}>
                              <button style={{ fontSize: 12 }} onClick={(ev) => { ev.stopPropagation(); setEditingItem({ ...it }); }}>编辑</button>
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
        </div>

        <div style={{ position: 'sticky', top: 'calc(50vh - 30vh)' }}>
          <MapView items={itemsForMap} selectedId={selectedItemId} hoveredId={hoveredItemId} />
        </div>
      </div>

      {/* 移除开发阶段 JSON 导出/发送按钮 */}

      {/* 已移除重复 AI 与列表区块 */}

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
      {/* 下面移除了重复的“其他费用/行程列表”渲染，仅保留上方新布局 */}

      {/* 移除费用说明与语音记账原型区块 */}
      
      {/* 已移除开发阶段 JSON 模态框 */}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
