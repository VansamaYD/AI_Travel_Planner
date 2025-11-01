import type { NextApiRequest, NextApiResponse } from 'next';
import { updateItineraryItem } from '../../../lib/api';
import { PartialItineraryItem } from '../../../lib/schemas';

/**
 * @openapi
 * /api/dev/updateItem:
 *   post:
 *     summary: Update an itinerary item (dev)
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
 *                 $ref: '#/components/schemas/ItineraryItem'
 *     responses:
 *       '200':
 *         description: updated item
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ItineraryItem'
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const { id, updates } = req.body as { id?: string; updates?: any };
  if (!id) return res.status(400).json({ error: 'id required' });
  const parsed = PartialItineraryItem.safeParse(updates || {});
  if (!parsed.success) return res.status(400).json({ error: 'invalid updates payload', details: parsed.error.format() });
  // Normalize fields (preserve numeric zeros, map notes/description if provided)
  const normalized: any = Object.assign({}, parsed.data);
  if (normalized.notes && !normalized.description) normalized.description = normalized.notes;
  // ensure numeric fields explicitly set to 0 are preserved
  if ('est_cost' in normalized && typeof normalized.est_cost !== 'number') normalized.est_cost = normalized.est_cost ?? null;
  if ('actual_cost' in normalized && typeof normalized.actual_cost !== 'number') normalized.actual_cost = normalized.actual_cost ?? null;
  if ('sequence' in normalized && typeof normalized.sequence !== 'number') normalized.sequence = normalized.sequence ?? null;

  // determine caller id from body, header, or cookie
  const bodyAny: any = req.body as any;
  const callerId = bodyAny.actorId || bodyAny.actor_id || req.cookies?.actorId || (req.headers.authorization ? String(req.headers.authorization).replace(/^Bearer\s+/i, '') : undefined) || req.headers['x-actor-id'];

  if (!callerId) return res.status(401).json({ error: 'actorId required for permission check' });

  // permission check: only trip owner or collaborator can update an itinerary item
  try {
    const sb = await import('../../../lib/supabaseClient');
    const { data: itemRow, error: iErr } = await sb.supabase.from('itinerary_items').select('trip_id').eq('id', String(id)).single();
    if (iErr) return res.status(500).json({ error: iErr });
    if (!itemRow) return res.status(404).json({ error: 'item not found' });
    const { data: tripRow, error: tErr } = await sb.supabase.from('trips').select('owner_id,collaborators').eq('id', itemRow.trip_id).single();
    if (tErr) return res.status(500).json({ error: tErr });
    const collabs = Array.isArray(tripRow.collaborators) ? tripRow.collaborators.map(String) : [];
    if (String(tripRow.owner_id) !== String(callerId) && !collabs.includes(String(callerId))) {
      return res.status(403).json({ error: 'forbidden: actor is not owner or collaborator' });
    }
  } catch (e:any) {
    return res.status(500).json({ error: String(e?.message || e) });
  }

  const resp = await updateItineraryItem(String(id), normalized);
  if (!resp.ok) return res.status(500).json({ error: resp.error });
  return res.status(200).json(resp.data);
  } catch (e:any) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
