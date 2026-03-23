"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, Users, BookOpen, CreditCard, ClipboardCheck, BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

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

interface ExportItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  count: number | null;
  loading: boolean;
  exporting: boolean;
}

export function DataExport() {
  const supabase = createClient();
  const [items, setItems] = useState<ExportItem[]>([
    { key: "swimmers", label: "All Swimmers", icon: <Users className="size-5" />, count: null, loading: true, exporting: false },
    { key: "enrollments", label: "All Enrollments", icon: <BookOpen className="size-5" />, count: null, loading: true, exporting: false },
    { key: "payments", label: "All Payments", icon: <CreditCard className="size-5" />, count: null, loading: true, exporting: false },
    { key: "attendance", label: "Attendance Records", icon: <ClipboardCheck className="size-5" />, count: null, loading: true, exporting: false },
    { key: "skills", label: "Skill Records", icon: <BarChart3 className="size-5" />, count: null, loading: true, exporting: false },
  ]);

  const updateItem = (key: string, updates: Partial<ExportItem>) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...updates } : item)));
  };

  const fetchCounts = useCallback(async () => {
    const [swimmers, enrollments, payments, attendance, skills] = await Promise.all([
      supabase.from("swimmers").select("id", { count: "exact", head: true }),
      supabase.from("enrollments").select("id", { count: "exact", head: true }),
      supabase.from("payments").select("id", { count: "exact", head: true }),
      supabase.from("attendance_records").select("id", { count: "exact", head: true }),
      supabase.from("skill_records").select("id", { count: "exact", head: true }),
    ]);

    updateItem("swimmers", { count: swimmers.count ?? 0, loading: false });
    updateItem("enrollments", { count: enrollments.count ?? 0, loading: false });
    updateItem("payments", { count: payments.count ?? 0, loading: false });
    updateItem("attendance", { count: attendance.count ?? 0, loading: false });
    updateItem("skills", { count: skills.count ?? 0, loading: false });
  }, [supabase]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const exportSwimmers = async () => {
    updateItem("swimmers", { exporting: true });
    try {
      const { data } = await supabase
        .from("swimmers")
        .select("first_name, last_name, date_of_birth, current_level, is_active, medical_notes, emergency_contact_name, emergency_contact_phone, family:profiles(full_name, phone), waivers(is_active, expires_at)")
        .order("last_name");

      const rows = (data ?? []).map((s: Record<string, unknown>) => {
        const family = Array.isArray(s.family) ? s.family[0] : s.family;
        const waivers = (s.waivers ?? []) as { is_active: boolean; expires_at: string }[];
        const activeWaiver = waivers.find((w) => w.is_active && new Date(w.expires_at) > new Date());
        return [
          s.first_name as string,
          s.last_name as string,
          s.date_of_birth as string,
          String(s.current_level),
          s.is_active ? "Active" : "Inactive",
          (family as { full_name: string })?.full_name ?? "",
          (family as { phone: string })?.phone ?? "",
          activeWaiver ? "Valid" : "Missing/Expired",
          (s.medical_notes as string) ?? "",
          (s.emergency_contact_name as string) ?? "",
          (s.emergency_contact_phone as string) ?? "",
        ];
      });

      downloadCsv("swimmers.csv", ["First Name", "Last Name", "DOB", "Level", "Status", "Parent Name", "Parent Phone", "Waiver", "Medical Notes", "Emergency Contact", "Emergency Phone"], rows);
      toast.success(`Exported ${rows.length} swimmers.`);
    } catch {
      toast.error("Failed to export swimmers.");
    }
    updateItem("swimmers", { exporting: false });
  };

  const exportEnrollments = async () => {
    updateItem("enrollments", { exporting: true });
    try {
      const { data } = await supabase
        .from("enrollments")
        .select("id, status, payment_status, makeup_credits, enrolled_at, cancelled_at, swimmer:swimmers(first_name, last_name), class:classes(level, day_of_week, start_time, end_time, class_type, session:sessions(name))")
        .order("enrolled_at", { ascending: false });

      const rows = (data ?? []).map((e: Record<string, unknown>) => {
        const swimmer = Array.isArray(e.swimmer) ? e.swimmer[0] : e.swimmer;
        const cls = Array.isArray(e.class) ? e.class[0] : e.class;
        const session = cls?.session;
        const sess = Array.isArray(session) ? session[0] : session;
        return [
          e.id as string,
          swimmer ? `${swimmer.first_name} ${swimmer.last_name}` : "",
          `L${cls?.level ?? ""}`,
          (cls?.day_of_week ?? []).join(", "),
          (cls?.start_time ?? "").slice(0, 5),
          (cls?.end_time ?? "").slice(0, 5),
          cls?.class_type ?? "",
          sess?.name ?? "",
          e.status as string,
          e.payment_status as string,
          String(e.makeup_credits ?? 0),
          e.enrolled_at as string,
          (e.cancelled_at as string) ?? "",
        ];
      });

      downloadCsv("enrollments.csv", ["ID", "Swimmer", "Level", "Days", "Start", "End", "Type", "Session", "Status", "Payment", "Makeup Credits", "Enrolled At", "Cancelled At"], rows);
      toast.success(`Exported ${rows.length} enrollments.`);
    } catch {
      toast.error("Failed to export enrollments.");
    }
    updateItem("enrollments", { exporting: false });
  };

  const exportPayments = async () => {
    updateItem("payments", { exporting: true });
    try {
      const { data } = await supabase
        .from("payments")
        .select("id, amount, status, payment_method, description, created_at, completed_at, stripe_payment_intent_id, family:profiles(full_name)")
        .order("created_at", { ascending: false });

      const rows = (data ?? []).map((p: Record<string, unknown>) => {
        const family = Array.isArray(p.family) ? p.family[0] : p.family;
        return [
          p.id as string,
          (family as { full_name: string })?.full_name ?? "",
          String(p.amount),
          p.payment_method as string,
          p.status as string,
          (p.description as string) ?? "",
          p.created_at as string,
          (p.completed_at as string) ?? "",
          (p.stripe_payment_intent_id as string) ?? "",
        ];
      });

      downloadCsv("payments.csv", ["ID", "Parent", "Amount", "Method", "Status", "Description", "Created", "Completed", "Stripe PI"], rows);
      toast.success(`Exported ${rows.length} payments.`);
    } catch {
      toast.error("Failed to export payments.");
    }
    updateItem("payments", { exporting: false });
  };

  const exportAttendance = async () => {
    updateItem("attendance", { exporting: true });
    try {
      const { data } = await supabase
        .from("attendance_records")
        .select("class_date, status, recorded_at, enrollment:enrollments(swimmer:swimmers(first_name, last_name), class:classes(level, start_time, day_of_week))")
        .order("class_date", { ascending: false });

      const rows = (data ?? []).map((a: Record<string, unknown>) => {
        const enrollment = Array.isArray(a.enrollment) ? a.enrollment[0] : a.enrollment;
        const swimmer = enrollment?.swimmer;
        const sw = Array.isArray(swimmer) ? swimmer[0] : swimmer;
        const cls = enrollment?.class;
        const classObj = Array.isArray(cls) ? cls[0] : cls;
        return [
          a.class_date as string,
          sw ? `${sw.first_name} ${sw.last_name}` : "",
          `L${classObj?.level ?? ""}`,
          (classObj?.day_of_week ?? []).join(", "),
          (classObj?.start_time ?? "").slice(0, 5),
          a.status as string,
          (a.recorded_at as string) ?? "",
        ];
      });

      downloadCsv("attendance.csv", ["Date", "Swimmer", "Level", "Days", "Time", "Status", "Recorded At"], rows);
      toast.success(`Exported ${rows.length} attendance records.`);
    } catch {
      toast.error("Failed to export attendance.");
    }
    updateItem("attendance", { exporting: false });
  };

  const exportSkills = async () => {
    updateItem("skills", { exporting: true });
    try {
      const { data } = await supabase
        .from("skill_records")
        .select("status, notes, updated_at, swimmer:swimmers(first_name, last_name), skill:skills(skill_name, level)")
        .order("updated_at", { ascending: false });

      const rows = (data ?? []).map((sr: Record<string, unknown>) => {
        const swimmer = Array.isArray(sr.swimmer) ? sr.swimmer[0] : sr.swimmer;
        const skill = Array.isArray(sr.skill) ? sr.skill[0] : sr.skill;
        return [
          swimmer ? `${swimmer.first_name} ${swimmer.last_name}` : "",
          `L${skill?.level ?? ""}`,
          skill?.skill_name ?? "",
          sr.status as string,
          (sr.notes as string) ?? "",
          (sr.updated_at as string) ?? "",
        ];
      });

      downloadCsv("skill-records.csv", ["Swimmer", "Level", "Skill", "Status", "Notes", "Updated At"], rows);
      toast.success(`Exported ${rows.length} skill records.`);
    } catch {
      toast.error("Failed to export skill records.");
    }
    updateItem("skills", { exporting: false });
  };

  const exportFns: Record<string, () => Promise<void>> = {
    swimmers: exportSwimmers,
    enrollments: exportEnrollments,
    payments: exportPayments,
    attendance: exportAttendance,
    skills: exportSkills,
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Card key={item.key}>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted">
              {item.icon}
            </div>
            <div className="flex-1">
              <p className="font-medium">{item.label}</p>
              <p className="text-sm text-muted-foreground">
                {item.loading ? (
                  <Loader2 className="inline size-3 animate-spin" />
                ) : (
                  <>{item.count?.toLocaleString()} row{item.count !== 1 ? "s" : ""}</>
                )}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={exportFns[item.key]}
              disabled={item.loading || item.exporting || item.count === 0}
            >
              {item.exporting ? (
                <Loader2 className="mr-1 size-3.5 animate-spin" />
              ) : (
                <Download className="mr-1 size-3.5" />
              )}
              Download
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
