"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  CloudOff,
  Loader2,
  Users,
} from "lucide-react";
import { TableSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { formatTime, formatDateShort } from "@/lib/date-utils";
import { getLevelColor, getLevelTextColor, getLevelName } from "@/lib/swim-utils";

interface ClassForDate {
  id: string;
  level: number;
  start_time: string;
  end_time: string;
  max_capacity: number;
  session_name: string;
  day_of_week: string[];
  instructor_name: string;
  enrolled_count: number;
  enrolled_swimmer_ids: string[];
  enrolled_parent_ids: string[];
  enrollment_ids: string[];
}

interface CancellationRecord {
  id: string;
  cancelled_date: string;
  reason: string | null;
  cancelled_by_name: string;
  class_level: number;
  class_time: string;
  affected_count: number;
  created_at: string;
}

const REASONS = [
  "Lightning/Thunderstorm",
  "Extreme Heat",
  "Poor Air Quality",
  "Pool Maintenance",
  "Other",
];

export function CancellationManager() {
  const supabase = createClient();
  const [tab, setTab] = useState<"new" | "history">("new");

  // ── New Cancellation ──────────────────────────────────
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [classes, setClasses] = useState<ClassForDate[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("Lightning/Thunderstorm");
  const [otherReason, setOtherReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [makeupLimit, setMakeupLimit] = useState(2);

  // ── History ───────────────────────────────────────────
  const [history, setHistory] = useState<CancellationRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Fetch classes for selected date
  const fetchClassesForDate = useCallback(async () => {
    setLoadingClasses(true);
    setSelectedClasses(new Set());

    try {
      const date = new Date(selectedDate + "T12:00:00");
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayName = dayNames[date.getDay()];

      // Get active sessions
      const { data: sessions, error: sessErr } = await supabase
        .from("sessions")
        .select("id, name")
        .in("status", ["enrollment_open", "in_progress"]);
      if (sessErr) throw sessErr;

      if (!sessions?.length) {
        setClasses([]);
        setLoadingClasses(false);
        return;
      }

      const sessionIds = sessions.map((s) => s.id);
      const sessionMap = new Map(sessions.map((s) => [s.id, s.name]));

      // Get classes that run on this day
      const { data: classData, error: classErr } = await supabase
        .from("classes")
        .select("id, level, start_time, end_time, max_capacity, session_id, day_of_week, instructor:instructors(profile:profiles!id(full_name))")
        .eq("is_active", true)
        .in("session_id", sessionIds)
        .contains("day_of_week", [dayName]);
      if (classErr) throw classErr;

      if (!classData?.length) {
        setClasses([]);
        setLoadingClasses(false);
        return;
      }

      // Check which are already cancelled
      const classIds = classData.map((c) => c.id);
      const { data: existingCancellations } = await supabase
        .from("cancellations")
        .select("class_id")
        .in("class_id", classIds)
        .eq("cancelled_date", selectedDate);

      const cancelledSet = new Set(
        (existingCancellations ?? []).map((c) => c.class_id)
      );

      // Get enrollment data
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("id, class_id, swimmer_id, swimmer:swimmers(family_id)")
        .in("class_id", classIds)
        .eq("status", "confirmed");

      // Build per-class enrollment info
      const classEnrollments = new Map<string, {
        count: number;
        swimmerIds: string[];
        parentIds: string[];
        enrollmentIds: string[];
      }>();

      for (const e of enrollments ?? []) {
        const sw = e.swimmer as unknown as
          | { family_id: string }
          | { family_id: string }[]
          | null;
        const s = Array.isArray(sw) ? sw[0] : sw;

        const existing = classEnrollments.get(e.class_id) ?? {
          count: 0,
          swimmerIds: [],
          parentIds: [],
          enrollmentIds: [],
        };
        existing.count++;
        existing.swimmerIds.push(e.swimmer_id);
        if (s?.family_id) existing.parentIds.push(s.family_id);
        existing.enrollmentIds.push(e.id);
        classEnrollments.set(e.class_id, existing);
      }

      setClasses(
        classData
          .filter((c) => !cancelledSet.has(c.id))
          .map((c) => {
            const inst = c.instructor as unknown as
              | { profile: { full_name: string } | { full_name: string }[] | null }
              | { profile: { full_name: string } | { full_name: string }[] | null }[]
              | null;
            const iObj = Array.isArray(inst) ? inst[0] : inst;
            const profile = iObj?.profile;
            const pObj = Array.isArray(profile) ? profile[0] : profile;

            const enrollInfo = classEnrollments.get(c.id);

            return {
              id: c.id,
              level: c.level,
              start_time: c.start_time,
              end_time: c.end_time,
              max_capacity: c.max_capacity,
              session_name: sessionMap.get(c.session_id) ?? "",
              day_of_week: c.day_of_week,
              instructor_name: pObj?.full_name ?? "Unassigned",
              enrolled_count: enrollInfo?.count ?? 0,
              enrolled_swimmer_ids: enrollInfo?.swimmerIds ?? [],
              enrolled_parent_ids: enrollInfo?.parentIds ?? [],
              enrollment_ids: enrollInfo?.enrollmentIds ?? [],
            };
          })
          .sort((a, b) => a.start_time.localeCompare(b.start_time))
      );

      // Get makeup credit limit from settings
      const { data: setting } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "makeup_credit_limit")
        .single();
      if (setting?.value) setMakeupLimit(Number(setting.value) || 2);
    } catch (err) {
      toast.error("Failed to load classes for this date.", { duration: Infinity });
      setClasses([]);
    } finally {
      setLoadingClasses(false);
    }
  }, [supabase, selectedDate]);

  useEffect(() => {
    if (tab === "new") fetchClassesForDate();
  }, [fetchClassesForDate, tab]);

  // Fetch cancellation history
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);

    try {
      let query = supabase
        .from("cancellations")
        .select("id, class_id, cancelled_date, reason, created_at, cancelled_by, admin:profiles!cancelled_by(full_name), class:classes(level, start_time)")
        .order("cancelled_date", { ascending: false })
        .limit(100);

      if (dateFrom) query = query.gte("cancelled_date", dateFrom);
      if (dateTo) query = query.lte("cancelled_date", dateTo);

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        // Get affected counts per cancellation
        const records: CancellationRecord[] = data.map((c) => {
          const admin = c.admin as unknown as
            | { full_name: string }
            | { full_name: string }[]
            | null;
          const aObj = Array.isArray(admin) ? admin[0] : admin;

          const cls = c.class as unknown as
            | { level: number; start_time: string }
            | { level: number; start_time: string }[]
            | null;
          const cObj = Array.isArray(cls) ? cls[0] : cls;

          return {
            id: c.id,
            cancelled_date: c.cancelled_date,
            reason: c.reason,
            cancelled_by_name: aObj?.full_name ?? "System",
            class_level: cObj?.level ?? 1,
            class_time: cObj?.start_time ?? "",
            affected_count: 0, // Will be enriched below
            created_at: c.created_at,
          };
        });

        setHistory(records);
      }
    } catch {
      toast.error("Failed to load cancellation history.", { duration: Infinity });
    } finally {
      setLoadingHistory(false);
    }
  }, [supabase, dateFrom, dateTo]);

  useEffect(() => {
    if (tab === "history") fetchHistory();
  }, [fetchHistory, tab]);

  // Selection helpers
  const allSelected = classes.length > 0 && classes.every((c) => selectedClasses.has(c.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedClasses(new Set());
    } else {
      setSelectedClasses(new Set(classes.map((c) => c.id)));
    }
  };

  const toggleClass = (id: string) => {
    setSelectedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Preview calculations
  const selectedClassList = classes.filter((c) => selectedClasses.has(c.id));
  const totalSwimmers = new Set(
    selectedClassList.flatMap((c) => c.enrolled_swimmer_ids)
  ).size;
  const totalEnrollments = selectedClassList.reduce(
    (sum, c) => sum + c.enrollment_ids.length,
    0
  );

  const finalReason = reason === "Other" ? otherReason.trim() : reason;

  // Submit cancellation
  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Insert cancellation records
      const cancellationInserts = selectedClassList.map((c) => ({
        class_id: c.id,
        cancelled_date: selectedDate,
        reason: finalReason,
        cancelled_by: user?.id,
      }));

      const { error: cancelError } = await supabase
        .from("cancellations")
        .insert(cancellationInserts);
      if (cancelError) throw cancelError;

      // 2. Increment makeup_credits on each enrollment (respect limit)
      const allEnrollmentIds = selectedClassList.flatMap((c) => c.enrollment_ids);

      if (allEnrollmentIds.length > 0) {
        // Fetch current credits
        const { data: enrollmentData } = await supabase
          .from("enrollments")
          .select("id, makeup_credits")
          .in("id", allEnrollmentIds);

        for (const e of enrollmentData ?? []) {
          const currentCredits = e.makeup_credits ?? 0;
          if (currentCredits < makeupLimit) {
            await supabase
              .from("enrollments")
              .update({ makeup_credits: currentCredits + 1 })
              .eq("id", e.id);
          }
        }
      }

      // 3. Notify affected parents (deduplicate)
      const parentIds = [
        ...new Set(selectedClassList.flatMap((c) => c.enrolled_parent_ids)),
      ];

      if (parentIds.length > 0) {
        const notifications = parentIds.map((pid) => ({
          user_id: pid,
          type: "weather_cancellation" as const,
          title: "Class Cancelled",
          message: `Classes on ${format(parseISO(selectedDate), "EEEE, MMMM d")} have been cancelled due to ${finalReason.toLowerCase()}. A make-up credit has been added to your account.`,
          link: "/dashboard",
        }));

        await supabase.from("notifications").insert(notifications);
      }

      toast.success(
        `${selectedClassList.length} class(es) cancelled. ${totalSwimmers} swimmer(s) notified.`
      );
      setConfirmOpen(false);
      setSelectedClasses(new Set());
      await fetchClassesForDate();
    } catch {
      toast.error("Failed to process cancellations.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border p-1">
        <button
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === "new"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setTab("new")}
        >
          <CloudOff className="mr-1.5 inline size-3.5" />
          New Cancellation
        </button>
        <button
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === "history"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setTab("history")}
        >
          History
        </button>
      </div>

      {tab === "new" ? (
        <div className="space-y-4">
          {/* Date + Reason */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="cancel-date">Date</Label>
              <Input
                id="cancel-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select value={reason} onValueChange={(v) => v && setReason(v)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {reason === "Other" && (
              <div className="flex-1 space-y-2">
                <Label htmlFor="other-reason">Specify</Label>
                <Input
                  id="other-reason"
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  placeholder="Reason for cancellation..."
                />
              </div>
            )}
          </div>

          {/* Class List */}
          {loadingClasses ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : classes.length === 0 ? (
            <EmptyState
              icon={<CloudOff className="size-10" />}
              title="No active classes"
              description="There are no active classes on this date, or all have already been cancelled."
            />
          ) : (
            <>
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  Select All ({classes.length} classes)
                </label>
              </div>

              <div className="space-y-2">
                {classes.map((cls) => (
                  <label
                    key={cls.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-colors ${
                      selectedClasses.has(cls.id)
                        ? "border-primary bg-primary/5"
                        : "border-muted"
                    }`}
                  >
                    <Checkbox
                      checked={selectedClasses.has(cls.id)}
                      onCheckedChange={() => toggleClass(cls.id)}
                    />
                    <Badge
                      style={{ backgroundColor: getLevelColor(cls.level), color: getLevelTextColor(cls.level) }}
                    >
                      L{cls.level}
                    </Badge>
                    <div className="flex-1">
                      <p className="font-medium">
                        {formatTime(cls.start_time)} – {formatTime(cls.end_time)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {cls.session_name} • {cls.instructor_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {cls.enrolled_count} swimmer{cls.enrolled_count !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              {/* Preview + Submit */}
              {selectedClasses.size > 0 && (
                <div className="rounded-lg border-2 border-orange-300 bg-orange-50 p-4 dark:bg-orange-950/20">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 size-5 text-orange-600" />
                    <div>
                      <p className="font-semibold text-orange-800 dark:text-orange-300">
                        Cancellation Preview
                      </p>
                      <ul className="mt-1 space-y-0.5 text-sm text-orange-700 dark:text-orange-400">
                        <li>{selectedClasses.size} class(es) will be cancelled</li>
                        <li>{totalSwimmers} unique swimmer(s) affected</li>
                        <li>{totalEnrollments} enrollment(s) will receive 1 make-up credit each</li>
                        <li>Make-up credit limit: {makeupLimit} per enrollment</li>
                      </ul>
                      <Button
                        className="mt-3"
                        variant="destructive"
                        onClick={() => setConfirmOpen(true)}
                        disabled={reason === "Other" && !otherReason.trim()}
                      >
                        <CloudOff className="mr-2 size-4" />
                        Confirm Cancellation
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Confirmation Dialog */}
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Confirm Cancellation</DialogTitle>
                <DialogDescription>
                  This will cancel {selectedClasses.size} class(es), issue make-up credits, and
                  notify {totalSwimmers} parent(s). This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <p>
                  <strong>Date:</strong>{" "}
                  {format(parseISO(selectedDate), "EEEE, MMMM d, yyyy")}
                </p>
                <p>
                  <strong>Reason:</strong> {finalReason}
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                  Go Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirm}
                  disabled={submitting}
                >
                  {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Cancel Classes
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        /* ── History ──────────────────────────────────────── */
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="hist-from">From</Label>
              <Input
                id="hist-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hist-to">To</Label>
              <Input
                id="hist-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            {(dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                Clear
              </Button>
            )}
          </div>

          {loadingHistory ? (
            <TableSkeleton rows={5} cols={4} />
          ) : history.length === 0 ? (
            <EmptyState
              icon={<CloudOff className="size-10" />}
              title="No cancellation history"
              description="No cancellations have been recorded for the selected date range."
            />
          ) : (
            <>
            {/* Mobile cards */}
            <div className="space-y-3 sm:hidden">
              {history.map((h) => (
                <div key={h.id} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {formatDateShort(h.cancelled_date)}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge
                        style={{ backgroundColor: getLevelColor(h.class_level), color: getLevelTextColor(h.class_level) }}
                      >
                        L{h.class_level}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {formatTime(h.class_time)}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm">{h.reason ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">By {h.cancelled_by_name}</p>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block">
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Cancelled By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="font-medium">
                        {formatDateShort(h.cancelled_date)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge
                            style={{ backgroundColor: getLevelColor(h.class_level), color: getLevelTextColor(h.class_level) }}
                          >
                            L{h.class_level}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {formatTime(h.class_time)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {h.reason ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {h.cancelled_by_name}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
