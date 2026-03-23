"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CalendarOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatTime } from "@/lib/date-utils";
import { getLevelColor, getLevelTextColor } from "@/lib/swim-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

interface WeekClass {
  id: string;
  level: number;
  start_time: string;
  end_time: string;
  max_capacity: number;
  day_of_week: string[];
  session_name: string;
  enrolled_count: number;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7)); // Monday
  d.setHours(0, 0, 0, 0);
  return d;
}

export function WeekTab({ userId }: { userId: string }) {
  const supabase = createClient();
  const [classes, setClasses] = useState<WeekClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);

  const today = new Date();
  const todayDayName = DAYS[(today.getDay() + 6) % 7]; // Adjust Sunday=0 to Monday=0
  const weekStart = getWeekStart(today);
  weekStart.setDate(weekStart.getDate() + weekOffset * 7);

  const weekLabel = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 5);
  const weekEndLabel = weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const fetchClasses = useCallback(async () => {
    setLoading(true);

    const { data: activeSessions } = await supabase
      .from("sessions")
      .select("id, name")
      .in("status", ["enrollment_open", "in_progress"]);

    if (!activeSessions?.length) {
      setClasses([]);
      setLoading(false);
      return;
    }

    const sessionIds = activeSessions.map((s) => s.id);
    const sessionMap = new Map(activeSessions.map((s) => [s.id, s.name]));

    const { data: classData } = await supabase
      .from("classes")
      .select("id, level, start_time, end_time, max_capacity, session_id, day_of_week")
      .eq("instructor_id", userId)
      .eq("is_active", true)
      .in("session_id", sessionIds);

    if (!classData?.length) {
      setClasses([]);
      setLoading(false);
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

    setClasses(
      classData.map((c) => ({
        ...c,
        session_name: sessionMap.get(c.session_id) ?? "",
        enrolled_count: countMap.get(c.id) ?? 0,
      }))
    );

    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  // Group classes by day
  const byDay = new Map<string, WeekClass[]>();
  for (const cls of classes) {
    for (const day of cls.day_of_week) {
      if (!DAYS.includes(day)) continue;
      const list = byDay.get(day) ?? [];
      list.push(cls);
      byDay.set(day, list);
    }
  }
  // Sort each day by time
  for (const [, list] of byDay) {
    list.sort((a, b) => a.start_time.localeCompare(b.start_time));
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="size-12 rounded-md" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="size-12 rounded-md" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <EmptyState
        icon={<CalendarOff className="size-10" />}
        title="No classes this week"
        description="You don't have any classes assigned for the current sessions."
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" className="size-12" onClick={() => setWeekOffset((o) => o - 1)}>
          <ChevronLeft className="size-5" />
        </Button>
        <div className="text-center">
          <p className="text-lg font-bold">{weekLabel} – {weekEndLabel}</p>
          {weekOffset !== 0 && (
            <button
              className="text-sm text-primary underline"
              onClick={() => setWeekOffset(0)}
            >
              Back to this week
            </button>
          )}
        </div>
        <Button variant="outline" size="icon" className="size-12" onClick={() => setWeekOffset((o) => o + 1)}>
          <ChevronRight className="size-5" />
        </Button>
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {DAYS.map((day) => {
          const isToday = weekOffset === 0 && day === todayDayName;
          const dayClasses = byDay.get(day) ?? [];

          return (
            <div
              key={day}
              className={`min-h-[120px] rounded-xl border-2 p-2 ${
                isToday ? "border-primary bg-primary/5" : "border-muted"
              }`}
            >
              <p className={`mb-1.5 text-center text-sm font-bold ${isToday ? "text-primary" : ""}`}>
                {day.slice(0, 3)}
              </p>
              {dayClasses.length === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground">—</p>
              ) : (
                <div className="space-y-1.5">
                  {dayClasses.map((cls) => (
                    <div
                      key={cls.id + day}
                      className="rounded-lg p-2"
                      style={{ backgroundColor: getLevelColor(cls.level) + "20" }}
                    >
                      <Badge
                        className="mb-0.5 text-xs"
                        style={{ backgroundColor: getLevelColor(cls.level), color: getLevelTextColor(cls.level) }}
                      >
                        L{cls.level}
                      </Badge>
                      <p className="text-sm font-bold">
                        {formatTime(cls.start_time)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {cls.enrolled_count}/{cls.max_capacity}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
