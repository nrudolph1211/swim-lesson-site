"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Loader2, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { getLevelColor, getLevelName, getLevelTextColor } from "@/lib/swim-utils";
import { formatTime } from "@/lib/date-utils";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeletons";

interface Session {
  id: string;
  name: string;
  status: string;
}

interface ClassInfo {
  id: string;
  level: number;
  day_of_week: string[];
  start_time: string;
  end_time: string;
  max_capacity: number;
  class_type: string;
}

interface Assignment {
  id: string;
  swimmer_id: string;
  class_id: string;
  status: string;
  created_at: string;
  swimmer_name: string;
  swimmer_level: number;
  class_level: number;
  class_days: string[];
  class_time: string;
  class_type: string;
}

interface Swimmer {
  id: string;
  first_name: string;
  last_name: string;
  current_level: number;
  family_name: string | null;
}

export function AssignmentsManager() {
  const supabase = createClient();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  // Assign dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
  const [swimmerSearch, setSwimmerSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Load sessions
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("sessions")
        .select("id, name, status")
        .order("start_date", { ascending: false });
      const s = data ?? [];
      setSessions(s);
      const active = s.find((x) => x.status === "in_progress") ?? s[0];
      if (active) setSelectedSession(active.id);
      if (!active) setLoading(false);
    }
    load();
  }, [supabase]);

  // Load classes + assignments for session
  const fetchData = useCallback(async () => {
    if (!selectedSession) return;
    setLoading(true);

    // Get classes
    const { data: classData } = await supabase
      .from("classes")
      .select("id, level, day_of_week, start_time, end_time, max_capacity, class_type")
      .eq("session_id", selectedSession)
      .eq("is_active", true)
      .order("level")
      .order("start_time");

    setClasses(classData ?? []);

    // Get assignments for these classes
    const classIds = (classData ?? []).map((c) => c.id);
    if (classIds.length === 0) {
      setAssignments([]);
      setLoading(false);
      return;
    }

    const { data: assignData } = await supabase
      .from("class_assignments")
      .select(
        `id, swimmer_id, class_id, status, created_at,
         swimmer:swimmers(first_name, last_name, current_level),
         class:classes(level, day_of_week, start_time, class_type)`
      )
      .in("class_id", classIds)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    const mapped: Assignment[] = (assignData ?? []).map((a) => {
      const sw = Array.isArray(a.swimmer) ? a.swimmer[0] : a.swimmer;
      const cl = Array.isArray(a.class) ? a.class[0] : a.class;
      return {
        id: a.id,
        swimmer_id: a.swimmer_id,
        class_id: a.class_id,
        status: a.status ?? "active",
        created_at: a.created_at,
        swimmer_name: sw ? `${sw.first_name} ${sw.last_name}` : "Unknown",
        swimmer_level: sw?.current_level ?? 0,
        class_level: cl?.level ?? 0,
        class_days: cl?.day_of_week ?? [],
        class_time: cl?.start_time ?? "",
        class_type: cl?.class_type ?? "",
      };
    });

    setAssignments(mapped);
    setLoading(false);
  }, [selectedSession, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open assign dialog
  const openAssign = async (classId?: string) => {
    setSelectedClass(classId ?? "");
    setSwimmerSearch("");
    setDialogOpen(true);

    // Load all active swimmers
    const { data } = await supabase
      .from("swimmers")
      .select("id, first_name, last_name, current_level, family:profiles!family_id(full_name)")
      .eq("is_active", true)
      .order("first_name");

    setSwimmers(
      (data ?? []).map((s) => ({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        current_level: s.current_level ?? 1,
        family_name: Array.isArray(s.family) ? s.family[0]?.full_name : (s.family as { full_name: string } | null)?.full_name ?? null,
      }))
    );
  };

  const assignSwimmer = async (swimmerId: string) => {
    if (!selectedClass) {
      toast.error("Select a class first.");
      return;
    }
    setSaving(true);

    const { error } = await supabase.from("class_assignments").insert({
      swimmer_id: swimmerId,
      class_id: selectedClass,
      status: "active",
    });

    if (error) {
      if (error.code === "23505") {
        toast.error("Swimmer is already assigned to this class.");
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success("Swimmer assigned!");
      await fetchData();
    }
    setSaving(false);
  };

  const removeAssignment = async (id: string) => {
    if (!confirm("Remove this swimmer from the class?")) return;
    const { error } = await supabase
      .from("class_assignments")
      .update({ status: "dropped" })
      .eq("id", id);

    if (error) {
      toast.error("Failed to remove.");
    } else {
      toast.success("Swimmer removed from class.");
      await fetchData();
    }
  };

  // Filter swimmers not already assigned to selected class
  const filteredSwimmers = swimmers.filter((s) => {
    const alreadyAssigned = assignments.some(
      (a) => a.swimmer_id === s.id && a.class_id === selectedClass
    );
    if (alreadyAssigned) return false;
    if (swimmerSearch) {
      const q = swimmerSearch.toLowerCase();
      return (
        s.first_name.toLowerCase().includes(q) ||
        s.last_name.toLowerCase().includes(q) ||
        (s.family_name?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  // Assignment counts per class
  const countByClass = (classId: string) =>
    assignments.filter((a) => a.class_id === classId).length;

  return (
    <div className="space-y-6">
      {/* Session selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:w-64">
          <Select value={selectedSession} onValueChange={(v) => v && setSelectedSession(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select session" />
            </SelectTrigger>
            <SelectContent>
              {sessions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => openAssign()}>
          <Plus className="mr-2 size-4" />
          Assign Swimmer
        </Button>
      </div>

      {/* Classes with assignment counts */}
      {loading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : classes.length === 0 ? (
        <EmptyState
          icon={<Users className="size-10" />}
          title="No classes in this session"
          description="Create classes in the Sessions tab first, then assign swimmers here."
        />
      ) : (
        <div className="space-y-6">
          {classes.map((cls) => {
            const classAssignments = assignments.filter((a) => a.class_id === cls.id);
            return (
              <div key={cls.id} className="rounded-lg border">
                <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Badge
                      style={{
                        backgroundColor: getLevelColor(cls.level),
                        color: getLevelTextColor(cls.level),
                      }}
                    >
                      L{cls.level} {getLevelName(cls.level)}
                    </Badge>
                    <span className="text-sm font-medium">
                      {cls.day_of_week?.join(", ")} &middot; {formatTime(cls.start_time)} &ndash; {formatTime(cls.end_time)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {classAssignments.length}/{cls.max_capacity} assigned
                    </span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openAssign(cls.id)}>
                    <Plus className="mr-1 size-3" />
                    Add
                  </Button>
                </div>

                {classAssignments.length === 0 ? (
                  <p className="px-4 py-4 text-center text-sm text-muted-foreground">
                    No swimmers assigned yet.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Swimmer</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Assigned</TableHead>
                        <TableHead className="w-[60px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {classAssignments.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.swimmer_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">L{a.swimmer_level}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(a.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => removeAssignment(a.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Assign Swimmer Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Swimmer to Class</DialogTitle>
            <DialogDescription>Search for a swimmer and assign them to a class.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Class</Label>
              <Select value={selectedClass} onValueChange={(v) => v && setSelectedClass(v)}>
                <SelectTrigger>
                  {selectedClass
                    ? (() => {
                        const c = classes.find((x) => x.id === selectedClass);
                        return c
                          ? `L${c.level} ${getLevelName(c.level)} — ${c.day_of_week?.join(", ")} ${formatTime(c.start_time)}`
                          : "Select class";
                      })()
                    : "Select class"}
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      L{c.level} {getLevelName(c.level)} — {c.day_of_week?.join(", ")} {formatTime(c.start_time)} ({countByClass(c.id)}/{c.max_capacity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Search Swimmers</Label>
              <Input
                placeholder="Search by name..."
                value={swimmerSearch}
                onChange={(e) => setSwimmerSearch(e.target.value)}
              />
            </div>

            <div className="max-h-60 overflow-y-auto rounded-lg border">
              {filteredSwimmers.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                  No matching swimmers found.
                </p>
              ) : (
                filteredSwimmers.slice(0, 20).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => assignSwimmer(s.id)}
                    disabled={saving}
                    className="flex w-full items-center justify-between border-b px-3 py-2.5 text-left text-sm hover:bg-muted last:border-0"
                  >
                    <div>
                      <span className="font-medium">
                        {s.first_name} {s.last_name}
                      </span>
                      {s.family_name && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({s.family_name})
                        </span>
                      )}
                    </div>
                    <Badge variant="outline">L{s.current_level}</Badge>
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
