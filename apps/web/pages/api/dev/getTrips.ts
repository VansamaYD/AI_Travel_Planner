import type { NextApiRequest, NextApiResponse } from 'next';
import { getTrips } from '../../../lib/api';

/**
 * @openapi
 * /api/dev/getTrips:
 *   get:
 *     summary: Get list of trips (dev)
 *     responses:
 *       '200':
 *         description: array of trips
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Trip'
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const trips = await getTrips();
    res.status(200).json(trips);
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
