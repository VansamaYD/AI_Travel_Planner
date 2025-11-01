import { z } from 'zod';

export const ExpenseSchema = z.object({
  id: z.string().optional(),
  trip_id: z.string().optional(),
  itinerary_item_id: z.string().nullable().optional(),
  amount: z.number(),
  currency: z.string(),
  payer_id: z.string().optional(),
  user_id: z.string().optional(),
  description: z.string().nullable().optional(),
  // optional fields that map to DB columns
  category: z.string().nullable().optional(),
  date: z.string().optional(),
  note: z.string().nullable().optional(),
  vendor: z.string().nullable().optional(),
  payment_method: z.string().nullable().optional(),
  recorded_via: z.string().optional(),
  raw_transcript: z.string().nullable().optional(),
  receipt_url: z.string().nullable().optional(),
  split: z.any().optional(),
  status: z.string().optional(),
  created_at: z.string().optional(),
});

export const ItineraryItemSchema = z.object({
  id: z.string().optional(),
  trip_id: z.string().optional(),
  day_index: z.number().optional(),
  // core fields
  title: z.string(),
  date: z.string(),
  start_time: z.string().nullable().optional(),
  end_time: z.string().nullable().optional(),
  // human-friendly notes / description
  notes: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  // optional type/category (e.g. flight, hotel, poi)
  type: z.string().nullable().optional(),
  // location object: lat/lng/address
  location: z
    .object({
      lat: z.number().optional(),
      lng: z.number().optional(),
      address: z.string().optional(),
    })
    .nullable()
    .optional(),
  // cost related
  est_cost: z.number().nullable().optional(),
  actual_cost: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  // sequence/order within day
  sequence: z.number().optional(),
  // any extra JSON blob
  extra: z.any().optional(),
  created_at: z.string().optional(),
});

export const TripSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  days: z
    .array(
      z.object({
        date: z.string().optional(),
        items: z.array(ItineraryItemSchema).optional(),
      })
    )
    .optional(),
  // additional backend fields commonly returned/stored
  owner_id: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  estimated_budget: z.number().nullable().optional(),
  currency: z.string().optional(),
  status: z.string().optional(),
  visibility: z.string().optional(),
  collaborators: z.array(z.string()).optional(),
  metadata: z.any().optional(),
  estimated_budget_consumed: z.number().optional(),
  last_budget_recalc_at: z.string().nullable().optional(),
  estimated_budget_remaining: z.number().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

// Partial helper for update payloads
export const PartialTrip = TripSchema.partial();

// Partial helpers for update payloads
export const PartialExpense = ExpenseSchema.partial();
export const PartialItineraryItem = ItineraryItemSchema.partial();

export type Expense = z.infer<typeof ExpenseSchema>;
export type ItineraryItem = z.infer<typeof ItineraryItemSchema>;
export type Trip = z.infer<typeof TripSchema>;
