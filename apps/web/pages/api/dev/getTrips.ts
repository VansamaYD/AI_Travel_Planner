import type { NextApiRequest, NextApiResponse } from 'next';
import { getTrips } from '../../../lib/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const trips = await getTrips();
    res.status(200).json(trips);
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
