"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getLevelColor, getLevelTextColor, getLevelName, calculateAge, formatPhoneNumber } from "@/lib/swim-utils";
import { formatTime } from "@/lib/date-utils";
import { PrintLayout } from "./PrintLayout";

interface StudentRow {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  medical_notes: string | null;
  allergies: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
}

interface ClassData {
  level: number;
  start_time: string;
  end_time: string;
  day_of_week: string[];
  max_capacity: number;
  session_name: string;
  instructor_name: string;
}

export function PrintRoster({ classId }: { classId: string }) {
  const supabase = createClient();
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    // Fetch class info
    const { data: cls } = await supabase
      .from("classes")
      .select(`
        level, start_time, end_time, day_of_week, max_capacity,
        session:sessions(name),
        instructor:instructors(profile:profiles(full_name))
      `)
      .eq("id", classId)
      .single();

    if (cls) {
      const session = Array.isArray(cls.session) ? cls.session[0] : cls.session;
      const instructor = Array.isArray(cls.instructor) ? cls.instructor[0] : cls.instructor;
      const profile = instructor?.profile;
      const prof = Array.isArray(profile) ? profile[0] : profile;
      setClassData({
        level: cls.level,
        start_time: cls.start_time,
        end_time: cls.end_time,
        day_of_week: cls.day_of_week,
        max_capacity: cls.max_capacity,
        session_name: session?.name ?? "Session",
        instructor_name: prof?.full_name ?? "TBD",
      });
    }

    // Fetch enrolled students with emergency contact info
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select(`
        swimmer:swimmers(
          first_name, last_name, date_of_birth,
          medical_notes,
          emergency_contact_name, emergency_contact_phone
        )
      `)
      .eq("class_id", classId)
      .eq("status", "confirmed");

    const rows: StudentRow[] = (enrollments ?? []).map((e) => {
      const sw = Array.isArray(e.swimmer) ? e.swimmer[0] : e.swimmer;
      return {
        first_name: sw?.first_name ?? "",
        last_name: sw?.last_name ?? "",
        date_of_birth: sw?.date_of_birth ?? "",
        medical_notes: sw?.medical_notes ?? null,
        allergies: null,
        emergency_contact_name: sw?.emergency_contact_name ?? null,
        emergency_contact_phone: sw?.emergency_contact_phone ?? null,
      };
    });

    rows.sort((a, b) => a.last_name.localeCompare(b.last_name));
    setStudents(rows);
    setLoading(false);
  }, [supabase, classId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!classData) {
    return <p className="py-12 text-center text-muted-foreground">Class not found.</p>;
  }

  const hasMedical = students.some((s) => s.medical_notes || s.allergies);

  return (
    <PrintLayout title={`Roster — L${classData.level} ${formatTime(classData.start_time)}`}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
              Heights Athletic Club — Swim Lessons
            </h1>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: "4px 0", color: "#444" }}>
              Class Roster
            </h2>
          </div>
          <div style={{ textAlign: "right", fontSize: 12, color: "#666" }}>
            <div>Printed {new Date().toLocaleDateString()}</div>
          </div>
        </div>

        <div
          style={{
            marginTop: 12,
            padding: 10,
            border: "1px solid #ccc",
            borderRadius: 6,
            fontSize: 13,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "4px 24px",
          }}
        >
          <div>
            <strong>Level:</strong>{" "}
            <span
              className="print-badge"
              style={{
                backgroundColor: getLevelColor(classData.level),
                color: getLevelTextColor(classData.level),
                padding: "1px 8px",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              L{classData.level}: {getLevelName(classData.level)}
            </span>
          </div>
          <div><strong>Session:</strong> {classData.session_name}</div>
          <div><strong>Days:</strong> {classData.day_of_week.join(", ")}</div>
          <div><strong>Instructor:</strong> {classData.instructor_name}</div>
          <div><strong>Time:</strong> {formatTime(classData.start_time)} – {formatTime(classData.end_time)}</div>
          <div><strong>Enrolled:</strong> {students.length} / {classData.max_capacity}</div>
        </div>
      </div>

      {/* Student Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ width: 30, textAlign: "center", border: "1px solid #333", padding: "5px 4px", background: "#e5e5e5" }}>#</th>
            <th style={{ border: "1px solid #333", padding: "5px 6px", background: "#e5e5e5" }}>Name</th>
            <th style={{ width: 40, textAlign: "center", border: "1px solid #333", padding: "5px 4px", background: "#e5e5e5" }}>Age</th>
            <th style={{ border: "1px solid #333", padding: "5px 6px", background: "#e5e5e5" }}>Medical Alerts</th>
            <th style={{ border: "1px solid #333", padding: "5px 6px", background: "#e5e5e5" }}>Emergency Contact</th>
            <th style={{ border: "1px solid #333", padding: "5px 6px", background: "#e5e5e5" }}>Phone</th>
            <th style={{ width: 70, textAlign: "center", border: "1px solid #333", padding: "5px 4px", background: "#e5e5e5" }}>Present</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s, i) => {
            const alerts = [s.medical_notes, s.allergies].filter(Boolean).join("; ");
            return (
              <tr key={i}>
                <td style={{ textAlign: "center", border: "1px solid #333", padding: "5px 4px" }}>{i + 1}</td>
                <td style={{ border: "1px solid #333", padding: "5px 6px", fontWeight: 500 }}>
                  {s.last_name}, {s.first_name}
                </td>
                <td style={{ textAlign: "center", border: "1px solid #333", padding: "5px 4px" }}>
                  {s.date_of_birth ? calculateAge(s.date_of_birth) : "—"}
                </td>
                <td style={{ border: "1px solid #333", padding: "5px 6px", color: alerts ? "#c0392b" : "#999" }}>
                  {alerts ? (
                    <span>
                      <AlertTriangle style={{ width: 12, height: 12, display: "inline", verticalAlign: "middle" }} />{" "}
                      {alerts}
                    </span>
                  ) : (
                    "None"
                  )}
                </td>
                <td style={{ border: "1px solid #333", padding: "5px 6px" }}>
                  {s.emergency_contact_name ?? "—"}
                </td>
                <td style={{ border: "1px solid #333", padding: "5px 6px" }}>
                  {s.emergency_contact_phone ? formatPhoneNumber(s.emergency_contact_phone) : "—"}
                </td>
                <td style={{ textAlign: "center", border: "1px solid #333", padding: "5px 4px" }}>
                  <span style={{ fontSize: 16 }}>☐</span>
                </td>
              </tr>
            );
          })}
          {/* Empty rows for walk-ins */}
          {[...Array(3)].map((_, i) => (
            <tr key={`empty-${i}`}>
              <td style={{ textAlign: "center", border: "1px solid #333", padding: "5px 4px", color: "#ccc" }}>
                {students.length + i + 1}
              </td>
              {[...Array(6)].map((_, j) => (
                <td key={j} style={{ border: "1px solid #333", padding: "5px 6px" }}>&nbsp;</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {hasMedical && (
        <div style={{ marginTop: 16, padding: 10, border: "1px solid #e74c3c", borderRadius: 6, fontSize: 11, color: "#c0392b" }}>
          <strong>Medical Alert Summary:</strong>
          <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
            {students
              .filter((s) => s.medical_notes || s.allergies)
              .map((s, i) => (
                <li key={i}>
                  <strong>{s.first_name} {s.last_name}:</strong>{" "}
                  {[s.medical_notes, s.allergies].filter(Boolean).join("; ")}
                </li>
              ))}
          </ul>
        </div>
      )}

      <div style={{ marginTop: 20, fontSize: 10, color: "#999", textAlign: "center" }}>
        Heights Athletic Club — 301 E FM 2410 Rd, Harker Heights, TX 76548
      </div>
    </PrintLayout>
  );
}
