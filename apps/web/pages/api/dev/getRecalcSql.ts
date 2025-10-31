import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const p = path.resolve(process.cwd(), 'scripts/recalculate_budgets.sql');
    if (!fs.existsSync(p)) return res.status(404).json({ error: 'file not found' });
    const sql = fs.readFileSync(p, 'utf-8');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(sql);
  } catch (e:any) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
