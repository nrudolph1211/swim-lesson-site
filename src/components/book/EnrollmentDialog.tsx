"use client";

import { useState, useMemo } from "react";
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
  CheckCircle,
  Loader2,
  ShieldAlert,
  User,
} from "lucide-react";
import { getLevelColor, getLevelTextColor, getLevelName, formatPrice } from "@/lib/swim-utils";
import { formatTime } from "@/lib/date-utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { EmptyState } from "@/components/ui/empty-state";
import type { ClassWithDetails } from "@/hooks/useClasses";
import type { SwimmerRow } from "@/hooks/useSwimmers";
import Link from "next/link";

interface EnrollmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cls: ClassWithDetails | null;
  swimmers: SwimmerRow[];
  getWaiverStatus: (id: string) => "active" | "expiring" | "required";
  price: number;
  originalPrice?: number;
  earlyBirdActive: boolean;
  earlyBirdPct: number;
  memberDiscountPct: number;
  militaryDiscountPct: number;
  isMember: boolean;
  isMilitary: boolean;
  familyCredits: number;
  onSuccess: () => void;
}

type Step = "select-swimmer" | "summary";

export function EnrollmentDialog({
  open,
  onOpenChange,
  cls,
  swimmers,
  getWaiverStatus,
  price,
  originalPrice,
  earlyBirdActive,
  earlyBirdPct,
  memberDiscountPct,
  militaryDiscountPct,
  isMember,
  isMilitary,
  familyCredits,
  onSuccess,
}: EnrollmentDialogProps) {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState<Step>("select-swimmer");
  const [selectedSwimmer, setSelectedSwimmer] = useState<SwimmerRow | null>(
    null
  );
  const [applyCredits, setApplyCredits] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isFull = cls
    ? cls.confirmed_count >= cls.max_capacity
    : false;

  const levelMismatch = useMemo(() => {
    if (!selectedSwimmer || !cls) return null;
    const diff = Math.abs(selectedSwimmer.current_level - cls.level);
    if (diff === 0) return null;
    if (diff === 1) return "warning";
    return "blocked";
  }, [selectedSwimmer, cls]);

  // Price calculation
  const priceBreakdown = useMemo(() => {
    if (!cls) return { base: 0, discount: 0, discountLabel: "", credits: 0, total: 0 };

    const base = price;
    let discount = 0;
    let discountLabel = "";

    if (earlyBirdActive && originalPrice) {
      discount = originalPrice - price;
      discountLabel = `Early bird (${earlyBirdPct}% off)`;
    }

    // Member/military discount applies to already-discounted price
    let afterDiscount = base;
    if (isMember && memberDiscountPct > 0) {
      const memberDisc = base * (memberDiscountPct / 100);
      discount += memberDisc;
      afterDiscount -= memberDisc;
      discountLabel += (discountLabel ? " + " : "") + `Member (${memberDiscountPct}% off)`;
    } else if (isMilitary && militaryDiscountPct > 0) {
      const milDisc = base * (militaryDiscountPct / 100);
      discount += milDisc;
      afterDiscount -= milDisc;
      discountLabel += (discountLabel ? " + " : "") + `Military (${militaryDiscountPct}% off)`;
    }

    const creditsApplied = applyCredits
      ? Math.min(familyCredits, afterDiscount)
      : 0;
    const total = Math.max(afterDiscount - creditsApplied, 0);

    return { base: originalPrice ?? base, discount, discountLabel, credits: creditsApplied, total };
  }, [
    cls,
    price,
    originalPrice,
    earlyBirdActive,
    earlyBirdPct,
    isMember,
    isMilitary,
    memberDiscountPct,
    militaryDiscountPct,
    applyCredits,
    familyCredits,
  ]);

  const handleSelectSwimmer = (swimmer: SwimmerRow) => {
    const waiverStatus = getWaiverStatus(swimmer.id);
    if (waiverStatus === "required") return;
    setSelectedSwimmer(swimmer);
    setStep("summary");
  };

  const handleBack = () => {
    setStep("select-swimmer");
    setSelectedSwimmer(null);
  };

  const handleEnroll = async () => {
    if (!cls || !selectedSwimmer) return;
    setSubmitting(true);

    try {
      const status = isFull ? "waitlisted" : "confirmed";

      // Create enrollment
      const { data: enrollment, error: enrollErr } = await supabase
        .from("enrollments")
        .insert({
          swimmer_id: selectedSwimmer.id,
          class_id: cls.id,
          status,
          payment_status: "pending",
        })
        .select("id")
        .single();

      if (enrollErr) throw enrollErr;

      if (isFull) {
        toast.success(
          `${selectedSwimmer.first_name} has been added to the waitlist.`
        );
        onSuccess();
        onOpenChange(false);
        resetState();
        return;
      }

      // If credits cover the full amount, skip Stripe
      if (priceBreakdown.total <= 0 && priceBreakdown.credits > 0) {
        // Apply credits
        await supabase.from("family_credits").insert({
          family_id: (await supabase.auth.getUser()).data.user?.id,
          amount: -priceBreakdown.credits,
          type: "used",
          description: `Applied to enrollment ${enrollment.id}`,
        });

        await supabase
          .from("enrollments")
          .update({ payment_status: "paid" })
          .eq("id", enrollment.id);

        toast.success(
          `${selectedSwimmer.first_name} is enrolled! Credits applied.`
        );
        onSuccess();
        onOpenChange(false);
        resetState();
        return;
      }

      // Otherwise, go to Stripe checkout
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollment_id: enrollment.id,
          class_id: cls.id,
          swimmer_name: `${selectedSwimmer.first_name} ${selectedSwimmer.last_name}`,
          session_name: cls.session.name,
          level: cls.level,
          amount: Math.round(priceBreakdown.total * 100),
          credits_applied: Math.round(priceBreakdown.credits * 100),
        }),
      });

      if (!res.ok) throw new Error("Failed to create checkout session");

      const { url } = await res.json();
      router.push(url);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetState = () => {
    setStep("select-swimmer");
    setSelectedSwimmer(null);
    setApplyCredits(false);
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isFull ? "Join Waitlist" : "Enroll"} — {cls.session.name}
          </DialogTitle>
          <DialogDescription>
            L{cls.level}: {getLevelName(cls.level)} •{" "}
            {cls.day_of_week.join(", ")} {formatTime(cls.start_time)} –{" "}
            {formatTime(cls.end_time)}
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
                description="Add a swimmer to your account before enrolling in a class."
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
                            backgroundColor: getLevelColor(
                              swimmer.current_level
                            ),
                            color: getLevelTextColor(
                              swimmer.current_level
                            ),
                          }}
                        >
                          <User className="size-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {swimmer.first_name} {swimmer.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Level {swimmer.current_level}:{" "}
                            {getLevelName(swimmer.current_level)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {hasWarning && (
                          <Badge
                            variant="outline"
                            className="border-yellow-500 text-yellow-600"
                          >
                            <AlertTriangle className="mr-1 size-3" />
                            Level ±1
                          </Badge>
                        )}
                        {isBlocked && (
                          <Badge variant="destructive">
                            Level mismatch
                          </Badge>
                        )}
                        {waiverRequired && (
                          <Link
                            href={`/waiver/${swimmer.id}`}
                            onClick={(e) => e.stopPropagation()}
                          >
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
            {levelMismatch === "warning" && (
              <div className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>
                  {selectedSwimmer.first_name} is Level{" "}
                  {selectedSwimmer.current_level} but this class is Level{" "}
                  {cls.level}. The instructor may adjust placement after the
                  first lesson.
                </p>
              </div>
            )}

            <div className="rounded-lg border p-4">
              <h4 className="text-sm font-semibold">Order Summary</h4>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Swimmer</span>
                  <span>
                    {selectedSwimmer.first_name} {selectedSwimmer.last_name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Class</span>
                  <span>
                    L{cls.level} — {cls.day_of_week.join(", ")}{" "}
                    {formatTime(cls.start_time)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Session</span>
                  <span>{cls.session.name}</span>
                </div>

                <div className="my-2 border-t" />

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base Price</span>
                  <span>{formatPrice(priceBreakdown.base * 100)}</span>
                </div>

                {priceBreakdown.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>{priceBreakdown.discountLabel}</span>
                    <span>−{formatPrice(priceBreakdown.discount * 100)}</span>
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
                    {applyCredits && (
                      <span className="text-green-600">
                        −{formatPrice(priceBreakdown.credits * 100)}
                      </span>
                    )}
                  </div>
                )}

                <div className="my-2 border-t" />

                <div className="flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span>{formatPrice(priceBreakdown.total * 100)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleBack} className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleEnroll}
                disabled={submitting}
                className="flex-1"
              >
                {submitting && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                {isFull
                  ? "Join Waitlist"
                  : priceBreakdown.total <= 0
                    ? "Enroll (Covered by Credits)"
                    : "Proceed to Payment"}
              </Button>
            </div>

            {!isFull && priceBreakdown.total > 0 && (
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
