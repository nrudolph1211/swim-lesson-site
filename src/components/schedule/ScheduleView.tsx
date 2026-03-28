"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, List, Loader2 } from "lucide-react";
import { getLevelColor, getLevelName, getLevelTextColor } from "@/lib/swim-utils";
import { formatTime } from "@/lib/date-utils";

interface Session {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface ClassItem {
  id: string;
  level: number;
  day_of_week: string[];
  start_time: string;
  end_time: string;
  class_type: string;
  max_capacity: number;
  instructor_id: string | null;
  is_active: boolean;
  instructor_name: string | null;
}

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatClassType(t: string): string {
  switch (t) {
    case "group": return "Group";
    case "semi_private": return "Semi-Private";
    case "private": return "Private";
    default: return t;
  }
}

export function ScheduleView() {
  const supabase = createClient();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"calendar" | "list">("calendar");

  // Fetch sessions
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("sessions")
        .select("id, name, start_date, end_date, status")
        .in("status", ["enrollment_open", "in_progress", "upcoming"])
        .order("start_date", { ascending: false });

      const s = data ?? [];
      setSessions(s);
      if (s.length > 0) {
        // Prefer in_progress, then enrollment_open
        const active = s.find((x) => x.status === "in_progress") ?? s[0];
        setSelectedSessionId(active.id);
      }
      if (s.length === 0) setLoading(false);
    }
    load();
  }, [supabase]);

  // Fetch classes for selected session
  const fetchClasses = useCallback(async () => {
    if (!selectedSessionId) return;
    setLoading(true);

    const { data } = await supabase
      .from("classes")
      .select("id, level, day_of_week, start_time, end_time, class_type, max_capacity, instructor_id, is_active")
      .eq("session_id", selectedSessionId)
      .eq("is_active", true)
      .order("level")
      .order("start_time");

    const classRows = data ?? [];

    // Get instructor names
    const instructorIds = [...new Set(classRows.filter((c) => c.instructor_id).map((c) => c.instructor_id!))];
    let nameMap: Record<string, string> = {};
    if (instructorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", instructorIds);
      nameMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name]));
    }

    setClasses(
      classRows.map((c) => ({
        ...c,
        instructor_name: c.instructor_id ? nameMap[c.instructor_id] ?? null : null,
      }))
    );
    setLoading(false);
  }, [selectedSessionId, supabase]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  // Group by day
  const classesByDay = useMemo(() => {
    const map: Record<string, ClassItem[]> = {};
    for (const day of DAY_ORDER) {
      const dayClasses = classes.filter((c) => c.day_of_week?.includes(day));
      if (dayClasses.length > 0) {
        map[day] = dayClasses.sort((a, b) => a.start_time.localeCompare(b.start_time));
      }
    }
    return map;
  }, [classes]);

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg font-medium">No sessions currently available</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Check back soon for upcoming session schedules.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:w-64">
          <Select value={selectedSessionId} onValueChange={(v) => v && setSelectedSessionId(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select session" />
            </SelectTrigger>
            <SelectContent>
              {sessions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1 rounded-lg border p-1">
          <Button
            variant={view === "calendar" ? "default" : "ghost"}
            size="sm"
            onClick={() => setView("calendar")}
          >
            <CalendarDays className="mr-1.5 size-4" />
            Calendar
          </Button>
          <Button
            variant={view === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => setView("list")}
          >
            <List className="mr-1.5 size-4" />
            List
          </Button>
        </div>
      </div>

      {selectedSession && (
        <p className="text-sm text-muted-foreground">
          {selectedSession.name}: {new Date(selectedSession.start_date).toLocaleDateString()} &ndash;{" "}
          {new Date(selectedSession.end_date).toLocaleDateString()}
        </p>
      )}

      {classes.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-lg font-medium">No classes scheduled for this session</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Contact us for information about upcoming classes.
          </p>
        </div>
      ) : view === "calendar" ? (
        /* Calendar view — grid by day */
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {DAY_ORDER.map((day) => {
            const dayClasses = classesByDay[day];
            if (!dayClasses) return null;
            return (
              <Card key={day}>
                <CardContent className="p-4">
                  <h3 className="mb-3 font-heading text-sm font-semibold">{day}</h3>
                  <div className="space-y-2">
                    {dayClasses.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-lg border p-3"
                        style={{ borderLeftWidth: 4, borderLeftColor: getLevelColor(c.level) }}
                      >
                        <div className="flex items-center justify-between">
                          <Badge
                            style={{
                              backgroundColor: getLevelColor(c.level),
                              color: getLevelTextColor(c.level),
                            }}
                          >
                            L{c.level} {getLevelName(c.level)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatClassType(c.class_type)}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm font-medium">
                          {formatTime(c.start_time)} &ndash; {formatTime(c.end_time)}
                        </p>
                        {c.instructor_name && (
                          <p className="text-xs text-muted-foreground">
                            Instructor: {c.instructor_name}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* List view — grouped by day */
        <div className="space-y-6">
          {DAY_ORDER.map((day) => {
            const dayClasses = classesByDay[day];
            if (!dayClasses) return null;
            return (
              <div key={day}>
                <h3 className="mb-2 font-heading text-base font-semibold">{day}</h3>
                <div className="space-y-2">
                  {dayClasses.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-4 rounded-lg border p-3"
                    >
                      <Badge
                        style={{
                          backgroundColor: getLevelColor(c.level),
                          color: getLevelTextColor(c.level),
                        }}
                      >
                        L{c.level}
                      </Badge>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {getLevelName(c.level)} &middot;{" "}
                          {formatTime(c.start_time)} &ndash; {formatTime(c.end_time)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatClassType(c.class_type)}
                          {c.instructor_name && ` · ${c.instructor_name}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
