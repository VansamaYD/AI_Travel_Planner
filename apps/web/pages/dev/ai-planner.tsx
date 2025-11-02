"use client";
import React, { useEffect, useState } from 'react';
import Auth from '../../components/Auth';
import VoiceRecorder from '../../components/VoiceRecorder';
import { createTrip as apiCreateTrip, updateTrip as apiUpdateTrip } from '../../lib/api';
import supabaseClient from '../../utils/supabase/client';

const LOCAL_API_KEY = 'tongyi_api_key';
const LOCAL_API_URL = 'tongyi_api_url';

type Message = { role: 'user' | 'assistant' | 'system'; text: string };

export default function AIPlannerPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiUrl, setApiUrl] = useState<string | null>(null);
  const [needApiKey, setNeedApiKey] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [trip, setTrip] = useState<any | null>(null);
  const [lastParsed, setLastParsed] = useState<any | null>(null);
  const [lastRawModelText, setLastRawModelText] = useState<string | null>(null);
  const [preparedJson, setPreparedJson] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const k = localStorage.getItem(LOCAL_API_KEY);
    const u = localStorage.getItem(LOCAL_API_URL);
    setApiKey(k);
    setApiUrl(u);
    setNeedApiKey(!k || !u);
  }, []);

  const append = (m: Message) => setMessages(prev => [...prev, m]);

  // Resolve current actor/user id from several local sources.
  async function resolveActorId(): Promise<string | null> {
    // 1) try supabase session
    try {
      const sessionRes: any = await supabaseClient.auth.getUser();
      const id = sessionRes?.data?.user?.id || null;
      if (id) return id;
    } catch (e) {
      // ignore
    }

    // 2) try localStorage 'actorId'
    try {
      if (typeof window !== 'undefined') {
        const ls = localStorage.getItem('actorId');
        if (ls) return ls;
      }
    } catch (e) {}

    // 3) try cookie 'actorId'
    try {
      if (typeof window !== 'undefined') {
        const cookie = document.cookie || '';
        const match = cookie.split(';').map(s => s.trim()).find(s => s.startsWith('actorId='));
        const actorId = match ? match.split('=')[1] : null;
        if (actorId) return actorId;
      }
    } catch (e) {}

    return null;
  }

  const handleVoiceResult = (txt: string) => {
    setInput(prev => (prev ? prev + '\n' + txt : txt));
  };

  async function sendMessage(msg?: string) {
    const text = (msg ?? input).trim();
    if (!text) return;
    append({ role: 'user', text });
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, apiKey, apiUrl }),
      });
      const data = await res.json();
      if (res.status === 400 && data?.error === 'no_api_configured') {
        setNeedApiKey(true);
        append({ role: 'assistant', text: '未检测到模型 API Key，请在页面上输入并保存后重试。' });
        return;
      }
      if (!res.ok) {
        append({ role: 'assistant', text: '模型调用失败：' + JSON.stringify(data) });
        return;
      }
      const txt = data?.text || JSON.stringify(data);
      append({ role: 'assistant', text: String(txt) });
    } catch (e:any) {
      append({ role: 'assistant', text: '调用失败：' + String(e?.message || e) });
    } finally {
      setLoading(false);
    }
  }

  // 请求后端以结构化 JSON 方式生成行程并在服务端创建行程及日程条目
  async function requestStructuredPlan(sourceText?: string) {
    const text = (sourceText ?? input).trim();
    if (!text) return alert('请输入需求文本后再生成结构化行程');
    append({ role: 'user', text: '请求结构化行程：' + text });
    setLoading(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, apiKey, apiUrl, mode: 'plan' }),
      });
      const data = await res.json();
      if (!res.ok) {
        append({ role: 'assistant', text: '结构化生成失败：' + JSON.stringify(data) });
        return;
      }

      // Expect the backend to return parsed structured JSON in data.parsed
      const parsed = data?.parsed;
      if (!parsed) {
        append({ role: 'assistant', text: '模型未返回可解析的结构化数据，原文：' + (data?.rawModelText || JSON.stringify(data)) });
        return;
      }

      // Save parsed/raw to local state and present to user for preview/edit before persisting
      setLastParsed(parsed);
      setLastRawModelText(data?.rawModelText || JSON.stringify(data));
      try {
        setPreparedJson(JSON.stringify(parsed, null, 2));
      } catch (e) {
        setPreparedJson(String(parsed));
      }

      append({ role: 'assistant', text: '已解析到结构化 JSON（已保存在“预提交 JSON”区域），请在确认或编辑后点击“保存并创建行程”。' });
      return;
      
    } catch (e:any) {
      append({ role: 'assistant', text: '结构化调用失败：' + String(e?.message || e) });
    } finally {
      setLoading(false);
    }
  }

  function saveApiConfig(k: string, u?: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_API_KEY, k);
      if (u) localStorage.setItem(LOCAL_API_URL, u);
    }
    setApiKey(k);
    if (u) setApiUrl(u);
    setNeedApiKey(!k || !u);
  }

  // Try to extract a title/date/budget from assistant text. Very heuristic.
  function buildTripPayloadFromText(text: string) {
    const titleMatch = text.split('\n')[0] || 'AI 生成行程';
    // find first YYYY-MM-DD like date
    const dateRe = /(20\d{2}-\d{2}-\d{2})/;
    const m = text.match(dateRe);
    const start_date = m ? m[1] : new Date().toISOString().slice(0,10);
    // default 5 days
    const end = new Date(start_date);
    end.setDate(end.getDate() + 4);
    const end_date = end.toISOString().slice(0,10);
    const budgetRe = /预算\s*[:：]?\s*(\d+[\d,]*)/;
    const bm = text.match(budgetRe);
    const estimated_budget = bm ? Number(String(bm[1]).replace(/,/g, '')) : null;
    return {
      title: titleMatch.slice(0, 120),
      start_date,
      end_date,
      description: text.slice(0, 2000),
      estimated_budget,
      currency: 'CNY',
    };
  }

  async function createTripFromLastAssistant() {
    const last = [...messages].reverse().find(m => m.role === 'assistant');
    if (!last) {
      alert('没有 AI 的建议可以用于创建行程');
      return;
    }
    // If we already have a parsed structured JSON from the model, prefer that (user can preview/edit it)
    if (lastParsed) {
      // ensure preparedJson reflects lastParsed
      try { setPreparedJson(JSON.stringify(lastParsed, null, 2)); } catch (e) { setPreparedJson(String(lastParsed)); }
      return createTripFromPreparedJson();
    }

    const payload = buildTripPayloadFromText(last.text);
    append({ role: 'system', text: '正在根据 AI 建议创建行程...' });
    try {
      // call local dev createTrip route
      const res = await fetch('/api/dev/createTrip', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        append({ role: 'assistant', text: '创建行程失败：' + JSON.stringify(data) });
        return;
      }
      setTrip(data);
      append({ role: 'assistant', text: '行程创建成功，ID: ' + data.id });
    } catch (e:any) {
      append({ role: 'assistant', text: '创建请求失败：' + String(e?.message || e) });
    }
  }

  // Create trip using the preparedJson (user-edited) or lastParsed
  async function createTripFromPreparedJson() {
    let obj: any = null;
    try { obj = JSON.parse(preparedJson); } catch (e) { return alert('预提交 JSON 格式错误，请修正后重试'); }
    append({ role: 'system', text: '正在根据预提交的 JSON 创建行程...' });
    setLoading(true);
    try {
  // attach owner_id from local resolver (supabase session -> localStorage actorId -> cookie)
  const owner_id = await resolveActorId();
  const tripPayload = Object.assign({}, obj, { owner_id });

      const createResp = await fetch('/api/dev/createTrip', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tripPayload),
      });
      const created = await createResp.json();
      if (!createResp.ok) {
        append({ role: 'assistant', text: '保存行程失败：' + JSON.stringify(created) });
        return;
      }
      setTrip(created);
      append({ role: 'assistant', text: '已根据 AI 建议创建行程，ID: ' + created.id });

      // add items
      let addedCount = 0;
      if (Array.isArray(obj.days)) {
        for (const d of obj.days) {
          if (!Array.isArray(d.items)) continue;
          for (const it of d.items) {
            const item = Object.assign({}, it, { date: d.date || it.date });
            try {
              const aiResp = await fetch('/api/dev/addItineraryItem', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tripId: created.id, item }),
              });
              if (aiResp.ok) addedCount += 1;
            } catch (e) {
              // ignore individual item failures
            }
          }
        }
      }

      let expenseCount = 0;
      if (Array.isArray(obj.expenses)) {
        for (const ex of obj.expenses) {
          try {
            const er = await fetch('/api/dev/addExpense', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tripId: created.id, expense: ex }),
            });
            if (er.ok) expenseCount += 1;
          } catch (e) {}
        }
      }

      if (addedCount) append({ role: 'assistant', text: `已添加 ${addedCount} 个日程条目。` });
      if (expenseCount) append({ role: 'assistant', text: `已添加 ${expenseCount} 条费用记录。` });
    } catch (e:any) {
      append({ role: 'assistant', text: '本地保存失败：' + String(e?.message || e) });
    } finally {
      setLoading(false);
    }
  }

  async function applyUpdateToTrip(updatesText: string) {
    if (!trip) return alert('请先创建或选择一个行程');
    // very simple: try to parse JSON from updatesText, otherwise ask user to provide JSON
    let updates: any = null;
    try { updates = JSON.parse(updatesText); } catch (e) {}
    if (!updates) {
      return append({ role: 'assistant', text: '请在对话中以 JSON 格式提供要更新的字段，例如 {"estimated_budget":8000}' });
    }
    append({ role: 'system', text: '正在应用更新到行程...' });
    try {
      const resp = await apiUpdateTrip(trip.id, updates as any);
      if (!resp.ok) {
        append({ role: 'assistant', text: '更新失败：' + JSON.stringify(resp.error) });
        return;
      }
      setTrip(resp.data);
      append({ role: 'assistant', text: '行程已更新' });
    } catch (e:any) {
      append({ role: 'assistant', text: '更新请求失败：' + String(e?.message || e) });
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 920, margin: '0 auto' }}>
      <h2>AI 智能行程规划（Dev）</h2>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <Auth />
        <div style={{ marginLeft: 'auto' }}>
          {needApiKey ? (
            <div style={{ border: '1px solid #ccc', padding: 8 }}>
              <div>未检测到模型 API Key 或 API URL，请输入（将保存在本地浏览器，仅用于开发调试）</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input style={{ width: 320 }} placeholder="请输入 API Key" value={apiKey ?? ''} onChange={e => setApiKey(e.target.value)} />
                <input style={{ width: 360 }} placeholder="可选：API Base URL（例如 Dashscope/通义兼容模式的 base url）" value={apiUrl ?? ''} onChange={e => setApiUrl(e.target.value)} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => saveApiConfig(apiKey || '', apiUrl || '')} style={{ marginLeft: 8 }}>保存</button>
                  <button onClick={async () => {
                    // 保存并立即测试一次调用
                    saveApiConfig(apiKey || '', apiUrl || '');
                    setTestLoading(true);
                    setTestResult(null);
                    try {
                      const res = await fetch('/api/ai/chat', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: '测试连接', apiKey: apiKey || '', apiUrl: apiUrl || '' })
                      });
                      const data = await res.json();
                      if (!res.ok) {
                        setTestResult('测试失败: ' + JSON.stringify(data));
                      } else {
                        const txt = data?.text || data?.rawModelText || JSON.stringify(data);
                        setTestResult('测试成功: ' + String(txt).slice(0, 300));
                      }
                    } catch (e:any) {
                      setTestResult('测试异常: ' + String(e?.message || e));
                    } finally {
                      setTestLoading(false);
                    }
                  }} style={{ marginLeft: 8 }}>{testLoading ? '测试中...' : '保存并测试'}</button>
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>提示：若后端配置了服务端 Key（环境变量），则优先使用服务端配置；此处仅为本地开发提供便利。</div>
              {testResult ? <div style={{ marginTop: 8, fontSize: 13 }}>{testResult}</div> : null}
            </div>
          ) : (
            <div>模型 API 已配置（本地）。若需更改，请清理 localStorage 键 {LOCAL_API_KEY} 和 {LOCAL_API_URL}。</div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ border: '1px solid #ddd', padding: 12, minHeight: 300, overflowY: 'auto' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: '#666' }}>{m.role}</div>
                <div style={{ background: m.role === 'user' ? '#e6f7ff' : '#f5f5f5', padding: 8, borderRadius: 6 }}>{m.text}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <VoiceRecorder onResult={handleVoiceResult} />
            <input value={input} onChange={e => setInput(e.target.value)} style={{ flex: 1 }} placeholder="输入你的旅行需求，或用语音输入" />
            <button onClick={() => sendMessage()} disabled={loading}>{loading ? '发送中...' : '发送'}</button>
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button onClick={createTripFromLastAssistant} disabled={!messages.some(m => m.role === 'assistant')}>根据 AI 建议创建行程</button>
            <button onClick={() => {
              // allow user to explicitly request structured plan from current input or last user message
              const source = input || [...messages].reverse().find(m => m.role === 'user')?.text || '';
              requestStructuredPlan(source);
            }} disabled={loading}>请求 AI 返回结构化行程并创建（更可靠）</button>
            <button onClick={() => {
              const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
              if (!lastAssistant) return alert('没有 AI 建议');
              const updatesText = prompt('请输入要应用到行程的 JSON 更新（示例：{"estimated_budget":8000}）', '{"estimated_budget":8000}');
              if (updatesText) applyUpdateToTrip(updatesText);
            }} disabled={!trip}>将 JSON 更新应用到已创建行程</button>
          </div>

          {lastRawModelText || preparedJson ? (
            <div style={{ marginTop: 12, border: '1px dashed #ccc', padding: 10 }}>
              <h4>模型原始输出（只读）</h4>
              <textarea readOnly value={lastRawModelText || ''} style={{ width: '100%', height: 120, fontFamily: 'monospace' }} />
              <h4 style={{ marginTop: 8 }}>预提交 JSON（可编辑）</h4>
              <textarea value={preparedJson} onChange={e => setPreparedJson(e.target.value)} style={{ width: '100%', height: 200, fontFamily: 'monospace' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={() => createTripFromPreparedJson()} disabled={loading || !preparedJson}>保存并创建行程（使用预提交 JSON）</button>
                <button onClick={() => setInput(prev => (preparedJson || ''))}>将预提交 JSON 复制到输入框</button>
                <button onClick={() => { setLastParsed(null); setLastRawModelText(null); setPreparedJson(''); }}>清除预提交数据</button>
              </div>
            </div>
          ) : null}
        </div>

        <div style={{ width: 320 }}>
          <div style={{ border: '1px solid #eee', padding: 12 }}>
            <h4>行程状态</h4>
            {trip ? (
              <div>
                <div>ID: {trip.id}</div>
                <div>标题: {trip.title}</div>
                <div>开始: {trip.start_date} 结束: {trip.end_date}</div>
                <div>预算: {trip.estimated_budget ?? '无'}</div>
              </div>
            ) : (
              <div>尚未创建行程</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
