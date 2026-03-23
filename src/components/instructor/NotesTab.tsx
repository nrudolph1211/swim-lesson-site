"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle, CalendarX, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { getLevelColor, getLevelTextColor } from "@/lib/swim-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineError } from "@/components/ui/inline-error";

interface StudentNote {
  swimmer_id: string;
  first_name: string;
  last_name: string;
  current_level: number;
  session_id: string;
  notes: string;
  recommendation: string;
  saved: boolean;
}

export function NotesTab({ userId }: { userId: string }) {
  const supabase = createClient();
  const [students, setStudents] = useState<StudentNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Get active session
      const { data: activeSessions, error: sessErr } = await supabase
        .from("sessions")
        .select("id, name")
        .in("status", ["enrollment_open", "in_progress"])
        .limit(1);

      if (sessErr) throw sessErr;

      if (!activeSessions?.length) {
        setStudents([]);
        setSessionId(null);
        setLoading(false);
        return;
      }

      const session = activeSessions[0];
      setSessionId(session.id);
      setSessionName(session.name);

      // Get instructor's classes in this session
      const { data: classData, error: classErr } = await supabase
        .from("classes")
        .select("id")
        .eq("instructor_id", userId)
        .eq("is_active", true)
        .eq("session_id", session.id);

      if (classErr) throw classErr;

      if (!classData?.length) {
        setStudents([]);
        setLoading(false);
        return;
      }

      const classIds = classData.map((c) => c.id);

      // Get enrolled swimmers (deduplicated)
      const { data: enrollments, error: enrollErr } = await supabase
        .from("enrollments")
        .select("swimmer_id, swimmer:swimmers(first_name, last_name, current_level)")
        .in("class_id", classIds)
        .eq("status", "confirmed");

      if (enrollErr) throw enrollErr;

      const swimmerMap = new Map<string, { first_name: string; last_name: string; current_level: number }>();
      for (const e of enrollments ?? []) {
        if (swimmerMap.has(e.swimmer_id)) continue;
        const sw = e.swimmer as unknown as
          | { first_name: string; last_name: string; current_level: number }
          | { first_name: string; last_name: string; current_level: number }[]
          | null;
        const s = Array.isArray(sw) ? sw[0] : sw;
        if (s) swimmerMap.set(e.swimmer_id, s);
      }

      // Get existing notes
      const swimmerIds = Array.from(swimmerMap.keys());
      const { data: existingNotes } = await supabase
        .from("session_instructor_notes")
        .select("swimmer_id, notes, recommendation")
        .eq("session_id", session.id)
        .eq("instructor_id", userId)
        .in("swimmer_id", swimmerIds.length > 0 ? swimmerIds : ["__none__"]);

      const notesMap = new Map<string, { notes: string; recommendation: string }>();
      for (const n of existingNotes ?? []) {
        notesMap.set(n.swimmer_id, { notes: n.notes ?? "", recommendation: n.recommendation ?? "" });
      }

      setStudents(
        Array.from(swimmerMap.entries())
          .map(([id, s]) => ({
            swimmer_id: id,
            first_name: s.first_name,
            last_name: s.last_name,
            current_level: s.current_level,
            session_id: session.id,
            notes: notesMap.get(id)?.notes ?? "",
            recommendation: notesMap.get(id)?.recommendation ?? "",
            saved: true,
          }))
          .sort((a, b) => a.last_name.localeCompare(b.last_name))
      );
    } catch {
      setError("Failed to load student notes.");
      toast.error("Failed to load student notes.", { duration: Infinity });
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const saveNote = useCallback(
    async (swimmerId: string, notes: string, recommendation: string) => {
      if (!sessionId) return;

      const { error } = await supabase
        .from("session_instructor_notes")
        .upsert(
          {
            swimmer_id: swimmerId,
            session_id: sessionId,
            instructor_id: userId,
            notes: notes || null,
            recommendation: recommendation || null,
          },
          { onConflict: "swimmer_id,session_id,instructor_id" }
        );

      if (error) {
        // If upsert fails due to no unique constraint, try insert then update
        const { error: insertError } = await supabase
          .from("session_instructor_notes")
          .insert({
            swimmer_id: swimmerId,
            session_id: sessionId,
            instructor_id: userId,
            notes: notes || null,
            recommendation: recommendation || null,
          });

        if (insertError) {
          // Already exists, update
          await supabase
            .from("session_instructor_notes")
            .update({ notes: notes || null, recommendation: recommendation || null })
            .eq("swimmer_id", swimmerId)
            .eq("session_id", sessionId)
            .eq("instructor_id", userId);
        }
      }

      setStudents((prev) =>
        prev.map((s) =>
          s.swimmer_id === swimmerId ? { ...s, saved: true } : s
        )
      );
    },
    [supabase, sessionId, userId]
  );

  const handleNoteChange = (swimmerId: string, notes: string) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.swimmer_id === swimmerId ? { ...s, notes, saved: false } : s
      )
    );

    // Debounce save
    const existing = debounceTimers.current.get(swimmerId);
    if (existing) clearTimeout(existing);

    const student = students.find((s) => s.swimmer_id === swimmerId);
    debounceTimers.current.set(
      swimmerId,
      setTimeout(() => {
        saveNote(swimmerId, notes, student?.recommendation ?? "");
      }, 1000)
    );
  };

  const handleRecommendationChange = (swimmerId: string, recommendation: string) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.swimmer_id === swimmerId ? { ...s, recommendation, saved: false } : s
      )
    );

    const student = students.find((s) => s.swimmer_id === swimmerId);
    // Save immediately for dropdown changes
    saveNote(swimmerId, student?.notes ?? "", recommendation);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-5 w-32 rounded-full" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border-2 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-10 rounded-full" />
                <Skeleton className="h-5 w-32" />
              </div>
              <Skeleton className="size-4 rounded-full" />
            </div>
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <InlineError message={error} onRetry={fetchData} />;
  }

  if (!sessionId) {
    return (
      <EmptyState
        icon={<CalendarX className="size-10" />}
        title="No active session"
        description="There is no active session right now. Notes will be available once a session is in progress."
      />
    );
  }

  const completedCount = students.filter((s) => s.notes.trim() || s.recommendation).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{sessionName}</h2>
        <Badge variant="outline" className="text-sm">
          <CheckCircle className="mr-1 size-3.5" />
          {completedCount} of {students.length} completed
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: students.length > 0 ? `${(completedCount / students.length) * 100}%` : "0%" }}
        />
      </div>

      {students.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-10" />}
          title="No students to review"
          description="You don't have any enrolled students in this session yet."
        />
      ) : (
        <div className="space-y-3">
          {students.map((s) => (
            <div key={s.swimmer_id} className="rounded-xl border-2 bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge
                    style={{ backgroundColor: getLevelColor(s.current_level), color: getLevelTextColor(s.current_level) }}
                  >
                    L{s.current_level}
                  </Badge>
                  <span className="text-base font-bold">
                    {s.first_name} {s.last_name}
                  </span>
                </div>
                {s.saved ? (
                  <CheckCircle className="size-4 text-green-500" />
                ) : (
                  <span className="text-xs text-muted-foreground">Saving...</span>
                )}
              </div>

              <Textarea
                value={s.notes}
                onChange={(e) => handleNoteChange(s.swimmer_id, e.target.value)}
                placeholder="End-of-session notes..."
                rows={2}
                className="mb-2 text-base"
              />

              <Select
                value={s.recommendation || "__none__"}
                onValueChange={(v) => v && handleRecommendationChange(s.swimmer_id, v === "__none__" ? "" : v)}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Recommendation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No Recommendation</SelectItem>
                  <SelectItem value="promote">Promote to Next Level</SelectItem>
                  <SelectItem value="continue">Continue at Current Level</SelectItem>
                  <SelectItem value="review">Needs Review</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
