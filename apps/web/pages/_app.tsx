import type { AppProps } from 'next/app';
import '../styles/globals.css';
import React, { useEffect, useState } from 'react';
import { SWRConfig } from 'swr';
import Link from 'next/link';

function MyApp({ Component, pageProps }: AppProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // 检查是否已登录
    if (typeof window !== 'undefined') {
      const checkLogin = () => {
        const cookie = document.cookie || '';
        const hasActorId = cookie.split(';').some(s => s.trim().startsWith('actorId='));
        const hasLocalActorId = localStorage.getItem('actorId');
        setIsLoggedIn(!!(hasActorId || hasLocalActorId));
      };
      checkLogin();
      // 定期检查登录状态
      const interval = setInterval(checkLogin, 1000);
      return () => clearInterval(interval);
    }
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/dev/logout', { method: 'POST' });
    } catch (e) {}
    try { localStorage.removeItem('actorId'); } catch (e) {}
    setIsLoggedIn(false);
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  return (
    <SWRConfig value={{ revalidateOnFocus: false }}>
      <div style={{ padding: '12px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 16, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>
          <Link href="/trips" style={{ textDecoration: 'none', color: '#111827' }}>✈️ AI Travel Planner</Link>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, alignItems: 'center' }}>
          {isLoggedIn ? (
            <>
              <Link href="/trips" style={{ textDecoration: 'none', color: '#374151', fontSize: 14, fontWeight: 500 }}>我的行程</Link>
              <Link href="/ai" style={{ textDecoration: 'none', color: '#374151', fontSize: 14, fontWeight: 500 }}>AI 规划</Link>
              <button 
                onClick={handleLogout}
                style={{
                  padding: '6px 12px',
                  fontSize: 14,
                  background: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                退出
              </button>
            </>
          ) : (
            <>
              <Link href="/login" style={{ textDecoration: 'none', color: '#374151', fontSize: 14, fontWeight: 500 }}>登录</Link>
              <Link href="/register" style={{ textDecoration: 'none', color: '#374151', fontSize: 14, fontWeight: 500 }}>注册</Link>
            </>
          )}
        </div>
      </div>
      <Component {...pageProps} />
    </SWRConfig>
  );
}

export default MyApp;
