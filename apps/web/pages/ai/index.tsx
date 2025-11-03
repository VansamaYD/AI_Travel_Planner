"use client";
import React, { useEffect, useState } from 'react';
import VoiceRecorder from '../../components/VoiceRecorder';

type Message = { role: 'user' | 'assistant' | 'system'; text: string };

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [needApiKey, setNeedApiKey] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiUrl, setApiUrl] = useState<string | null>(null);
  const [parsed, setParsed] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [createdTrip, setCreatedTrip] = useState<any | null>(null);
  const [showApiConfig, setShowApiConfig] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const k = localStorage.getItem('tongyi_api_key');
    const u = localStorage.getItem('tongyi_api_url');
    setApiKey(k);
    setApiUrl(u);
    setNeedApiKey(!k || !u);
  }, []);

  const append = (m: Message) => setMessages(prev => [...prev, m]);

  // 语音识别结果实时更新输入框（智能追加模式）
  const onVoice = (txt: string) => {
    setInput(prev => {
      // 如果输入框为空，直接使用新文本
      if (!prev || prev.trim() === '') {
        return txt;
      }
      
      // 如果新文本包含了旧文本的全部内容（可能是前缀），说明是累积更新
      // 检查：新文本是否以旧文本开头（考虑空格）
      const prevTrimmed = prev.trim();
      const txtTrimmed = txt.trim();
      
      if (txtTrimmed.startsWith(prevTrimmed)) {
        // 累积更新：使用新文本（完整的累积结果）
        return txt;
      }
      
      // 如果旧文本包含了新文本的全部内容，说明新文本可能是临时结果的变化
      // 使用新文本（更完整的累积结果）
      if (prevTrimmed.includes(txtTrimmed) && txtTrimmed.length < prevTrimmed.length) {
        // 这种情况不应该发生（新文本应该更长），但为了安全保留旧文本
        return prev;
      }
      
      // 否则，追加到现有内容后面（用户手动输入的内容 + 新的语音识别结果）
      return prev + (prev.endsWith(' ') || txt.startsWith(' ') ? '' : ' ') + txt;
    });
  };

  const requestPlan = async () => {
    const text = input.trim();
    if (!text) return;
    append({ role: 'user', text });
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, apiKey, apiUrl, mode: 'plan' }) });
      const data = await res.json();
      // 针对未配置/配置错误/上游返回401或URL错误的情况，提示并打开配置
      if ((res.status === 400 && data?.error === 'no_api_configured')) {
        setNeedApiKey(true);
        setShowApiConfig(true);
        append({ role: 'assistant', text: '未配置模型 API，请点击上方“重新配置API”完成设置。' });
        return;
      }
      if (!res.ok) {
        const detail: string = String(data?.detail || '');
        const msg: string = String(data?.message || '调用失败');
        const isInvalidKey = /invalid_api_key/i.test(detail) || /401/.test(msg);
        const isBadUrl = /Failed to parse URL/i.test(detail) || /http/i.test(detail) === false;
        if (isInvalidKey) {
          setNeedApiKey(true);
          setShowApiConfig(true);
          append({ role: 'assistant', text: 'API Key 无效或已过期，请重新配置。' });
        } else if (isBadUrl) {
          setNeedApiKey(true);
          setShowApiConfig(true);
          append({ role: 'assistant', text: 'API Base URL 无效，请检查是否为通义兼容 /chat/completions。' });
        } else {
          append({ role: 'assistant', text: '生成失败：' + msg });
        }
        return;
      }
      const p = data?.parsed;
      if (!p) {
        append({ role: 'assistant', text: '模型未返回可解析的结构化计划。' });
        return;
      }
      setParsed(p);
      append({ role: 'assistant', text: '已生成结构化计划，正在为你创建行程…' });
      await createFromParsed(p);
    } catch (e:any) {
      append({ role: 'assistant', text: '调用异常：' + String(e?.message || e) });
    } finally {
      setLoading(false);
    }
  };

  async function resolveActorId(): Promise<string | null> {
    try {
      if (typeof window !== 'undefined') {
        const ls = localStorage.getItem('actorId');
        if (ls) return ls;
      }
    } catch {}
    try {
      if (typeof document !== 'undefined') {
        const cookie = document.cookie || '';
        const match = cookie.split(';').map(s => s.trim()).find(s => s.startsWith('actorId='));
        const actorId = match ? match.split('=')[1] : null;
        if (actorId) return actorId;
      }
    } catch {}
    return null;
  }

  const createFromParsed = async (obj: any) => {
    setCreating(true);
    try {
      const owner_id = await resolveActorId();
      const payload = Object.assign({}, obj, { owner_id });
      const cr = await fetch('/api/dev/createTrip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const created = await cr.json();
      if (!cr.ok) {
        append({ role: 'assistant', text: '创建行程失败：' + JSON.stringify(created) });
        return;
      }
      setCreatedTrip(created);
      // create items
      let addedCount = 0;
      if (Array.isArray(obj.days)) {
        for (const d of obj.days) {
          if (!Array.isArray(d.items)) continue;
          for (const it of d.items) {
            const item = Object.assign({}, it, { date: d.date || it.date });
            try {
              const r = await fetch('/api/dev/addItineraryItem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tripId: created.id, item }) });
              if (r.ok) addedCount += 1;
            } catch {}
          }
        }
      }
      let expenseCount = 0;
      if (Array.isArray(obj.expenses)) {
        for (const ex of obj.expenses) {
          try {
            const r = await fetch('/api/dev/addExpense', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tripId: created.id, expense: ex }) });
            if (r.ok) expenseCount += 1;
          } catch {}
        }
      }
      if (addedCount) append({ role: 'system', text: `已添加 ${addedCount} 个日程条目。` });
      if (expenseCount) append({ role: 'system', text: `已添加 ${expenseCount} 条费用记录。` });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 880, margin: '0 auto' }}>
      <h2 style={{ marginTop: 4, marginBottom: 12 }}>AI 智能行程规划</h2>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <button onClick={() => setShowApiConfig(s => !s)}>{showApiConfig ? '收起配置' : '重新配置API'}</button>
      </div>
      <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 12, minHeight: 320, background: '#fafafa' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{m.role}</div>
            <div style={{ background: m.role === 'user' ? '#e6f7ff' : '#fff', padding: 10, borderRadius: 8 }}>{m.text}</div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b7280' }}>
            <div className="spinner" style={{ width: 16, height: 16, border: '2px solid #ddd', borderTopColor: '#111827', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            模型正在思考，请稍候…
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <VoiceRecorder onResult={onVoice} />
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="例如：我想去日本，5天，预算1万元，喜欢美食和动漫，带孩子" style={{ flex: 1 }} />
        <button onClick={requestPlan} disabled={loading}>{loading ? '生成中…' : '生成计划并保存'}</button>
      </div>

      {(needApiKey || showApiConfig) && (
        <div style={{ marginTop: 12, padding: 10, border: '1px dashed #ddd', borderRadius: 8 }}>
          <div style={{ fontSize: 13, color: '#6b7280' }}>未检测到模型 API Key/URL，请在浏览器 localStorage 保存：</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input placeholder="API Key" value={apiKey ?? ''} onChange={e => setApiKey(e.target.value)} style={{ width: 320 }} />
            <input placeholder="API Base URL（通义兼容 /chat/completions）" value={apiUrl ?? ''} onChange={e => setApiUrl(e.target.value)} style={{ width: 380 }} />
            <button onClick={() => { if (typeof window !== 'undefined') { if (apiKey) localStorage.setItem('tongyi_api_key', apiKey); if (apiUrl) localStorage.setItem('tongyi_api_url', apiUrl); } setNeedApiKey(!(apiKey && apiUrl)); setShowApiConfig(false); }}>保存</button>
            <button onClick={() => { try { localStorage.removeItem('tongyi_api_key'); localStorage.removeItem('tongyi_api_url'); } catch {} setApiKey(''); setApiUrl(''); setNeedApiKey(true); setShowApiConfig(true); }}>清除并重试</button>
          </div>
        </div>
      )}

      {createdTrip && (
        <div style={{ marginTop: 16, padding: 12, border: '1px solid #d1fae5', background: '#ecfdf5', borderRadius: 10 }}>
          <div style={{ marginBottom: 6 }}>已创建行程：</div>
          <a href={`/trips/${createdTrip.id}`} style={{ textDecoration: 'none' }}>
            <button>打开「{createdTrip.title || '新行程'}」详情</button>
          </a>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}


