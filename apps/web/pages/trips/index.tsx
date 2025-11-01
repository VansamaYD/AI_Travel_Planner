import React from 'react';
import Link from 'next/link';
import { GetServerSideProps } from 'next';
import { getTrips, Trip } from '../../lib/api';

type Props = {
  trips: Trip[];
};

export default function TripsPage({ trips }: Props) {
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

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const cookie = ctx.req.headers.cookie || '';
  const match = cookie.split(';').map(s => s.trim()).find(s => s.startsWith('actorId='));
  const actorId = match ? match.split('=')[1] : null;
  if (!actorId) {
    return {
      redirect: {
        destination: '/dev/login',
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
