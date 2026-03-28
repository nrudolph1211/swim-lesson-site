"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CalendarPlus,
  ChevronDown,
  ChevronUp,
  Copy,
  Edit,
  MoreHorizontal,
  Search,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatDateShort, formatDatetimeShort, toDatetimeLocal } from "@/lib/date-utils";
import { TableSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineError } from "@/components/ui/inline-error";
import { SessionFormDialog, type SessionFormData } from "./SessionFormDialog";

interface SessionRow {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  enrollment_open_date: string | null;
  enrollment_close_date: string | null;
  status: string;
  season_type: string;
  early_bird_discount_percent: number;
  early_bird_deadline: string | null;
  priority_enrollment_start: string | null;
  priority_enrollment_end: string | null;
  re_enrollment_priority_enabled: boolean;
  created_at: string;
  enrolled_count: number;
}

type SortKey = "name" | "start_date" | "status" | "enrolled_count";

function statusBadge(status: string) {
  switch (status) {
    case "enrollment_open":
      return <Badge className="bg-green-500 text-white">Enrollment Open</Badge>;
    case "in_progress":
      return <Badge className="bg-blue-500 text-white">In Progress</Badge>;
    case "completed":
      return <Badge variant="secondary">Completed</Badge>;
    default:
      return <Badge variant="outline">Draft</Badge>;
  }
}

export function SessionsTable() {
  const supabase = createClient();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("start_date");
  const [sortAsc, setSortAsc] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState("Create Session");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogInitial, setDialogInitial] = useState<Partial<SessionFormData> | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: sessionData, error: sessionError } = await supabase
        .from("sessions")
        .select("*")
        .order("created_at", { ascending: false });

      if (sessionError) throw sessionError;

      if (sessionData) {
        // Get assignment counts per session
        const sessionIds = sessionData.map((s) => s.id);
        const { data: assignments } = await supabase
          .from("class_assignments")
          .select("id, class:classes!inner(session_id)")
          .eq("status", "active");

        const countMap = new Map<string, number>();
        for (const e of assignments ?? []) {
          const cls = e.class as unknown as { session_id: string } | { session_id: string }[];
          const sessionId = Array.isArray(cls)
            ? cls[0]?.session_id
            : cls?.session_id;
          if (sessionId && sessionIds.includes(sessionId)) {
            countMap.set(sessionId, (countMap.get(sessionId) ?? 0) + 1);
          }
        }

        setSessions(
          sessionData.map((s) => ({
            ...s,
            enrolled_count: countMap.get(s.id) ?? 0,
          }))
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load sessions.";
      setError(message);
      toast.error("Failed to load sessions.", { duration: Infinity });
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const filtered = useMemo(() => {
    let result = sessions;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(q));
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "start_date":
          cmp = (a.start_date ?? "").localeCompare(b.start_date ?? "");
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "enrolled_count":
          cmp = a.enrolled_count - b.enrolled_count;
          break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [sessions, search, sortKey, sortAsc]);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortAsc ? (
      <ChevronUp className="ml-1 inline size-3" />
    ) : (
      <ChevronDown className="ml-1 inline size-3" />
    );
  };

  // ── CRUD ────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingId(null);
    setDialogInitial(null);
    setDialogTitle("Create Session");
    setDialogOpen(true);
  };

  const openEdit = (s: SessionRow) => {
    setEditingId(s.id);
    setDialogTitle("Edit Session");
    setDialogInitial({
      name: s.name,
      start_date: s.start_date ?? "",
      end_date: s.end_date ?? "",
      enrollment_open_date: toDatetimeLocal(s.enrollment_open_date),
      enrollment_close_date: toDatetimeLocal(s.enrollment_close_date),
      status: s.status,
      season_type: s.season_type ?? "summer_intensive",
      early_bird_discount_percent: s.early_bird_discount_percent ?? 0,
      early_bird_deadline: toDatetimeLocal(s.early_bird_deadline),
      priority_enrollment_start: toDatetimeLocal(s.priority_enrollment_start),
      priority_enrollment_end: toDatetimeLocal(s.priority_enrollment_end),
      re_enrollment_priority_enabled: s.re_enrollment_priority_enabled ?? false,
    });
    setDialogOpen(true);
  };

  const openDuplicate = (s: SessionRow) => {
    setEditingId(null);
    setDialogTitle("Duplicate Session");
    setDialogInitial({
      name: `${s.name} (Copy)`,
      start_date: "",
      end_date: "",
      enrollment_open_date: "",
      enrollment_close_date: "",
      status: "draft",
      season_type: s.season_type ?? "summer_intensive",
      early_bird_discount_percent: s.early_bird_discount_percent ?? 0,
      early_bird_deadline: "",
      priority_enrollment_start: "",
      priority_enrollment_end: "",
      re_enrollment_priority_enabled: s.re_enrollment_priority_enabled ?? false,
    });
    setDialogOpen(true);
  };

  const handleSave = async (data: SessionFormData) => {
    const payload = {
      name: data.name.trim(),
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      enrollment_open_date: data.enrollment_open_date || null,
      enrollment_close_date: data.enrollment_close_date || null,
      status: data.status,
      season_type: data.season_type,
      early_bird_discount_percent: data.early_bird_discount_percent,
      early_bird_deadline: data.early_bird_deadline || null,
      priority_enrollment_start: data.priority_enrollment_start || null,
      priority_enrollment_end: data.priority_enrollment_end || null,
      re_enrollment_priority_enabled: data.re_enrollment_priority_enabled,
    };

    if (editingId) {
      const { error } = await supabase
        .from("sessions")
        .update(payload)
        .eq("id", editingId);
      if (error) throw error;
      toast.success("Session updated.");
    } else {
      const { error } = await supabase.from("sessions").insert(payload);
      if (error) throw error;
      toast.success("Session created.");
    }

    await fetchSessions();
  };

  const changeStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("sessions")
      .update({ status })
      .eq("id", id);
    if (error) {
      toast.error("Failed to update status.");
      return;
    }
    toast.success(`Status changed to ${status.replace("_", " ")}.`);
    await fetchSessions();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sessions..."
            className="pl-9"
          />
        </div>
        <Button onClick={openCreate}>
          <CalendarPlus className="mr-2 size-4" />
          Create Session
        </Button>
      </div>

      {/* Table */}
      {error ? (
        <InlineError message={error} onRetry={fetchSessions} />
      ) : loading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<CalendarPlus className="size-10" />}
          title={search ? "No sessions match your search" : "No sessions yet"}
          description={search ? "Try adjusting your search term." : "Create your first session to start managing swim classes."}
          action={search ? undefined : { label: "Create Session", onClick: openCreate }}
        />
      ) : (
      <>
      {/* Mobile cards */}
      <div className="space-y-3 sm:hidden">
        {filtered.map((s) => (
          <div key={s.id} className="rounded-lg border p-4 space-y-2 active:bg-muted/50">
            <div className="flex items-center justify-between">
              <Link
                href={`/admin/sessions/${s.id}/classes`}
                className="font-medium text-primary hover:underline"
              >
                {s.name}
              </Link>
              {statusBadge(s.status)}
            </div>
            <p className="text-sm text-muted-foreground">
              {formatDateShort(s.start_date)} – {formatDateShort(s.end_date)}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{s.enrolled_count} enrolled</span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon-sm" className="min-h-[44px] min-w-[44px]" aria-label="Session actions">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(s)}>
                    <Edit className="mr-2 size-3.5" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openDuplicate(s)}>
                    <Copy className="mr-2 size-3.5" />
                    Duplicate
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort("name")}
              >
                Name <SortIcon col="name" />
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort("start_date")}
              >
                Dates <SortIcon col="start_date" />
              </TableHead>
              <TableHead className="hidden lg:table-cell">
                Enrollment Period
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort("status")}
              >
                Status <SortIcon col="status" />
              </TableHead>
              <TableHead
                className="cursor-pointer text-right"
                onClick={() => handleSort("enrolled_count")}
              >
                Enrolled <SortIcon col="enrolled_count" />
              </TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(
              filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link
                      href={`/admin/sessions/${s.id}/classes`}
                      className="font-medium text-primary hover:underline"
                    >
                      {s.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateShort(s.start_date)} – {formatDateShort(s.end_date)}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                    {formatDatetimeShort(s.enrollment_open_date)} –{" "}
                    {formatDatetimeShort(s.enrollment_close_date)}
                  </TableCell>
                  <TableCell>{statusBadge(s.status)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {s.enrolled_count}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon-sm" aria-label="Session actions">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(s)}>
                          <Edit className="mr-2 size-3.5" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openDuplicate(s)}>
                          <Copy className="mr-2 size-3.5" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {s.status !== "enrollment_open" && (
                          <DropdownMenuItem
                            onClick={() => changeStatus(s.id, "enrollment_open")}
                          >
                            Open Enrollment
                          </DropdownMenuItem>
                        )}
                        {s.status !== "in_progress" && (
                          <DropdownMenuItem
                            onClick={() => changeStatus(s.id, "in_progress")}
                          >
                            Mark In Progress
                          </DropdownMenuItem>
                        )}
                        {s.status !== "completed" && (
                          <DropdownMenuItem
                            onClick={() => changeStatus(s.id, "completed")}
                          >
                            Mark Completed
                          </DropdownMenuItem>
                        )}
                        {s.status !== "draft" && (
                          <DropdownMenuItem
                            onClick={() => changeStatus(s.id, "draft")}
                          >
                            <Trash2 className="mr-2 size-3.5" />
                            Archive (Draft)
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      </div>
      </>
      )}

      {/* Form Dialog */}
      <SessionFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={dialogInitial}
        title={dialogTitle}
        onSave={handleSave}
      />
    </div>
  );
}
