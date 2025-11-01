import type { NextApiRequest, NextApiResponse } from 'next';
import { addItineraryItem } from '../../../lib/api';
import { ItineraryItemSchema } from '../../../lib/schemas';

/**
 * @openapi
 * /api/dev/addItineraryItem:
 *   post:
 *     summary: Add an itinerary item to a trip (dev)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tripId:
 *                 type: string
 *               item:
 *                 type: object
 *                 description: Itinerary item object. All fields are optional unless noted.
 *                 properties:
 *                   id:
 *                     type: string
 *                   title:
 *                     type: string
 *                   date:
 *                     type: string
 *                     format: date
 *                   start_time:
 *                     type: string
 *                   end_time:
 *                     type: string
 *                   notes:
 *                     type: string
 *                   description:
 *                     type: string
 *                   type:
 *                     type: string
 *                     description: Category such as flight, hotel, poi
 *                   location:
 *                     type: object
 *                     properties:
 *                       lat:
 *                         type: number
 *                       lng:
 *                         type: number
 *                       address:
 *                         type: string
 *                   est_cost:
 *                     type: number
 *                   actual_cost:
 *                     type: number
 *                   currency:
 *                     type: string
 *                   sequence:
 *                     type: integer
 *                   extra:
 *                     type: object
 *                 example:
 *                   id: item_1
 *                   title: Visit the museum
 *                   date: 2025-11-01
 *                   start_time: '10:00'
 *                   end_time: '12:00'
 *                   notes: Buy tickets online
 *                   description: A deep-dive tour of the city history museum
 *                   type: activity
 *                   location:
 *                     lat: 31.2304
 *                     lng: 121.4737
 *                     address: People's Square, Shanghai
 *                   est_cost: 100
 *                   actual_cost: 0
 *                   currency: CNY
 *                   sequence: 1
 *                   extra:
 *                     createdBy: tester
 *     responses:
 *       '200':
 *         description: created itinerary item
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ItineraryItem'
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
    const { tripId, item } = req.body;
    if (!tripId || !item) return res.status(400).json({ error: 'tripId and item required' });
    const withDefaults = Object.assign({ start_time: null, end_time: null }, item);
    const parsed = ItineraryItemSchema.safeParse(withDefaults);
    if (!parsed.success) {
      const issues = parsed.error.issues.map(i => ({ path: i.path, message: i.message, code: i.code }));
      return res.status(400).json({ error: 'invalid item payload', issues });
    }
    const resp = await addItineraryItem(String(tripId), parsed.data);
    if (!resp.ok) return res.status(500).json({ error: resp.error });
    return res.status(200).json(resp.data);
  } catch (e:any) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
