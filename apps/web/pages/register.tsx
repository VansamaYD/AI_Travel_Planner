import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/dev/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await resp.json();
      if (!resp.ok) {
        setError(body?.error || '注册失败');
        setLoading(false);
        return;
      }
      if (body?.user?.id) localStorage.setItem('actorId', body.user.id);
      router.push('/trips');
    } catch (e:any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%)' }}>
      <div style={{ width: 380, background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 24, boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>AI Travel Planner</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>注册新账号，开始使用 AI 旅行规划</div>
        </div>
        <form onSubmit={submit}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#374151', marginBottom: 6 }}>邮箱</label>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" type="email" required style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#374151', marginBottom: 6 }}>密码</label>
              <input value={password} onChange={e => setPassword(e.target.value)} placeholder="至少 6 位" type="password" required style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }} />
            </div>
            <button type="submit" disabled={loading} style={{ marginTop: 4, width: '100%', background: '#111827', color: '#fff', border: 0, borderRadius: 8, padding: '10px 12px', cursor: 'pointer' }}>{loading ? '注册中…' : '注册'}</button>
            {error ? <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div> : null}
          </div>
        </form>
        <div style={{ marginTop: 12, fontSize: 13, color: '#6b7280', textAlign: 'center' }}>
          已有账号？ <Link href="/login" style={{ color: '#2563eb', textDecoration: 'none' }}>去登录</Link>
        </div>
      </div>
    </div>
  );
}


