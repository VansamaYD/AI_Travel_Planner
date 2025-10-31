import type { NextApiRequest, NextApiResponse } from 'next';
import { getTrip } from '../../../lib/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });
    const trip = await getTrip(String(id));
    if (!trip) return res.status(404).json({ error: 'not found' });
    res.status(200).json(trip);
  } catch (e:any) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
