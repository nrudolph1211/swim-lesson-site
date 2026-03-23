"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Loader2, AlertTriangle, ChevronDown, ChevronUp, Printer, ClipboardCheck, BarChart3, CalendarOff, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatTime } from "@/lib/date-utils";
import { getLevelColor, getLevelTextColor, getLevelName, calculateAge } from "@/lib/swim-utils";
import { SkillTracker } from "./SkillTracker";
import { InstructorSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineError } from "@/components/ui/inline-error";

interface ClassInfo {
  id: string;
  level: number;
  start_time: string;
  end_time: string;
  max_capacity: number;
  session_name: string;
  day_of_week: string[];
}

interface StudentInfo {
  enrollment_id: string;
  swimmer_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  current_level: number;
  medical_notes: string | null;
}

interface AttendanceStatus {
  enrollment_id: string;
  status: "present" | "absent" | "excused";
}

export function TodayTab({ userId }: { userId: string }) {
  const supabase = createClient();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [students, setStudents] = useState<Map<string, StudentInfo[]>>(new Map());
  const [attendanceMode, setAttendanceMode] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<Map<string, AttendanceStatus[]>>(new Map());
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [skillStudent, setSkillStudent] = useState<StudentInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayName = dayNames[today.getDay()];
  const todayDate = today.toISOString().split("T")[0];

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Get active sessions
      const { data: activeSessions, error: sessErr } = await supabase
        .from("sessions")
        .select("id, name")
        .in("status", ["enrollment_open", "in_progress"]);

      if (sessErr) throw sessErr;

      if (!activeSessions?.length) {
        setClasses([]);
        setLoading(false);
        return;
      }

      const sessionIds = activeSessions.map((s) => s.id);
      const sessionMap = new Map(activeSessions.map((s) => [s.id, s.name]));

      // Get instructor's classes for today
      const { data: classData, error: classErr } = await supabase
        .from("classes")
        .select("id, level, start_time, end_time, max_capacity, session_id, day_of_week")
        .eq("instructor_id", userId)
        .eq("is_active", true)
        .in("session_id", sessionIds)
        .contains("day_of_week", [todayName]);

      if (classErr) throw classErr;

      setClasses(
        (classData ?? [])
          .map((c) => ({
            ...c,
            session_name: sessionMap.get(c.session_id) ?? "Unknown",
          }))
          .sort((a, b) => a.start_time.localeCompare(b.start_time))
      );
    } catch {
      setError("Failed to load today's classes.");
      toast.error("Failed to load today's classes.", { duration: Infinity });
    } finally {
      setLoading(false);
    }
  }, [supabase, userId, todayName]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const loadStudents = async (classId: string) => {
    if (students.has(classId)) return;

    try {
      const { data, error: enrollErr } = await supabase
        .from("enrollments")
        .select("id, swimmer_id, swimmer:swimmers(first_name, last_name, date_of_birth, current_level, medical_notes)")
        .eq("class_id", classId)
        .eq("status", "confirmed");

      if (enrollErr) throw enrollErr;

      const mapped: StudentInfo[] = (data ?? []).map((e) => {
        const sw = e.swimmer as unknown as
          | { first_name: string; last_name: string; date_of_birth: string; current_level: number; medical_notes: string | null }
          | { first_name: string; last_name: string; date_of_birth: string; current_level: number; medical_notes: string | null }[]
          | null;
        const s = Array.isArray(sw) ? sw[0] : sw;
        return {
          enrollment_id: e.id,
          swimmer_id: e.swimmer_id,
          first_name: s?.first_name ?? "",
          last_name: s?.last_name ?? "",
          date_of_birth: s?.date_of_birth ?? "",
          current_level: s?.current_level ?? 1,
          medical_notes: s?.medical_notes ?? null,
        };
      });

      setStudents((prev) => new Map(prev).set(classId, mapped));

      // Load existing attendance for today
      if (mapped.length > 0) {
        const enrollmentIds = mapped.map((m) => m.enrollment_id);
        const { data: existing } = await supabase
          .from("attendance_records")
          .select("enrollment_id, status")
          .in("enrollment_id", enrollmentIds)
          .eq("class_date", todayDate);

        const existingMap = new Map((existing ?? []).map((a) => [a.enrollment_id, a.status]));

        setAttendance((prev) =>
          new Map(prev).set(
            classId,
            mapped.map((m) => ({
              enrollment_id: m.enrollment_id,
              status: (existingMap.get(m.enrollment_id) as "present" | "absent" | "excused") ?? "present",
            }))
          )
        );
      }
    } catch {
      toast.error("Failed to load students for this class.", { duration: Infinity });
    }
  };

  const toggleExpand = async (classId: string) => {
    if (expandedClass === classId) {
      setExpandedClass(null);
      setAttendanceMode(null);
    } else {
      setExpandedClass(classId);
      await loadStudents(classId);
    }
  };

  const toggleAttendance = (classId: string, enrollmentId: string) => {
    setAttendance((prev) => {
      const next = new Map(prev);
      const list = (next.get(classId) ?? []).map((a) =>
        a.enrollment_id === enrollmentId
          ? { ...a, status: (a.status === "present" ? "absent" : "present") as "present" | "absent" }
          : a
      );
      next.set(classId, list);
      return next;
    });
  };

  const saveAttendance = async (classId: string) => {
    setSavingAttendance(true);
    try {
      const records = attendance.get(classId) ?? [];

      for (const record of records) {
        await supabase
          .from("attendance_records")
          .upsert(
            {
              enrollment_id: record.enrollment_id,
              class_date: todayDate,
              status: record.status,
              recorded_by: userId,
              recorded_at: new Date().toISOString(),
            },
            { onConflict: "enrollment_id,class_date", ignoreDuplicates: false }
          );
      }

      toast.success("Attendance saved!");
      setAttendanceMode(null);
    } catch {
      toast.error("Failed to save attendance.");
    } finally {
      setSavingAttendance(false);
    }
  };

  const printRoster = (cls: ClassInfo) => {
    window.open(`/instructor/print/roster/${cls.id}`, "_blank");
  };

  const printSchedule = () => {
    window.open("/instructor/print/schedule", "_blank");
  };

  if (loading) {
    return <InstructorSkeleton />;
  }

  if (error) {
    return <InlineError message={error} onRetry={fetchClasses} />;
  }

  if (classes.length === 0) {
    return (
      <EmptyState
        icon={<CalendarOff className="size-10" />}
        title="No classes scheduled for today"
        description={`You don\u2019t have any classes on ${todayName}. Check the Week tab for upcoming classes.`}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">
          {todayName}&apos;s Classes ({classes.length})
        </h2>
        <Button variant="outline" size="sm" onClick={printSchedule}>
          <Printer className="mr-1.5 size-4" />
          Print Schedule
        </Button>
      </div>

      {classes.map((cls) => {
        const studs = students.get(cls.id) ?? [];
        const isExpanded = expandedClass === cls.id;
        const isAttendance = attendanceMode === cls.id;
        const att = attendance.get(cls.id) ?? [];

        return (
          <div key={cls.id} className="rounded-xl border-2 bg-card">
            {/* Class Header */}
            <button
              className="flex w-full items-center justify-between p-4 text-left"
              onClick={() => toggleExpand(cls.id)}
            >
              <div className="flex items-center gap-3">
                <Badge
                  className="px-3 py-1 text-base"
                  style={{ backgroundColor: getLevelColor(cls.level), color: getLevelTextColor(cls.level) }}
                >
                  L{cls.level}
                </Badge>
                <div>
                  <p className="text-lg font-bold">
                    {formatTime(cls.start_time)} – {formatTime(cls.end_time)}
                  </p>
                  <p className="text-sm text-muted-foreground">{cls.session_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold">
                  {studs.length || "—"}/{cls.max_capacity}
                </span>
                {isExpanded ? (
                  <ChevronUp className="size-5" />
                ) : (
                  <ChevronDown className="size-5" />
                )}
              </div>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="border-t px-4 pb-4 pt-3">
                {/* Action Buttons */}
                <div className="mb-3 flex gap-2">
                  {isAttendance ? (
                    <Button
                      onClick={() => saveAttendance(cls.id)}
                      disabled={savingAttendance}
                      className="h-12 flex-1 text-base font-bold"
                    >
                      {savingAttendance ? (
                        <Loader2 className="mr-2 size-5 animate-spin" />
                      ) : (
                        <ClipboardCheck className="mr-2 size-5" />
                      )}
                      Save Attendance
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setAttendanceMode(cls.id)}
                      className="h-12 flex-1 text-base"
                    >
                      <ClipboardCheck className="mr-2 size-5" />
                      Take Attendance
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-12 w-12"
                    onClick={() => printRoster(cls)}
                  >
                    <Printer className="size-5" />
                  </Button>
                </div>

                {/* Student Roster */}
                {studs.length === 0 ? (
                  <EmptyState
                    icon={<Users className="size-8" />}
                    title="No students enrolled"
                    description="There are no confirmed enrollments for this class yet."
                    className="py-6"
                  />
                ) : (
                  <div className="space-y-1.5">
                    {studs.map((s) => {
                      const attRecord = att.find((a) => a.enrollment_id === s.enrollment_id);
                      const isPresent = attRecord?.status === "present";

                      return (
                        <div
                          key={s.enrollment_id}
                          className="flex items-center justify-between rounded-lg border p-3 min-h-[56px]"
                        >
                          <div className="flex items-center gap-2">
                            {s.medical_notes && (
                              <AlertTriangle className="size-5 shrink-0 text-orange-500" />
                            )}
                            <div>
                              <p className="text-base font-medium">
                                {s.first_name} {s.last_name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Age {calculateAge(s.date_of_birth)} • L{s.current_level}
                                {s.medical_notes && (
                                  <span className="ml-1 text-orange-600"> • {s.medical_notes}</span>
                                )}
                              </p>
                            </div>
                          </div>
                          {isAttendance ? (
                            <div className="flex items-center gap-2">
                              <span className={`text-base font-bold ${isPresent ? "text-green-600" : "text-red-500"}`}>
                                {isPresent ? "Here" : "Absent"}
                              </span>
                              <Switch
                                checked={isPresent}
                                onCheckedChange={() => toggleAttendance(cls.id, s.enrollment_id)}
                                className="scale-150"
                              />
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-12 min-h-[48px] min-w-[48px]"
                              onClick={() => setSkillStudent(s)}
                            >
                              <BarChart3 className="size-5" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Skill Tracking Sheet */}
      <Sheet open={!!skillStudent} onOpenChange={(o) => !o && setSkillStudent(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Skill Tracking</SheetTitle>
          </SheetHeader>
          {skillStudent && (
            <SkillTracker
              swimmerId={skillStudent.swimmer_id}
              swimmerName={`${skillStudent.first_name} ${skillStudent.last_name}`}
              currentLevel={skillStudent.current_level}
              instructorId={userId}
              onClose={() => setSkillStudent(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
