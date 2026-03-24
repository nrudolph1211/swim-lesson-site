"use client";

import { useRef, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, startOfWeek, isSameDay, parseISO } from "date-fns";
import { formatTime } from "@/lib/date-utils";
import { getLevelColor } from "@/lib/swim-utils";
import { DAY_NAMES, DAY_SHORT } from "@/lib/swim-utils";
import type { EnrollmentWithDetails } from "@/hooks/useEnrollments";

interface WeeklyScheduleProps {
  enrollments: EnrollmentWithDetails[];
}

function getClassDatesForWeek(
  enrollment: EnrollmentWithDetails,
  weekStart: Date
): Date[] {
  const cls = enrollment.class;
  if (!cls?.day_of_week || !cls.session) return [];

  const sessionStart = parseISO(cls.session.start_date);
  const sessionEnd = parseISO(cls.session.end_date);
  const dates: Date[] = [];

  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    const dayName = DAY_NAMES[day.getDay()];
    if (
      cls.day_of_week.includes(dayName) &&
      day >= sessionStart &&
      day <= sessionEnd
    ) {
      dates.push(day);
    }
  }
  return dates;
}

// Consistent color per swimmer
const SWIMMER_COLORS = [
  "#3498DB", "#27AE60", "#E67E22", "#9B59B6", "#E74C3C", "#1ABC9C",
];

function MobileDailyView({
  weekDays,
  entries,
  today,
  swimmerColorMap,
}: {
  weekDays: Date[];
  entries: { date: Date; enrollment: EnrollmentWithDetails }[];
  today: Date;
  swimmerColorMap: Map<string, string>;
}) {
  const todayIndex = weekDays.findIndex((d) => isSameDay(d, today));
  const [dayIndex, setDayIndex] = useState(todayIndex >= 0 ? todayIndex : 0);
  const touchStartX = useRef(0);

  const day = weekDays[dayIndex];
  const dayEntries = entries.filter((e) => isSameDay(e.date, day));
  const isToday = isSameDay(day, today);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 50) {
      if (diff < 0 && dayIndex < 6) setDayIndex((i) => i + 1);
      if (diff > 0 && dayIndex > 0) setDayIndex((i) => i - 1);
    }
  };

  return (
    <div className="sm:hidden" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Day pills */}
      <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
        {weekDays.map((d, i) => {
          const hasLessons = entries.some((e) => isSameDay(e.date, d));
          const isSelected = i === dayIndex;
          const isDayToday = isSameDay(d, today);
          return (
            <button
              key={d.toISOString()}
              onClick={() => setDayIndex(i)}
              className={`flex min-w-[44px] flex-col items-center rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                isSelected
                  ? "bg-primary text-white"
                  : isDayToday
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <span>{DAY_SHORT[d.getDay()]}</span>
              <span className="text-sm font-bold">{format(d, "d")}</span>
              {hasLessons && !isSelected && (
                <span className="mt-0.5 size-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* Day header */}
      <p className={`mb-2 text-sm font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>
        {format(day, "EEEE, MMM d")}
        {isToday && " (Today)"}
      </p>

      {/* Entries */}
      {dayEntries.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No lessons on {format(day, "EEEE")}.
        </p>
      ) : (
        <div className="space-y-2">
          {dayEntries.map((entry, i) => (
            <div
              key={`${entry.enrollment.id}-${i}`}
              className="flex items-center gap-3 rounded-lg border p-3 min-h-[56px]"
              style={{
                borderLeftWidth: 3,
                borderLeftColor:
                  swimmerColorMap.get(entry.enrollment.swimmer_id) ??
                  getLevelColor(entry.enrollment.class?.level ?? 1),
              }}
            >
              <div className="flex-1">
                <span className="font-medium">
                  {formatTime(entry.enrollment.class?.start_time)} –{" "}
                  {formatTime(entry.enrollment.class?.end_time)}
                </span>
                <p className="text-sm text-muted-foreground">
                  {entry.enrollment.swimmer?.first_name} • Level{" "}
                  {entry.enrollment.class?.level}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function WeeklySchedule({ enrollments }: WeeklyScheduleProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = startOfWeek(addDays(new Date(), weekOffset * 7), {
    weekStartsOn: 1,
  });

  const swimmerColorMap = useMemo(() => {
    const map = new Map<string, string>();
    const uniqueSwimmers = [...new Set(enrollments.map((e) => e.swimmer_id))];
    uniqueSwimmers.forEach((id, i) => {
      map.set(id, SWIMMER_COLORS[i % SWIMMER_COLORS.length]);
    });
    return map;
  }, [enrollments]);

  const activeEnrollments = useMemo(
    () => enrollments.filter(
      (e) => e.status === "confirmed" && e.class?.session?.status !== "completed"
    ),
    [enrollments]
  );

  // Build schedule entries
  const entries = useMemo(() => {
    const result: {
      date: Date;
      enrollment: EnrollmentWithDetails;
    }[] = [];

    for (const enrollment of activeEnrollments) {
      const dates = getClassDatesForWeek(enrollment, weekStart);
      for (const date of dates) {
        result.push({ date, enrollment });
      }
    }

    return result.sort((a, b) => {
      if (!isSameDay(a.date, b.date)) return a.date.getTime() - b.date.getTime();
      return (a.enrollment.class?.start_time ?? "").localeCompare(
        b.enrollment.class?.start_time ?? ""
      );
    });
  }, [activeEnrollments, weekStart]);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <h3 className="font-heading text-base font-semibold">
          Upcoming Lessons
        </h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setWeekOffset((o) => o - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWeekOffset(0)}
            className="text-xs"
          >
            This Week
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setWeekOffset((o) => o + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Desktop grid */}
        <div className="hidden sm:grid sm:grid-cols-7 sm:gap-1">
          {weekDays.map((day) => {
            const dayEntries = entries.filter((e) => isSameDay(e.date, day));
            const isToday = isSameDay(day, today);
            return (
              <div key={day.toISOString()} className="min-h-[80px]">
                <div
                  className={`mb-1 text-center text-xs font-medium ${
                    isToday ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <span>{DAY_SHORT[day.getDay()]}</span>
                  <br />
                  <span
                    className={`inline-flex size-6 items-center justify-center rounded-full text-[11px] ${
                      isToday ? "bg-primary text-white" : ""
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                </div>
                <div className="space-y-1">
                  {dayEntries.map((entry, i) => (
                    <div
                      key={`${entry.enrollment.id}-${i}`}
                      className="rounded-md border px-1.5 py-1 text-[10px] leading-tight"
                      style={{
                        borderLeftWidth: 3,
                        borderLeftColor:
                          swimmerColorMap.get(entry.enrollment.swimmer_id) ??
                          getLevelColor(entry.enrollment.class?.level ?? 1),
                      }}
                    >
                      <span className="font-medium">
                        {formatTime(entry.enrollment.class?.start_time)}
                      </span>
                      <br />
                      <span className="text-muted-foreground">
                        {entry.enrollment.swimmer?.first_name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile: daily list with swipe */}
        <MobileDailyView
          weekDays={weekDays}
          entries={entries}
          today={today}
          swimmerColorMap={swimmerColorMap}
        />

        {entries.length === 0 && (
          <p className="hidden py-4 text-center text-sm text-muted-foreground sm:block">
            No lessons scheduled this week.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
