-- seeds: example data for local demo

-- create a demo user
INSERT INTO users (id, auth_user_id, email, display_name)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'auth|demo-user', 'demo@example.com', 'Demo User')
ON CONFLICT DO NOTHING;

-- create a demo trip
INSERT INTO trips (id, owner_id, title, start_date, end_date, estimated_budget, currency, status)
VALUES
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', '东京亲子美食游', '2025-12-10', '2025-12-15', 10000, 'CNY', 'generated')
ON CONFLICT DO NOTHING;

-- insert itinerary items
INSERT INTO itinerary_items (id, trip_id, day_index, date, start_time, end_time, title, type, description, location, est_cost, currency, sequence)
VALUES
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 0, '2025-12-10', '08:00:00', '12:30:00', '北京 - 东京 航班', 'transport', '建议直飞', NULL, 2000, 'CNY', 0),
  ('22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111111', 0, '2025-12-10', '15:00:00', '16:30:00', '浅草寺', 'poi', '适合带孩子', '{"lat":35.7148, "lng":139.7967, "address":"浅草 2-3-1"}', 0, 'CNY', 1)
ON CONFLICT DO NOTHING;

-- insert expenses, link to itinerary item (e.g., 拉面店发生在 浅草寺 的行程项)
INSERT INTO expenses (id, trip_id, itinerary_item_id, user_id, amount, currency, category, date, note, recorded_via)
VALUES
  ('33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222223', '00000000-0000-0000-0000-000000000001', 120, 'CNY', 'meal', '2025-12-10', '浅草拉面', 'manual')
ON CONFLICT DO NOTHING;

-- insert a generate job and prompt history
INSERT INTO generate_jobs (id, trip_id, user_id, status, prompt)
VALUES
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'done', '{"input":"我想去日本，5 天，预算 1 万元，喜欢美食和动漫，带孩子"}')
ON CONFLICT DO NOTHING;

INSERT INTO prompts_history (id, user_id, trip_id, direction, content)
VALUES
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'user', '我想去日本，5 天，预算 1 万元，喜欢美食和动漫，带孩子')
ON CONFLICT DO NOTHING;
