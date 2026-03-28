"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AlertTriangle, BarChart3, ChevronDown, ChevronUp, Phone, Search, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatTime } from "@/lib/date-utils";
import { getLevelColor, getLevelTextColor, getLevelName, calculateAge } from "@/lib/swim-utils";
import { SkillTracker } from "./SkillTracker";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

interface StudentEntry {
  swimmer_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  current_level: number;
  medical_notes: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  classes: { level: number; start_time: string; day_of_week: string[] }[];
}

export function StudentsTab({ userId }: { userId: string }) {
  const supabase = createClient();
  const [students, setStudents] = useState<StudentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [skillStudent, setSkillStudent] = useState<StudentEntry | null>(null);

  const fetchStudents = useCallback(async () => {
    setLoading(true);

    // Get active sessions
    const { data: activeSessions } = await supabase
      .from("sessions")
      .select("id")
      .in("status", ["enrollment_open", "in_progress"]);

    if (!activeSessions?.length) {
      setStudents([]);
      setLoading(false);
      return;
    }

    const sessionIds = activeSessions.map((s) => s.id);

    // Get instructor's classes
    const { data: classData } = await supabase
      .from("classes")
      .select("id, level, start_time, day_of_week")
      .eq("instructor_id", userId)
      .eq("is_active", true)
      .in("session_id", sessionIds);

    if (!classData?.length) {
      setStudents([]);
      setLoading(false);
      return;
    }

    const classIds = classData.map((c) => c.id);
    const classMap = new Map(classData.map((c) => [c.id, c]));

    // Get class assignments
    const { data: assignments } = await supabase
      .from("class_assignments")
      .select("class_id, swimmer_id, swimmer:swimmers(first_name, last_name, date_of_birth, current_level, medical_notes, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship)")
      .in("class_id", classIds)
      .eq("status", "active");

    // Deduplicate by swimmer_id
    const swimmerMap = new Map<string, StudentEntry>();

    for (const e of assignments ?? []) {
      const sw = e.swimmer as unknown as
        | { first_name: string; last_name: string; date_of_birth: string; current_level: number; medical_notes: string | null; emergency_contact_name: string | null; emergency_contact_phone: string | null; emergency_contact_relationship: string | null }
        | { first_name: string; last_name: string; date_of_birth: string; current_level: number; medical_notes: string | null; emergency_contact_name: string | null; emergency_contact_phone: string | null; emergency_contact_relationship: string | null }[]
        | null;
      const s = Array.isArray(sw) ? sw[0] : sw;
      if (!s) continue;

      const cls = classMap.get(e.class_id);
      if (!cls) continue;

      const existing = swimmerMap.get(e.swimmer_id);
      if (existing) {
        existing.classes.push({ level: cls.level, start_time: cls.start_time, day_of_week: cls.day_of_week });
      } else {
        swimmerMap.set(e.swimmer_id, {
          swimmer_id: e.swimmer_id,
          first_name: s.first_name,
          last_name: s.last_name,
          date_of_birth: s.date_of_birth,
          current_level: s.current_level,
          medical_notes: s.medical_notes,
          emergency_contact_name: s.emergency_contact_name,
          emergency_contact_phone: s.emergency_contact_phone,
          emergency_contact_relationship: s.emergency_contact_relationship,
          classes: [{ level: cls.level, start_time: cls.start_time, day_of_week: cls.day_of_week }],
        });
      }
    }

    setStudents(
      Array.from(swimmerMap.values()).sort((a, b) =>
        a.last_name.localeCompare(b.last_name)
      )
    );
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const filtered = useMemo(() => {
    if (!search) return students;
    const q = search.toLowerCase();
    return students.filter(
      (s) =>
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(q)
    );
  }, [students, search]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full rounded-md" />
        <Skeleton className="h-4 w-24" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search students..."
          className="h-12 pl-10 text-base"
        />
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} student{filtered.length !== 1 ? "s" : ""}
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="size-10" />}
          title={search ? "No students match your search" : "No students assigned"}
          description={search ? "Try a different search term." : "Students will appear here once they are assigned to your classes."}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => {
            const isExpanded = expandedId === s.swimmer_id;

            return (
              <div key={s.swimmer_id} className="rounded-xl border-2 bg-card">
                <button
                  className="flex w-full items-center justify-between p-3 min-h-[56px] text-left active:bg-muted/50"
                  onClick={() => setExpandedId(isExpanded ? null : s.swimmer_id)}
                >
                  <div className="flex items-center gap-2">
                    {s.medical_notes && (
                      <AlertTriangle className="size-5 shrink-0 text-orange-500" />
                    )}
                    <div>
                      <p className="text-base font-bold">
                        {s.first_name} {s.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Age {calculateAge(s.date_of_birth)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      style={{ backgroundColor: getLevelColor(s.current_level), color: getLevelTextColor(s.current_level) }}
                    >
                      L{s.current_level}
                    </Badge>
                    {isExpanded ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t px-3 pb-3 pt-2 text-sm">
                    {/* Classes */}
                    <p className="mb-1 text-xs font-semibold text-muted-foreground">
                      Classes with you
                    </p>
                    <div className="mb-2 space-y-1">
                      {s.classes.map((cls, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Badge
                            className="text-xs"
                            style={{ backgroundColor: getLevelColor(cls.level), color: getLevelTextColor(cls.level) }}
                          >
                            L{cls.level}
                          </Badge>
                          <span>
                            {cls.day_of_week.join(", ")} {formatTime(cls.start_time)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Medical */}
                    {s.medical_notes && (
                      <div className="mb-2 rounded-lg bg-orange-50 p-2 text-orange-800 dark:bg-orange-950/30 dark:text-orange-300">
                        <p className="text-xs font-semibold">Medical Notes</p>
                        <p>{s.medical_notes}</p>
                      </div>
                    )}

                    {/* Emergency Contact */}
                    {s.emergency_contact_name && (
                      <div className="rounded-lg bg-muted/50 p-2">
                        <p className="text-xs font-semibold text-muted-foreground">Emergency Contact</p>
                        <p className="font-medium">
                          {s.emergency_contact_name}
                          {s.emergency_contact_relationship && (
                            <span className="font-normal text-muted-foreground">
                              {" "}({s.emergency_contact_relationship})
                            </span>
                          )}
                        </p>
                        {s.emergency_contact_phone && (
                          <a
                            href={`tel:${s.emergency_contact_phone}`}
                            className="mt-0.5 flex items-center gap-1 text-primary"
                          >
                            <Phone className="size-3.5" />
                            {s.emergency_contact_phone}
                          </a>
                        )}
                      </div>
                    )}

                    {/* Track Skills button */}
                    <Button
                      variant="outline"
                      className="mt-2 h-12 w-full text-base"
                      onClick={() => setSkillStudent(s)}
                    >
                      <BarChart3 className="mr-2 size-5" />
                      Track Skills
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
