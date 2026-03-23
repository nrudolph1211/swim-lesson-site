-- ============================================================
-- HAC Swim Booking — Initial Schema Migration
-- Heights Athletic Club, Harker Heights TX
-- ============================================================

-- ============================================================
-- 0. CLEANUP — Drop everything for a clean start
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS get_user_role(uuid) CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

DROP TABLE IF EXISTS email_subscribers CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS time_entries CASCADE;
DROP TABLE IF EXISTS cancellations CASCADE;
DROP TABLE IF EXISTS surveys CASCADE;
DROP TABLE IF EXISTS family_credits CASCADE;
DROP TABLE IF EXISTS referrals CASCADE;
DROP TABLE IF EXISTS event_registrations CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS email_logs CASCADE;
DROP TABLE IF EXISTS sms_logs CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS session_instructor_notes CASCADE;
DROP TABLE IF EXISTS promotion_requests CASCADE;
DROP TABLE IF EXISTS attendance_records CASCADE;
DROP TABLE IF EXISTS skill_records CASCADE;
DROP TABLE IF EXISTS skills CASCADE;
DROP TABLE IF EXISTS waivers CASCADE;
DROP TABLE IF EXISTS enrollments CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS instructors CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS swimmers CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================================
-- 1. HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 2. TABLES (in dependency order)
-- ============================================================

-- 1. profiles
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  role text NOT NULL DEFAULT 'parent' CHECK (role IN ('parent', 'instructor', 'admin')),
  hac_member_id text,
  is_military boolean DEFAULT false,
  email_notifications boolean DEFAULT true,
  sms_notifications boolean DEFAULT false,
  phone_verified boolean DEFAULT false,
  marketing_emails boolean DEFAULT false,
  calendar_token text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. swimmers
CREATE TABLE swimmers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date NOT NULL,
  current_level integer DEFAULT 1 CHECK (current_level BETWEEN 1 AND 5),
  medical_notes text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relationship text,
  swim_experience text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER swimmers_updated_at
  BEFORE UPDATE ON swimmers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. sessions
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date,
  end_date date,
  enrollment_open_date timestamptz,
  enrollment_close_date timestamptz,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'enrollment_open', 'in_progress', 'completed')),
  early_bird_discount_percent numeric(5,2) DEFAULT 0,
  early_bird_deadline timestamptz,
  priority_enrollment_start timestamptz,
  priority_enrollment_end timestamptz,
  re_enrollment_priority_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. instructors
CREATE TABLE instructors (
  id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  bio text,
  certifications jsonb DEFAULT '[]',
  is_active boolean DEFAULT true,
  photo_url text,
  display_on_website boolean DEFAULT true,
  hourly_rate numeric(6,2),
  has_completed_onboarding boolean DEFAULT false
);

-- 5. classes
CREATE TABLE classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  instructor_id uuid REFERENCES instructors(id) ON DELETE SET NULL,
  level integer NOT NULL CHECK (level BETWEEN 1 AND 5),
  day_of_week text[] NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  max_capacity integer NOT NULL,
  member_price numeric(10,2),
  non_member_price numeric(10,2),
  military_price numeric(10,2),
  class_type text DEFAULT 'group' CHECK (class_type IN ('group', 'private', 'semi_private')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER classes_updated_at
  BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. enrollments
CREATE TABLE enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  swimmer_id uuid NOT NULL REFERENCES swimmers(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  status text DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'waitlisted', 'cancelled')),
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  makeup_credits integer DEFAULT 0,
  enrolled_at timestamptz DEFAULT now(),
  cancelled_at timestamptz,
  notes text
);

-- 7. waivers
CREATE TABLE waivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  swimmer_id uuid NOT NULL REFERENCES swimmers(id) ON DELETE CASCADE,
  signed_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  signed_at timestamptz DEFAULT now(),
  waiver_version text DEFAULT '1.0',
  signature_data text,
  ip_address text,
  expires_at timestamptz,
  is_active boolean DEFAULT true
);

-- 8. skills
CREATE TABLE skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level integer NOT NULL CHECK (level BETWEEN 1 AND 5),
  skill_name text NOT NULL,
  skill_order integer NOT NULL,
  description text
);

-- 9. skill_records
CREATE TABLE skill_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  swimmer_id uuid NOT NULL REFERENCES swimmers(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  status text DEFAULT 'not_started' CHECK (status IN ('not_started', 'introduced', 'practicing', 'mastered')),
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notes text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (swimmer_id, skill_id)
);

-- 10. attendance_records
CREATE TABLE attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  class_date date NOT NULL,
  status text DEFAULT 'present' CHECK (status IN ('present', 'absent', 'excused')),
  recorded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  recorded_at timestamptz DEFAULT now(),
  notes text
);

-- 11. promotion_requests
CREATE TABLE promotion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  swimmer_id uuid NOT NULL REFERENCES swimmers(id) ON DELETE CASCADE,
  from_level integer NOT NULL,
  to_level integer NOT NULL,
  requested_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  admin_notes text,
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 12. session_instructor_notes
CREATE TABLE session_instructor_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  swimmer_id uuid NOT NULL REFERENCES swimmers(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notes text,
  recommendation text CHECK (recommendation IN ('promote', 'continue', 'review')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER session_instructor_notes_updated_at
  BEFORE UPDATE ON session_instructor_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 13. payments
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid REFERENCES enrollments(id) ON DELETE SET NULL,
  family_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  currency text DEFAULT 'usd',
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_method text DEFAULT 'stripe' CHECK (payment_method IN ('stripe', 'cash', 'check', 'comp')),
  description text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- 14. notifications
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'weather_cancellation', 'enrollment_confirmed', 'enrollment_cancelled',
    'waitlist_promoted', 'waiver_expiring', 'session_opening',
    'makeup_credit', 'level_promotion', 'general'
  )),
  title text,
  message text,
  link text,
  read boolean DEFAULT false,
  email_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 15. campaigns
CREATE TABLE campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text,
  body_html text,
  audience_type text,
  audience_filter jsonb,
  recipient_count integer DEFAULT 0,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'sent', 'scheduled')),
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- 16. email_logs
CREATE TABLE email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email text,
  subject text,
  notification_type text,
  status text DEFAULT 'sent',
  resend_message_id text,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- 17. sms_logs
CREATE TABLE sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_phone text,
  message_body text,
  twilio_sid text,
  status text DEFAULT 'sent',
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- 18. events
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  event_type text DEFAULT 'camp' CHECK (event_type IN ('camp', 'workshop', 'clinic')),
  start_date date,
  end_date date,
  daily_start_time time,
  daily_end_time time,
  level_min integer DEFAULT 1,
  level_max integer DEFAULT 5,
  max_capacity integer,
  member_price numeric(10,2),
  non_member_price numeric(10,2),
  military_price numeric(10,2),
  instructor_id uuid REFERENCES instructors(id) ON DELETE SET NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'registration_open', 'full', 'in_progress', 'completed', 'cancelled')),
  image_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 19. event_registrations
CREATE TABLE event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  swimmer_id uuid NOT NULL REFERENCES swimmers(id) ON DELETE CASCADE,
  status text DEFAULT 'confirmed',
  payment_status text DEFAULT 'pending',
  registered_at timestamptz DEFAULT now(),
  notes text
);

-- 20. referrals
CREATE TABLE referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referral_code text UNIQUE NOT NULL,
  referred_email text,
  referred_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'signed_up', 'enrolled', 'credited')),
  credit_amount numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER referrals_updated_at
  BEFORE UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 21. family_credits
CREATE TABLE family_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount numeric(10,2),
  type text CHECK (type IN ('referral', 'adjustment', 'used')),
  description text,
  referral_id uuid REFERENCES referrals(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- 22. surveys
CREATE TABLE surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  swimmer_id uuid NOT NULL REFERENCES swimmers(id) ON DELETE CASCADE,
  overall_rating integer CHECK (overall_rating BETWEEN 1 AND 5),
  instructor_rating integer CHECK (instructor_rating BETWEEN 1 AND 5),
  facility_rating integer CHECK (facility_rating BETWEEN 1 AND 5),
  would_recommend boolean,
  feedback_text text,
  review_requested boolean DEFAULT false,
  review_link_clicked boolean DEFAULT false,
  approved_for_display boolean DEFAULT false,
  display_name text,
  created_at timestamptz DEFAULT now()
);

-- 23. cancellations
CREATE TABLE cancellations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  cancelled_date date NOT NULL,
  reason text,
  cancelled_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- 24. time_entries
CREATE TABLE time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  clock_in timestamptz NOT NULL,
  clock_out timestamptz,
  hours_worked numeric(5,2),
  status text DEFAULT 'clocked_in' CHECK (status IN ('clocked_in', 'completed', 'edited')),
  notes text,
  edited_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- 25. settings
CREATE TABLE settings (
  key text PRIMARY KEY,
  value jsonb,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

-- 26. email_subscribers
CREATE TABLE email_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  source text,
  subscribed_at timestamptz DEFAULT now(),
  unsubscribed_at timestamptz
);

-- ============================================================
-- 3. INDEXES
-- ============================================================

-- profiles
CREATE INDEX idx_profiles_role ON profiles(role);

-- swimmers
CREATE INDEX idx_swimmers_family_id ON swimmers(family_id);
CREATE INDEX idx_swimmers_current_level ON swimmers(current_level);

-- classes
CREATE INDEX idx_classes_session_id ON classes(session_id);
CREATE INDEX idx_classes_instructor_id ON classes(instructor_id);
CREATE INDEX idx_classes_session_level_active ON classes(session_id, level, is_active);

-- enrollments
CREATE INDEX idx_enrollments_swimmer_id ON enrollments(swimmer_id);
CREATE INDEX idx_enrollments_class_id ON enrollments(class_id);
CREATE INDEX idx_enrollments_class_status ON enrollments(class_id, status);
CREATE INDEX idx_enrollments_swimmer_status ON enrollments(swimmer_id, status);

-- waivers
CREATE INDEX idx_waivers_swimmer_id ON waivers(swimmer_id);
CREATE INDEX idx_waivers_signed_by ON waivers(signed_by);

-- skill_records
CREATE INDEX idx_skill_records_swimmer_skill ON skill_records(swimmer_id, skill_id);

-- attendance_records
CREATE INDEX idx_attendance_enrollment_date ON attendance_records(enrollment_id, class_date);

-- promotion_requests
CREATE INDEX idx_promotion_requests_swimmer_id ON promotion_requests(swimmer_id);
CREATE INDEX idx_promotion_requests_status ON promotion_requests(status);

-- session_instructor_notes
CREATE INDEX idx_session_notes_swimmer ON session_instructor_notes(swimmer_id);
CREATE INDEX idx_session_notes_session ON session_instructor_notes(session_id);
CREATE INDEX idx_session_notes_instructor ON session_instructor_notes(instructor_id);

-- payments
CREATE INDEX idx_payments_enrollment_id ON payments(enrollment_id);
CREATE INDEX idx_payments_family_id ON payments(family_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_stripe_pi ON payments(stripe_payment_intent_id);

-- notifications
CREATE INDEX idx_notifications_user_read_created ON notifications(user_id, read, created_at);

-- campaigns
CREATE INDEX idx_campaigns_status ON campaigns(status);

-- events
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_instructor_id ON events(instructor_id);

-- event_registrations
CREATE INDEX idx_event_reg_event_id ON event_registrations(event_id);
CREATE INDEX idx_event_reg_swimmer_id ON event_registrations(swimmer_id);

-- referrals
CREATE INDEX idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX idx_referrals_code ON referrals(referral_code);
CREATE INDEX idx_referrals_referred_id ON referrals(referred_id);

-- family_credits
CREATE INDEX idx_family_credits_family_id ON family_credits(family_id);

-- surveys
CREATE INDEX idx_surveys_session_id ON surveys(session_id);
CREATE INDEX idx_surveys_family_id ON surveys(family_id);

-- cancellations
CREATE INDEX idx_cancellations_class_id ON cancellations(class_id);

-- time_entries
CREATE INDEX idx_time_entries_instructor_id ON time_entries(instructor_id);

-- ============================================================
-- 4. AUTH TRIGGER — auto-create profile on signup
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    'parent'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 5. ROLE HELPER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_role(uid uuid)
RETURNS text AS $$
  SELECT role FROM profiles WHERE id = uid;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 6. ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE swimmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE waivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_instructor_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancellations ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_subscribers ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. RLS POLICIES
-- ============================================================

-- ==================== profiles ====================

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Admins full access to profiles"
  ON profiles FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Instructors can view parent profiles for their students"
  ON profiles FOR SELECT
  USING (
    get_user_role(auth.uid()) = 'instructor'
    AND id IN (
      SELECT s.family_id FROM swimmers s
      JOIN enrollments e ON e.swimmer_id = s.id
      JOIN classes c ON c.id = e.class_id
      WHERE c.instructor_id = auth.uid()
    )
  );

-- ==================== swimmers ====================

CREATE POLICY "Parents can view own swimmers"
  ON swimmers FOR SELECT
  USING (family_id = auth.uid());

CREATE POLICY "Parents can insert own swimmers"
  ON swimmers FOR INSERT
  WITH CHECK (family_id = auth.uid());

CREATE POLICY "Parents can update own swimmers"
  ON swimmers FOR UPDATE
  USING (family_id = auth.uid());

CREATE POLICY "Parents can delete own swimmers"
  ON swimmers FOR DELETE
  USING (family_id = auth.uid());

CREATE POLICY "Instructors can view swimmers in their classes"
  ON swimmers FOR SELECT
  USING (
    get_user_role(auth.uid()) = 'instructor'
    AND id IN (
      SELECT e.swimmer_id FROM enrollments e
      JOIN classes c ON c.id = e.class_id
      WHERE c.instructor_id = auth.uid()
        AND e.status = 'confirmed'
    )
  );

CREATE POLICY "Admins full access to swimmers"
  ON swimmers FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ==================== sessions ====================

CREATE POLICY "Anyone authenticated can view sessions"
  ON sessions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins full access to sessions"
  ON sessions FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ==================== instructors ====================

CREATE POLICY "Anyone authenticated can view active instructors"
  ON instructors FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

CREATE POLICY "Instructors can view and update own record"
  ON instructors FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Instructors can update own record"
  ON instructors FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Admins full access to instructors"
  ON instructors FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ==================== classes ====================

CREATE POLICY "Anyone authenticated can view active classes"
  ON classes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins full access to classes"
  ON classes FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ==================== enrollments ====================

CREATE POLICY "Parents can view own enrollments"
  ON enrollments FOR SELECT
  USING (
    swimmer_id IN (SELECT id FROM swimmers WHERE family_id = auth.uid())
  );

CREATE POLICY "Parents can insert enrollments for own swimmers"
  ON enrollments FOR INSERT
  WITH CHECK (
    swimmer_id IN (SELECT id FROM swimmers WHERE family_id = auth.uid())
  );

CREATE POLICY "Parents can cancel own enrollments"
  ON enrollments FOR UPDATE
  USING (
    swimmer_id IN (SELECT id FROM swimmers WHERE family_id = auth.uid())
  );

CREATE POLICY "Instructors can view enrollments in their classes"
  ON enrollments FOR SELECT
  USING (
    get_user_role(auth.uid()) = 'instructor'
    AND class_id IN (SELECT id FROM classes WHERE instructor_id = auth.uid())
  );

CREATE POLICY "Admins full access to enrollments"
  ON enrollments FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ==================== waivers ====================

CREATE POLICY "Parents can view own waivers"
  ON waivers FOR SELECT
  USING (signed_by = auth.uid());

CREATE POLICY "Parents can insert waivers"
  ON waivers FOR INSERT
  WITH CHECK (signed_by = auth.uid());

CREATE POLICY "Admins full access to waivers"
  ON waivers FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ==================== skills ====================

CREATE POLICY "Anyone authenticated can view skills"
  ON skills FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins full access to skills"
  ON skills FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ==================== skill_records ====================

CREATE POLICY "Parents can view own swimmer skill records"
  ON skill_records FOR SELECT
  USING (
    swimmer_id IN (SELECT id FROM swimmers WHERE family_id = auth.uid())
  );

CREATE POLICY "Instructors can view and write skill records for their students"
  ON skill_records FOR SELECT
  USING (
    get_user_role(auth.uid()) = 'instructor'
    AND swimmer_id IN (
      SELECT e.swimmer_id FROM enrollments e
      JOIN classes c ON c.id = e.class_id
      WHERE c.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can insert skill records"
  ON skill_records FOR INSERT
  WITH CHECK (
    get_user_role(auth.uid()) = 'instructor'
    AND updated_by = auth.uid()
  );

CREATE POLICY "Instructors can update skill records"
  ON skill_records FOR UPDATE
  USING (
    get_user_role(auth.uid()) = 'instructor'
    AND updated_by = auth.uid()
  );

CREATE POLICY "Admins full access to skill_records"
  ON skill_records FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ==================== attendance_records ====================

CREATE POLICY "Parents can view own attendance"
  ON attendance_records FOR SELECT
  USING (
    enrollment_id IN (
      SELECT e.id FROM enrollments e
      JOIN swimmers s ON s.id = e.swimmer_id
      WHERE s.family_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can view and write attendance for their classes"
  ON attendance_records FOR SELECT
  USING (
    get_user_role(auth.uid()) = 'instructor'
    AND enrollment_id IN (
      SELECT e.id FROM enrollments e
      JOIN classes c ON c.id = e.class_id
      WHERE c.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can insert attendance records"
  ON attendance_records FOR INSERT
  WITH CHECK (
    get_user_role(auth.uid()) = 'instructor'
    AND recorded_by = auth.uid()
  );

CREATE POLICY "Instructors can update attendance records"
  ON attendance_records FOR UPDATE
  USING (
    get_user_role(auth.uid()) = 'instructor'
    AND recorded_by = auth.uid()
  );

CREATE POLICY "Admins full access to attendance_records"
  ON attendance_records FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ==================== promotion_requests ====================

CREATE POLICY "Parents can view own promotion requests"
  ON promotion_requests FOR SELECT
  USING (
    swimmer_id IN (SELECT id FROM swimmers WHERE family_id = auth.uid())
  );

CREATE POLICY "Instructors can view and create promotion requests"
  ON promotion_requests FOR SELECT
  USING (get_user_role(auth.uid()) = 'instructor');

CREATE POLICY "Instructors can insert promotion requests"
  ON promotion_requests FOR INSERT
  WITH CHECK (
    get_user_role(auth.uid()) = 'instructor'
    AND requested_by = auth.uid()
  );

CREATE POLICY "Admins full access to promotion_requests"
  ON promotion_requests FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ==================== session_instructor_notes ====================

CREATE POLICY "Instructors can manage own notes"
  ON session_instructor_notes FOR SELECT
  USING (instructor_id = auth.uid());

CREATE POLICY "Instructors can insert own notes"
  ON session_instructor_notes FOR INSERT
  WITH CHECK (instructor_id = auth.uid());

CREATE POLICY "Instructors can update own notes"
  ON session_instructor_notes FOR UPDATE
  USING (instructor_id = auth.uid());

CREATE POLICY "Admins full access to session_instructor_notes"
  ON session_instructor_notes FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ==================== payments ====================

CREATE POLICY "Parents can view own payments"
  ON payments FOR SELECT
  USING (family_id = auth.uid());

CREATE POLICY "Admins full access to payments"
  ON payments FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ==================== notifications ====================

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Admins full access to notifications"
  ON notifications FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ==================== campaigns ====================

CREATE POLICY "Admins full access to campaigns"
  ON campaigns FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ==================== email_logs ====================

CREATE POLICY "Admins full access to email_logs"
  ON email_logs FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ==================== sms_logs ====================

CREATE POLICY "Admins full access to sms_logs"
  ON sms_logs FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ==================== events ====================

CREATE POLICY "Anyone authenticated can view events"
  ON events FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins full access to events"
  ON events FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ==================== event_registrations ====================

CREATE POLICY "Parents can view own event registrations"
  ON event_registrations FOR SELECT
  USING (
    swimmer_id IN (SELECT id FROM swimmers WHERE family_id = auth.uid())
  );

CREATE POLICY "Parents can insert event registrations"
  ON event_registrations FOR INSERT
  WITH CHECK (
    swimmer_id IN (SELECT id FROM swimmers WHERE family_id = auth.uid())
  );

CREATE POLICY "Admins full access to event_registrations"
  ON event_registrations FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ==================== referrals ====================

CREATE POLICY "Parents can view own referrals"
  ON referrals FOR SELECT
  USING (referrer_id = auth.uid());

CREATE POLICY "Parents can insert referrals"
  ON referrals FOR INSERT
  WITH CHECK (referrer_id = auth.uid());

CREATE POLICY "Admins full access to referrals"
  ON referrals FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ==================== family_credits ====================

CREATE POLICY "Parents can view own credits"
  ON family_credits FOR SELECT
  USING (family_id = auth.uid());

CREATE POLICY "Admins full access to family_credits"
  ON family_credits FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ==================== surveys ====================

CREATE POLICY "Parents can view own surveys"
  ON surveys FOR SELECT
  USING (family_id = auth.uid());

CREATE POLICY "Parents can insert surveys"
  ON surveys FOR INSERT
  WITH CHECK (family_id = auth.uid());

CREATE POLICY "Anyone can view approved survey reviews"
  ON surveys FOR SELECT
  USING (approved_for_display = true);

CREATE POLICY "Admins full access to surveys"
  ON surveys FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ==================== cancellations ====================

CREATE POLICY "Anyone authenticated can view cancellations"
  ON cancellations FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins full access to cancellations"
  ON cancellations FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ==================== time_entries ====================

CREATE POLICY "Instructors can view own time entries"
  ON time_entries FOR SELECT
  USING (instructor_id = auth.uid());

CREATE POLICY "Instructors can insert own time entries"
  ON time_entries FOR INSERT
  WITH CHECK (instructor_id = auth.uid());

CREATE POLICY "Instructors can update own time entries"
  ON time_entries FOR UPDATE
  USING (instructor_id = auth.uid());

CREATE POLICY "Admins full access to time_entries"
  ON time_entries FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ==================== settings ====================

CREATE POLICY "Anyone authenticated can view settings"
  ON settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins full access to settings"
  ON settings FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ==================== email_subscribers ====================

CREATE POLICY "Admins full access to email_subscribers"
  ON email_subscribers FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Anyone can subscribe"
  ON email_subscribers FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- 8. SEED DEFAULT SETTINGS
-- ============================================================

INSERT INTO settings (key, value) VALUES
  ('business_name', '"Heights Athletic Club"'),
  ('business_phone', '"(254) 213-5543"'),
  ('business_email', '"swim@hacswim.com"'),
  ('business_address', '{"street": "301 E FM 2410 Rd", "city": "Harker Heights", "state": "TX", "zip": "76548"}'),
  ('waiver_version', '"1.0"'),
  ('max_swimmers_per_family', '6'),
  ('waitlist_enabled', 'true'),
  ('referral_credit_amount', '10.00'),
  ('cancellation_policy_hours', '24')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 9. SEED SKILLS PER LEVEL
-- ============================================================

INSERT INTO skills (level, skill_name, skill_order, description) VALUES
  -- Level 1: Water Acclimation
  (1, 'Enter/Exit Pool Safely', 1, 'Can safely enter and exit the pool using the ladder or edge'),
  (1, 'Blow Bubbles', 2, 'Can blow bubbles with mouth and nose submerged'),
  (1, 'Front Float (assisted)', 3, 'Can float on front with instructor assistance for 5 seconds'),
  (1, 'Back Float (assisted)', 4, 'Can float on back with instructor assistance for 5 seconds'),
  (1, 'Kick with Board', 5, 'Can kick across pool width while holding a kickboard'),
  (1, 'Submerge Face', 6, 'Willingly submerges entire face in water'),
  -- Level 2: Water Movement
  (2, 'Front Float (unassisted)', 1, 'Can float on front unassisted for 10 seconds'),
  (2, 'Back Float (unassisted)', 2, 'Can float on back unassisted for 10 seconds'),
  (2, 'Front Glide', 3, 'Can push off wall and glide on front for 5 feet'),
  (2, 'Back Glide', 4, 'Can push off wall and glide on back for 5 feet'),
  (2, 'Roll Over', 5, 'Can roll from front to back and back to front in water'),
  (2, 'Retrieve Object', 6, 'Can retrieve an object from the bottom in shallow water'),
  -- Level 3: Water Stamina
  (3, 'Freestyle Arms', 1, 'Demonstrates proper freestyle arm motion for 15 yards'),
  (3, 'Backstroke Arms', 2, 'Demonstrates proper backstroke arm motion for 15 yards'),
  (3, 'Rotary Breathing', 3, 'Can perform side breathing while swimming freestyle'),
  (3, 'Treading Water', 4, 'Can tread water for 30 seconds'),
  (3, 'Swim 25 Yards', 5, 'Can swim 25 yards continuously using any stroke'),
  (3, 'Dolphin Kick', 6, 'Can perform dolphin kick on front and back'),
  -- Level 4: Stroke Development
  (4, 'Freestyle (25 yds)', 1, 'Swims 25 yards freestyle with proper form and breathing'),
  (4, 'Backstroke (25 yds)', 2, 'Swims 25 yards backstroke with proper form'),
  (4, 'Breaststroke Kick', 3, 'Demonstrates proper breaststroke kick technique'),
  (4, 'Butterfly Arms', 4, 'Demonstrates butterfly arm motion with breathing'),
  (4, 'Flip Turn Introduction', 5, 'Can perform a basic flip turn at the wall'),
  (4, 'Tread Water (2 min)', 6, 'Can tread water for 2 minutes continuously'),
  -- Level 5: Stroke Mechanics
  (5, 'Freestyle (50 yds)', 1, 'Swims 50 yards freestyle with competitive form'),
  (5, 'Backstroke (50 yds)', 2, 'Swims 50 yards backstroke with competitive form'),
  (5, 'Breaststroke (25 yds)', 3, 'Swims 25 yards breaststroke with proper timing'),
  (5, 'Butterfly (25 yds)', 4, 'Swims 25 yards butterfly with proper form'),
  (5, 'Individual Medley', 5, 'Can swim a 100-yard IM (all four strokes in order)'),
  (5, 'Competitive Starts & Turns', 6, 'Demonstrates dive starts and flip/open turns');
