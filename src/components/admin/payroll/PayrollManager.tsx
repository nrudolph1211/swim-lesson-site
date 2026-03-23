"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Clock,
  DollarSign,
  Users,
  Download,
  Loader2,
  AlertTriangle,
  Pencil,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { format, parseISO, startOfDay, endOfDay, differenceInHours } from "date-fns";
import { toast } from "sonner";

interface TimeEntry {
  id: string;
  instructor_id: string;
  instructor_name: string;
  clock_in: string;
  clock_out: string | null;
  hours_worked: number | null;
  status: string;
  notes: string | null;
  edited_by: string | null;
}

interface InstructorSummary {
  id: string;
  name: string;
  hours: number;
  classes: number;
  hourlyRate: number | null;
  grossPay: number | null;
}

// Bi-weekly pay periods starting from a reference Monday
function getPayPeriods() {
  const now = new Date();
  const ref = new Date("2026-01-05"); // A known Monday
  const periods: { label: string; start: string; end: string }[] = [];

  let start = new Date(ref);
  // Advance to a period that covers now or is recent
  while (start < now) {
    const end = new Date(start);
    end.setDate(end.getDate() + 13);
    if (end >= new Date(now.getFullYear(), now.getMonth() - 3, 1)) {
      periods.push({
        label: `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`,
        start: format(start, "yyyy-MM-dd"),
        end: format(end, "yyyy-MM-dd"),
      });
    }
    start.setDate(start.getDate() + 14);
  }
  // Add one more future period
  const end = new Date(start);
  end.setDate(end.getDate() + 13);
  periods.push({
    label: `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`,
    start: format(start, "yyyy-MM-dd"),
    end: format(end, "yyyy-MM-dd"),
  });

  return periods.reverse();
}

export function PayrollManager() {
  const supabase = createClient();
  const { user } = useAuthContext();
  const payPeriods = useMemo(() => getPayPeriods(), []);
  const [periodIdx, setPeriodIdx] = useState(0);
  const [dateStart, setDateStart] = useState(payPeriods[0]?.start ?? "");
  const [dateEnd, setDateEnd] = useState(payPeriods[0]?.end ?? "");
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [instructors, setInstructors] = useState<Map<string, { name: string; hourlyRate: number | null }>>(new Map());
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const selectPeriod = (idx: number) => {
    setPeriodIdx(idx);
    setDateStart(payPeriods[idx].start);
    setDateEnd(payPeriods[idx].end);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Fetch instructors with profiles
    const { data: instrData } = await supabase
      .from("instructors")
      .select("id, hourly_rate, profile:profiles(full_name)")
      .eq("is_active", true);

    const instrMap = new Map<string, { name: string; hourlyRate: number | null }>();
    for (const i of instrData ?? []) {
      const profile = Array.isArray(i.profile) ? i.profile[0] : i.profile;
      instrMap.set(i.id, {
        name: profile?.full_name ?? "Unknown",
        hourlyRate: i.hourly_rate ? Number(i.hourly_rate) : null,
      });
    }
    setInstructors(instrMap);

    // Fetch time entries in date range
    const { data: timeData } = await supabase
      .from("time_entries")
      .select("*")
      .gte("clock_in", startOfDay(parseISO(dateStart)).toISOString())
      .lte("clock_in", endOfDay(parseISO(dateEnd)).toISOString())
      .order("clock_in", { ascending: false });

    const mapped: TimeEntry[] = (timeData ?? []).map((t) => ({
      id: t.id,
      instructor_id: t.instructor_id,
      instructor_name: instrMap.get(t.instructor_id)?.name ?? "Unknown",
      clock_in: t.clock_in,
      clock_out: t.clock_out,
      hours_worked: t.hours_worked ? Number(t.hours_worked) : null,
      status: t.status,
      notes: t.notes,
      edited_by: t.edited_by,
    }));
    setEntries(mapped);
    setLoading(false);
  }, [supabase, dateStart, dateEnd]);

  useEffect(() => {
    if (dateStart && dateEnd) fetchData();
  }, [fetchData, dateStart, dateEnd]);

  // Instructor summaries
  const summaries = useMemo(() => {
    const map = new Map<string, InstructorSummary>();
    for (const [id, info] of instructors) {
      map.set(id, {
        id,
        name: info.name,
        hours: 0,
        classes: 0,
        hourlyRate: info.hourlyRate,
        grossPay: null,
      });
    }
    for (const e of entries) {
      const s = map.get(e.instructor_id);
      if (s && e.hours_worked != null) {
        s.hours += e.hours_worked;
        s.classes += 1;
      }
    }
    for (const s of map.values()) {
      s.hours = Math.round(s.hours * 100) / 100;
      if (s.hourlyRate) {
        s.grossPay = Math.round(s.hours * s.hourlyRate * 100) / 100;
      }
    }
    return Array.from(map.values()).filter((s) => s.hours > 0 || s.classes > 0);
  }, [entries, instructors]);

  const totalHours = summaries.reduce((sum, s) => sum + s.hours, 0);
  const totalPay = summaries.reduce((sum, s) => sum + (s.grossPay ?? 0), 0);

  // Missed clock-outs (>12 hours without clock_out)
  const missedClockouts = entries.filter(
    (e) =>
      !e.clock_out &&
      differenceInHours(new Date(), parseISO(e.clock_in)) > 12
  );

  // Edit handler
  const openEdit = (entry: TimeEntry) => {
    setEditEntry(entry);
    setEditClockIn(entry.clock_in ? format(parseISO(entry.clock_in), "yyyy-MM-dd'T'HH:mm") : "");
    setEditClockOut(entry.clock_out ? format(parseISO(entry.clock_out), "yyyy-MM-dd'T'HH:mm") : "");
  };

  const handleSaveEdit = async () => {
    if (!editEntry || !user) return;
    setEditSaving(true);

    const clockInDate = new Date(editClockIn);
    const clockOutDate = editClockOut ? new Date(editClockOut) : null;
    const hours = clockOutDate
      ? Math.round(((clockOutDate.getTime() - clockInDate.getTime()) / 3600000) * 100) / 100
      : null;

    // Store original times in notes
    const originalNote = `Edited by admin. Original: ${format(parseISO(editEntry.clock_in), "M/d h:mm a")}${editEntry.clock_out ? ` – ${format(parseISO(editEntry.clock_out), "h:mm a")}` : " (no clock-out)"}`;
    const notes = editEntry.notes
      ? `${editEntry.notes}\n${originalNote}`
      : originalNote;

    const { error } = await supabase
      .from("time_entries")
      .update({
        clock_in: clockInDate.toISOString(),
        clock_out: clockOutDate?.toISOString() ?? null,
        hours_worked: hours,
        status: clockOutDate ? "edited" : "clocked_in",
        notes,
        edited_by: user.id,
      })
      .eq("id", editEntry.id);

    if (error) {
      toast.error("Failed to update time entry.");
    } else {
      toast.success("Time entry updated.");
      setEditEntry(null);
      await fetchData();
    }
    setEditSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this time entry? This cannot be undone.")) return;
    const { error } = await supabase.from("time_entries").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete.");
    } else {
      toast.success("Entry deleted.");
      await fetchData();
    }
  };

  // CSV export
  const exportCSV = () => {
    const headers = ["Employee Name", "Date", "Clock In", "Clock Out", "Hours", "Hourly Rate", "Gross Pay", "Status", "Notes"];
    const rows = entries.map((e) => {
      const info = instructors.get(e.instructor_id);
      const rate = info?.hourlyRate ?? 0;
      const pay = e.hours_worked != null && rate ? (e.hours_worked * rate).toFixed(2) : "";
      return [
        `"${e.instructor_name}"`,
        format(parseISO(e.clock_in), "yyyy-MM-dd"),
        format(parseISO(e.clock_in), "HH:mm"),
        e.clock_out ? format(parseISO(e.clock_out), "HH:mm") : "",
        e.hours_worked?.toFixed(2) ?? "",
        rate ? rate.toFixed(2) : "",
        pay,
        e.status,
        `"${(e.notes ?? "").replace(/"/g, '""')}"`,
      ];
    });
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-${dateStart}-to-${dateEnd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && entries.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Instructor Payroll</h1>
          <p className="text-sm text-muted-foreground">Track hours and generate payroll reports.</p>
        </div>
        <Button variant="outline" onClick={exportCSV}>
          <Download className="mr-2 size-4" />
          Export Payroll
        </Button>
      </div>

      {/* Pay Period Selector */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-1">
            <Label className="text-xs">Pay Period</Label>
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={periodIdx}
              onChange={(e) => selectPeriod(Number(e.target.value))}
            >
              {payPeriods.map((p, i) => (
                <option key={i} value={i}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Start</Label>
            <Input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">End</Label>
            <Input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="w-40"
            />
          </div>
        </CardContent>
      </Card>

      {/* Missed Clock-outs Warning */}
      {missedClockouts.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">
              {missedClockouts.length} missed clock-out{missedClockouts.length > 1 ? "s" : ""}
            </p>
            <p className="text-xs">
              The following entries are over 12 hours without a clock-out:{" "}
              {missedClockouts.map((e) => `${e.instructor_name} (${format(parseISO(e.clock_in), "M/d")})`).join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-blue-100">
              <Clock className="size-5 text-blue-700" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalHours.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">Total Hours</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-green-100">
              <DollarSign className="size-5 text-green-700" />
            </div>
            <div>
              <p className="text-2xl font-bold">${totalPay.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Gross Pay</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-purple-100">
              <Users className="size-5 text-purple-700" />
            </div>
            <div>
              <p className="text-2xl font-bold">{summaries.length}</p>
              <p className="text-xs text-muted-foreground">Active Instructors</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-Instructor Summary */}
      <Card>
        <CardHeader>
          <h2 className="font-heading text-lg font-semibold">Instructor Summary</h2>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instructor</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Gross Pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No time entries in this period.
                  </TableCell>
                </TableRow>
              ) : (
                summaries.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-right">{s.hours.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{s.classes}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {s.hourlyRate ? `$${s.hourlyRate.toFixed(2)}/hr` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {s.grossPay != null ? `$${s.grossPay.toFixed(2)}` : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detailed Time Entries */}
      <Card>
        <CardHeader>
          <h2 className="font-heading text-lg font-semibold">
            Time Entry Log ({entries.length})
          </h2>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instructor</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Clock In</TableHead>
                <TableHead>Clock Out</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    No time entries in this period.
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((e) => {
                  const isMissed =
                    !e.clock_out &&
                    differenceInHours(new Date(), parseISO(e.clock_in)) > 12;

                  return (
                    <TableRow key={e.id} className={isMissed ? "bg-yellow-50" : ""}>
                      <TableCell className="text-sm font-medium">{e.instructor_name}</TableCell>
                      <TableCell className="text-xs">
                        {format(parseISO(e.clock_in), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-xs">
                        {format(parseISO(e.clock_in), "h:mm a")}
                      </TableCell>
                      <TableCell className="text-xs">
                        {e.clock_out ? (
                          format(parseISO(e.clock_out), "h:mm a")
                        ) : isMissed ? (
                          <Badge variant="destructive" className="text-[10px]">
                            <AlertTriangle className="mr-1 size-3" />
                            Missing
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-800 text-[10px]">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {e.hours_worked != null ? e.hours_worked.toFixed(2) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            e.status === "edited"
                              ? "border-orange-400 text-orange-600"
                              : e.status === "completed"
                                ? "border-green-400 text-green-600"
                                : ""
                          }
                        >
                          {e.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground">
                        {e.notes ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(e)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(e.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editEntry} onOpenChange={(o) => !o && setEditEntry(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Time Entry</DialogTitle>
            <DialogDescription>
              {editEntry?.instructor_name} —{" "}
              {editEntry?.clock_in && format(parseISO(editEntry.clock_in), "MMM d, yyyy")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Clock In</Label>
              <Input
                type="datetime-local"
                value={editClockIn}
                onChange={(e) => setEditClockIn(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Clock Out</Label>
              <Input
                type="datetime-local"
                value={editClockOut}
                onChange={(e) => setEditClockOut(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty if still clocked in.
              </p>
            </div>
            {editClockIn && editClockOut && (
              <p className="text-sm text-muted-foreground">
                Calculated hours:{" "}
                <strong>
                  {(
                    (new Date(editClockOut).getTime() - new Date(editClockIn).getTime()) /
                    3600000
                  ).toFixed(2)}
                </strong>
              </p>
            )}
            <Button onClick={handleSaveEdit} disabled={editSaving} className="w-full">
              {editSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
