"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Grid3X3, List, Search, UserPlus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { AdminPageSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineError } from "@/components/ui/inline-error";
import { format } from "date-fns";
import { createInstructor, updateInstructor } from "@/app/admin/instructors/actions";
import {
  InstructorFormDialog,
  type InstructorFormData,
} from "./InstructorFormDialog";
import { InstructorDetail } from "./InstructorDetail";

interface InstructorRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  bio: string | null;
  photo_url: string | null;
  is_active: boolean;
  display_on_website: boolean;
  hourly_rate: number | null;
  certifications: { name: string; expiry_date: string }[];
  class_count: number;
}

type ViewMode = "grid" | "table";

export function InstructorsManager() {
  const supabase = createClient();
  const [instructors, setInstructors] = useState<InstructorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState("Add Instructor");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogInitial, setDialogInitial] = useState<Partial<InstructorFormData> | null>(null);

  // Detail sheet
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchInstructors = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: instructorData, error: instError } = await supabase
        .from("instructors")
        .select("id, bio, photo_url, is_active, display_on_website, hourly_rate, certifications, profile:profiles!id(full_name, phone)");

      if (instError) throw instError;

      if (!instructorData) {
        setLoading(false);
        return;
      }

      const instructorIds = instructorData.map((i) => i.id);

      // Get class counts and emails in parallel
      const [classRes] = await Promise.all([
        supabase
          .from("classes")
          .select("instructor_id")
          .in("instructor_id", instructorIds.length > 0 ? instructorIds : ["__none__"])
          .eq("is_active", true),
      ]);

      const classCountMap = new Map<string, number>();
      for (const c of classRes.data ?? []) {
        classCountMap.set(c.instructor_id, (classCountMap.get(c.instructor_id) ?? 0) + 1);
      }

      // We need emails — fetch from auth via a server-side approach.
      // Since we can't access auth.users from the client, we'll use the profile full_name.
      // Email will be shown as empty on the client; the form dialog handles email for new invites.

      setInstructors(
        instructorData.map((i) => {
          const profile = i.profile as unknown as
            | { full_name: string; phone: string | null }
            | { full_name: string; phone: string | null }[]
            | null;
          const pObj = Array.isArray(profile) ? profile[0] : profile;

          return {
            id: i.id,
            full_name: pObj?.full_name ?? "Unknown",
            email: "", // Not accessible from client
            phone: pObj?.phone ?? null,
            bio: i.bio,
            photo_url: i.photo_url,
            is_active: i.is_active,
            display_on_website: i.display_on_website,
            hourly_rate: i.hourly_rate,
            certifications: (i.certifications as { name: string; expiry_date: string }[]) ?? [],
            class_count: classCountMap.get(i.id) ?? 0,
          };
        })
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load instructors.";
      setError(message);
      toast.error("Failed to load instructors.", { duration: Infinity });
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchInstructors();
  }, [fetchInstructors]);

  const filtered = useMemo(() => {
    if (!search) return instructors;
    const q = search.toLowerCase();
    return instructors.filter(
      (i) =>
        i.full_name.toLowerCase().includes(q) ||
        i.email.toLowerCase().includes(q)
    );
  }, [instructors, search]);

  // ── CRUD ──────────────────────────────────────────────────

  const openCreate = () => {
    setEditingId(null);
    setDialogInitial(null);
    setDialogTitle("Add Instructor");
    setDialogOpen(true);
  };

  const openEdit = (i: InstructorRow) => {
    setEditingId(i.id);
    setDialogTitle("Edit Instructor");
    setDialogInitial({
      full_name: i.full_name,
      email: i.email,
      phone: i.phone ?? "",
      bio: i.bio ?? "",
      photo_url: i.photo_url ?? "",
      is_active: i.is_active,
      display_on_website: i.display_on_website,
      hourly_rate: i.hourly_rate ? String(i.hourly_rate) : "",
      certifications: i.certifications,
    });
    setDialogOpen(true);
  };

  const handleSave = async (data: InstructorFormData) => {
    const payload = {
      full_name: data.full_name.trim(),
      email: data.email.trim(),
      phone: data.phone.trim(),
      bio: data.bio.trim(),
      photo_url: data.photo_url,
      is_active: data.is_active,
      display_on_website: data.display_on_website,
      hourly_rate: data.hourly_rate ? Number(data.hourly_rate) : null,
      certifications: data.certifications,
    };

    if (editingId) {
      const result = await updateInstructor({ ...payload, id: editingId });
      if (result.error) {
        toast.error(result.error);
        throw new Error(result.error);
      }
      toast.success("Instructor updated.");
    } else {
      const result = await createInstructor(payload);
      if (result.error) {
        toast.error(result.error);
        throw new Error(result.error);
      }
      toast.success("Instructor invited! They'll receive an email to set their password.");
    }

    await fetchInstructors();
  };

  // ── Cert helpers ──────────────────────────────────────────

  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  function certStatusColor(cert: { expiry_date: string }) {
    if (!cert.expiry_date) return "border-gray-300 text-gray-500";
    const exp = new Date(cert.expiry_date);
    if (exp < now) return "border-red-500 text-red-600";
    if (exp < thirtyDays) return "border-yellow-500 text-yellow-600";
    return "border-green-500 text-green-600";
  }

  function initials(name: string) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="icon-sm"
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="size-4" />
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="icon-sm"
              onClick={() => setViewMode("table")}
            >
              <List className="size-4" />
            </Button>
          </div>
          <Button onClick={openCreate}>
            <UserPlus className="mr-2 size-4" />
            Add Instructor
          </Button>
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} instructor{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* Content */}
      {error ? (
        <InlineError message={error} onRetry={fetchInstructors} />
      ) : loading ? (
        <AdminPageSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="size-10" />}
          title={search ? "No instructors match your search" : "No instructors yet"}
          description={search ? "Try adjusting your search term." : "Add your first instructor to start assigning classes."}
          action={search ? undefined : { label: "Add Instructor", onClick: openCreate }}
        />
      ) : viewMode === "grid" ? (
        /* ── Card Grid ────────────────────────────────────────── */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((inst) => (
            <Card key={inst.id} className="relative">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="size-12">
                    <AvatarImage src={inst.photo_url ?? undefined} alt={inst.full_name} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {initials(inst.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-medium">{inst.full_name}</h3>
                      {inst.is_active ? (
                        <Badge variant="outline" className="border-green-500 text-green-600">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                    {inst.email && (
                      <p className="truncate text-sm text-muted-foreground">{inst.email}</p>
                    )}
                    <p className="mt-1 text-sm">
                      {inst.class_count} class{inst.class_count !== 1 ? "es" : ""}
                    </p>
                  </div>
                </div>

                {/* Certs */}
                {inst.certifications.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {inst.certifications.map((cert, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className={`text-xs ${certStatusColor(cert)}`}
                      >
                        {cert.name}
                        {cert.expiry_date && (
                          <span className="ml-1 opacity-70">
                            {format(new Date(cert.expiry_date), "M/yy")}
                          </span>
                        )}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setSelectedId(inst.id)}
                  >
                    View Schedule
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEdit(inst)}
                  >
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* ── Table View ───────────────────────────────────────── */
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instructor</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead>Certifications</TableHead>
                <TableHead className="text-right">Classes</TableHead>
                <TableHead className="w-[140px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((inst) => (
                <TableRow key={inst.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarImage src={inst.photo_url ?? undefined} alt={inst.full_name} />
                        <AvatarFallback className="bg-primary/10 text-xs text-primary">
                          {initials(inst.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="font-medium">{inst.full_name}</span>
                        {inst.email && (
                          <p className="text-xs text-muted-foreground">{inst.email}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {inst.is_active ? (
                      <Badge variant="outline" className="border-green-500 text-green-600">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {inst.certifications.map((cert, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className={`text-xs ${certStatusColor(cert)}`}
                        >
                          {cert.name}
                        </Badge>
                      ))}
                      {inst.certifications.length === 0 && (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {inst.class_count}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedId(inst.id)}
                      >
                        Schedule
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(inst)}
                      >
                        Edit
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Form Dialog */}
      <InstructorFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={dialogInitial}
        title={dialogTitle}
        onSave={handleSave}
        isEdit={!!editingId}
      />

      {/* Detail Sheet */}
      <Sheet open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Instructor Details</SheetTitle>
          </SheetHeader>
          {selectedId && <InstructorDetail instructorId={selectedId} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
