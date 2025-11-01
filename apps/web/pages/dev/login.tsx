import React, { useState } from 'react';
import { useRouter } from 'next/router';

export default function DevLogin() {
  const [email, setEmail] = useState('owner@example.com');
  const [password, setPassword] = useState('password');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/dev/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await resp.json();
      if (!resp.ok) {
        setError(body?.error || 'login failed');
        setLoading(false);
        return;
      }
      // store actor id in localStorage for client-side tests; server also sets HttpOnly cookie
      if (body?.user?.id) localStorage.setItem('actorId', body.user.id);
      // After successful login, go to trips page
      router.push('/trips');
    } catch (e:any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Dev Login</h2>
      <form onSubmit={submit}>
        <div>
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div style={{ marginTop: 10 }}>
          <button type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
        </div>
        {error && <div style={{ color: 'red', marginTop: 10 }}>{error}</div>}
      </form>
      <p style={{ marginTop: 12 }}>Tip: use <code>owner@example.com</code> to sign in as the demo owner (maps to id 00000000-...001).</p>
    </div>
  );
}
