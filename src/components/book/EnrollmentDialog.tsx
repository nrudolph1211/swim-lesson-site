"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Loader2,
  ShieldAlert,
  User,
  Info,
} from "lucide-react";
import { getLevelColor, getLevelTextColor, getLevelName, formatPriceDollars } from "@/lib/swim-utils";
import { formatTime } from "@/lib/date-utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { EmptyState } from "@/components/ui/empty-state";
import {
  calculateCheckoutPrice,
  isEarlyBird,
  type DiscountSettings,
  type CheckoutPriceResult,
} from "@/lib/pricing";
import type { ClassWithDetails } from "@/hooks/useClasses";
import type { SwimmerRow } from "@/hooks/useSwimmers";
import Link from "next/link";

interface EnrollmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cls: ClassWithDetails | null;
  swimmers: SwimmerRow[];
  getWaiverStatus: (id: string) => "active" | "expiring" | "required";
  isMember: boolean;
  isMilitary: boolean;
  familyCredits: number;
  discountSettings: DiscountSettings;
  onSuccess: () => void;
}

type Step = "select-swimmer" | "summary";

export function EnrollmentDialog({
  open,
  onOpenChange,
  cls,
  swimmers,
  getWaiverStatus,
  isMember,
  isMilitary,
  familyCredits,
  discountSettings,
  onSuccess,
}: EnrollmentDialogProps) {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState<Step>("select-swimmer");
  const [selectedSwimmer, setSelectedSwimmer] = useState<SwimmerRow | null>(null);
  const [applyCredits, setApplyCredits] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [siblingCount, setSiblingCount] = useState(0);
  const [regFeeNeeded, setRegFeeNeeded] = useState(false);
  const [existingEnrollment, setExistingEnrollment] = useState<{
    id: string;
    status: string;
    payment_status: string;
  } | null>(null);
  const [contextLoading, setContextLoading] = useState(false);

  const isFull = cls ? cls.confirmed_count >= cls.max_capacity : false;
  const basePrice = cls ? (cls.base_price ?? cls.non_member_price ?? 0) : 0;

  // Check sibling count + registration fee when swimmer is selected
  useEffect(() => {
    if (!selectedSwimmer || !cls) return;

    let cancelled = false;
    setContextLoading(true);

    const checkContext = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      // Check sibling enrollments in this session (server-side filtered)
      const { data: siblings } = await supabase
        .from("enrollments")
        .select("id, swimmer:swimmers!inner(family_id), class:classes!inner(session_id)")
        .neq("swimmer_id", selectedSwimmer.id)
        .eq("status", "confirmed")
        .eq("swimmers.family_id", user.id)
        .eq("classes.session_id", cls.session.id);

      if (cancelled) return;
      setSiblingCount((siblings ?? []).length);

      // Check existing enrollment for duplicate prevention
      const { data: existing } = await supabase
        .from("enrollments")
        .select("id, status, payment_status")
        .eq("swimmer_id", selectedSwimmer.id)
        .eq("class_id", cls.id)
        .in("status", ["confirmed", "waitlisted"])
        .maybeSingle();

      if (cancelled) return;
      setExistingEnrollment(existing ?? null);

      // Check registration fee
      const year = new Date().getFullYear();
      const { data: regFee } = await supabase
        .from("registration_fees")
        .select("id, status")
        .eq("family_id", user.id)
        .eq("year", year)
        .eq("status", "paid")
        .maybeSingle();

      if (cancelled) return;
      setRegFeeNeeded(!regFee);
      setContextLoading(false);
    };

    checkContext();

    return () => { cancelled = true; };
  }, [selectedSwimmer, cls, supabase]);

  // Calculate price using the pricing engine
  const priceResult: CheckoutPriceResult = useMemo(() => {
    if (!cls) {
      return {
        basePrice: 0,
        discountsApplied: [],
        discountsNotApplied: [],
        subtotalAfterDiscounts: 0,
        creditsApplied: 0,
        totalDue: 0,
        discountLimitReached: false,
      };
    }

    return calculateCheckoutPrice({
      basePrice,
      isMember,
      isMilitary,
      isEarlyBird: isEarlyBird(cls.session.start_date, cls.session.early_bird_deadline),
      siblingIndex: siblingCount,
      isMultiSession: false,
      availableCredits: familyCredits,
      applyCredits,
      settings: discountSettings,
    });
  }, [cls, basePrice, isMember, isMilitary, siblingCount, familyCredits, applyCredits, discountSettings]);

  const regFeeAmount = regFeeNeeded ? discountSettings.annual_registration_fee : 0;
  const grandTotal = priceResult.totalDue + regFeeAmount;

  const handleSelectSwimmer = (swimmer: SwimmerRow) => {
    const waiverStatus = getWaiverStatus(swimmer.id);
    if (waiverStatus === "required") return;
    setSelectedSwimmer(swimmer);
    setStep("summary");
  };

  const handleBack = () => {
    setStep("select-swimmer");
    setSelectedSwimmer(null);
    setExistingEnrollment(null);
  };

  const handleEnroll = async () => {
    if (!cls || !selectedSwimmer) return;
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Duplicate check
      if (existingEnrollment) {
        if (existingEnrollment.payment_status === "paid") {
          toast.info(`${selectedSwimmer.first_name} is already enrolled and paid.`);
          setSubmitting(false);
          return;
        }
        // Pending payment — update pricing and create new Stripe session
        if (existingEnrollment.payment_status === "pending" && existingEnrollment.status === "confirmed") {
          await supabase
            .from("enrollments")
            .update({
              amount_due: priceResult.totalDue,
              credits_applied: priceResult.creditsApplied,
              discount_breakdown: {
                discounts: priceResult.discountsApplied,
                basePrice: priceResult.basePrice,
                subtotal: priceResult.subtotalAfterDiscounts,
              },
            })
            .eq("id", existingEnrollment.id);
          await goToStripe(existingEnrollment.id, user.id);
          return;
        }
      }

      const status = isFull ? "waitlisted" : "confirmed";

      // Create enrollment with discount breakdown
      const { data: enrollment, error: enrollErr } = await supabase
        .from("enrollments")
        .insert({
          swimmer_id: selectedSwimmer.id,
          class_id: cls.id,
          status,
          payment_status: "pending",
          amount_due: priceResult.totalDue,
          credits_applied: priceResult.creditsApplied,
          discount_breakdown: {
            discounts: priceResult.discountsApplied,
            basePrice: priceResult.basePrice,
            subtotal: priceResult.subtotalAfterDiscounts,
          },
        })
        .select("id")
        .single();

      if (enrollErr) {
        // Unique constraint violation = duplicate
        if (enrollErr.code === "23505") {
          toast.error(`${selectedSwimmer.first_name} is already enrolled in this class.`);
          setSubmitting(false);
          return;
        }
        throw enrollErr;
      }

      if (isFull) {
        toast.success(`${selectedSwimmer.first_name} has been added to the waitlist.`);
        onSuccess();
        onOpenChange(false);
        resetState();
        return;
      }

      // Full amount covered (by credits or zero-cost) — skip Stripe
      if (grandTotal <= 0) {
        if (priceResult.creditsApplied > 0) {
          await supabase.from("family_credits").insert({
            family_id: user.id,
            amount: -priceResult.creditsApplied,
            type: "used",
            description: `Applied to enrollment ${enrollment.id}`,
          });
        }
        await supabase
          .from("enrollments")
          .update({ payment_status: "paid" })
          .eq("id", enrollment.id);

        if (regFeeNeeded) {
          await supabase.from("registration_fees").upsert({
            family_id: user.id,
            year: new Date().getFullYear(),
            status: "paid",
            paid_at: new Date().toISOString(),
            amount: 0,
          }, { onConflict: "family_id,year" });
        }

        toast.success(
          priceResult.creditsApplied > 0
            ? `${selectedSwimmer.first_name} is enrolled! Credits applied.`
            : `${selectedSwimmer.first_name} is enrolled!`
        );
        onSuccess();
        onOpenChange(false);
        resetState();
        return;
      }

      // Go to Stripe
      await goToStripe(enrollment.id, user.id);
    } catch (err) {
      console.error("Enrollment error:", err);
      toast.error("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  const goToStripe = async (enrollmentId: string, userId: string) => {
    if (!cls || !selectedSwimmer) return;

    const discountSummary = priceResult.discountsApplied
      .map((d) => `${d.name} (${d.percent}%): -$${d.amount.toFixed(2)}`)
      .join("; ");

    const res = await fetch("/api/stripe/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enrollment_id: enrollmentId,
        class_id: cls.id,
        swimmer_name: `${selectedSwimmer.first_name} ${selectedSwimmer.last_name}`,
        session_name: cls.session.name,
        level: cls.level,
        amount: Math.round(priceResult.totalDue * 100),
        registration_fee: regFeeNeeded ? Math.round(regFeeAmount * 100) : 0,
        credits_applied: Math.round(priceResult.creditsApplied * 100),
        discount_breakdown: discountSummary,
      }),
    });

    if (!res.ok) throw new Error("Failed to create checkout session");

    const { url } = await res.json();
    router.push(url);
  };

  const resetState = () => {
    setStep("select-swimmer");
    setSelectedSwimmer(null);
    setApplyCredits(false);
    setExistingEnrollment(null);
    setSiblingCount(0);
    setRegFeeNeeded(false);
    setContextLoading(false);
  };

  if (!cls) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) resetState();
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isFull ? "Join Waitlist" : "Enroll"} — {cls.session.name}
          </DialogTitle>
          <DialogDescription>
            L{cls.level}: {getLevelName(cls.level)} • {cls.day_of_week.join(", ")}{" "}
            {formatTime(cls.start_time)} – {formatTime(cls.end_time)}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Select Swimmer */}
        {step === "select-swimmer" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Select which swimmer to enroll:
            </p>
            {swimmers.length === 0 ? (
              <EmptyState
                icon={<User className="size-10" />}
                title="No Swimmers Found"
                description="Add a swimmer to your account before enrolling."
                action={{ label: "Go to Dashboard", onClick: () => router.push("/dashboard") }}
              />
            ) : (
              <div className="space-y-2">
                {swimmers.map((swimmer) => {
                  const waiverStatus = getWaiverStatus(swimmer.id);
                  const diff = Math.abs(swimmer.current_level - cls.level);
                  const hasWarning = diff === 1;
                  const isBlocked = diff > 1;
                  const waiverRequired = waiverStatus === "required";

                  return (
                    <button
                      key={swimmer.id}
                      type="button"
                      disabled={waiverRequired || isBlocked}
                      onClick={() => handleSelectSwimmer(swimmer)}
                      className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                        waiverRequired || isBlocked
                          ? "cursor-not-allowed opacity-60"
                          : "hover:border-primary hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="flex size-9 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: getLevelColor(swimmer.current_level),
                            color: getLevelTextColor(swimmer.current_level),
                          }}
                        >
                          <User className="size-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {swimmer.first_name} {swimmer.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Level {swimmer.current_level}: {getLevelName(swimmer.current_level)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasWarning && (
                          <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                            <AlertTriangle className="mr-1 size-3" />
                            Level ±1
                          </Badge>
                        )}
                        {isBlocked && <Badge variant="destructive">Level mismatch</Badge>}
                        {waiverRequired && (
                          <Link href={`/waiver/${swimmer.id}`} onClick={(e) => e.stopPropagation()}>
                            <Badge variant="destructive">
                              <ShieldAlert className="mr-1 size-3" />
                              Sign Waiver
                            </Badge>
                          </Link>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Order Summary */}
        {step === "summary" && selectedSwimmer && (
          <div className="space-y-4">
            {/* Duplicate enrollment warning */}
            {existingEnrollment && (
              <div className="flex items-start gap-2 rounded-md border border-blue-300 bg-blue-50 p-3 text-sm text-blue-800">
                <Info className="mt-0.5 size-4 shrink-0" />
                <div>
                  {existingEnrollment.payment_status === "paid" ? (
                    <p>{selectedSwimmer.first_name} is already enrolled and paid for this class.</p>
                  ) : existingEnrollment.status === "waitlisted" ? (
                    <p>{selectedSwimmer.first_name} is already on the waitlist for this class.</p>
                  ) : (
                    <p>
                      {selectedSwimmer.first_name} is already enrolled — payment is pending.
                      Click below to complete payment.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Level mismatch warning */}
            {selectedSwimmer && cls && Math.abs(selectedSwimmer.current_level - cls.level) === 1 && (
              <div className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>
                  {selectedSwimmer.first_name} is Level {selectedSwimmer.current_level} but this class
                  is Level {cls.level}. The instructor may adjust placement.
                </p>
              </div>
            )}

            {/* Order Summary */}
            <div className="rounded-lg border p-4">
              <h4 className="text-sm font-semibold">Order Summary</h4>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Swimmer</span>
                  <span>{selectedSwimmer.first_name} {selectedSwimmer.last_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Class</span>
                  <span>
                    L{cls.level} — {cls.day_of_week.join(", ")} {formatTime(cls.start_time)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Session</span>
                  <span>{cls.session.name}</span>
                </div>

                <div className="my-2 border-t" />

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base Price</span>
                  <span>{formatPriceDollars(priceResult.basePrice)}</span>
                </div>

                {priceResult.discountsApplied.map((d, i) => (
                  <div key={i} className="flex justify-between text-green-600">
                    <span>{d.name} ({d.percent}%)</span>
                    <span>-{formatPriceDollars(d.amount)}</span>
                  </div>
                ))}

                {priceResult.discountLimitReached && (
                  <div className="flex items-start gap-1.5 rounded bg-muted/50 p-2 text-xs text-muted-foreground">
                    <Info className="mt-0.5 size-3 shrink-0" />
                    <span>
                      Maximum {discountSettings.max_discount_stack} discounts applied.
                      Additional eligible:{" "}
                      {priceResult.discountsNotApplied.map((d) => `${d.name} (${d.percent}%)`).join(", ")}
                    </span>
                  </div>
                )}

                {familyCredits > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={applyCredits}
                        onCheckedChange={setApplyCredits}
                        id="apply-credits"
                      />
                      <Label htmlFor="apply-credits" className="text-sm">
                        Apply ${familyCredits.toFixed(2)} credit
                      </Label>
                    </div>
                    {applyCredits && priceResult.creditsApplied > 0 && (
                      <span className="text-green-600">
                        -{formatPriceDollars(priceResult.creditsApplied)}
                      </span>
                    )}
                  </div>
                )}

                {regFeeNeeded && (
                  <>
                    <div className="my-2 border-t" />
                    <div className="flex justify-between">
                      <div>
                        <span className="text-muted-foreground">Annual Registration Fee</span>
                        <p className="text-[10px] text-muted-foreground">
                          One-time per family/year. Non-refundable.
                        </p>
                      </div>
                      <span>{formatPriceDollars(regFeeAmount)}</span>
                    </div>
                  </>
                )}

                <div className="my-2 border-t" />

                <div className="flex justify-between text-base font-bold">
                  <span>Total Due</span>
                  <span>{formatPriceDollars(grandTotal)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleBack} className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleEnroll}
                disabled={
                  submitting ||
                  contextLoading ||
                  (existingEnrollment?.payment_status === "paid") ||
                  (existingEnrollment?.status === "waitlisted")
                }
                className="flex-1"
              >
                {(submitting || contextLoading) && <Loader2 className="mr-2 size-4 animate-spin" />}
                {contextLoading
                  ? "Loading..."
                  : existingEnrollment?.payment_status === "pending"
                    ? "Complete Payment"
                    : isFull
                      ? "Join Waitlist"
                      : grandTotal <= 0
                        ? "Enroll (Covered by Credits)"
                        : "Proceed to Payment"}
              </Button>
            </div>

            {!isFull && grandTotal > 0 && !existingEnrollment && (
              <p className="text-center text-xs text-muted-foreground">
                You&apos;ll be redirected to Stripe for secure payment.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
