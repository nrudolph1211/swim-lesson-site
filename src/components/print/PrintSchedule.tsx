"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getLevelColor, getLevelTextColor, getLevelName, calculateAge } from "@/lib/swim-utils";
import { formatTime } from "@/lib/date-utils";
import { PrintLayout } from "./PrintLayout";

interface ClassBlock {
  id: string;
  level: number;
  start_time: string;
  end_time: string;
  session_name: string;
  max_capacity: number;
  students: {
    first_name: string;
    last_name: string;
    date_of_birth: string;
    medical_notes: string | null;
  }[];
}

export function PrintSchedule({ userId }: { userId: string }) {
  const supabase = createClient();
  const [classes, setClasses] = useState<ClassBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [instructorName, setInstructorName] = useState("");

  const today = new Date();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayName = dayNames[today.getDay()];

  const fetchData = useCallback(async () => {
    // Get instructor name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .single();
    setInstructorName(profile?.full_name ?? "Instructor");

    // Get active sessions
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, name")
      .in("status", ["enrollment_open", "in_progress"]);

    if (!sessions?.length) {
      setClasses([]);
      setLoading(false);
      return;
    }

    const sessionIds = sessions.map((s) => s.id);
    const sessionMap = new Map(sessions.map((s) => [s.id, s.name]));

    // Get today's classes
    const { data: classData } = await supabase
      .from("classes")
      .select("id, level, start_time, end_time, max_capacity, session_id, day_of_week")
      .eq("instructor_id", userId)
      .eq("is_active", true)
      .in("session_id", sessionIds)
      .contains("day_of_week", [todayName])
      .order("start_time", { ascending: true });

    if (!classData?.length) {
      setClasses([]);
      setLoading(false);
      return;
    }

    // Fetch students for all classes
    const classIds = classData.map((c) => c.id);
    const { data: assignments } = await supabase
      .from("class_assignments")
      .select(`
        class_id,
        swimmer:swimmers(first_name, last_name, date_of_birth, medical_notes)
      `)
      .in("class_id", classIds)
      .eq("status", "active");

    // Group students by class
    const studentsByClass = new Map<string, ClassBlock["students"]>();
    for (const e of assignments ?? []) {
      const sw = Array.isArray(e.swimmer) ? e.swimmer[0] : e.swimmer;
      if (!sw) continue;
      const list = studentsByClass.get(e.class_id) ?? [];
      list.push({
        first_name: sw.first_name,
        last_name: sw.last_name,
        date_of_birth: sw.date_of_birth,
        medical_notes: sw.medical_notes,
      });
      studentsByClass.set(e.class_id, list);
    }

    setClasses(
      classData.map((c) => ({
        id: c.id,
        level: c.level,
        start_time: c.start_time,
        end_time: c.end_time,
        session_name: sessionMap.get(c.session_id) ?? "Session",
        max_capacity: c.max_capacity,
        students: (studentsByClass.get(c.id) ?? []).sort((a, b) =>
          a.last_name.localeCompare(b.last_name)
        ),
      }))
    );
    setLoading(false);
  }, [supabase, userId, todayName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <PrintLayout title={`Schedule — ${todayName}`}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          Heights Athletic Club — Daily Schedule
        </h1>
        <h2 style={{ fontSize: 14, color: "#666", margin: "4px 0" }}>
          {instructorName} — {todayName},{" "}
          {today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </h2>
      </div>

      {classes.length === 0 ? (
        <p style={{ textAlign: "center", color: "#999", padding: 40 }}>
          No classes scheduled for today.
        </p>
      ) : (
        classes.map((cls) => (
          <div key={cls.id} style={{ marginBottom: 20, pageBreakInside: "avoid" }}>
            {/* Class header bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                background: "#f0f0f0",
                borderRadius: "6px 6px 0 0",
                borderBottom: "2px solid #333",
              }}
            >
              <span
                className="print-badge"
                style={{
                  backgroundColor: getLevelColor(cls.level),
                  color: getLevelTextColor(cls.level),
                  padding: "2px 10px",
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                L{cls.level}
              </span>
              <strong style={{ fontSize: 14 }}>
                {getLevelName(cls.level)}
              </strong>
              <span style={{ fontSize: 13 }}>
                {formatTime(cls.start_time)} – {formatTime(cls.end_time)}
              </span>
              <span style={{ fontSize: 12, color: "#666", marginLeft: "auto" }}>
                {cls.students.length}/{cls.max_capacity} • {cls.session_name}
              </span>
            </div>

            {/* Students list */}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ width: 30, textAlign: "center", border: "1px solid #333", padding: "4px", background: "#e5e5e5" }}>#</th>
                  <th style={{ border: "1px solid #333", padding: "4px 6px", background: "#e5e5e5" }}>Name</th>
                  <th style={{ width: 40, textAlign: "center", border: "1px solid #333", padding: "4px", background: "#e5e5e5" }}>Age</th>
                  <th style={{ border: "1px solid #333", padding: "4px 6px", background: "#e5e5e5" }}>Medical Flags</th>
                  <th style={{ width: 60, textAlign: "center", border: "1px solid #333", padding: "4px", background: "#e5e5e5" }}>Present</th>
                </tr>
              </thead>
              <tbody>
                {cls.students.map((s, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: "center", border: "1px solid #333", padding: "4px" }}>{i + 1}</td>
                    <td style={{ border: "1px solid #333", padding: "4px 6px", fontWeight: 500 }}>
                      {s.last_name}, {s.first_name}
                    </td>
                    <td style={{ textAlign: "center", border: "1px solid #333", padding: "4px" }}>
                      {s.date_of_birth ? calculateAge(s.date_of_birth) : "—"}
                    </td>
                    <td style={{ border: "1px solid #333", padding: "4px 6px", color: s.medical_notes ? "#c0392b" : "#999" }}>
                      {s.medical_notes ? (
                        <>
                          <AlertTriangle style={{ width: 11, height: 11, display: "inline", verticalAlign: "middle" }} />{" "}
                          {s.medical_notes}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ textAlign: "center", border: "1px solid #333", padding: "4px" }}>
                      <span style={{ fontSize: 15 }}>☐</span>
                    </td>
                  </tr>
                ))}
                {cls.students.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", border: "1px solid #333", padding: 12, color: "#999" }}>
                      No students enrolled
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ))
      )}

      <div style={{ marginTop: 24, fontSize: 10, color: "#999", textAlign: "center" }}>
        Heights Athletic Club — 301 E FM 2410 Rd, Harker Heights, TX 76548
      </div>
    </PrintLayout>
  );
}
