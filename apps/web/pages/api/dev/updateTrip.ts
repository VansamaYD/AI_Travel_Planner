import type { NextApiRequest, NextApiResponse } from 'next';
import { updateTrip } from '../../../lib/api';
import { PartialTrip } from '../../../lib/schemas';

/**
 * @openapi
 * /api/dev/updateTrip:
 *   post:
 *     summary: Update a trip (dev)
 *     parameters:
 *       - in: header
 *         name: x-actor-id
 *         description: Optional actor id. If not provided, server reads `actorId` from cookie or Authorization header. Used for permission checks.
 *         required: false
 *         schema:
 *           type: string
 *           example: 00000000-0000-0000-0000-000000000001
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               updates:
 *                 $ref: '#/components/schemas/Trip'
 *     responses:
 *       '200':
 *         description: updated trip
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Trip'
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
    const { id, updates } = req.body as { id?: string; updates?: any };
    if (!id) return res.status(400).json({ error: 'id required' });
  const bodyAny: any = req.body as any;
  const callerId = bodyAny.actorId || bodyAny.actor_id || req.cookies?.actorId || (req.headers.authorization ? String(req.headers.authorization).replace(/^Bearer\s+/i, '') : undefined) || req.headers['x-actor-id'];

    const parsed = PartialTrip.safeParse(updates || {});
    if (!parsed.success) return res.status(400).json({ error: 'invalid updates payload', details: parsed.error.format() });
    // normalize possible notes -> description
    const normalized: any = Object.assign({}, parsed.data);
    if (normalized.notes && !normalized.description) normalized.description = normalized.notes;

  // require actor id for permission check
  if (!callerId) return res.status(401).json({ error: 'actorId required for permission check' });

    // fetch trip to validate actor permissions (owner or collaborator)
    try {
      const { data: tripRow, error: tErr } = await (await import('../../../lib/supabaseClient')).supabase
        .from('trips')
        .select('owner_id,collaborators')
        .eq('id', String(id))
        .single();
      if (tErr) return res.status(500).json({ error: tErr });
      if (!tripRow) return res.status(404).json({ error: 'trip not found' });
      const collabs = Array.isArray(tripRow.collaborators) ? tripRow.collaborators.map(String) : [];
      if (String(tripRow.owner_id) !== String(callerId) && !collabs.includes(String(callerId))) {
        return res.status(403).json({ error: 'forbidden: actor is not owner or collaborator' });
      }
    } catch (e:any) {
      return res.status(500).json({ error: String(e?.message || e) });
    }

    const resp = await updateTrip(String(id), normalized);
    if (!resp.ok) return res.status(500).json({ error: resp.error });
    return res.status(200).json(resp.data);
  } catch (e:any) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
