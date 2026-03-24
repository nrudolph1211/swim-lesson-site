"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface ClassWithDetails {
  id: string;
  session_id: string;
  instructor_id: string | null;
  level: number;
  day_of_week: string[];
  start_time: string;
  end_time: string;
  max_capacity: number;
  base_price: number | null;
  program_type: string | null;
  member_price: number | null;
  non_member_price: number | null;
  military_price: number | null;
  class_type: string;
  is_active: boolean;
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
    season_type: string;
    early_bird_discount_percent: number;
    early_bird_deadline: string | null;
    priority_enrollment_start: string | null;
    priority_enrollment_end: string | null;
    re_enrollment_priority_enabled: boolean;
  };
  confirmed_count: number;
}

export interface SessionOption {
  id: string;
  name: string;
  status: string;
  start_date: string;
  end_date: string;
  season_type: string;
  early_bird_discount_percent: number;
  early_bird_deadline: string | null;
  priority_enrollment_start: string | null;
  priority_enrollment_end: string | null;
  re_enrollment_priority_enabled: boolean;
}

export interface ClassFilters {
  sessionId: string | null;
  levels: number[];
  days: string[];
  timeOfDay: string[];
  classType: string[];
}

export function useClasses() {
  const supabase = createClient();
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [classes, setClasses] = useState<ClassWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ClassFilters>({
    sessionId: null,
    levels: [],
    days: [],
    timeOfDay: [],
    classType: [],
  });

  const fetchSessions = useCallback(async () => {
    const { data } = await supabase
      .from("sessions")
      .select(
        "id, name, status, start_date, end_date, season_type, early_bird_discount_percent, early_bird_deadline, priority_enrollment_start, priority_enrollment_end, re_enrollment_priority_enabled"
      )
      .eq("status", "enrollment_open")
      .order("start_date");

    if (data && data.length > 0) {
      setSessions(data);
      if (!filters.sessionId) {
        setFilters((f) => ({ ...f, sessionId: data[0].id }));
      }
    } else {
      setSessions([]);
      setLoading(false);
    }
    return data;
  }, [supabase, filters.sessionId]);

  const fetchClasses = useCallback(async () => {
    if (!filters.sessionId) {
      setClasses([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data } = await supabase
      .from("classes")
      .select(
        `
        id, session_id, instructor_id, level, day_of_week, start_time, end_time,
        max_capacity, base_price, program_type, member_price, non_member_price, military_price, class_type, is_active,
        instructor:instructors(id, bio, profile:profiles(full_name)),
        session:sessions!inner(
          id, name, start_date, end_date, status, season_type,
          early_bird_discount_percent, early_bird_deadline,
          priority_enrollment_start, priority_enrollment_end,
          re_enrollment_priority_enabled
        )
      `
      )
      .eq("session_id", filters.sessionId)
      .eq("is_active", true)
      .order("level")
      .order("start_time");

    if (data) {
      const classIds = data.map((c: Record<string, unknown>) => c.id as string);

      let countMap = new Map<string, number>();
      if (classIds.length > 0) {
        const { data: counts } = await supabase
          .from("enrollments")
          .select("class_id")
          .in("class_id", classIds)
          .eq("status", "confirmed");

        if (counts) {
          countMap = new Map<string, number>();
          for (const row of counts) {
            countMap.set(row.class_id, (countMap.get(row.class_id) ?? 0) + 1);
          }
        }
      }

      const normalized = data.map((c: Record<string, unknown>) => ({
        ...c,
        instructor: Array.isArray(c.instructor)
          ? c.instructor[0] ?? null
          : c.instructor,
        session: Array.isArray(c.session) ? c.session[0] : c.session,
        confirmed_count: countMap.get(c.id as string) ?? 0,
      })) as unknown as ClassWithDetails[];

      setClasses(normalized);
    }

    setLoading(false);
  }, [supabase, filters.sessionId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (filters.sessionId) {
      fetchClasses();
    }
  }, [filters.sessionId, fetchClasses]);

  const filteredClasses = classes.filter((cls) => {
    if (filters.levels.length > 0 && !filters.levels.includes(cls.level)) {
      return false;
    }
    if (filters.days.length > 0) {
      const hasMatchingDay = cls.day_of_week.some((d) => filters.days.includes(d));
      if (!hasMatchingDay) return false;
    }
    if (filters.timeOfDay.length > 0) {
      const hour = parseInt(cls.start_time.slice(0, 2), 10);
      const period =
        hour < 12 ? "morning" : hour < 16 ? "afternoon" : "evening";
      if (!filters.timeOfDay.includes(period)) return false;
    }
    if (
      filters.classType.length > 0 &&
      !filters.classType.includes(cls.class_type)
    ) {
      return false;
    }
    return true;
  });

  const clearFilters = () => {
    setFilters((f) => ({
      ...f,
      levels: [],
      days: [],
      timeOfDay: [],
      classType: [],
    }));
  };

  return {
    sessions,
    classes: filteredClasses,
    allClasses: classes,
    filters,
    setFilters,
    clearFilters,
    loading,
    refetchClasses: fetchClasses,
  };
}
