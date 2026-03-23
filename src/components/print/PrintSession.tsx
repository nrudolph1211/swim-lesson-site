"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getLevelColor, getLevelTextColor, getLevelName, DAY_SHORT } from "@/lib/swim-utils";
import { PrintLayout } from "./PrintLayout";

interface SessionData {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
}

interface ClassCell {
  id: string;
  level: number;
  start_time: string;
  end_time: string;
  instructor_name: string;
  enrolled: number;
  max_capacity: number;
}

// Days for the grid columns (Mon–Sat, typical pool schedule)
const GRID_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const GRID_DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function PrintSession() {
  const supabase = createClient();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [classesByDay, setClassesByDay] = useState<Map<string, ClassCell[]>>(new Map());
  const [loading, setLoading] = useState(true);

  // Fetch active sessions
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("sessions")
        .select("id, name, start_date, end_date")
        .in("status", ["enrollment_open", "in_progress", "upcoming"])
        .order("start_date", { ascending: false });

      const list = data ?? [];
      setSessions(list);
      if (list.length > 0) setSelectedSession(list[0].id);
      if (list.length === 0) setLoading(false);
    })();
  }, [supabase]);

  const fetchClasses = useCallback(async () => {
    if (!selectedSession) return;
    setLoading(true);

    const { data: classData } = await supabase
      .from("classes")
      .select(`
        id, level, start_time, end_time, max_capacity, day_of_week, is_active,
        instructor:profiles!classes_instructor_id_fkey(full_name)
      `)
      .eq("session_id", selectedSession)
      .eq("is_active", true)
      .order("start_time", { ascending: true });

    // Count enrollments per class
    const classIds = (classData ?? []).map((c) => c.id);
    let enrollmentCounts = new Map<string, number>();
    if (classIds.length > 0) {
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("class_id")
        .in("class_id", classIds)
        .eq("status", "confirmed");

      for (const e of enrollments ?? []) {
        enrollmentCounts.set(e.class_id, (enrollmentCounts.get(e.class_id) ?? 0) + 1);
      }
    }

    // Group by day
    const byDay = new Map<string, ClassCell[]>();
    for (const day of GRID_DAYS) byDay.set(day, []);

    for (const cls of classData ?? []) {
      const instructor = Array.isArray(cls.instructor) ? cls.instructor[0] : cls.instructor;
      const cell: ClassCell = {
        id: cls.id,
        level: cls.level,
        start_time: cls.start_time,
        end_time: cls.end_time,
        instructor_name: instructor?.full_name ?? "TBD",
        enrolled: enrollmentCounts.get(cls.id) ?? 0,
        max_capacity: cls.max_capacity,
      };

      for (const day of cls.day_of_week) {
        if (GRID_DAYS.includes(day)) {
          byDay.get(day)!.push(cell);
        }
      }
    }

    setClassesByDay(byDay);
    setLoading(false);
  }, [supabase, selectedSession]);

  useEffect(() => {
    if (selectedSession) fetchClasses();
  }, [fetchClasses, selectedSession]);

  const session = sessions.find((s) => s.id === selectedSession);

  // Collect unique time slots for row headers
  const timeSlots = new Set<string>();
  for (const cells of classesByDay.values()) {
    for (const c of cells) {
      timeSlots.add(`${c.start_time.slice(0, 5)}-${c.end_time.slice(0, 5)}`);
    }
  }
  const sortedSlots = Array.from(timeSlots).sort();

  return (
    <PrintLayout title={`Session Overview — ${session?.name ?? ""}`}>
      {/* Session selector (screen only) */}
      <div className="print-hide" style={{ marginBottom: 16 }}>
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={selectedSession}
          onChange={(e) => setSelectedSession(e.target.value)}
        >
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : !session ? (
        <p style={{ textAlign: "center", color: "#999", padding: 40 }}>No active sessions.</p>
      ) : (
        <>
          {/* Header */}
          <div style={{ marginBottom: 16 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
              Heights Athletic Club — Session Overview
            </h1>
            <h2 style={{ fontSize: 14, color: "#666", margin: "4px 0" }}>
              {session.name} — {new Date(session.start_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              {" to "}
              {new Date(session.end_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </h2>
          </div>

          {/* Weekly Grid */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ width: 80, border: "1px solid #333", padding: "6px", background: "#e5e5e5", textAlign: "center" }}>
                  Time
                </th>
                {GRID_DAY_SHORT.map((day) => (
                  <th key={day} style={{ border: "1px solid #333", padding: "6px", background: "#e5e5e5", textAlign: "center" }}>
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedSlots.map((slot) => {
                const [startTime] = slot.split("-");
                return (
                  <tr key={slot}>
                    <td style={{ border: "1px solid #333", padding: "4px 6px", fontWeight: 600, fontSize: 11, whiteSpace: "nowrap", verticalAlign: "top" }}>
                      {slot.replace("-", "–")}
                    </td>
                    {GRID_DAYS.map((day) => {
                      const cells = (classesByDay.get(day) ?? []).filter(
                        (c) => `${c.start_time.slice(0, 5)}-${c.end_time.slice(0, 5)}` === slot
                      );
                      return (
                        <td key={day} style={{ border: "1px solid #333", padding: "3px 4px", verticalAlign: "top" }}>
                          {cells.map((c) => (
                            <div
                              key={c.id}
                              style={{
                                marginBottom: cells.length > 1 ? 4 : 0,
                                padding: "3px 5px",
                                borderRadius: 4,
                                borderLeft: `3px solid ${getLevelColor(c.level)}`,
                                fontSize: 10,
                                lineHeight: 1.3,
                              }}
                            >
                              <div style={{ fontWeight: 700 }}>
                                <span
                                  className="print-badge"
                                  style={{
                                    backgroundColor: getLevelColor(c.level),
                                    color: getLevelTextColor(c.level),
                                    padding: "0 4px",
                                    borderRadius: 3,
                                    fontSize: 9,
                                    fontWeight: 700,
                                  }}
                                >
                                  L{c.level}
                                </span>{" "}
                                {getLevelName(c.level)}
                              </div>
                              <div style={{ color: "#555" }}>{c.instructor_name}</div>
                              <div style={{ color: c.enrolled >= c.max_capacity ? "#c0392b" : "#666" }}>
                                {c.enrolled}/{c.max_capacity}
                                {c.enrolled >= c.max_capacity && " FULL"}
                              </div>
                            </div>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {sortedSlots.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", border: "1px solid #333", padding: 24, color: "#999" }}>
                    No classes scheduled for this session.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Legend */}
          <div style={{ marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap", fontSize: 10 }}>
            {[1, 2, 3, 4, 5].map((level) => (
              <div key={level} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span
                  className="print-badge"
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 2,
                    backgroundColor: getLevelColor(level),
                    display: "inline-block",
                  }}
                />
                <span>L{level}: {getLevelName(level)}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, fontSize: 10, color: "#999", textAlign: "center" }}>
            Heights Athletic Club — 301 E FM 2410 Rd, Harker Heights, TX 76548 — Printed {new Date().toLocaleDateString()}
          </div>
        </>
      )}
    </PrintLayout>
  );
}
