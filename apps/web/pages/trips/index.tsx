import React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { getTrips, Trip } from '../../lib/api';

const fetcher = () => getTrips();

export default function TripsPage() {
  const { data: trips, error } = useSWR<Trip[]>('trips', fetcher);

  if (error) return <div>加载失败</div>;
  if (!trips) return <div>加载中...</div>;

  return (
    <div style={{ padding: 24 }}>
      <h1>我的行程</h1>
      <ul>
        {trips.map(t => (
          <li key={t.id} style={{ marginBottom: 12 }}>
            <Link href={`/trips/${t.id}`}>
              <>
                <strong>{t.title}</strong> <span style={{ color: '#666' }}>{t.start_date} - {t.end_date}</span>
              </>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
