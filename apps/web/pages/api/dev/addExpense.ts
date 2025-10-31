import type { NextApiRequest, NextApiResponse } from 'next';
import { addExpense } from '../../../lib/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
    const { tripId, expense } = req.body;
    if (!tripId || !expense) return res.status(400).json({ error: 'tripId and expense required' });
    const result = await addExpense(String(tripId), expense);
    res.status(200).json(result);
  } catch (e:any) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
