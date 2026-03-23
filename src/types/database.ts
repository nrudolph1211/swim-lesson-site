export type UserRole = "parent" | "instructor" | "admin";

export type EnrollmentStatus = "active" | "waitlisted" | "cancelled" | "completed";
export type PaymentStatus = "pending" | "paid" | "refunded" | "failed";
export type CancellationReason = "parent_request" | "schedule_conflict" | "medical" | "weather" | "instructor_unavailable" | "other";
export type NotificationType = "info" | "success" | "warning" | "error";
export type DiscountType = "percentage" | "fixed";
export type CampaignChannel = "email" | "sms" | "both";
export type CampaignStatus = "draft" | "scheduled" | "sent" | "failed";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  stripe_customer_id: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  hac_member_id: string | null;
  is_military: boolean;
  referral_code: string | null;
  referred_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Swimmer {
  id: string;
  parent_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  current_level: number;
  medical_notes: string | null;
  allergies: string | null;
  special_needs: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Instructor {
  id: string;
  profile_id: string;
  bio: string | null;
  certifications: string[];
  max_classes: number;
  hourly_rate_cents: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SwimSession {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  registration_open: string;
  registration_close: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export interface SwimClass {
  id: string;
  session_id: string;
  level: number;
  instructor_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_capacity: number;
  current_enrollment: number;
  price_cents: number;
  location: string;
  is_private: boolean;
  created_at: string;
}

export interface Enrollment {
  id: string;
  swimmer_id: string;
  class_id: string;
  status: EnrollmentStatus;
  payment_status: PaymentStatus;
  stripe_payment_intent_id: string | null;
  amount_paid_cents: number;
  discount_applied_cents: number;
  promotion_id: string | null;
  enrolled_at: string;
  cancelled_at: string | null;
  waitlist_position: number | null;
}

export interface Waiver {
  id: string;
  swimmer_id: string;
  parent_id: string;
  signed: boolean;
  signed_at: string | null;
  ip_address: string | null;
  waiver_version: string;
  created_at: string;
}

export interface Skill {
  id: string;
  level: number;
  name: string;
  description: string;
  sort_order: number;
}

export interface SkillRecord {
  id: string;
  swimmer_id: string;
  skill_id: string;
  class_id: string;
  instructor_id: string;
  passed: boolean;
  notes: string | null;
  assessed_at: string;
}

export interface AttendanceRecord {
  id: string;
  enrollment_id: string;
  class_id: string;
  class_date: string;
  present: boolean;
  notes: string | null;
  marked_by: string;
  created_at: string;
}

export interface PromotionRequest {
  id: string;
  swimmer_id: string;
  from_level: number;
  to_level: number;
  instructor_id: string;
  status: "pending" | "approved" | "denied";
  notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  enrollment_id: string;
  parent_id: string;
  amount_cents: number;
  stripe_payment_intent_id: string;
  status: PaymentStatus;
  refund_amount_cents: number;
  refund_reason: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  link: string | null;
  created_at: string;
}

export interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  end_date: string | null;
  location: string;
  max_participants: number | null;
  is_public: boolean;
  image_url: string | null;
  created_at: string;
}

export interface EventRegistration {
  id: string;
  event_id: string;
  parent_id: string;
  swimmer_ids: string[];
  registered_at: string;
}

export interface Promotion {
  id: string;
  code: string;
  description: string;
  discount_type: DiscountType;
  discount_value: number;
  max_uses: number | null;
  current_uses: number;
  valid_from: string;
  valid_until: string;
  applicable_session_ids: string[] | null;
  is_active: boolean;
  created_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  referral_code: string;
  credit_amount_cents: number;
  credited: boolean;
  credited_at: string | null;
  created_at: string;
}

export interface FamilyCredit {
  id: string;
  parent_id: string;
  amount_cents: number;
  reason: string;
  source: "referral" | "refund" | "promo" | "admin";
  applied_to_enrollment_id: string | null;
  created_at: string;
}

export interface Survey {
  id: string;
  swimmer_id: string;
  session_id: string;
  parent_id: string;
  rating: number;
  instructor_rating: number | null;
  facility_rating: number | null;
  feedback: string | null;
  would_recommend: boolean | null;
  submitted_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  body: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  recipient_filter: Record<string, unknown> | null;
  sent_count: number;
  scheduled_for: string | null;
  sent_at: string | null;
  created_by: string;
  created_at: string;
}

export interface Cancellation {
  id: string;
  enrollment_id: string;
  reason: CancellationReason;
  details: string | null;
  refund_amount_cents: number;
  cancelled_by: string;
  created_at: string;
}

export interface TimeEntry {
  id: string;
  instructor_id: string;
  class_id: string;
  class_date: string;
  hours_worked: number;
  rate_cents: number;
  total_cents: number;
  approved: boolean;
  approved_by: string | null;
  created_at: string;
}

export interface Settings {
  id: string;
  key: string;
  value: string;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}
