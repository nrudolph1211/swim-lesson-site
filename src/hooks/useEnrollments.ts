"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";

export interface EnrollmentWithDetails {
  id: string;
  swimmer_id: string;
  class_id: string;
  status: string;
  payment_status: string;
  makeup_credits: number;
  amount_due: number | null;
  credits_applied: number | null;
  discount_breakdown: Record<string, unknown> | null;
  enrolled_at: string;
  cancelled_at: string | null;
  notes: string | null;
  swimmer: {
    id: string;
    first_name: string;
    last_name: string;
    current_level: number;
  };
  class: {
    id: string;
    level: number;
    day_of_week: string[];
    start_time: string;
    end_time: string;
    max_capacity: number;
    class_type: string;
    instructor: {
      id: string;
      bio: string | null;
      profile: { full_name: string } | null;
    } | null;
    session: {
      id: string;
      name: string;
      start_date: string;
      end_date: string;
      status: string;
    };
  };
}

export function useEnrollments() {
  const { user } = useAuthContext();
  const supabase = createClient();
  const [enrollments, setEnrollments] = useState<EnrollmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEnrollments = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // First get swimmer IDs for this family
    const { data: swimmers } = await supabase
      .from("swimmers")
      .select("id")
      .eq("family_id", user.id);

    if (!swimmers || swimmers.length === 0) {
      setEnrollments([]);
      setLoading(false);
      return;
    }

    const swimmerIds = swimmers.map((s) => s.id);

    const { data } = await supabase
      .from("enrollments")
      .select(
        `
        id, swimmer_id, class_id, status, payment_status, makeup_credits,
        amount_due, credits_applied, discount_breakdown,
        enrolled_at, cancelled_at, notes,
        swimmer:swimmers!inner(id, first_name, last_name, current_level),
        class:classes!inner(
          id, level, day_of_week, start_time, end_time, max_capacity, class_type,
          instructor:instructors(id, bio, profile:profiles(full_name)),
          session:sessions!inner(id, name, start_date, end_date, status)
        )
      `
      )
      .in("swimmer_id", swimmerIds)
      .order("enrolled_at", { ascending: false });

    if (data) {
      // Flatten the nested arrays from supabase joins
      const normalized = data.map((e: Record<string, unknown>) => ({
        ...e,
        swimmer: Array.isArray(e.swimmer) ? e.swimmer[0] : e.swimmer,
        class: Array.isArray(e.class) ? e.class[0] : e.class,
      })) as unknown as EnrollmentWithDetails[];
      setEnrollments(normalized);
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  const cancelEnrollment = async (enrollmentId: string) => {
    // Use the API route so that waitlist auto-promotion and notifications are triggered
    const res = await fetch("/api/enrollments/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enrollmentId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Failed to cancel enrollment" }));
      throw new Error(data.error ?? "Failed to cancel enrollment");
    }
    await fetchEnrollments();
  };

  const active = enrollments.filter(
    (e) => e.status === "confirmed" && e.class?.session?.status !== "completed"
  );
  const waitlisted = enrollments.filter(
    (e) => e.status === "waitlisted" && e.class?.session?.status !== "completed"
  );
  const past = enrollments.filter(
    (e) => e.status === "cancelled" || e.class?.session?.status === "completed"
  );

  return {
    enrollments,
    active,
    waitlisted,
    past,
    loading,
    fetchEnrollments,
    cancelEnrollment,
  };
}
