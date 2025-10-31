import type { AppProps } from 'next/app';
import '../styles/globals.css';
import React from 'react';
import { SWRConfig } from 'swr';
import Auth from '../components/Auth';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <SWRConfig value={{ revalidateOnFocus: false }}>
      <div style={{ padding: 12, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 600 }}>AI Travel Planner (原型)</div>
        <Auth />
      </div>
      <Component {...pageProps} />
    </SWRConfig>
  );
}

export default MyApp;
