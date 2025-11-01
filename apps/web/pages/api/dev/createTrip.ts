import type { NextApiRequest, NextApiResponse } from 'next';
import { createTrip } from '../../../lib/api';
import { TripSchema } from '../../../lib/schemas';

/**
 * @openapi
 * /api/dev/createTrip:
 *   post:
 *     summary: Create a trip (dev)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Trip'
 *     responses:
 *       '200':
 *         description: created trip
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Trip'
 *             example:
 *               id: 5d18dbff-234d-4e95-b877-670b9bc0e4ae
 *               owner_id: 00000000-0000-0000-0000-000000000001
 *               title: Beijing Weekend
 *               description: A short weekend trip to Beijing
 *               start_date: 2025-11-01
 *               end_date: 2025-11-03
 *               estimated_budget: 5000
 *               currency: CNY
 *               status: draft
 *               visibility: private
 *               collaborators: []
 *               created_at: 2025-10-31T10:57:14.25548+00:00
 *               updated_at: 2025-10-31T10:57:14.25548+00:00
 *               metadata: {}
 *               estimated_budget_consumed: 0
 *               last_budget_recalc_at: 2025-10-31T00:00:00.000Z
 *               estimated_budget_remaining: 5000
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
    const payload = req.body;
    // Fill defaults
    const withDefaults = Object.assign({ currency: 'CNY', status: 'draft' }, payload);
    const parsed = TripSchema.safeParse(withDefaults);
    if (!parsed.success) {
      const issues = parsed.error.issues.map(i => ({ path: i.path, message: i.message, code: i.code }));
      return res.status(400).json({ error: 'invalid trip payload', issues });
    }
    const resp = await createTrip(parsed.data);
    if (!resp.ok) return res.status(500).json({ error: resp.error });
    return res.status(200).json(resp.data);
  } catch (e:any) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
