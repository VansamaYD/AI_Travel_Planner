import dynamic from 'next/dynamic';
import React from 'react';

// Swagger UI does browser-only rendering, so load it dynamically without SSR
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });
import 'swagger-ui-react/swagger-ui.css';

export default function ApiDocsPage() {
  return (
    <div style={{ padding: 20 }}>
      <h1>API 文档（开发）</h1>
      <p>这是基于项目内的 <code>/public/openapi.json</code> 的 Swagger UI（仅用于开发）。</p>
      <div style={{ border: '1px solid #eee' }}>
        {/* SwaggerUI expects a url or spec prop */}
        {/* @ts-ignore */}
        <SwaggerUI url="/openapi.json" />
      </div>
    </div>
  );
}
