import type { NextApiRequest, NextApiResponse } from 'next';
import { updateExpense } from '../../../lib/api';
import { PartialExpense } from '../../../lib/schemas';

/**
 * @openapi
 * /api/dev/updateExpense:
 *   post:
 *     summary: Update an expense (dev)
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
 *                 $ref: '#/components/schemas/Expense'
 *     responses:
 *       '200':
 *         description: updated expense
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Expense'
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const { id, updates } = req.body as { id?: string; updates?: any };
  if (!id) return res.status(400).json({ error: 'id required' });
  const parsed = PartialExpense.safeParse(updates || {});
  if (!parsed.success) return res.status(400).json({ error: 'invalid updates payload', details: parsed.error.format() });
  // normalize common client fields to DB columns (description -> note, accept item_id variants)
  const normalized: any = Object.assign({}, parsed.data);
  if (typeof normalized.description === 'string' && !normalized.note) normalized.note = normalized.description;
  if (normalized.item_id && !normalized.itinerary_item_id) normalized.itinerary_item_id = normalized.item_id;
  if (normalized.itineraryItemId && !normalized.itinerary_item_id) normalized.itinerary_item_id = normalized.itineraryItemId;

  // determine caller id from body, header or cookie
  const bodyAny: any = req.body as any;
  const callerId = bodyAny.actorId || bodyAny.actor_id || req.cookies?.actorId || (req.headers.authorization ? String(req.headers.authorization).replace(/^Bearer\s+/i, '') : undefined) || req.headers['x-actor-id'];

  // permission check: allow if caller is trip owner or collaborator or the payer of this expense
  try {
    const sb = await import('../../../lib/supabaseClient');
    const { data: expenseRow, error: eErr } = await sb.supabase.from('expenses').select('payer_id,trip_id').eq('id', String(id)).single();
    if (eErr) return res.status(500).json({ error: eErr });
    if (!expenseRow) return res.status(404).json({ error: 'expense not found' });
    const { data: tripRow, error: tErr } = await sb.supabase.from('trips').select('owner_id,collaborators').eq('id', expenseRow.trip_id).single();
    if (tErr) return res.status(500).json({ error: tErr });
    const collabs = Array.isArray(tripRow.collaborators) ? tripRow.collaborators.map(String) : [];
    if (!(String(expenseRow.payer_id) === String(callerId) || String(tripRow.owner_id) === String(callerId) || collabs.includes(String(callerId)))) {
      return res.status(403).json({ error: 'forbidden: actor cannot modify this expense' });
    }
  } catch (e:any) {
    return res.status(500).json({ error: String(e?.message || e) });
  }

  const resp = await updateExpense(String(id), normalized);
  if (!resp.ok) return res.status(500).json({ error: resp.error });
  return res.status(200).json(resp.data);
  } catch (e:any) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
