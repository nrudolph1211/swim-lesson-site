"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  Users,
  Zap,
  AlertTriangle,
  PhoneOff,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useSwimmers } from "@/hooks/useSwimmers";
import { useFamilyCredits } from "@/hooks/useFamilyCredits";
import {
  getLevelColor,
  getLevelTextColor,
  getLevelName,
  formatPrice,
  DAY_SHORT,
  DAY_NAMES,
} from "@/lib/swim-utils";
import { formatTime } from "@/lib/date-utils";
import { toast } from "sonner";
import type { ClassWithDetails } from "@/hooks/useClasses";
import { CardSkeleton } from "@/components/ui/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineError } from "@/components/ui/inline-error";

// ─── Types ───────────────────────────────────────────────────

type SchedulePreference = "same_time" | "back_to_back" | "same_days" | "no_preference";

interface SelectedSwimmer {
  id: string;
  first_name: string;
  last_name: string;
  current_level: number;
}

interface ScheduleOption {
  id: string;
  assignments: {
    swimmer: SelectedSwimmer;
    cls: ClassWithDetails;
  }[];
  score: number;
  label: string;
  tags: string[];
}

type Step = 1 | 2 | 3 | 4;

// ─── Helpers ─────────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// formatTime is now imported from @/lib/date-utils

function getPrice(cls: ClassWithDetails, isMember: boolean, isMilitary: boolean): number {
  if (isMilitary && cls.military_price != null) return cls.military_price;
  if (isMember && cls.member_price != null) return cls.member_price;
  return cls.non_member_price ?? cls.member_price ?? 0;
}

// ─── Component ───────────────────────────────────────────────

export function FamilyScheduler() {
  const router = useRouter();
  const supabase = createClient();
  const { user } = useAuthContext();
  const { swimmers, loading: swimmersLoading, getWaiverStatus } = useSwimmers();
  const { balance: familyCredits } = useFamilyCredits();

  const [step, setStep] = useState<Step>(1);

  // Step 1 — swimmer selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Step 2 — preferences
  const [preference, setPreference] = useState<SchedulePreference>("same_time");
  const [preferredDays, setPreferredDays] = useState<Set<string>>(new Set());
  const [timeWindow, setTimeWindow] = useState<string>("any");

  // Step 3 — results
  const [allClasses, setAllClasses] = useState<ClassWithDetails[]>([]);
  const [options, setOptions] = useState<ScheduleOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [classesError, setClassesError] = useState<string | null>(null);

  // Step 4 — checkout
  const [submitting, setSubmitting] = useState(false);

  // Profile data for pricing
  const [isMember, setIsMember] = useState(false);
  const [isMilitary, setIsMilitary] = useState(false);

  // Fetch profile
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("hac_member_id, is_military")
        .eq("id", user.id)
        .single();
      if (data) {
        setIsMember(!!data.hac_member_id);
        setIsMilitary(!!data.is_military);
      }
    })();
  }, [supabase, user]);

  const activeSwimmers = swimmers.filter((s) => s.is_active);
  const selected = useMemo(
    () =>
      activeSwimmers
        .filter((s) => selectedIds.has(s.id))
        .map((s) => ({
          id: s.id,
          first_name: s.first_name,
          last_name: s.last_name,
          current_level: s.current_level,
        })),
    [activeSwimmers, selectedIds]
  );

  // Toggle swimmer selection
  const toggleSwimmer = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleDay = (day: string) => {
    setPreferredDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  // ─── Fetch classes & run algorithm ──────────────────────────

  const fetchAndCompute = useCallback(async () => {
    setLoadingClasses(true);
    setClassesError(null);
    setOptions([]);
    setSelectedOption(null);

    try {
    // Get sessions with enrollment open
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, name, start_date, end_date, status, early_bird_discount_percent, early_bird_deadline, priority_enrollment_start, priority_enrollment_end, re_enrollment_priority_enabled")
      .eq("status", "enrollment_open");

    if (!sessions?.length) {
      return;
    }

    const sessionIds = sessions.map((s) => s.id);

    // Fetch all active classes for these sessions
    const { data: classData } = await supabase
      .from("classes")
      .select(`
        id, session_id, instructor_id, level, day_of_week, start_time, end_time,
        max_capacity, member_price, non_member_price, military_price, class_type, is_active,
        instructor:instructors(id, bio, profile:profiles(full_name)),
        session:sessions!inner(
          id, name, start_date, end_date, status,
          early_bird_discount_percent, early_bird_deadline,
          priority_enrollment_start, priority_enrollment_end,
          re_enrollment_priority_enabled
        )
      `)
      .in("session_id", sessionIds)
      .eq("is_active", true)
      .order("level")
      .order("start_time");

    if (!classData?.length) {
      return;
    }

    // Get enrollment counts
    const classIds = classData.map((c) => c.id);
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("class_id")
      .in("class_id", classIds)
      .eq("status", "confirmed");

    const countMap = new Map<string, number>();
    for (const e of enrollments ?? []) {
      countMap.set(e.class_id, (countMap.get(e.class_id) ?? 0) + 1);
    }

    const classes: ClassWithDetails[] = classData.map((c: Record<string, unknown>) => ({
      ...c,
      instructor: Array.isArray(c.instructor) ? c.instructor[0] ?? null : c.instructor,
      session: Array.isArray(c.session) ? c.session[0] : c.session,
      confirmed_count: countMap.get(c.id as string) ?? 0,
    })) as unknown as ClassWithDetails[];

    setAllClasses(classes);

    // Run scheduling algorithm
    const results = computeOptions(classes, selected, preference, preferredDays, timeWindow, isMember, isMilitary);
    setOptions(results);
    } catch {
      setClassesError("Failed to find schedule options. Please try again.");
    } finally {
      setLoadingClasses(false);
    }
  }, [supabase, selected, preference, preferredDays, timeWindow, isMember, isMilitary]);

  // ─── Scheduling Algorithm ──────────────────────────────────

  function computeOptions(
    classes: ClassWithDetails[],
    swimmers: SelectedSwimmer[],
    pref: SchedulePreference,
    preferDays: Set<string>,
    timeWin: string,
    member: boolean,
    military: boolean
  ): ScheduleOption[] {
    // For each swimmer, find eligible classes (matching level, with open spots)
    const swimmerClasses = new Map<string, ClassWithDetails[]>();
    for (const sw of swimmers) {
      const eligible = classes.filter((c) => {
        if (c.level !== sw.current_level) return false;
        if (c.confirmed_count >= c.max_capacity) return false;
        // Time window filter
        if (timeWin !== "any") {
          const hour = parseInt(c.start_time.slice(0, 2), 10);
          if (timeWin === "morning" && hour >= 12) return false;
          if (timeWin === "afternoon" && (hour < 12 || hour >= 16)) return false;
          if (timeWin === "evening" && hour < 16) return false;
        }
        // Preferred days filter (soft — we'll still include others but score lower)
        return true;
      });
      swimmerClasses.set(sw.id, eligible);
    }

    // Check if any swimmer has zero options
    for (const sw of swimmers) {
      if ((swimmerClasses.get(sw.id) ?? []).length === 0) return [];
    }

    // Generate all combinations (bounded to prevent explosion)
    const combos = generateCombinations(swimmers, swimmerClasses, 200);

    // Score and filter
    const scored: ScheduleOption[] = combos.map((combo, idx) => {
      let score = 50; // base
      const tags: string[] = [];
      const assignments = combo.map(({ swimmer, cls }) => ({ swimmer, cls }));

      const times = assignments.map((a) => ({
        start: timeToMinutes(a.cls.start_time),
        end: timeToMinutes(a.cls.end_time),
        day: a.cls.day_of_week,
      }));

      // Same time bonus
      const allSameTime =
        times.length > 1 &&
        times.every((t) => t.start === times[0].start && t.end === times[0].end);
      if (allSameTime) {
        score += pref === "same_time" ? 40 : 15;
        tags.push("Same Time");
      }

      // Back-to-back bonus
      const sorted = [...times].sort((a, b) => a.start - b.start);
      let isBackToBack = true;
      for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i].start - sorted[i - 1].end;
        if (gap < 0 || gap > 15) {
          isBackToBack = false;
          break;
        }
      }
      if (isBackToBack && times.length > 1 && !allSameTime) {
        score += pref === "back_to_back" ? 40 : 15;
        tags.push("Back-to-Back");
      }

      // Same day bonus
      const allDays = assignments.flatMap((a) => a.cls.day_of_week);
      const commonDays = assignments[0].cls.day_of_week.filter((d) =>
        assignments.every((a) => a.cls.day_of_week.includes(d))
      );
      if (commonDays.length > 0) {
        score += pref === "same_days" ? 30 : 10;
        tags.push(`Same Day${commonDays.length > 1 ? "s" : ""}: ${commonDays.join(", ")}`);
      }

      // Preferred days bonus
      if (preferDays.size > 0) {
        const matchingDays = allDays.filter((d) => preferDays.has(d)).length;
        const totalDays = allDays.length;
        score += Math.round((matchingDays / totalDays) * 20);
        if (matchingDays === totalDays) tags.push("Preferred Days");
      }

      // Fewer total trips bonus
      const uniqueDays = new Set(allDays);
      score += Math.max(0, 10 - uniqueDays.size * 2);

      // No time conflicts penalty
      for (let i = 0; i < times.length; i++) {
        for (let j = i + 1; j < times.length; j++) {
          // Only check conflicts if on same day
          const sharedDay = assignments[i].cls.day_of_week.some((d) =>
            assignments[j].cls.day_of_week.includes(d)
          );
          if (sharedDay && times[i].start < times[j].end && times[j].start < times[i].end) {
            // Time overlap with different swimmers is okay (they can be in pool simultaneously)
            // Only penalize if truly overlapping AND same swimmer somehow
            if (assignments[i].swimmer.id === assignments[j].swimmer.id) {
              score -= 100;
            }
          }
        }
      }

      const label = assignments
        .map((a) => `${a.swimmer.first_name}: L${a.cls.level} ${formatTime(a.cls.start_time)}`)
        .join(" | ");

      return { id: `opt-${idx}`, assignments, score, label, tags };
    });

    // Filter out invalid (negative score) and sort by score descending
    return scored
      .filter((o) => o.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }

  function generateCombinations(
    swimmers: SelectedSwimmer[],
    classMap: Map<string, ClassWithDetails[]>,
    maxResults: number
  ): { swimmer: SelectedSwimmer; cls: ClassWithDetails }[][] {
    const results: { swimmer: SelectedSwimmer; cls: ClassWithDetails }[][] = [];

    function backtrack(idx: number, current: { swimmer: SelectedSwimmer; cls: ClassWithDetails }[]) {
      if (results.length >= maxResults) return;
      if (idx === swimmers.length) {
        results.push([...current]);
        return;
      }
      const sw = swimmers[idx];
      const eligible = classMap.get(sw.id) ?? [];
      for (const cls of eligible) {
        current.push({ swimmer: sw, cls });
        backtrack(idx + 1, current);
        current.pop();
      }
    }

    backtrack(0, []);
    return results;
  }

  // ─── Enrollment & Checkout ─────────────────────────────────

  const chosenOption = options.find((o) => o.id === selectedOption);

  const totalPrice = useMemo(() => {
    if (!chosenOption) return 0;
    return chosenOption.assignments.reduce(
      (sum, a) => sum + getPrice(a.cls, isMember, isMilitary),
      0
    );
  }, [chosenOption, isMember, isMilitary]);

  const handleEnrollAll = async () => {
    if (!chosenOption || !user) return;
    setSubmitting(true);

    try {
      // Create all enrollments
      const enrollments: {
        enrollment_id: string;
        class_id: string;
        swimmer_name: string;
        session_name: string;
        level: number;
        amount: number;
      }[] = [];

      for (const a of chosenOption.assignments) {
        const { data: enrollment, error } = await supabase
          .from("enrollments")
          .insert({
            swimmer_id: a.swimmer.id,
            class_id: a.cls.id,
            status: "confirmed",
            payment_status: "pending",
          })
          .select("id")
          .single();

        if (error) throw error;

        const price = getPrice(a.cls, isMember, isMilitary);
        enrollments.push({
          enrollment_id: enrollment.id,
          class_id: a.cls.id,
          swimmer_name: `${a.swimmer.first_name} ${a.swimmer.last_name}`,
          session_name: a.cls.session.name,
          level: a.cls.level,
          amount: Math.round(price * 100),
        });
      }

      const totalCents = enrollments.reduce((s, e) => s + e.amount, 0);

      // If credits cover everything
      if (familyCredits * 100 >= totalCents && totalCents > 0) {
        await supabase.from("family_credits").insert({
          family_id: user.id,
          amount: -(totalCents / 100),
          type: "used",
          description: `Family batch enrollment (${enrollments.length} classes)`,
        });

        for (const e of enrollments) {
          await supabase
            .from("enrollments")
            .update({ payment_status: "paid" })
            .eq("id", e.enrollment_id);
        }

        toast.success(`${enrollments.length} enrollments confirmed with credits!`);
        router.push("/dashboard?payment=success");
        return;
      }

      if (totalCents <= 0) {
        for (const e of enrollments) {
          await supabase
            .from("enrollments")
            .update({ payment_status: "paid" })
            .eq("id", e.enrollment_id);
        }
        toast.success(`${enrollments.length} enrollments confirmed!`);
        router.push("/dashboard?payment=success");
        return;
      }

      // Stripe batch checkout
      const creditsToApply = Math.min(Math.round(familyCredits * 100), totalCents);

      const res = await fetch("/api/stripe/create-batch-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: enrollments,
          credits_applied: creditsToApply > 0 ? creditsToApply : 0,
        }),
      });

      if (!res.ok) throw new Error("Failed to create checkout");

      const { url } = await res.json();
      router.push(url);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Guard: need 2+ swimmers ───────────────────────────────

  if (swimmersLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-5 w-72" />
        <CardSkeleton />
      </div>
    );
  }

  if (activeSwimmers.length < 2) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <Users className="mx-auto size-12 text-muted-foreground" />
        <h2 className="mt-4 font-heading text-xl font-bold">Family Scheduler</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You need at least 2 active swimmers to use the family scheduler.
          Add swimmers from your{" "}
          <a href="/dashboard" className="text-primary underline">
            dashboard
          </a>{" "}
          first.
        </p>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/book")} className="mb-2">
          <ArrowLeft className="mr-1 size-4" />
          Back to Class Browser
        </Button>
        <h1 className="font-heading text-2xl font-bold">Family Scheduler</h1>
        <p className="text-sm text-muted-foreground">
          Find the best class combination for your family.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex size-8 items-center justify-center rounded-full text-sm font-bold ${
                step === s
                  ? "bg-primary text-primary-foreground"
                  : step > s
                    ? "bg-green-100 text-green-700"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {step > s ? <CheckCircle2 className="size-4" /> : s}
            </div>
            {s < 4 && (
              <div className={`h-0.5 w-8 ${step > s ? "bg-green-400" : "bg-muted"}`} />
            )}
          </div>
        ))}
      </div>

      {/* ─── STEP 1: Select Swimmers ─── */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <h2 className="font-heading text-lg font-semibold">
              Select Swimmers to Schedule
            </h2>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeSwimmers.map((sw) => {
              const waiver = getWaiverStatus(sw.id);
              const blocked = waiver === "required";

              return (
                <label
                  key={sw.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                    blocked
                      ? "cursor-not-allowed opacity-60"
                      : selectedIds.has(sw.id)
                        ? "border-primary bg-primary/5"
                        : "hover:border-muted-foreground/30"
                  }`}
                >
                  <Checkbox
                    checked={selectedIds.has(sw.id)}
                    onCheckedChange={() => !blocked && toggleSwimmer(sw.id)}
                    disabled={blocked}
                  />
                  <div
                    className="flex size-9 items-center justify-center rounded-full text-sm font-bold"
                    style={{ backgroundColor: getLevelColor(sw.current_level), color: getLevelTextColor(sw.current_level) }}
                  >
                    L{sw.current_level}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {sw.first_name} {sw.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Level {sw.current_level}: {getLevelName(sw.current_level)}
                    </p>
                  </div>
                  {blocked && (
                    <Badge variant="destructive" className="text-[10px]">
                      Waiver Required
                    </Badge>
                  )}
                </label>
              );
            })}

            <Button
              className="mt-4 w-full"
              disabled={selectedIds.size < 2}
              onClick={() => setStep(2)}
            >
              Continue with {selectedIds.size} Swimmer{selectedIds.size !== 1 ? "s" : ""}
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ─── STEP 2: Preferences ─── */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <h2 className="font-heading text-lg font-semibold">
              Scheduling Preferences
            </h2>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Preference type */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Priority</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    { value: "same_time", label: "Same Time", icon: Clock, desc: "All classes at the same time slot" },
                    { value: "back_to_back", label: "Back-to-Back", icon: Zap, desc: "Classes in sequence (≤15 min gap)" },
                    { value: "same_days", label: "Same Days", icon: Calendar, desc: "All classes on the same day(s)" },
                    { value: "no_preference", label: "Best Available", icon: Users, desc: "Show all viable options" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPreference(opt.value)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      preference === opt.value
                        ? "border-primary bg-primary/5"
                        : "hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <opt.icon className="size-4 text-primary" />
                      <span className="text-sm font-medium">{opt.label}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Preferred days */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Preferred Days (optional)</Label>
              <div className="flex flex-wrap gap-2">
                {DAY_NAMES.filter((d) => d !== "Sunday").map((day, i) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      preferredDays.has(day)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:border-muted-foreground/30"
                    }`}
                  >
                    {DAY_SHORT[i + 1]}
                  </button>
                ))}
              </div>
            </div>

            {/* Time window */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Time of Day</Label>
              <Select value={timeWindow} onValueChange={(v) => v && setTimeWindow(v)}>
                <SelectTrigger className="w-60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Time</SelectItem>
                  <SelectItem value="morning">Morning (before 12pm)</SelectItem>
                  <SelectItem value="afternoon">Afternoon (12–4pm)</SelectItem>
                  <SelectItem value="evening">Evening (after 4pm)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-1 size-4" />
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  setStep(3);
                  fetchAndCompute();
                }}
              >
                Find Schedules
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── STEP 3: Results ─── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold">
              Schedule Options
            </h2>
            <Button variant="outline" size="sm" onClick={() => setStep(2)}>
              <ArrowLeft className="mr-1 size-4" />
              Change Preferences
            </Button>
          </div>

          {loadingClasses ? (
            <div className="space-y-4 py-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </div>
                    <Skeleton className="h-6 w-16" />
                  </div>
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-5 w-full" />
                </div>
              ))}
            </div>
          ) : classesError ? (
            <InlineError message={classesError} onRetry={fetchAndCompute} />
          ) : options.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <PhoneOff className="mx-auto size-10 text-muted-foreground" />
                <h3 className="mt-3 font-heading text-base font-semibold">
                  No Matching Schedules Found
                </h3>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                  We couldn&apos;t find class combinations matching your preferences.
                  Try adjusting your time or day preferences, or contact HAC at{" "}
                  <strong>(254) 698-5951</strong> for help scheduling.
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setStep(2)}
                >
                  Adjust Preferences
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {options.length} option{options.length !== 1 ? "s" : ""} found.
                Select the best fit for your family.
              </p>

              <div className="space-y-3">
                {options.map((opt, idx) => {
                  const isSelected = selectedOption === opt.id;
                  const total = opt.assignments.reduce(
                    (sum, a) => sum + getPrice(a.cls, isMember, isMilitary),
                    0
                  );

                  // Build mini timeline
                  const daySlots = new Map<string, { swimmer: string; level: number; start: number; end: number; color: string }[]>();
                  for (const a of opt.assignments) {
                    for (const day of a.cls.day_of_week) {
                      const list = daySlots.get(day) ?? [];
                      list.push({
                        swimmer: a.swimmer.first_name,
                        level: a.cls.level,
                        start: timeToMinutes(a.cls.start_time),
                        end: timeToMinutes(a.cls.end_time),
                        color: getLevelColor(a.cls.level),
                      });
                      daySlots.set(day, list);
                    }
                  }

                  // Timeline bounds
                  const allStarts = opt.assignments.flatMap((a) => [timeToMinutes(a.cls.start_time)]);
                  const allEnds = opt.assignments.flatMap((a) => [timeToMinutes(a.cls.end_time)]);
                  const minTime = Math.min(...allStarts) - 15;
                  const maxTime = Math.max(...allEnds) + 15;
                  const range = maxTime - minTime;

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedOption(opt.id)}
                      className={`w-full rounded-lg border p-4 text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "hover:border-muted-foreground/30"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {idx === 0 && (
                            <Badge className="bg-green-500 text-white text-[10px]">
                              Best Match
                            </Badge>
                          )}
                          {opt.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-[10px]">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <span className="text-base font-bold">
                          {formatPrice(total * 100)}
                        </span>
                      </div>

                      {/* Assignments list */}
                      <div className="mt-3 space-y-1.5">
                        {opt.assignments.map((a, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <span
                              className="inline-block size-5 rounded text-center text-[10px] font-bold leading-5"
                              style={{ backgroundColor: getLevelColor(a.cls.level), color: getLevelTextColor(a.cls.level) }}
                            >
                              {a.cls.level}
                            </span>
                            <span className="font-medium">{a.swimmer.first_name}</span>
                            <span className="text-muted-foreground">
                              {a.cls.day_of_week.join(", ")} {formatTime(a.cls.start_time)}–{formatTime(a.cls.end_time)}
                            </span>
                            {a.cls.instructor?.profile?.full_name && (
                              <span className="text-xs text-muted-foreground">
                                ({a.cls.instructor.profile.full_name})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Mini timeline */}
                      <div className="mt-3 space-y-1">
                        {Array.from(daySlots.entries())
                          .sort(
                            (a, b) =>
                              (DAY_NAMES as readonly string[]).indexOf(a[0]) - (DAY_NAMES as readonly string[]).indexOf(b[0])
                          )
                          .map(([day, slots]) => (
                            <div key={day} className="flex items-center gap-2">
                              <span className="w-8 text-[10px] font-medium text-muted-foreground">
                                {day.slice(0, 3)}
                              </span>
                              <div className="relative h-5 flex-1 rounded bg-muted/50">
                                {slots.map((slot, si) => {
                                  const left = ((slot.start - minTime) / range) * 100;
                                  const width = ((slot.end - slot.start) / range) * 100;
                                  return (
                                    <div
                                      key={si}
                                      className="absolute top-0.5 h-4 rounded text-[9px] font-bold leading-4 text-white"
                                      style={{
                                        left: `${Math.max(left, 0)}%`,
                                        width: `${Math.max(width, 4)}%`,
                                        backgroundColor: slot.color,
                                      }}
                                      title={`${slot.swimmer} L${slot.level}`}
                                    >
                                      <span className="ml-1 truncate">
                                        {slot.swimmer}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                      </div>
                    </button>
                  );
                })}
              </div>

              <Button
                className="w-full"
                disabled={!selectedOption}
                onClick={() => setStep(4)}
              >
                Review & Enroll
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </>
          )}
        </div>
      )}

      {/* ─── STEP 4: Checkout ─── */}
      {step === 4 && chosenOption && (
        <Card>
          <CardHeader>
            <h2 className="font-heading text-lg font-semibold">
              Confirm Family Enrollment
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Line items */}
            <div className="space-y-3">
              {chosenOption.assignments.map((a, i) => {
                const price = getPrice(a.cls, isMember, isMilitary);
                return (
                  <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex size-9 items-center justify-center rounded-full text-sm font-bold"
                        style={{ backgroundColor: getLevelColor(a.cls.level), color: getLevelTextColor(a.cls.level) }}
                      >
                        L{a.cls.level}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {a.swimmer.first_name} {a.swimmer.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {getLevelName(a.cls.level)} • {a.cls.day_of_week.join(", ")}{" "}
                          {formatTime(a.cls.start_time)}–{formatTime(a.cls.end_time)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {a.cls.session.name}
                          {a.cls.instructor?.profile?.full_name &&
                            ` • ${a.cls.instructor.profile.full_name}`}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-medium">
                      {formatPrice(price * 100)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Total */}
            <div className="border-t pt-3">
              {familyCredits > 0 && (
                <div className="mb-2 flex justify-between text-sm text-green-600">
                  <span>Family Credits Available</span>
                  <span>−{formatPrice(Math.min(familyCredits, totalPrice) * 100)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>
                  {formatPrice(
                    Math.max(totalPrice - familyCredits, 0) * 100
                  )}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)}>
                <ArrowLeft className="mr-1 size-4" />
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={handleEnrollAll}
                disabled={submitting}
              >
                {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                {totalPrice <= 0 || familyCredits >= totalPrice
                  ? `Enroll All (${chosenOption.assignments.length})`
                  : `Pay & Enroll All (${chosenOption.assignments.length})`}
              </Button>
            </div>

            {totalPrice > 0 && familyCredits < totalPrice && (
              <p className="text-center text-xs text-muted-foreground">
                You&apos;ll be redirected to Stripe for a single combined payment.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
