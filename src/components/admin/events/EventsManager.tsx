"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DialogClose,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus,
  Loader2,
  MoreHorizontal,
  Pencil,
  Copy,
  Users,
  Eye,
  Trash2,
  CalendarDays,
} from "lucide-react";
import { TableSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatDateShort } from "@/lib/date-utils";

interface EventRow {
  id: string;
  name: string;
  description: string | null;
  event_type: string;
  start_date: string;
  end_date: string;
  daily_start_time: string | null;
  daily_end_time: string | null;
  level_min: number;
  level_max: number;
  max_capacity: number;
  member_price: number;
  non_member_price: number;
  military_price: number;
  instructor_id: string | null;
  status: string;
  image_url: string | null;
  registered_count: number;
}

interface Registration {
  id: string;
  swimmer_name: string;
  status: string;
  payment_status: string;
  registered_at: string;
}

interface InstructorOption {
  id: string;
  name: string;
}

const EMPTY_FORM = {
  name: "",
  description: "",
  event_type: "camp",
  start_date: "",
  end_date: "",
  daily_start_time: "",
  daily_end_time: "",
  level_min: "1",
  level_max: "5",
  max_capacity: "20",
  member_price: "",
  non_member_price: "",
  military_price: "",
  instructor_id: "",
  status: "draft",
  image_url: "",
};

export function EventsManager() {
  const supabase = createClient();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Registrations sheet
  const [regEvent, setRegEvent] = useState<EventRow | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;

      // Get registration counts
      const eventIds = (data ?? []).map((e) => e.id);
      let regCounts: Record<string, number> = {};
      if (eventIds.length > 0) {
        // Only count "confirmed" toward capacity; waitlisted are separate
        const { data: regs } = await supabase
          .from("event_registrations")
          .select("event_id")
          .in("event_id", eventIds)
          .eq("status", "confirmed");
        for (const r of regs ?? []) {
          regCounts[r.event_id] = (regCounts[r.event_id] ?? 0) + 1;
        }
      }

      setEvents(
        (data ?? []).map((e) => ({
          ...e,
          member_price: Number(e.member_price),
          non_member_price: Number(e.non_member_price),
          military_price: Number(e.military_price),
          registered_count: regCounts[e.id] ?? 0,
        }))
      );
    } catch {
      toast.error("Failed to load events.", { duration: Infinity });
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const fetchInstructors = useCallback(async () => {
    const { data } = await supabase
      .from("instructors")
      .select("id, profile:profiles(full_name)")
      .eq("is_active", true);
    setInstructors(
      (data ?? []).map((i) => {
        const profile = Array.isArray(i.profile) ? i.profile[0] : i.profile;
        return { id: i.id, name: profile?.full_name ?? "Unknown" };
      })
    );
  }, [supabase]);

  useEffect(() => {
    fetchEvents();
    fetchInstructors();
  }, [fetchEvents, fetchInstructors]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (event: EventRow) => {
    setEditingId(event.id);
    setForm({
      name: event.name,
      description: event.description ?? "",
      event_type: event.event_type,
      start_date: event.start_date,
      end_date: event.end_date,
      daily_start_time: event.daily_start_time ?? "",
      daily_end_time: event.daily_end_time ?? "",
      level_min: String(event.level_min),
      level_max: String(event.level_max),
      max_capacity: String(event.max_capacity),
      member_price: String(event.member_price),
      non_member_price: String(event.non_member_price),
      military_price: String(event.military_price),
      instructor_id: event.instructor_id ?? "",
      status: event.status,
      image_url: event.image_url ?? "",
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.start_date || !form.end_date) {
      toast.error("Name and dates are required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        event_type: form.event_type,
        start_date: form.start_date,
        end_date: form.end_date,
        daily_start_time: form.daily_start_time || null,
        daily_end_time: form.daily_end_time || null,
        level_min: parseInt(form.level_min),
        level_max: parseInt(form.level_max),
        max_capacity: parseInt(form.max_capacity),
        member_price: parseFloat(form.member_price) || 0,
        non_member_price: parseFloat(form.non_member_price) || 0,
        military_price: parseFloat(form.military_price) || 0,
        instructor_id: form.instructor_id || null,
        status: form.status,
        image_url: form.image_url || null,
      };

      if (editingId) {
        const { error } = await supabase.from("events").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("Event updated.");
      } else {
        const { error } = await supabase.from("events").insert(payload);
        if (error) throw error;
        toast.success("Event created.");
      }

      setFormOpen(false);
      fetchEvents();
    } catch {
      toast.error("Failed to save event.");
    } finally {
      setSaving(false);
    }
  };

  const duplicateEvent = async (event: EventRow) => {
    const { error } = await supabase.from("events").insert({
      name: `${event.name} (Copy)`,
      description: event.description,
      event_type: event.event_type,
      start_date: event.start_date,
      end_date: event.end_date,
      daily_start_time: event.daily_start_time,
      daily_end_time: event.daily_end_time,
      level_min: event.level_min,
      level_max: event.level_max,
      max_capacity: event.max_capacity,
      member_price: event.member_price,
      non_member_price: event.non_member_price,
      military_price: event.military_price,
      instructor_id: event.instructor_id,
      status: "draft",
      image_url: event.image_url,
    });

    if (error) {
      toast.error("Failed to duplicate event.");
    } else {
      toast.success("Event duplicated as draft.");
      fetchEvents();
    }
  };

  const deleteEvent = async (id: string) => {
    // Check for active registrations before deleting
    const { count } = await supabase
      .from("event_registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", id)
      .in("status", ["confirmed", "waitlisted"]);

    if (count && count > 0) {
      toast.error(`Cannot delete: ${count} active registration${count !== 1 ? "s" : ""} exist. Cancel them first.`);
      return;
    }

    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete event.");
    } else {
      toast.success("Event deleted.");
      fetchEvents();
    }
  };

  const viewRegistrations = async (event: EventRow) => {
    setRegEvent(event);
    setLoadingRegs(true);

    const { data } = await supabase
      .from("event_registrations")
      .select("id, status, payment_status, registered_at, swimmer:swimmers(first_name, last_name)")
      .eq("event_id", event.id)
      .order("registered_at", { ascending: true });

    setRegistrations(
      (data ?? []).map((r) => {
        const swimmer = Array.isArray(r.swimmer) ? r.swimmer[0] : r.swimmer;
        return {
          id: r.id,
          swimmer_name: swimmer ? `${swimmer.first_name} ${swimmer.last_name}` : "Unknown",
          status: r.status,
          payment_status: r.payment_status,
          registered_at: r.registered_at,
        };
      })
    );
    setLoadingRegs(false);
  };

  const updateRegStatus = async (regId: string, status: string) => {
    await supabase.from("event_registrations").update({ status }).eq("id", regId);
    if (regEvent) viewRegistrations(regEvent);
    toast.success("Registration updated.");
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="outline">Draft</Badge>;
      case "registration_open":
        return <Badge className="bg-green-100 text-green-800">Open</Badge>;
      case "full":
        return <Badge variant="destructive">Full</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case "completed":
        return <Badge className="bg-gray-100 text-gray-800">Completed</Badge>;
      case "cancelled":
        return <Badge className="bg-red-100 text-red-800">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{events.length} event{events.length !== 1 ? "s" : ""}</p>
        <Button onClick={openCreate}>
          <Plus className="mr-1.5 size-4" />
          Create Event
        </Button>
      </div>

      {events.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No events yet.</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Levels</TableHead>
                <TableHead className="text-right">Registered</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="font-medium">{event.name}</TableCell>
                  <TableCell className="capitalize text-sm">{event.event_type}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatDateShort(event.start_date)}
                    {event.start_date !== event.end_date && ` – ${formatDateShort(event.end_date)}`}
                  </TableCell>
                  <TableCell>L{event.level_min}–{event.level_max}</TableCell>
                  <TableCell className="text-right">
                    {event.registered_count}/{event.max_capacity}
                  </TableCell>
                  <TableCell>{statusBadge(event.status)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon" className="size-8" aria-label="Event actions">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(event)}>
                          <Pencil className="mr-2 size-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => viewRegistrations(event)}>
                          <Users className="mr-2 size-4" /> View Registrations
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => duplicateEvent(event)}>
                          <Copy className="mr-2 size-4" /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteEvent(event.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 size-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Event" : "Create Event"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Update the event details." : "Fill in the details for the new event."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1" />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="mt-1" rows={3} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.event_type} onValueChange={(v) => v && setForm((f) => ({ ...f, event_type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="camp">Camp</SelectItem>
                    <SelectItem value="workshop">Workshop</SelectItem>
                    <SelectItem value="clinic">Clinic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => v && setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="registration_open">Registration Open</SelectItem>
                    <SelectItem value="full">Full</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date *</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>End Date *</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} className="mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Daily Start Time</Label>
                <Input type="time" value={form.daily_start_time} onChange={(e) => setForm((f) => ({ ...f, daily_start_time: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Daily End Time</Label>
                <Input type="time" value={form.daily_end_time} onChange={(e) => setForm((f) => ({ ...f, daily_end_time: e.target.value }))} className="mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Level Min</Label>
                <Select value={form.level_min} onValueChange={(v) => v && setForm((f) => ({ ...f, level_min: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[0,1,2,3,4,5].map((l) => <SelectItem key={l} value={String(l)}>Level {l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Level Max</Label>
                <Select value={form.level_max} onValueChange={(v) => v && setForm((f) => ({ ...f, level_max: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[0,1,2,3,4,5].map((l) => <SelectItem key={l} value={String(l)}>Level {l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Max Capacity</Label>
                <Input type="number" value={form.max_capacity} onChange={(e) => setForm((f) => ({ ...f, max_capacity: e.target.value }))} className="mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Member Price ($)</Label>
                <Input type="number" step="0.01" value={form.member_price} onChange={(e) => setForm((f) => ({ ...f, member_price: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Non-Member ($)</Label>
                <Input type="number" step="0.01" value={form.non_member_price} onChange={(e) => setForm((f) => ({ ...f, non_member_price: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Military ($)</Label>
                <Input type="number" step="0.01" value={form.military_price} onChange={(e) => setForm((f) => ({ ...f, military_price: e.target.value }))} className="mt-1" />
              </div>
            </div>

            <div>
              <Label>Instructor</Label>
              <Select value={form.instructor_id} onValueChange={(v) => v && setForm((f) => ({ ...f, instructor_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select instructor..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {instructors.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Image URL</Label>
              <Input value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} placeholder="https://..." className="mt-1" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <DialogClose render={<Button variant="outline">Cancel</Button>} />
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                {editingId ? "Save Changes" : "Create Event"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Registrations Sheet */}
      <Sheet open={!!regEvent} onOpenChange={(o) => !o && setRegEvent(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Registrations — {regEvent?.name}</SheetTitle>
          </SheetHeader>

          {loadingRegs ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : registrations.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No registrations yet.</p>
          ) : (
            <div className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Swimmer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations.map((reg) => (
                    <TableRow key={reg.id}>
                      <TableCell className="font-medium">{reg.swimmer_name}</TableCell>
                      <TableCell>
                        {reg.status === "confirmed" ? (
                          <Badge className="bg-green-100 text-green-800">Confirmed</Badge>
                        ) : reg.status === "waitlisted" ? (
                          <Badge className="bg-yellow-100 text-yellow-800">Waitlisted</Badge>
                        ) : (
                          <Badge variant="outline">{reg.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {reg.payment_status === "paid" ? (
                          <Badge className="bg-green-100 text-green-800">Paid</Badge>
                        ) : (
                          <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button variant="ghost" size="icon" className="size-7" aria-label="Ticket actions">
                                <MoreHorizontal className="size-3.5" />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end">
                            {reg.status === "waitlisted" && (
                              <DropdownMenuItem onClick={() => updateRegStatus(reg.id, "confirmed")}>
                                Confirm
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => updateRegStatus(reg.id, "cancelled")}
                              className="text-destructive"
                            >
                              Cancel Registration
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
