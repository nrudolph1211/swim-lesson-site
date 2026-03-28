"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface ClassAssignmentWithDetails {
  id: string;
  swimmer_id: string;
  class_id: string;
  status: string;
  notes: string | null;
  created_at: string;
  swimmer: {
    first_name: string;
    last_name: string;
    current_level: number;
  } | null;
  class: {
    id: string;
    level: number;
    day_of_week: string[];
    start_time: string;
    end_time: string;
    class_type: string;
    instructor_id: string | null;
    max_capacity: number;
    session_id: string;
    session: {
      id: string;
      name: string;
      start_date: string;
      end_date: string;
      status: string;
    } | null;
  } | null;
}

export function useClassAssignments(userId: string | undefined) {
  const supabase = createClient();
  const [assignments, setAssignments] = useState<ClassAssignmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAssignments = useCallback(async () => {
    if (!userId) {
      setAssignments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: swimmers } = await supabase
        .from("swimmers")
        .select("id")
        .eq("family_id", userId)
        .eq("is_active", true);

      if (!swimmers || swimmers.length === 0) {
        setAssignments([]);
        setLoading(false);
        return;
      }

      const swimmerIds = swimmers.map((s) => s.id);

      const { data, error } = await supabase
        .from("class_assignments")
        .select(
          `id, swimmer_id, class_id, status, notes, created_at,
           swimmer:swimmers(first_name, last_name, current_level),
           class:classes(id, level, day_of_week, start_time, end_time, class_type, instructor_id, max_capacity, session_id,
             session:sessions(id, name, start_date, end_date, status)
           )`
        )
        .in("swimmer_id", swimmerIds)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching class assignments:", error);
        setAssignments([]);
      } else {
        // Flatten array joins from PostgREST
        const flattened = (data ?? []).map((a: Record<string, unknown>) => {
          const swimmer = Array.isArray(a.swimmer) ? a.swimmer[0] : a.swimmer;
          const rawClass = Array.isArray(a.class) ? a.class[0] : a.class;
          let cls = rawClass as Record<string, unknown> | null;
          if (cls) {
            cls = {
              ...cls,
              session: Array.isArray(cls.session) ? cls.session[0] : cls.session,
            };
          }
          return {
            id: a.id,
            swimmer_id: a.swimmer_id,
            class_id: a.class_id,
            status: a.status,
            notes: a.notes,
            created_at: a.created_at,
            swimmer,
            class: cls,
          } as ClassAssignmentWithDetails;
        });
        setAssignments(flattened);
      }
    } catch {
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [userId, supabase]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const active = useMemo(
    () => assignments.filter((a) => a.status === "active"),
    [assignments]
  );

  const completed = useMemo(
    () => assignments.filter((a) => a.status === "completed"),
    [assignments]
  );

  return { assignments, active, completed, loading, refetch: fetchAssignments };
}
