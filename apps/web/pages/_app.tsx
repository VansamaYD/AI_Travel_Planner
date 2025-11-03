import type { AppProps } from 'next/app';
import '../styles/globals.css';
import React from 'react';
import { SWRConfig } from 'swr';
import Link from 'next/link';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <SWRConfig value={{ revalidateOnFocus: false }}>
      <div style={{ padding: 12, borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontWeight: 700 }}>
          <Link href="/trips" style={{ textDecoration: 'none', color: 'inherit' }}>AI Travel Planner</Link>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link href="/trips" style={{ textDecoration: 'none' }}>我的行程</Link>
          <Link href="/ai" style={{ textDecoration: 'none' }}>AI 规划</Link>
          <Link href="/login" style={{ textDecoration: 'none' }}>登录</Link>
          <Link href="/register" style={{ textDecoration: 'none' }}>注册</Link>
          <button onClick={async () => {
            try {
              await fetch('/api/dev/logout', { method: 'POST' });
            } catch (e) {}
            try { localStorage.removeItem('actorId'); } catch (e) {}
            location.href = '/login';
          }}>退出</button>
        </div>
      </div>
      <Component {...pageProps} />
    </SWRConfig>
  );
}

export default MyApp;
