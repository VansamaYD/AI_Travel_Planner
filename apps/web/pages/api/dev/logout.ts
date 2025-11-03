import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    // clear cookie
    res.setHeader('Set-Cookie', 'actorId=; Path=/; Max-Age=0');
    return res.status(200).json({ ok: true });
  } catch (e:any) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}


