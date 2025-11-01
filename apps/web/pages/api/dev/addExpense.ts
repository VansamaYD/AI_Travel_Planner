import type { NextApiRequest, NextApiResponse } from 'next';
import { addExpense } from '../../../lib/api';
import { ExpenseSchema } from '../../../lib/schemas';

/**
 * @openapi
 * /api/dev/addExpense:
 *   post:
 *     summary: Add an expense to a trip (dev)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tripId:
 *                 type: string
 *               expense:
 *                 type: object
 *                 description: Expense object. Fields are optional unless noted in schema.
 *                 properties:
 *                   id:
 *                     type: string
 *                   amount:
 *                     type: number
 *                   currency:
 *                     type: string
 *                   payer_id:
 *                     type: string
 *                     description: UUID of payer (use real UUID or omit)
 *                   itinerary_item_id:
 *                     type: string
 *                   user_id:
 *                     type: string
 *                   description:
 *                     type: string
 *                   note:
 *                     type: string
 *                   payment_method:
 *                     type: string
 *                   vendor:
 *                     type: string
 *                   receipt_url:
 *                     type: string
 *                   raw_transcript:
 *                     type: string
 *                   split:
 *                     type: object
 *                   date:
 *                     type: string
 *                     format: date
 *                   category:
 *                     type: string
 *                   status:
 *                     type: string
 *             example:
 *               tripId: 11111111-1111-1111-1111-111111111111
 *               expense:
 *                 id: exp_abc123
 *                 amount: 42.5
 *                 currency: USD
 *                 payer_id: 00000000-0000-0000-0000-000000000001
 *                 itinerary_item_id: a1b2c3d4-0000-0000-0000-000000000000
 *                 description: Lunch at local cafe
 *                 note: Lunch at local cafe
 *                 payment_method: card
 *                 vendor: Local Cafe
 *                 receipt_url: https://example.com/receipt.jpg
 *                 raw_transcript: null
 *                 split: { "type": "equal" }
 *                 date: "2025-10-31"
 *                 category: food
 *                 status: pending
 *     responses:
 *       '200':
 *         description: added expense or result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Expense'
 *             example:
 *               ok: true
 *               data:
 *                 id: exp_abc123
 *                 trip_id: 11111111-1111-1111-1111-111111111111
 *                 itinerary_item_id: a1b2c3d4-0000-0000-0000-000000000000
 *                 user_id: null
 *                 amount: 42.5
 *                 currency: USD
 *                 category: null
 *                 date: 2025-10-31
 *                 note: Lunch at local cafe
 *                 recorded_via: web
 *                 raw_transcript: null
 *                 created_at: 2025-10-31T00:00:00.000Z
 *                 payer_id: 00000000-0000-0000-0000-000000000001
 *                 status: pending
 *                 payment_method: null
 *                 vendor: null
 *                 receipt_url: null
 *                 split: null
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
    const { tripId, expense } = req.body;
    if (!tripId || !expense) return res.status(400).json({ error: 'tripId and expense required' });

    // Fill sensible defaults before validation
    const expenseWithDefaults = Object.assign({ currency: 'CNY' }, expense);

    // Validate required fields using Zod
    const parsed = ExpenseSchema.safeParse(expenseWithDefaults);
    if (!parsed.success) {
      // Map Zod errors into a friendlier shape highlighting missing/invalid fields
      const issues = parsed.error.issues.map((i) => ({ path: i.path, message: i.message, code: i.code }));
      return res.status(400).json({ error: 'invalid expense payload', issues });
    }

    const result = await addExpense(String(tripId), parsed.data);
    res.status(200).json(result);
  } catch (e:any) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
