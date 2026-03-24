"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SlidersHorizontal, Waves } from "lucide-react";
import { useClasses } from "@/hooks/useClasses";
import { useSettings } from "@/hooks/useSettings";
import { useSwimmers } from "@/hooks/useSwimmers";
import { useFamilyCredits } from "@/hooks/useFamilyCredits";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { ClassFiltersPanel } from "@/components/book/ClassFilters";
import { ClassCard } from "@/components/book/ClassCard";
import { EnrollmentDialog } from "@/components/book/EnrollmentDialog";
import { toast } from "sonner";
import type { ClassWithDetails } from "@/hooks/useClasses";
import { ClassGridSkeleton } from "@/components/ui/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import {
  isEarlyBird,
  type DiscountSettings,
  DEFAULT_DISCOUNT_SETTINGS,
} from "@/lib/pricing";

const SETTINGS_KEYS = [
  "member_discount_pct",
  "military_discount_pct",
  "sibling_discount_2nd_pct",
  "sibling_discount_3rd_pct",
  "early_bird_discount_pct",
  "multi_session_discount_pct",
  "max_discount_stack",
  "referral_credit_amount",
  "annual_registration_fee",
];

export function BookPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile } = useAuthContext();
  const {
    sessions,
    classes,
    filters,
    setFilters,
    clearFilters,
    loading,
  } = useClasses();
  const { getNumber, loading: settingsLoading } = useSettings(SETTINGS_KEYS);
  const { swimmers, getWaiverStatus, loading: swimmersLoading } = useSwimmers();
  const { balance: familyCredits } = useFamilyCredits();

  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [enrollingClass, setEnrollingClass] = useState<ClassWithDetails | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const isMember = !!profile?.hac_member_id;
  const isMilitary = !!profile?.is_military;

  const discountSettings: DiscountSettings = useMemo(() => ({
    member_discount_pct: getNumber("member_discount_pct", DEFAULT_DISCOUNT_SETTINGS.member_discount_pct),
    military_discount_pct: getNumber("military_discount_pct", DEFAULT_DISCOUNT_SETTINGS.military_discount_pct),
    sibling_discount_2nd_pct: getNumber("sibling_discount_2nd_pct", DEFAULT_DISCOUNT_SETTINGS.sibling_discount_2nd_pct),
    sibling_discount_3rd_pct: getNumber("sibling_discount_3rd_pct", DEFAULT_DISCOUNT_SETTINGS.sibling_discount_3rd_pct),
    early_bird_discount_pct: getNumber("early_bird_discount_pct", DEFAULT_DISCOUNT_SETTINGS.early_bird_discount_pct),
    multi_session_discount_pct: getNumber("multi_session_discount_pct", DEFAULT_DISCOUNT_SETTINGS.multi_session_discount_pct),
    max_discount_stack: getNumber("max_discount_stack", DEFAULT_DISCOUNT_SETTINGS.max_discount_stack),
    referral_credit_amount: getNumber("referral_credit_amount", DEFAULT_DISCOUNT_SETTINGS.referral_credit_amount),
    annual_registration_fee: getNumber("annual_registration_fee", DEFAULT_DISCOUNT_SETTINGS.annual_registration_fee),
  }), [getNumber]);

  // Handle payment return toasts
  useEffect(() => {
    const payment = searchParams.get("payment");
    if (payment === "cancelled") {
      toast.info("Payment not completed. You can finish paying from your dashboard.");
      router.replace("/book");
    }
  }, [searchParams, router]);

  // Check priority enrollment
  const isPriorityBlocked = useCallback(
    (cls: ClassWithDetails): boolean => {
      const session = cls.session;
      if (
        !session.re_enrollment_priority_enabled ||
        !session.priority_enrollment_start ||
        !session.priority_enrollment_end
      ) {
        return false;
      }
      const now = new Date();
      const start = new Date(session.priority_enrollment_start);
      const end = new Date(session.priority_enrollment_end);
      if (now < start || now > end) return false;
      // Within priority window — block non-returning families
      // TODO: check if user has a prior enrollment in a previous session to exempt returning families
      return true;
    },
    []
  );

  // Max discount hint for logged-in user
  const getMaxDiscountHint = useCallback(
    (cls: ClassWithDetails): number => {
      let totalPct = 0;
      let count = 0;
      const maxStack = discountSettings.max_discount_stack;

      // Early bird is usually the biggest
      if (isEarlyBird(cls.session.start_date, cls.session.early_bird_deadline)) {
        totalPct += discountSettings.early_bird_discount_pct;
        count++;
      }
      if (count < maxStack && isMember) {
        totalPct += discountSettings.member_discount_pct;
        count++;
      }
      if (count < maxStack && isMilitary) {
        totalPct += discountSettings.military_discount_pct;
        count++;
      }
      return totalPct;
    },
    [isMember, isMilitary, discountSettings]
  );

  const handleEnroll = useCallback(
    (cls: ClassWithDetails) => {
      if (!user) {
        router.push(`/login?redirect=/book`);
        return;
      }
      setEnrollingClass(cls);
      setDialogOpen(true);
    },
    [user, router]
  );

  // Loading state
  if (loading && sessions.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <Skeleton className="mb-2 h-8 w-56" />
        <Skeleton className="mb-6 h-5 w-72" />
        <div className="flex gap-8">
          <aside className="hidden w-64 shrink-0 lg:block">
            <div className="space-y-4 rounded-lg border p-4">
              <Skeleton className="h-4 w-16" />
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full rounded-md" />
              ))}
            </div>
          </aside>
          <div className="flex-1">
            <Skeleton className="mb-4 h-4 w-32" />
            <ClassGridSkeleton />
          </div>
        </div>
      </div>
    );
  }

  // No sessions open
  if (sessions.length === 0 && !loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
        <Waves className="size-12 text-muted-foreground" />
        <h1 className="font-heading text-2xl font-bold">
          Enrollment is not currently open.
        </h1>
        <p className="text-center text-muted-foreground">
          Check back soon for upcoming swim lesson sessions.
        </p>
      </div>
    );
  }

  const activeFilterCount =
    filters.levels.length +
    filters.days.length +
    filters.timeOfDay.length +
    filters.classType.length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold">Book Swim Lessons</h1>
        <p className="mt-1 text-muted-foreground">
          {sessions.length === 1
            ? sessions[0].name
            : "Browse available classes and enroll your swimmer."}
        </p>
      </div>

      <div className="flex gap-8">
        {/* Desktop Sidebar Filters */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-24 rounded-lg border p-4">
            <h2 className="mb-4 text-sm font-semibold">Filters</h2>
            <ClassFiltersPanel
              sessions={sessions}
              filters={filters}
              onFilterChange={setFilters}
              onClear={clearFilters}
            />
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1">
          {/* Mobile filter button */}
          <div className="mb-4 lg:hidden">
            <Button
              variant="outline"
              onClick={() => setMobileFilterOpen(true)}
              className="w-full"
            >
              <SlidersHorizontal className="mr-2 size-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-2 inline-flex size-5 items-center justify-center rounded-full bg-primary text-[10px] text-white">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>

          {/* Results count */}
          <p className="mb-4 text-sm text-muted-foreground">
            {loading
              ? "Loading classes..."
              : `${classes.length} class${classes.length !== 1 ? "es" : ""} found`}
          </p>

          {/* Class Grid */}
          {loading ? (
            <ClassGridSkeleton />
          ) : classes.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No classes match your filters.
              </p>
              {activeFilterCount > 0 && (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {classes.map((cls) => {
                const basePrice = cls.base_price ?? 0;
                const maxDiscount = user ? getMaxDiscountHint(cls) : 0;
                return (
                  <ClassCard
                    key={cls.id}
                    cls={cls}
                    basePrice={basePrice}
                    maxDiscountPct={maxDiscount}
                    isLoggedIn={!!user}
                    onEnroll={handleEnroll}
                    priorityBlocked={isPriorityBlocked(cls)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Filter Sheet */}
      <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <ClassFiltersPanel
              sessions={sessions}
              filters={filters}
              onFilterChange={(f) => {
                setFilters(f);
              }}
              onClear={() => {
                clearFilters();
                setMobileFilterOpen(false);
              }}
            />
            <Button
              className="mt-4 w-full"
              onClick={() => setMobileFilterOpen(false)}
            >
              Show Results ({classes.length})
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Enrollment Dialog */}
      {enrollingClass && (
        <EnrollmentDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          cls={enrollingClass}
          swimmers={swimmers}
          getWaiverStatus={getWaiverStatus}
          isMember={isMember}
          isMilitary={isMilitary}
          familyCredits={familyCredits}
          discountSettings={discountSettings}
          onSuccess={() => {
            setDialogOpen(false);
            setEnrollingClass(null);
          }}
        />
      )}
    </div>
  );
}
