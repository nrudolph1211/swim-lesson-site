/**
 * HAC Swim Lesson Pricing Engine
 *
 * Implements the official HAC Pricing Report:
 * - Session-based pricing with program types
 * - Discount stacking (max 2 percentage discounts)
 * - Sibling discount on lowest-priced enrollment
 * - Referral credits as account credit (not percentage)
 * - Registration fee tracking
 */

// ── Program Type Defaults ──────────────────────────────────

export type ProgramType =
  | "parent_child"
  | "preschool_group"
  | "youth_beginner"
  | "youth_intermediate"
  | "teen_adult"
  | "semi_private"
  | "private_single"
  | "private_4pack"
  | "private_8pack";

export type SeasonType = "summer_intensive" | "shoulder_spring" | "shoulder_fall";

interface ProgramDefaults {
  label: string;
  basePrice: number;
  shoulderPrice: number;
  maxCapacity: number;
  durationMinutes: number;
  level: number | null;
  perLesson: number;
  lessons: number;
}

export const PROGRAM_DEFAULTS: Record<ProgramType, ProgramDefaults> = {
  parent_child: {
    label: "Parent & Child (6mo–3yr)",
    basePrice: 120,
    shoulderPrice: 130,
    maxCapacity: 6,
    durationMinutes: 25,
    level: 0,
    perLesson: 15,
    lessons: 8,
  },
  preschool_group: {
    label: "Preschool Group (3–5yr)",
    basePrice: 140,
    shoulderPrice: 150,
    maxCapacity: 4,
    durationMinutes: 30,
    level: 1,
    perLesson: 17.5,
    lessons: 8,
  },
  youth_beginner: {
    label: "Youth Beginner L1–4 (6–12yr)",
    basePrice: 140,
    shoulderPrice: 150,
    maxCapacity: 4,
    durationMinutes: 30,
    level: 1,
    perLesson: 17.5,
    lessons: 8,
  },
  youth_intermediate: {
    label: "Youth Intermediate+ L5 (6–12yr)",
    basePrice: 160,
    shoulderPrice: 170,
    maxCapacity: 6,
    durationMinutes: 45,
    level: 5,
    perLesson: 20,
    lessons: 8,
  },
  teen_adult: {
    label: "Teen/Adult Group (13+)",
    basePrice: 160,
    shoulderPrice: 170,
    maxCapacity: 6,
    durationMinutes: 45,
    level: 1,
    perLesson: 20,
    lessons: 8,
  },
  semi_private: {
    label: "Semi-Private (All Ages)",
    basePrice: 280,
    shoulderPrice: 300,
    maxCapacity: 2,
    durationMinutes: 30,
    level: null,
    perLesson: 35,
    lessons: 8,
  },
  private_single: {
    label: "Private — Single Lesson",
    basePrice: 55,
    shoulderPrice: 55,
    maxCapacity: 1,
    durationMinutes: 30,
    level: null,
    perLesson: 55,
    lessons: 1,
  },
  private_4pack: {
    label: "Private — 4-Lesson Package",
    basePrice: 200,
    shoulderPrice: 200,
    maxCapacity: 1,
    durationMinutes: 30,
    level: null,
    perLesson: 50,
    lessons: 4,
  },
  private_8pack: {
    label: "Private — 8-Lesson Package",
    basePrice: 375,
    shoulderPrice: 375,
    maxCapacity: 1,
    durationMinutes: 30,
    level: null,
    perLesson: 46.88,
    lessons: 8,
  },
};

export function getDefaultBasePrice(
  programType: ProgramType,
  seasonType: SeasonType = "summer_intensive"
): number {
  const defaults = PROGRAM_DEFAULTS[programType];
  if (!defaults) return 0;
  return seasonType === "summer_intensive"
    ? defaults.basePrice
    : defaults.shoulderPrice;
}

export function getProgramDefaults(programType: ProgramType): ProgramDefaults | undefined {
  return PROGRAM_DEFAULTS[programType];
}

// ── Discount Settings ──────────────────────────────────────

export interface DiscountSettings {
  military_discount_pct: number;
  member_discount_pct: number;
  sibling_discount_2nd_pct: number;
  sibling_discount_3rd_pct: number;
  early_bird_discount_pct: number;
  multi_session_discount_pct: number;
  max_discount_stack: number;
  referral_credit_amount: number;
  annual_registration_fee: number;
}

export const DEFAULT_DISCOUNT_SETTINGS: DiscountSettings = {
  military_discount_pct: 10,
  member_discount_pct: 10,
  sibling_discount_2nd_pct: 10,
  sibling_discount_3rd_pct: 15,
  early_bird_discount_pct: 15,
  multi_session_discount_pct: 10,
  max_discount_stack: 2,
  referral_credit_amount: 25,
  annual_registration_fee: 30,
};

// ── Checkout Price Calculator ──────────────────────────────

export interface CheckoutPriceInput {
  basePrice: number;
  isMember: boolean;
  isMilitary: boolean;
  isEarlyBird: boolean;
  siblingIndex: number; // 0 = first child, 1 = second, 2+ = third+
  isMultiSession: boolean;
  availableCredits: number;
  applyCredits: boolean;
  settings: DiscountSettings;
}

export interface DiscountApplied {
  name: string;
  percent: number;
  amount: number;
}

export interface CheckoutPriceResult {
  basePrice: number;
  discountsApplied: DiscountApplied[];
  discountsNotApplied: DiscountApplied[];
  subtotalAfterDiscounts: number;
  creditsApplied: number;
  totalDue: number;
  discountLimitReached: boolean;
}

export function calculateCheckoutPrice(input: CheckoutPriceInput): CheckoutPriceResult {
  const {
    basePrice,
    isMember,
    isMilitary,
    isEarlyBird,
    siblingIndex,
    isMultiSession,
    availableCredits,
    applyCredits,
    settings,
  } = input;

  // 1. Gather all eligible percentage discounts
  const eligible: { name: string; percent: number; category: string }[] = [];

  if (isEarlyBird && settings.early_bird_discount_pct > 0) {
    eligible.push({
      name: "Early-Bird Discount",
      percent: settings.early_bird_discount_pct,
      category: "early_bird",
    });
  }

  if (isMilitary && settings.military_discount_pct > 0) {
    eligible.push({
      name: "Military Discount",
      percent: settings.military_discount_pct,
      category: "military",
    });
  }

  if (isMember && settings.member_discount_pct > 0) {
    eligible.push({
      name: "HAC Member Discount",
      percent: settings.member_discount_pct,
      category: "member",
    });
  }

  if (siblingIndex === 1 && settings.sibling_discount_2nd_pct > 0) {
    eligible.push({
      name: "Sibling Discount (2nd child)",
      percent: settings.sibling_discount_2nd_pct,
      category: "sibling",
    });
  } else if (siblingIndex >= 2 && settings.sibling_discount_3rd_pct > 0) {
    eligible.push({
      name: "Sibling Discount (3rd+ child)",
      percent: settings.sibling_discount_3rd_pct,
      category: "sibling",
    });
  }

  if (isMultiSession && settings.multi_session_discount_pct > 0) {
    eligible.push({
      name: "Multi-Session Discount",
      percent: settings.multi_session_discount_pct,
      category: "multi_session",
    });
  }

  // 2. Apply stacking rules:
  //    - Sort by percentage descending (best discounts first)
  //    - Max `max_discount_stack` discounts
  //    - Military and Member do NOT stack — pick the better one
  //    - Early-bird can stack with ONE other
  eligible.sort((a, b) => b.percent - a.percent);

  // Remove the lesser of military/member if both present
  const hasMilitary = eligible.some((e) => e.category === "military");
  const hasMember = eligible.some((e) => e.category === "member");
  if (hasMilitary && hasMember) {
    const milPct = eligible.find((e) => e.category === "military")!.percent;
    const memPct = eligible.find((e) => e.category === "member")!.percent;
    const removeCategory = milPct >= memPct ? "member" : "military";
    const idx = eligible.findIndex((e) => e.category === removeCategory);
    if (idx !== -1) eligible.splice(idx, 1);
  }

  const maxStack = settings.max_discount_stack;
  const applied: DiscountApplied[] = [];
  const notApplied: DiscountApplied[] = [];

  for (const disc of eligible) {
    if (applied.length < maxStack) {
      const amount = Math.round(basePrice * (disc.percent / 100) * 100) / 100;
      applied.push({ name: disc.name, percent: disc.percent, amount });
    } else {
      const amount = Math.round(basePrice * (disc.percent / 100) * 100) / 100;
      notApplied.push({ name: disc.name, percent: disc.percent, amount });
    }
  }

  // 3. Calculate subtotal
  const totalDiscount = applied.reduce((sum, d) => sum + d.amount, 0);
  const subtotalAfterDiscounts = Math.max(basePrice - totalDiscount, 0);

  // 4. Apply credits
  const creditsApplied =
    applyCredits && availableCredits > 0
      ? Math.min(availableCredits, subtotalAfterDiscounts)
      : 0;

  const totalDue = Math.max(subtotalAfterDiscounts - creditsApplied, 0);

  return {
    basePrice,
    discountsApplied: applied,
    discountsNotApplied: notApplied,
    subtotalAfterDiscounts,
    creditsApplied,
    totalDue,
    discountLimitReached: notApplied.length > 0,
  };
}

// ── Refund Calculator ──────────────────────────────────────

export interface RefundResult {
  refundAmount: number;
  refundPercent: number;
  reason: string;
  registrationFeeRefundable: boolean;
}

export function calculateRefund(
  amountPaid: number,
  sessionStartDate: string,
  cancelDate: Date = new Date()
): RefundResult {
  const start = new Date(sessionStartDate);
  const oneWeekAfterStart = new Date(start);
  oneWeekAfterStart.setDate(oneWeekAfterStart.getDate() + 7);

  if (cancelDate < start) {
    return {
      refundAmount: amountPaid,
      refundPercent: 100,
      reason: "Full refund — cancelled before session start",
      registrationFeeRefundable: false,
    };
  }

  if (cancelDate <= oneWeekAfterStart) {
    const refund = Math.round(amountPaid * 0.5 * 100) / 100;
    return {
      refundAmount: refund,
      refundPercent: 50,
      reason: "50% refund — cancelled during first week",
      registrationFeeRefundable: false,
    };
  }

  return {
    refundAmount: 0,
    refundPercent: 0,
    reason: "No refund — session is past the first week",
    registrationFeeRefundable: false,
  };
}

// ── Sibling Index Helper ───────────────────────────────────

export function getSiblingIndex(
  existingEnrollmentCount: number
): number {
  return existingEnrollmentCount; // 0 = first, 1 = second, 2+ = third+
}

// ── Early Bird Check ───────────────────────────────────────

export function isEarlyBird(
  sessionStartDate: string,
  earlyBirdDeadline?: string | null
): boolean {
  const now = new Date();

  // If the session has an explicit early-bird deadline, use it
  if (earlyBirdDeadline) {
    return now < new Date(earlyBirdDeadline);
  }

  // Fallback: early bird if registering more than 6 weeks before session start
  const start = new Date(sessionStartDate);
  const sixWeeksBefore = new Date(start);
  sixWeeksBefore.setDate(sixWeeksBefore.getDate() - 42);
  return now < sixWeeksBefore;
}
