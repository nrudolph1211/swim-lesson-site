-- ============================================================
-- HAC Swim Booking — Seed Data Migration
-- ============================================================

-- ============================================================
-- 1. SKILLS (37 total across 5 levels)
-- ============================================================

-- Clear existing skills to replace with updated curriculum
DELETE FROM skill_records;
DELETE FROM skills;

-- Level 1: Water Introduction
INSERT INTO skills (level, skill_name, skill_order, description) VALUES
  (1, 'Enters water willingly', 1, 'Willingly enters the pool without distress'),
  (1, 'Blows bubbles with mouth', 2, 'Can blow bubbles with mouth submerged in water'),
  (1, 'Submerges face for 3 seconds', 3, 'Submerges entire face underwater and holds for 3 seconds'),
  (1, 'Assisted front float (5 seconds)', 4, 'Floats on front with instructor support for 5 seconds'),
  (1, 'Assisted back float (5 seconds)', 5, 'Floats on back with instructor support for 5 seconds'),
  (1, 'Kicks with support', 6, 'Performs flutter kick while holding kickboard or with instructor support'),
  (1, 'Comfortable with water on face/head', 7, 'Remains calm when water is poured over face and head')
ON CONFLICT DO NOTHING;

-- Level 2: Beginner
INSERT INTO skills (level, skill_name, skill_order, description) VALUES
  (2, 'Unassisted front float (5 seconds)', 1, 'Floats on front without support for 5 seconds'),
  (2, 'Unassisted back float (5 seconds)', 2, 'Floats on back without support for 5 seconds'),
  (2, 'Submerges fully and retrieves object', 3, 'Goes fully underwater to retrieve an object from the bottom'),
  (2, 'Front glide with kick (5 yards)', 4, 'Pushes off wall and glides on front with kick for 5 yards'),
  (2, 'Back glide with kick (5 yards)', 5, 'Pushes off wall and glides on back with kick for 5 yards'),
  (2, 'Rolls from front to back', 6, 'Rolls from front float position to back float position in water'),
  (2, 'Enters water by jumping from side', 7, 'Jumps into the pool from the side unassisted')
ON CONFLICT DO NOTHING;

-- Level 3: Intermediate
INSERT INTO skills (level, skill_name, skill_order, description) VALUES
  (3, 'Freestyle arms with side breathing (10 yards)', 1, 'Performs freestyle arm stroke with side breathing for 10 yards'),
  (3, 'Backstroke kick with arms (10 yards)', 2, 'Swims backstroke with coordinated arms and kick for 10 yards'),
  (3, 'Treads water for 30 seconds', 3, 'Treads water in deep end for 30 seconds'),
  (3, 'Bobs in deep water (10 consecutive)', 4, 'Performs 10 consecutive bobs in deep water with controlled breathing'),
  (3, 'Streamline push-off from wall', 5, 'Pushes off wall in streamline position and glides'),
  (3, 'Swims 15 yards without stopping', 6, 'Swims 15 yards continuously using any stroke'),
  (3, 'Elementary backstroke introduction', 7, 'Demonstrates basic elementary backstroke arm and kick pattern')
ON CONFLICT DO NOTHING;

-- Level 4: Advanced
INSERT INTO skills (level, skill_name, skill_order, description) VALUES
  (4, 'Freestyle with rhythmic breathing (25 yards)', 1, 'Swims 25 yards freestyle with consistent rhythmic breathing'),
  (4, 'Backstroke full stroke (25 yards)', 2, 'Swims 25 yards backstroke with proper form'),
  (4, 'Breaststroke kick (15 yards)', 3, 'Demonstrates proper breaststroke kick for 15 yards'),
  (4, 'Butterfly kick (15 yards)', 4, 'Performs dolphin/butterfly kick for 15 yards on front or back'),
  (4, 'Treads water for 1 minute', 5, 'Treads water continuously for 1 minute'),
  (4, 'Diving from standing position', 6, 'Performs a standing dive from the side of the pool'),
  (4, 'Swims 50 yards continuously', 7, 'Swims 50 yards continuously using any stroke')
ON CONFLICT DO NOTHING;

-- Level 5: Pre-Competitive
INSERT INTO skills (level, skill_name, skill_order, description) VALUES
  (5, 'Freestyle with flip turn', 1, 'Swims freestyle and executes a flip turn at the wall'),
  (5, 'Backstroke with flip turn', 2, 'Swims backstroke and executes a flip turn at the wall'),
  (5, 'Breaststroke full stroke (25 yards)', 3, 'Swims 25 yards breaststroke with proper timing and form'),
  (5, 'Butterfly full stroke (15 yards)', 4, 'Swims 15 yards butterfly with coordinated arms, kick, and breathing'),
  (5, 'Individual Medley (25 yards each stroke)', 5, 'Swims 100-yard IM: 25 fly, 25 back, 25 breast, 25 free'),
  (5, 'Racing dive from blocks', 6, 'Performs a racing dive from starting blocks'),
  (5, 'Treads water for 2 minutes', 7, 'Treads water continuously for 2 minutes'),
  (5, 'Swims 100 yards continuously', 8, 'Swims 100 yards continuously with proper form')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. SETTINGS — Application defaults
-- ============================================================

INSERT INTO settings (key, value) VALUES
  ('member_discount_pct', '15'),
  ('military_discount_pct', '20'),
  ('drop_in_surcharge_pct', '25'),
  ('makeup_credit_limit', '2'),
  ('makeup_expiry', '"end_of_session"'),
  ('cancellation_notice_hours', '24'),
  ('waiver_validity_months', '12'),
  ('late_enrollment_allowed', 'true'),
  ('referral_credit_amount', '15'),
  ('referral_program_enabled', 'true'),
  ('pool_season_start', '4'),
  ('pool_season_end', '10'),
  ('google_review_url', '""'),
  ('facebook_review_url', '""')
ON CONFLICT (key) DO NOTHING;
