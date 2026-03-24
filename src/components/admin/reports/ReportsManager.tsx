"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DollarSign,
  TrendingUp,
  RefreshCcw,
  Users,
  Download,
  Loader2,
  BarChart3,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { getLevelColor, getLevelName } from "@/lib/swim-utils";
import { format, subDays, startOfMonth, startOfYear, parseISO } from "date-fns";

// ─── CSV helper ──────────────────────────────────────────────
function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Types ───────────────────────────────────────────────────
interface Payment {
  id: string;
  amount: number;
  status: string;
  payment_method: string;
  created_at: string;
  completed_at: string | null;
  enrollment_id: string | null;
  level: number | null;
  class_type: string | null;
}

interface AttendanceRow {
  class_label: string;
  total_lessons: number;
  avg_attendance: number;
  no_show_rate: number;
  makeups_used: number;
}

interface InstructorRow {
  name: string;
  classes: number;
  students: number;
  attendance_rate: number;
  skills_mastered: number;
}

const METHOD_COLORS: Record<string, string> = {
  stripe: "#7c3aed",
  cash: "#16a34a",
  check: "#2563eb",
  comp: "#6b7280",
};

export function ReportsManager() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("this_month");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [revenueGranularity, setRevenueGranularity] = useState<"daily" | "weekly">("daily");

  // Raw data
  const [payments, setPayments] = useState<Payment[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [instructorRows, setInstructorRows] = useState<InstructorRow[]>([]);
  const [enrollmentByLevel, setEnrollmentByLevel] = useState<{ level: number; count: number }[]>([]);
  const [occupancyData, setOccupancyData] = useState<{ day: string; hour: number; fill: number }[]>([]);

  // Compute effective date range
  const effectiveDates = useMemo(() => {
    const now = new Date();
    switch (dateRange) {
      case "this_month":
        return { from: format(startOfMonth(now), "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
      case "this_year":
        return { from: format(startOfYear(now), "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
      case "last_30":
        return { from: format(subDays(now, 30), "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
      case "custom":
        return { from: dateFrom || format(subDays(now, 30), "yyyy-MM-dd"), to: dateTo || format(now, "yyyy-MM-dd") };
      default:
        return { from: format(startOfMonth(now), "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
    }
  }, [dateRange, dateFrom, dateTo]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { from, to } = effectiveDates;

    // ── Payments ──
    const { data: payData } = await supabase
      .from("payments")
      .select("id, amount, status, payment_method, created_at, completed_at, enrollment_id, enrollment:enrollments(class:classes(level, class_type))")
      .gte("created_at", from)
      .lte("created_at", to + "T23:59:59");

    const mappedPayments: Payment[] = (payData ?? []).map((p: Record<string, unknown>) => {
      const enrollment = Array.isArray(p.enrollment) ? p.enrollment[0] : p.enrollment;
      const cls = enrollment?.class;
      const classObj = Array.isArray(cls) ? cls[0] : cls;
      return {
        id: p.id as string,
        amount: Number(p.amount),
        status: p.status as string,
        payment_method: p.payment_method as string,
        created_at: p.created_at as string,
        completed_at: p.completed_at as string | null,
        enrollment_id: p.enrollment_id as string | null,
        level: classObj?.level ?? null,
        class_type: classObj?.class_type ?? null,
      };
    });
    setPayments(mappedPayments);

    // ── Enrollments by level ──
    const { data: enrollData } = await supabase
      .from("enrollments")
      .select("class:classes(level)")
      .eq("status", "confirmed");

    const levelCounts: Record<number, number> = {};
    for (const e of enrollData ?? []) {
      const cls = Array.isArray(e.class) ? e.class[0] : e.class;
      const level = cls?.level;
      if (level) levelCounts[level] = (levelCounts[level] ?? 0) + 1;
    }
    setEnrollmentByLevel([1, 2, 3, 4, 5].map((l) => ({ level: l, count: levelCounts[l] ?? 0 })));

    // ── Attendance ──
    const { data: attData } = await supabase
      .from("attendance_records")
      .select("enrollment_id, class_date, status, enrollment:enrollments(class:classes(level, start_time, day_of_week), makeup_credits)")
      .gte("class_date", from)
      .lte("class_date", to);

    const classAtt: Record<string, { total: number; present: number; absent: number; makeups: number }> = {};
    for (const a of attData ?? []) {
      const enrollment = Array.isArray(a.enrollment) ? a.enrollment[0] : a.enrollment;
      const cls = enrollment?.class;
      const classObj = Array.isArray(cls) ? cls[0] : cls;
      const label = classObj ? `L${classObj.level} ${(classObj.day_of_week ?? []).join(",")} ${(classObj.start_time ?? "").slice(0, 5)}` : "Unknown";
      if (!classAtt[label]) classAtt[label] = { total: 0, present: 0, absent: 0, makeups: 0 };
      classAtt[label].total++;
      if (a.status === "present") classAtt[label].present++;
      if (a.status === "absent") classAtt[label].absent++;
      if (a.status === "makeup") classAtt[label].makeups++;
    }
    setAttendanceRows(
      Object.entries(classAtt).map(([label, d]) => ({
        class_label: label,
        total_lessons: d.total,
        avg_attendance: d.total > 0 ? Math.round((d.present / d.total) * 100) : 0,
        no_show_rate: d.total > 0 ? Math.round((d.absent / d.total) * 100) : 0,
        makeups_used: d.makeups,
      }))
    );

    // ── Instructor performance ──
    const { data: instData } = await supabase
      .from("instructors")
      .select("id, user_id, profile:profiles(full_name)")
      .eq("is_active", true);

    const rows: InstructorRow[] = [];
    for (const inst of instData ?? []) {
      const profile = Array.isArray(inst.profile) ? inst.profile[0] : inst.profile;
      const name = profile?.full_name ?? "Unknown";

      const { data: classIds } = await supabase
        .from("classes")
        .select("id")
        .eq("instructor_id", inst.id)
        .eq("is_active", true);

      const classCount = classIds?.length ?? 0;
      let studentCount = 0;
      let attRate = 0;
      let skillsMastered = 0;

      if (classIds?.length) {
        const ids = classIds.map((c) => c.id);
        const { count: enrollCount } = await supabase
          .from("enrollments")
          .select("id", { count: "exact", head: true })
          .in("class_id", ids)
          .eq("status", "confirmed");
        studentCount = enrollCount ?? 0;

        // Attendance rate for this instructor's classes
        const { data: instAttData } = await supabase
          .from("attendance_records")
          .select("status, enrollment:enrollments!inner(class_id)")
          .in("enrollment.class_id" as never, ids)
          .gte("class_date", from)
          .lte("class_date", to);

        const totalAtt = instAttData?.length ?? 0;
        const presentAtt = (instAttData ?? []).filter((a) => a.status === "present" || a.status === "makeup").length;
        attRate = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0;

        // Use user_id (auth UUID) for updated_by, not instructor table PK
        const instructorUserId = (inst as Record<string, unknown>).user_id as string | undefined;
        if (instructorUserId) {
          const { count: skillCount } = await supabase
            .from("skill_records")
            .select("id", { count: "exact", head: true })
            .eq("updated_by", instructorUserId)
            .eq("status", "mastered");
          skillsMastered = skillCount ?? 0;
        }
      }

      rows.push({
        name,
        classes: classCount,
        students: studentCount,
        attendance_rate: attRate,
        skills_mastered: skillsMastered,
      });
    }
    setInstructorRows(rows);

    // ── Occupancy heatmap ──
    const { data: classData } = await supabase
      .from("classes")
      .select("id, max_capacity, day_of_week, start_time")
      .eq("is_active", true);

    const occMap: Record<string, { capacity: number; enrolled: number }> = {};
    for (const cls of classData ?? []) {
      const hour = parseInt((cls.start_time as string).slice(0, 2), 10);
      for (const day of (cls.day_of_week ?? []) as string[]) {
        const key = `${day}-${hour}`;
        if (!occMap[key]) occMap[key] = { capacity: 0, enrolled: 0 };
        occMap[key].capacity += cls.max_capacity;
      }

      const { count } = await supabase
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .eq("class_id", cls.id)
        .eq("status", "confirmed");

      for (const day of (cls.day_of_week ?? []) as string[]) {
        const key = `${day}-${hour}`;
        occMap[key].enrolled += count ?? 0;
      }
    }
    setOccupancyData(
      Object.entries(occMap).map(([key, v]) => {
        const [day, hourStr] = key.split("-");
        return { day, hour: parseInt(hourStr), fill: v.capacity > 0 ? Math.round((v.enrolled / v.capacity) * 100) : 0 };
      })
    );

    setLoading(false);
  }, [supabase, effectiveDates]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Computed stats ─────────────────────────────────────────
  const stats = useMemo(() => {
    const completed = payments.filter((p) => p.status === "completed");
    const pending = payments.filter((p) => p.status === "pending");
    const refunded = payments.filter((p) => p.status === "refunded");
    const uniqueSwimmers = new Set(payments.filter((p) => p.enrollment_id).map((p) => p.enrollment_id)).size;

    return {
      totalRevenue: completed.reduce((s, p) => s + p.amount, 0),
      outstanding: pending.reduce((s, p) => s + p.amount, 0),
      refunds: refunded.reduce((s, p) => s + p.amount, 0),
      avgPerSwimmer: uniqueSwimmers > 0 ? completed.reduce((s, p) => s + p.amount, 0) / uniqueSwimmers : 0,
    };
  }, [payments]);

  // ── Revenue over time ──────────────────────────────────────
  const revenueTimeline = useMemo(() => {
    const completed = payments.filter((p) => p.status === "completed" && p.completed_at);
    const buckets: Record<string, number> = {};

    for (const p of completed) {
      const d = parseISO(p.completed_at!);
      let key: string;
      if (revenueGranularity === "daily") {
        key = format(d, "MMM d");
      } else {
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        key = `Wk ${format(weekStart, "MMM d")}`;
      }
      buckets[key] = (buckets[key] ?? 0) + p.amount;
    }

    return Object.entries(buckets).map(([date, amount]) => ({ date, amount }));
  }, [payments, revenueGranularity]);

  // ── Revenue by level ───────────────────────────────────────
  const revenueByLevel = useMemo(() => {
    const completed = payments.filter((p) => p.status === "completed" && p.level);
    const buckets: Record<number, number> = {};
    for (const p of completed) {
      buckets[p.level!] = (buckets[p.level!] ?? 0) + p.amount;
    }
    return [1, 2, 3, 4, 5].map((l) => ({ level: l, name: `L${l}`, amount: buckets[l] ?? 0, fill: getLevelColor(l) }));
  }, [payments]);

  // ── Revenue by method (donut) ──────────────────────────────
  const revenueByMethod = useMemo(() => {
    const completed = payments.filter((p) => p.status === "completed");
    const buckets: Record<string, number> = {};
    for (const p of completed) {
      buckets[p.payment_method] = (buckets[p.payment_method] ?? 0) + p.amount;
    }
    return Object.entries(buckets).map(([method, amount]) => ({
      name: method.charAt(0).toUpperCase() + method.slice(1),
      value: amount,
      fill: METHOD_COLORS[method] ?? "#6b7280",
    }));
  }, [payments]);

  // ── Revenue by class type ──────────────────────────────────
  const revenueByType = useMemo(() => {
    const completed = payments.filter((p) => p.status === "completed" && p.class_type);
    const buckets: Record<string, number> = {};
    for (const p of completed) {
      const label = p.class_type === "semi_private" ? "Semi-Private" : p.class_type!.charAt(0).toUpperCase() + p.class_type!.slice(1);
      buckets[label] = (buckets[label] ?? 0) + p.amount;
    }
    return Object.entries(buckets).map(([type, amount]) => ({ type, amount }));
  }, [payments]);

  // ── CSV exports ────────────────────────────────────────────
  const exportRevenue = () => {
    downloadCsv("revenue.csv", ["Date", "Amount"], revenueTimeline.map((r) => [r.date, r.amount.toFixed(2)]));
  };
  const exportAttendance = () => {
    downloadCsv(
      "attendance-report.csv",
      ["Class", "Total Lessons", "Avg Attendance %", "No-Show %", "Make-Ups Used"],
      attendanceRows.map((r) => [r.class_label, String(r.total_lessons), String(r.avg_attendance), String(r.no_show_rate), String(r.makeups_used)])
    );
  };
  const exportInstructors = () => {
    downloadCsv(
      "instructor-performance.csv",
      ["Name", "Classes", "Students", "Attendance %", "Skills Mastered"],
      instructorRows.map((r) => [r.name, String(r.classes), String(r.students), String(r.attendance_rate), String(r.skills_mastered)])
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Range Picker */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Label className="text-xs">Date Range</Label>
          <Select value={dateRange} onValueChange={(v) => v && setDateRange(v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_30">Last 30 Days</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {dateRange === "custom" && (
          <>
            <div className="w-40">
              <Label className="text-xs">From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1" />
            </div>
            <div className="w-40">
              <Label className="text-xs">To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1" />
            </div>
          </>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={<DollarSign className="size-5 text-green-700" />} label="Total Revenue" value={`$${stats.totalRevenue.toFixed(2)}`} bg="bg-green-100" />
        <SummaryCard icon={<TrendingUp className="size-5 text-yellow-700" />} label="Outstanding" value={`$${stats.outstanding.toFixed(2)}`} bg="bg-yellow-100" />
        <SummaryCard icon={<RefreshCcw className="size-5 text-red-700" />} label="Refunds" value={`$${stats.refunds.toFixed(2)}`} bg="bg-red-100" />
        <SummaryCard icon={<Users className="size-5 text-blue-700" />} label="Avg / Swimmer" value={`$${stats.avgPerSwimmer.toFixed(2)}`} bg="bg-blue-100" />
      </div>

      {/* Revenue Timeline */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <h3 className="text-sm font-semibold">Revenue Over Time</h3>
          <div className="flex items-center gap-2">
            <Select value={revenueGranularity} onValueChange={(v) => v && setRevenueGranularity(v as "daily" | "weekly")}>
              <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportRevenue}>
              <Download className="mr-1 size-3.5" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {revenueTimeline.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No revenue data in this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={revenueTimeline} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" fontSize={11} tickLine={false} />
                <YAxis fontSize={11} tickLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`, "Revenue"]} />
                <Line type="monotone" dataKey="amount" stroke="#1B4F72" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Revenue Breakdown Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* By Level */}
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-sm font-semibold">Revenue by Level</h3>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenueByLevel} margin={{ top: 4, right: 4, bottom: 4, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={11} tickLine={false} />
                <YAxis fontSize={11} tickLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`, "Revenue"]} />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {revenueByLevel.map((d) => (
                    <Cell key={d.level} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* By Method (donut) */}
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-sm font-semibold">Revenue by Method</h3>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            {revenueByMethod.length === 0 ? (
              <p className="py-8 text-sm text-muted-foreground">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={revenueByMethod} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} fontSize={11}>
                    {revenueByMethod.map((d, i) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* By Class Type */}
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-sm font-semibold">Revenue by Class Type</h3>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenueByType} margin={{ top: 4, right: 4, bottom: 4, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="type" fontSize={11} tickLine={false} />
                <YAxis fontSize={11} tickLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`, "Revenue"]} />
                <Bar dataKey="amount" fill="#2E86C1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Enrollment Analytics */}
      <Card>
        <CardHeader className="pb-2">
          <h3 className="text-sm font-semibold">Enrollment by Level</h3>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={enrollmentByLevel} margin={{ top: 4, right: 4, bottom: 4, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="level" fontSize={11} tickLine={false} tickFormatter={(v) => `L${v}`} />
              <YAxis fontSize={11} tickLine={false} allowDecimals={false} />
              <Tooltip formatter={(v, _, props) => [v, getLevelName((props.payload as { level: number }).level)]} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {enrollmentByLevel.map((d) => (
                  <Cell key={d.level} fill={getLevelColor(d.level)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Occupancy Heatmap */}
      <Card>
        <CardHeader className="pb-2">
          <h3 className="text-sm font-semibold">Occupancy Heatmap (% filled)</h3>
        </CardHeader>
        <CardContent>
          <OccupancyHeatmap data={occupancyData} />
        </CardContent>
      </Card>

      {/* Attendance Report */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <h3 className="text-sm font-semibold">Attendance Report</h3>
          <Button variant="outline" size="sm" onClick={exportAttendance}>
            <Download className="mr-1 size-3.5" /> CSV
          </Button>
        </CardHeader>
        <CardContent>
          {attendanceRows.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No attendance data in this period.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-right">Total Lessons</TableHead>
                  <TableHead className="text-right">Avg Attendance</TableHead>
                  <TableHead className="text-right">No-Show Rate</TableHead>
                  <TableHead className="text-right">Make-Ups</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceRows.map((r) => (
                  <TableRow key={r.class_label}>
                    <TableCell className="font-medium">{r.class_label}</TableCell>
                    <TableCell className="text-right">{r.total_lessons}</TableCell>
                    <TableCell className="text-right">
                      <Badge className={r.avg_attendance >= 80 ? "bg-green-100 text-green-800" : r.avg_attendance >= 60 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}>
                        {r.avg_attendance}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{r.no_show_rate}%</TableCell>
                    <TableCell className="text-right">{r.makeups_used}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Instructor Performance */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <h3 className="text-sm font-semibold">Instructor Performance</h3>
          <Button variant="outline" size="sm" onClick={exportInstructors}>
            <Download className="mr-1 size-3.5" /> CSV
          </Button>
        </CardHeader>
        <CardContent>
          {instructorRows.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No instructor data.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Instructor</TableHead>
                  <TableHead className="text-right">Classes</TableHead>
                  <TableHead className="text-right">Students</TableHead>
                  <TableHead className="text-right">Attendance</TableHead>
                  <TableHead className="text-right">Skills Mastered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instructorRows.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right">{r.classes}</TableCell>
                    <TableCell className="text-right">{r.students}</TableCell>
                    <TableCell className="text-right">
                      <Badge className={r.attendance_rate >= 80 ? "bg-green-100 text-green-800" : r.attendance_rate >= 60 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}>
                        {r.attendance_rate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{r.skills_mastered}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────

function SummaryCard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: string; bg: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex size-12 items-center justify-center rounded-xl ${bg}`}>{icon}</div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function OccupancyHeatmap({ data }: { data: { day: string; hour: number; fill: number }[] }) {
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const DAY_SHORT: Record<string, string> = { Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu", Friday: "Fri", Saturday: "Sat" };
  const HOURS = Array.from({ length: 12 }, (_, i) => i + 7);

  const lookup = new Map(data.map((d) => [`${d.day}-${d.hour}`, d.fill]));

  function getColor(fill: number): string {
    if (fill === 0) return "#f3f4f6";
    if (fill < 50) return "#bbf7d0";
    if (fill < 75) return "#fde68a";
    if (fill < 90) return "#fed7aa";
    return "#fca5a5";
  }

  function formatHour(h: number): string {
    if (h === 12) return "12p";
    return h < 12 ? `${h}a` : `${h - 12}p`;
  }

  if (data.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">No class data.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[320px]">
        <div className="mb-1 flex">
          <div className="w-10" />
          {DAYS.map((day) => (
            <div key={day} className="flex-1 text-center text-[10px] font-medium text-muted-foreground">
              {DAY_SHORT[day]}
            </div>
          ))}
        </div>
        {HOURS.map((hour) => (
          <div key={hour} className="flex items-center gap-0.5">
            <div className="w-10 pr-1 text-right text-[10px] text-muted-foreground">{formatHour(hour)}</div>
            {DAYS.map((day) => {
              const fill = lookup.get(`${day}-${hour}`) ?? 0;
              return (
                <div
                  key={`${day}-${hour}`}
                  className="flex-1 rounded-sm"
                  style={{ backgroundColor: getColor(fill), height: 14 }}
                  title={`${DAY_SHORT[day]} ${formatHour(hour)}: ${fill}% filled`}
                />
              );
            })}
          </div>
        ))}
        <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>0%</span>
          {[0, 50, 75, 90, 100].map((v) => (
            <div key={v} className="size-3 rounded-sm" style={{ backgroundColor: getColor(v) }} />
          ))}
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}
