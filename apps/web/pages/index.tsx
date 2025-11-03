import { GetServerSideProps } from 'next';

// Root route: redirect to login if no actorId cookie, otherwise to /trips
export default function Index() {
  // This page never renders on client because we redirect in getServerSideProps
  return null;
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const cookie = ctx.req.headers.cookie || '';
  const match = cookie.split(';').map(s => s.trim()).find(s => s.startsWith('actorId='));
  const actorId = match ? match.split('=')[1] : null;

  if (actorId) {
    return {
      redirect: {
        destination: '/trips',
        permanent: false,
      },
    };
  }

  return {
    redirect: {
      destination: '/login',
      permanent: false,
    },
  };
};
