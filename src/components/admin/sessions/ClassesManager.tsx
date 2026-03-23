"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Copy, Edit, Grid3X3, List, MoreHorizontal, Plus, XCircle, BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { getLevelColor, getLevelTextColor, getLevelName, SWIM_LEVELS } from "@/lib/swim-utils";
import { formatTime } from "@/lib/date-utils";
import { TableSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineError } from "@/components/ui/inline-error";
import { ClassFormDialog, type ClassFormData } from "./ClassFormDialog";

interface ClassRow {
  id: string;
  level: number;
  class_type: string;
  day_of_week: string[];
  start_time: string;
  end_time: string;
  max_capacity: number;
  member_price: number | null;
  non_member_price: number | null;
  military_price: number | null;
  instructor_id: string | null;
  is_active: boolean;
  instructor_name: string | null;
  enrolled_count: number;
}

interface InstructorOption {
  id: string;
  name: string;
}

interface ClassesManagerProps {
  sessionId: string;
  sessionName: string;
  sessionDates: string;
}

type ViewMode = "table" | "grid";

const DAY_ORDER: Record<string, number> = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
};

function formatPrice(v: number | null): string {
  if (v == null) return "—";
  return `$${Number(v).toFixed(2)}`;
}

function formatType(t: string): string {
  if (t === "semi_private") return "Semi-Private";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Grid hours 7AM - 7PM
const GRID_HOURS = Array.from({ length: 12 }, (_, i) => i + 7);
const GRID_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const GRID_DAY_MAP: Record<string, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
};

export function ClassesManager({
  sessionId,
  sessionName,
  sessionDates,
}: ClassesManagerProps) {
  const supabase = createClient();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState("Add Class");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogInitial, setDialogInitial] = useState<Partial<ClassFormData> | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [classRes, instRes] = await Promise.all([
        supabase
          .from("classes")
          .select(
            "id, level, class_type, day_of_week, start_time, end_time, max_capacity, member_price, non_member_price, military_price, instructor_id, is_active, instructor:instructors(profile:profiles(full_name))"
          )
          .eq("session_id", sessionId)
          .eq("is_active", true)
          .order("level")
          .order("start_time"),
        supabase
          .from("instructors")
          .select("id, profile:profiles(full_name)")
          .eq("is_active", true),
      ]);

      if (classRes.error) throw classRes.error;

      // Enrollment counts
      const classIds = (classRes.data ?? []).map((c: { id: string }) => c.id);
      let countMap = new Map<string, number>();
      if (classIds.length > 0) {
        const { data: enrollments } = await supabase
          .from("enrollments")
          .select("class_id")
          .in("class_id", classIds)
          .eq("status", "confirmed");
        if (enrollments) {
          for (const e of enrollments) {
            countMap.set(e.class_id, (countMap.get(e.class_id) ?? 0) + 1);
          }
        }
      }

      if (classRes.data) {
        setClasses(
          classRes.data.map((c: Record<string, unknown>) => {
            const inst = c.instructor as
              | { profile: { full_name: string } | null }
              | { profile: { full_name: string } | null }[]
              | null;
            const instObj = Array.isArray(inst) ? inst[0] : inst;
            return {
              ...c,
              instructor_name: instObj?.profile?.full_name ?? null,
              enrolled_count: countMap.get(c.id as string) ?? 0,
            };
          }) as ClassRow[]
        );
      }

      if (instRes.data) {
        setInstructors(
          instRes.data.map((i: Record<string, unknown>) => {
            const prof = i.profile as
              | { full_name: string }
              | { full_name: string }[]
              | null;
            const profObj = Array.isArray(prof) ? prof[0] : prof;
            return {
              id: i.id as string,
              name: profObj?.full_name ?? "Unknown",
            };
          })
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load classes.";
      setError(message);
      toast.error("Failed to load classes.", { duration: Infinity });
    } finally {
      setLoading(false);
    }
  }, [supabase, sessionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── CRUD ────────────────────────────────────────────────────

  const openAdd = () => {
    setEditingId(null);
    setDialogInitial(null);
    setDialogTitle("Add Class");
    setDialogOpen(true);
  };

  const openEdit = (c: ClassRow) => {
    setEditingId(c.id);
    setDialogTitle("Edit Class");
    setDialogInitial({
      level: c.level,
      class_type: c.class_type,
      day_of_week: c.day_of_week,
      start_time: c.start_time?.slice(0, 5) ?? "09:00",
      end_time: c.end_time?.slice(0, 5) ?? "09:30",
      instructor_id: c.instructor_id ?? "",
      max_capacity: c.max_capacity,
      member_price: c.member_price?.toString() ?? "",
      non_member_price: c.non_member_price?.toString() ?? "",
      military_price: c.military_price?.toString() ?? "",
    });
    setDialogOpen(true);
  };

  const openClone = (c: ClassRow) => {
    setEditingId(null);
    setDialogTitle("Clone Class");
    setDialogInitial({
      level: c.level,
      class_type: c.class_type,
      day_of_week: c.day_of_week,
      start_time: c.start_time?.slice(0, 5) ?? "09:00",
      end_time: c.end_time?.slice(0, 5) ?? "09:30",
      instructor_id: c.instructor_id ?? "",
      max_capacity: c.max_capacity,
      member_price: c.member_price?.toString() ?? "",
      non_member_price: c.non_member_price?.toString() ?? "",
      military_price: c.military_price?.toString() ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async (data: ClassFormData) => {
    const payload = {
      session_id: sessionId,
      level: data.level,
      class_type: data.class_type,
      day_of_week: data.day_of_week,
      start_time: data.start_time,
      end_time: data.end_time,
      instructor_id: data.instructor_id || null,
      max_capacity: data.max_capacity,
      member_price: data.member_price ? Number(data.member_price) : null,
      non_member_price: data.non_member_price
        ? Number(data.non_member_price)
        : null,
      military_price: data.military_price
        ? Number(data.military_price)
        : null,
    };

    if (editingId) {
      const { error } = await supabase
        .from("classes")
        .update(payload)
        .eq("id", editingId);
      if (error) throw error;
      toast.success("Class updated.");
    } else {
      const { error } = await supabase.from("classes").insert(payload);
      if (error) throw error;
      toast.success("Class created.");
    }

    await fetchData();
  };

  const cancelClass = async (id: string) => {
    const { error } = await supabase
      .from("classes")
      .update({ is_active: false })
      .eq("id", id);
    if (error) {
      toast.error("Failed to cancel class.");
      return;
    }
    toast.success("Class cancelled.");
    await fetchData();
  };

  // ── Grid view data ──────────────────────────────────────────
  const gridCells = useMemo(() => {
    const map = new Map<string, ClassRow[]>();
    for (const cls of classes) {
      const hour = parseInt(cls.start_time?.slice(0, 2) ?? "0", 10);
      for (const day of cls.day_of_week) {
        const short = GRID_DAY_MAP[day];
        if (!short) continue;
        const key = `${short}-${hour}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(cls);
      }
    }
    return map;
  }, [classes]);

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold">{sessionName}</h2>
          <p className="text-sm text-muted-foreground">{sessionDates}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border">
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setViewMode("table")}
            >
              <List className="size-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="size-4" />
            </Button>
          </div>
          <Button onClick={openAdd}>
            <Plus className="mr-2 size-4" />
            Add Class
          </Button>
        </div>
      </div>

      {error ? (
        <InlineError message={error} onRetry={fetchData} />
      ) : loading ? (
        <TableSkeleton rows={5} cols={8} />
      ) : classes.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-10" />}
          title="No classes yet"
          description="Add your first class to this session to start accepting enrollments."
          action={{ label: "Add Class", onClick: openAdd }}
        />
      ) : viewMode === "table" ? (
        /* ── Table View ── */
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Level</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="hidden md:table-cell">Instructor</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead className="hidden lg:table-cell">Type</TableHead>
                <TableHead className="hidden lg:table-cell">Prices</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Badge
                      style={{ backgroundColor: getLevelColor(c.level), color: getLevelTextColor(c.level) }}
                    >
                      L{c.level}: {getLevelName(c.level)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.day_of_week
                      .sort((a, b) => (DAY_ORDER[a] ?? 0) - (DAY_ORDER[b] ?? 0))
                      .map((d) => d.slice(0, 3))
                      .join(", ")}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatTime(c.start_time)} – {formatTime(c.end_time)}
                  </TableCell>
                  <TableCell className="hidden text-sm md:table-cell">
                    {c.instructor_name ?? "Unassigned"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`text-sm font-medium ${
                        c.enrolled_count >= c.max_capacity
                          ? "text-red-600"
                          : c.enrolled_count >= c.max_capacity * 0.8
                            ? "text-orange-600"
                            : ""
                      }`}
                    >
                      {c.enrolled_count}/{c.max_capacity}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-sm lg:table-cell">
                    {formatType(c.class_type)}
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                    M: {formatPrice(c.member_price)} / NM:{" "}
                    {formatPrice(c.non_member_price)} / Mil:{" "}
                    {formatPrice(c.military_price)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon-sm" aria-label="Class actions">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(c)}>
                          <Edit className="mr-2 size-3.5" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openClone(c)}>
                          <Copy className="mr-2 size-3.5" />
                          Clone
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => cancelClass(c.id)}
                          className="text-destructive"
                        >
                          <XCircle className="mr-2 size-3.5" />
                          Cancel Class
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* ── Grid View ── */
        <div className="rounded-lg border p-4 overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Header */}
            <div className="mb-2 grid grid-cols-[60px_repeat(6,1fr)] gap-1">
              <div />
              {GRID_DAYS.map((d) => (
                <div
                  key={d}
                  className="text-center text-xs font-medium text-muted-foreground"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Rows */}
            {GRID_HOURS.map((hour) => (
              <div
                key={hour}
                className="mb-1 grid grid-cols-[60px_repeat(6,1fr)] gap-1"
              >
                <div className="flex items-start pt-1 text-[10px] text-muted-foreground">
                  {hour < 12 ? `${hour}am` : hour === 12 ? "12pm" : `${hour - 12}pm`}
                </div>
                {GRID_DAYS.map((day) => {
                  const cellClasses = gridCells.get(`${day}-${hour}`) ?? [];
                  return (
                    <div
                      key={`${day}-${hour}`}
                      className="min-h-[36px] rounded border border-dashed border-muted"
                    >
                      {cellClasses.map((c) => (
                        <div
                          key={c.id}
                          className="m-0.5 rounded px-1.5 py-0.5 text-[10px] leading-tight"
                          style={{
                            backgroundColor: getLevelColor(c.level),
                            color: getLevelTextColor(c.level),
                          }}
                          title={`L${c.level} ${formatTime(c.start_time)}-${formatTime(c.end_time)} ${c.instructor_name ?? ""}`}
                        >
                          <span className="font-medium">
                            L{c.level}
                          </span>{" "}
                          {c.enrolled_count}/{c.max_capacity}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form Dialog */}
      <ClassFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={dialogInitial}
        title={dialogTitle}
        instructors={instructors}
        onSave={handleSave}
      />
    </div>
  );
}
