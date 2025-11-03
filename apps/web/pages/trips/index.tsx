import React from 'react';
import Link from 'next/link';
import { GetServerSideProps } from 'next';
import { getTrips, Trip } from '../../lib/api';

type Props = {
  trips: Trip[];
};

export default function TripsPage({ trips }: Props) {
  if (!trips) return <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>加载中...</div>;

  // 统一按钮样式
  const primaryButtonStyle = {
    padding: '10px 20px',
    fontSize: 16,
    fontWeight: 600,
    background: '#2563eb',
    color: '#fff',
    border: 'none' as const,
    borderRadius: 8,
    cursor: 'pointer' as const,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    transition: 'all 0.2s',
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#111827' }}>我的行程</h1>
        <div style={{ marginLeft: 'auto' }}>
          <a href="/ai" style={{ textDecoration: 'none' }}>
            <button 
              style={primaryButtonStyle}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.background = '#1d4ed8';
                (e.target as HTMLElement).style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.background = '#2563eb';
                (e.target as HTMLElement).style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
              }}
            >
              ✨ AI 智能规划
            </button>
          </a>
        </div>
      </div>
      {trips.length === 0 ? (
        <div style={{ 
          padding: 48, 
          textAlign: 'center', 
          background: '#f9fafb', 
          borderRadius: 12, 
          border: '1px solid #e5e7eb',
          color: '#6b7280'
        }}>
          <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 8, color: '#374151' }}>还没有行程</div>
          <div style={{ fontSize: 14, marginBottom: 16 }}>点击上方"AI 智能规划"按钮开始创建你的第一个行程</div>
          <a href="/ai" style={{ textDecoration: 'none' }}>
            <button style={primaryButtonStyle}>
              ✨ 开始规划
            </button>
          </a>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {trips.map(t => (
            <Link 
              key={t.id} 
              href={`/trips/${t.id}`} 
              style={{ 
                textDecoration: 'none', 
                color: 'inherit',
                display: 'block',
                padding: '20px',
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                transition: 'all 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#2563eb';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(37,99,235,0.15)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e5e7eb';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 20, fontWeight: 600, color: '#111827', marginBottom: 8 }}>{t.title}</div>
                  <div style={{ fontSize: 14, color: '#6b7280' }}>
                    <span style={{ marginRight: 16 }}>📅 {t.start_date} - {t.end_date}</span>
                    {t.estimated_budget && (
                      <span>💰 预算: {t.estimated_budget} {t.currency || 'CNY'}</span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 24, color: '#9ca3af' }}>→</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const cookie = ctx.req.headers.cookie || '';
  const match = cookie.split(';').map(s => s.trim()).find(s => s.startsWith('actorId='));
  const actorId = match ? match.split('=')[1] : null;
  if (!actorId) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }

  try {
    const all = await getTrips();
    const owned = (all || []).filter(t => String(t.owner_id) === String(actorId));
    return { props: { trips: owned } };
  } catch (e) {
    return { props: { trips: [] } };
  }
};
