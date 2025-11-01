const { z } = require('zod');
const { zodToJsonSchema } = require('zod-to-json-schema');

// Backup of runtime schemas.js — kept under scripts/generated to avoid colliding with TS source.
// If you need to restore the runtime copy, move this file back to lib/.
const ExpenseSchema = z.object({
  id: z.string().optional(),
  trip_id: z.string().optional(),
  itinerary_item_id: z.string().nullable().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  payer_id: z.string().optional(),
  user_id: z.string().optional(),
  description: z.string().nullable().optional(),
  created_at: z.string().optional(),
});

const ItineraryItemSchema = z.object({
  id: z.string().optional(),
  trip_id: z.string().optional(),
  day_index: z.number().optional(),
  title: z.string().optional(),
  date: z.string().optional(),
  start_time: z.string().nullable().optional(),
  end_time: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  location: z.object({
    lat: z.number().optional(),
    lng: z.number().optional(),
    address: z.string().optional(),
  }).nullable().optional(),
  est_cost: z.number().nullable().optional(),
  actual_cost: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  sequence: z.number().optional(),
  extra: z.any().optional(),
  created_at: z.string().optional(),
});

const TripSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  days: z.array(z.object({
    date: z.string().optional(),
    items: z.array(ItineraryItemSchema).optional(),
  })).optional(),
});

const components = {
  Expense: zodToJsonSchema(ExpenseSchema, 'Expense'),
  ItineraryItem: zodToJsonSchema(ItineraryItemSchema, 'ItineraryItem'),
  Trip: zodToJsonSchema(TripSchema, 'Trip'),
};

module.exports = { ExpenseSchema, ItineraryItemSchema, TripSchema, components };
