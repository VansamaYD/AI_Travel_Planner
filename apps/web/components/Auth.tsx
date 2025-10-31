import React, { useEffect, useState } from 'react';
import { supabase, signInWithEmail, signOut, onAuthChange } from '../lib/supabaseClient';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<any | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setUser(data.session?.user ?? null);
    })();

    const { data: sub } = onAuthChange((event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      mounted = false;
      try { sub?.subscription?.unsubscribe(); } catch (e) {}
    };
  }, []);

  const handleSignIn = async () => {
    // basic email+password sign-in (requires user exists in Supabase or enable signup)
    const res = await signInWithEmail(email, password);
    if ((res as any).error) {
      alert('登录失败: ' + JSON.stringify((res as any).error));
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
  };

  if (user) {
    return (
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div>已登录: {user.email || user.id}</div>
        <button onClick={handleSignOut}>退出</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input placeholder="email" value={email} onChange={e => setEmail(e.target.value)} />
      <input placeholder="password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
      <button onClick={handleSignIn}>登录</button>
    </div>
  );
}
