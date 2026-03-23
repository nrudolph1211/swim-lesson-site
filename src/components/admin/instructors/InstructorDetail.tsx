"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getLevelColor, getLevelTextColor, getLevelName } from "@/lib/swim-utils";
import { formatTime } from "@/lib/date-utils";
import { format } from "date-fns";

interface InstructorDetailProps {
  instructorId: string;
}

interface ClassAssignment {
  id: string;
  level: number;
  day_of_week: string[];
  start_time: string;
  end_time: string;
  session_name: string;
  enrolled_count: number;
  max_capacity: number;
}

interface StudentInfo {
  swimmer_id: string;
  swimmer_name: string;
  level: number;
  class_day: string[];
  class_time: string;
}

interface TimeEntry {
  id: string;
  clock_in: string;
  clock_out: string | null;
  hours_worked: number | null;
  status: string;
}

interface Certification {
  name: string;
  expiry_date: string;
}

export function InstructorDetail({ instructorId }: InstructorDetailProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [instructor, setInstructor] = useState<{
    full_name: string;
    email: string;
    bio: string | null;
    hourly_rate: number | null;
    certifications: Certification[];
  } | null>(null);
  const [classes, setClasses] = useState<ClassAssignment[]>([]);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [instRes, classRes, timeRes] = await Promise.all([
      supabase
        .from("instructors")
        .select("bio, hourly_rate, certifications, profile:profiles!id(full_name)")
        .eq("id", instructorId)
        .single(),
      supabase
        .from("classes")
        .select("id, level, day_of_week, start_time, end_time, max_capacity, session:sessions(name)")
        .eq("instructor_id", instructorId)
        .eq("is_active", true),
      supabase
        .from("time_entries")
        .select("id, clock_in, clock_out, hours_worked, status")
        .eq("instructor_id", instructorId)
        .order("clock_in", { ascending: false })
        .limit(20),
    ]);

    if (instRes.data) {
      const profile = instRes.data.profile as unknown as
        | { full_name: string }
        | { full_name: string }[]
        | null;
      const pObj = Array.isArray(profile) ? profile[0] : profile;

      // Fetch email from auth via profile id lookup
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", instructorId)
        .single();

      setInstructor({
        full_name: pObj?.full_name ?? profileData?.full_name ?? "Unknown",
        email: "", // Email is on auth.users, not accessible from client
        bio: instRes.data.bio,
        hourly_rate: instRes.data.hourly_rate,
        certifications: (instRes.data.certifications as Certification[]) ?? [],
      });
    }

    if (classRes.data) {
      const classIds = classRes.data.map((c) => c.id);

      // Get enrollment counts
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("class_id, swimmer_id, swimmer:swimmers(first_name, last_name, current_level)")
        .in("class_id", classIds.length > 0 ? classIds : ["__none__"])
        .eq("status", "confirmed");

      const countMap = new Map<string, number>();
      const studentList: StudentInfo[] = [];

      for (const e of enrollments ?? []) {
        countMap.set(e.class_id, (countMap.get(e.class_id) ?? 0) + 1);
        const sw = e.swimmer as unknown as
          | { first_name: string; last_name: string; current_level: number }
          | { first_name: string; last_name: string; current_level: number }[]
          | null;
        const s = Array.isArray(sw) ? sw[0] : sw;
        const cls = classRes.data.find((c) => c.id === e.class_id);

        if (s && cls) {
          studentList.push({
            swimmer_id: e.swimmer_id,
            swimmer_name: `${s.first_name} ${s.last_name}`,
            level: s.current_level,
            class_day: cls.day_of_week,
            class_time: cls.start_time,
          });
        }
      }

      setClasses(
        classRes.data.map((c) => {
          const sess = c.session as unknown as
            | { name: string }
            | { name: string }[]
            | null;
          const sObj = Array.isArray(sess) ? sess[0] : sess;
          return {
            id: c.id,
            level: c.level,
            day_of_week: c.day_of_week,
            start_time: c.start_time,
            end_time: c.end_time,
            session_name: sObj?.name ?? "Unknown",
            enrolled_count: countMap.get(c.id) ?? 0,
            max_capacity: c.max_capacity,
          };
        })
      );

      setStudents(studentList);
    }

    if (timeRes.data) {
      setTimeEntries(timeRes.data as TimeEntry[]);
    }

    setLoading(false);
  }, [supabase, instructorId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!instructor) {
    return <p className="py-8 text-center text-muted-foreground">Instructor not found.</p>;
  }

  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  function certBadge(cert: Certification) {
    if (!cert.expiry_date) {
      return <Badge variant="outline">No expiry</Badge>;
    }
    const exp = new Date(cert.expiry_date);
    if (exp < now) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (exp < thirtyDays) {
      return (
        <Badge variant="outline" className="border-yellow-500 text-yellow-600">
          Expiring Soon
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="border-green-500 text-green-600">
        Valid
      </Badge>
    );
  }

  // Payroll summary
  const totalHours = timeEntries.reduce((sum, t) => sum + (t.hours_worked ?? 0), 0);
  const totalPay = instructor.hourly_rate ? totalHours * instructor.hourly_rate : null;

  // Build weekly schedule from classes
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const scheduleByDay = new Map<string, ClassAssignment[]>();
  for (const cls of classes) {
    for (const day of cls.day_of_week) {
      const existing = scheduleByDay.get(day) ?? [];
      existing.push(cls);
      scheduleByDay.set(day, existing);
    }
  }

  return (
    <div className="space-y-6 pb-4">
      {/* Header */}
      <div>
        <h3 className="font-heading text-lg font-semibold">{instructor.full_name}</h3>
        {instructor.bio && (
          <p className="mt-1 text-sm text-muted-foreground">{instructor.bio}</p>
        )}
        {instructor.hourly_rate && (
          <p className="mt-1 text-sm">
            Rate: <span className="font-medium">${instructor.hourly_rate}/hr</span>
          </p>
        )}
      </div>

      {/* Certifications */}
      <div>
        <h4 className="mb-2 text-sm font-semibold">Certifications</h4>
        {instructor.certifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No certifications on file.</p>
        ) : (
          <div className="space-y-1.5">
            {instructor.certifications.map((cert, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span className="font-medium">{cert.name}</span>
                <div className="flex items-center gap-2">
                  {certBadge(cert)}
                  {cert.expiry_date && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(cert.expiry_date), "MMM d, yyyy")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Weekly Schedule */}
      <div>
        <h4 className="mb-2 text-sm font-semibold">Weekly Schedule</h4>
        {classes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No classes assigned.</p>
        ) : (
          <div className="space-y-2">
            {DAYS.filter((d) => scheduleByDay.has(d)).map((day) => (
              <div key={day}>
                <p className="text-xs font-medium text-muted-foreground">{day}</p>
                <div className="mt-1 space-y-1">
                  {(scheduleByDay.get(day) ?? [])
                    .sort((a, b) => a.start_time.localeCompare(b.start_time))
                    .map((cls) => (
                      <div
                        key={cls.id + day}
                        className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <Badge
                            style={{ backgroundColor: getLevelColor(cls.level), color: getLevelTextColor(cls.level) }}
                          >
                            L{cls.level}
                          </Badge>
                          <span>
                            {formatTime(cls.start_time)} – {formatTime(cls.end_time)}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {cls.enrolled_count}/{cls.max_capacity} • {cls.session_name}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Student Roster */}
      <div>
        <h4 className="mb-2 text-sm font-semibold">
          Student Roster ({students.length})
        </h4>
        {students.length === 0 ? (
          <p className="text-sm text-muted-foreground">No students enrolled.</p>
        ) : (
          <div className="space-y-1">
            {students.map((s, idx) => (
              <div
                key={`${s.swimmer_id}-${idx}`}
                className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Badge
                    className="text-white"
                    style={{ backgroundColor: getLevelColor(s.level) }}
                  >
                    L{s.level}
                  </Badge>
                  <span>{s.swimmer_name}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {s.class_day.join(", ")} {formatTime(s.class_time)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Payroll Summary */}
      <div>
        <h4 className="mb-2 text-sm font-semibold">Payroll Summary (Recent)</h4>
        <div className="rounded-md border p-3">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Entries</p>
              <p className="text-lg font-semibold">{timeEntries.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Hours</p>
              <p className="text-lg font-semibold">{totalHours.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Est. Pay</p>
              <p className="text-lg font-semibold">
                {totalPay != null ? `$${totalPay.toFixed(2)}` : "—"}
              </p>
            </div>
          </div>
        </div>

        {timeEntries.length > 0 && (
          <div className="mt-2 space-y-1">
            {timeEntries.slice(0, 10).map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between text-xs text-muted-foreground"
              >
                <span>
                  {format(new Date(t.clock_in), "MMM d")} •{" "}
                  {format(new Date(t.clock_in), "h:mm a")}
                  {t.clock_out && ` – ${format(new Date(t.clock_out), "h:mm a")}`}
                </span>
                <span>{t.hours_worked ? `${t.hours_worked}h` : "In progress"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
