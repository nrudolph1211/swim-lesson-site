"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Search,
  X,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  CreditCard,
  ArrowUp,
  Loader2,
  ClipboardList,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineError } from "@/components/ui/inline-error";
import { formatTime, formatDateShort } from "@/lib/date-utils";
import {
  SWIM_LEVELS,
  getLevelColor,
  getLevelTextColor,
  getLevelName,
} from "@/lib/swim-utils";

interface EnrollmentRow {
  id: string;
  swimmer_id: string;
  swimmer_name: string;
  class_id: string;
  level: number;
  day_of_week: string[];
  start_time: string;
  session_name: string;
  session_id: string;
  status: string;
  payment_status: string;
  enrolled_at: string;
  waitlist_position: number | null;
  parent_name: string;
}

interface SessionOption {
  id: string;
  name: string;
}

type TabKey = "all" | "waitlist";

export function EnrollmentsTable() {
  const supabase = createClient();
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Filters
  const [filterSession, setFilterSession] = useState<string>("");
  const [filterLevel, setFilterLevel] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterPayment, setFilterPayment] = useState<string>("");

  // Tab
  const [tab, setTab] = useState<TabKey>("all");

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Cancel dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelIds, setCancelIds] = useState<string[]>([]);
  const [cancelling, setCancelling] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [sessionRes, enrollRes] = await Promise.all([
        supabase.from("sessions").select("id, name").order("created_at", { ascending: false }),
        supabase
          .from("enrollments")
          .select(
            "id, swimmer_id, class_id, status, payment_status, enrolled_at, waitlist_position, swimmer:swimmers(first_name, last_name, current_level, family:profiles!family_id(full_name)), class:classes(level, day_of_week, start_time, session_id, session:sessions(name))"
          )
          .order("enrolled_at", { ascending: false }),
      ]);

      if (enrollRes.error) throw enrollRes.error;

      if (sessionRes.data) {
        setSessions(sessionRes.data);
      }

      if (enrollRes.data) {
        setEnrollments(
          enrollRes.data.map((e: Record<string, unknown>) => {
            const swimmer = e.swimmer as unknown as
              | { first_name: string; last_name: string; current_level: number; family: { full_name: string } | { full_name: string }[] | null }
              | { first_name: string; last_name: string; current_level: number; family: { full_name: string } | { full_name: string }[] | null }[]
              | null;
            const s = Array.isArray(swimmer) ? swimmer[0] : swimmer;

            const cls = e.class as unknown as
              | { level: number; day_of_week: string[]; start_time: string; session_id: string; session: { name: string } | { name: string }[] | null }
              | { level: number; day_of_week: string[]; start_time: string; session_id: string; session: { name: string } | { name: string }[] | null }[]
              | null;
            const c = Array.isArray(cls) ? cls[0] : cls;

            const family = s?.family;
            const fObj = Array.isArray(family) ? family[0] : family;

            const sess = c?.session;
            const sessObj = Array.isArray(sess) ? sess[0] : sess;

            return {
              id: e.id as string,
              swimmer_id: e.swimmer_id as string,
              swimmer_name: s ? `${s.first_name} ${s.last_name}` : "Unknown",
              class_id: e.class_id as string,
              level: c?.level ?? 1,
              day_of_week: c?.day_of_week ?? [],
              start_time: c?.start_time ?? "",
              session_name: sessObj?.name ?? "Unknown",
              session_id: c?.session_id ?? "",
              status: e.status as string,
              payment_status: e.payment_status as string,
              enrolled_at: e.enrolled_at as string,
              waitlist_position: e.waitlist_position as number | null,
              parent_name: fObj?.full_name ?? "Unknown",
            };
          })
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load enrollments.";
      setError(message);
      toast.error("Failed to load enrollments.", { duration: Infinity });
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    return enrollments.filter((e) => {
      // Tab
      if (tab === "waitlist" && e.status !== "waitlisted") return false;

      // Search
      if (search) {
        const q = search.toLowerCase();
        if (
          !e.swimmer_name.toLowerCase().includes(q) &&
          !e.parent_name.toLowerCase().includes(q)
        ) {
          return false;
        }
      }

      // Session
      if (filterSession && e.session_id !== filterSession) return false;

      // Level
      if (filterLevel && e.level !== Number(filterLevel)) return false;

      // Status
      if (filterStatus && e.status !== filterStatus) return false;

      // Payment
      if (filterPayment && e.payment_status !== filterPayment) return false;

      return true;
    });
  }, [enrollments, search, filterSession, filterLevel, filterStatus, filterPayment, tab]);

  const hasFilters =
    filterSession !== "" || filterLevel !== "" || filterStatus !== "" || filterPayment !== "";

  // Selection helpers
  const allSelected = filtered.length > 0 && filtered.every((e) => selected.has(e.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((e) => e.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Actions ──────────────────────────────────────────────────

  const confirmEnrollments = async (ids: string[]) => {
    const { error } = await supabase
      .from("enrollments")
      .update({ status: "confirmed" })
      .in("id", ids);
    if (error) {
      toast.error("Failed to confirm enrollments.");
      return;
    }
    toast.success(`${ids.length} enrollment(s) confirmed.`);
    setSelected(new Set());
    await fetchData();
  };

  const openCancelDialog = (ids: string[]) => {
    setCancelIds(ids);
    setCancelReason("");
    setCancelDialogOpen(true);
  };

  const executeCancellation = async () => {
    setCancelling(true);
    try {
      const { error } = await supabase
        .from("enrollments")
        .update({ status: "cancelled", cancellation_reason: cancelReason.trim() || null })
        .in("id", cancelIds);
      if (error) throw error;
      toast.success(`${cancelIds.length} enrollment(s) cancelled.`);
      setSelected(new Set());
      setCancelDialogOpen(false);
      await fetchData();
    } catch {
      toast.error("Failed to cancel enrollments.");
    } finally {
      setCancelling(false);
    }
  };

  const markPaid = async (ids: string[]) => {
    const { error } = await supabase
      .from("enrollments")
      .update({ payment_status: "paid" })
      .in("id", ids);
    if (error) {
      toast.error("Failed to update payment status.");
      return;
    }
    toast.success(`${ids.length} enrollment(s) marked as paid.`);
    setSelected(new Set());
    await fetchData();
  };

  const changePaymentStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("enrollments")
      .update({ payment_status: status })
      .eq("id", id);
    if (error) {
      toast.error("Failed to update payment status.");
      return;
    }
    toast.success(`Payment status updated to ${status}.`);
    await fetchData();
  };

  const issueMakeUpCredit = async (enrollment: EnrollmentRow) => {
    // Get the class price to determine credit amount
    const { data: cls } = await supabase
      .from("classes")
      .select("member_price")
      .eq("id", enrollment.class_id)
      .single();

    const amount = cls?.member_price ?? 0;

    // Get swimmer's family_id
    const { data: swimmer } = await supabase
      .from("swimmers")
      .select("family_id")
      .eq("id", enrollment.swimmer_id)
      .single();

    if (!swimmer) {
      toast.error("Could not find swimmer's family.");
      return;
    }

    const { error } = await supabase.from("family_credits").insert({
      family_id: swimmer.family_id,
      amount,
      type: "adjustment",
      description: `Make-up credit for ${enrollment.swimmer_name} - ${enrollment.session_name}`,
    });

    if (error) {
      toast.error("Failed to issue make-up credit.");
      return;
    }

    toast.success(`Make-up credit of $${amount} issued.`);
  };

  const promoteFromWaitlist = async (id: string) => {
    const { error } = await supabase
      .from("enrollments")
      .update({ status: "confirmed", waitlist_position: null })
      .eq("id", id);
    if (error) {
      toast.error("Failed to promote from waitlist.");
      return;
    }
    toast.success("Swimmer promoted from waitlist.");
    await fetchData();
  };

  // ── Status / Payment badges ──────────────────────────────────

  function statusBadge(status: string) {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-green-500 text-white">Confirmed</Badge>;
      case "waitlisted":
        return <Badge className="bg-yellow-500 text-white">Waitlisted</Badge>;
      case "cancelled":
        return <Badge variant="secondary">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function paymentBadge(status: string) {
    switch (status) {
      case "paid":
        return (
          <Badge variant="outline" className="border-green-500 text-green-600">
            Paid
          </Badge>
        );
      case "refunded":
        return (
          <Badge variant="outline" className="border-blue-500 text-blue-600">
            Refunded
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-orange-500 text-orange-600">
            Pending
          </Badge>
        );
    }
  }

  const selectedIds = Array.from(selected);
  const selectedCount = selectedIds.length;

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border p-1">
        <button
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === "all"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setTab("all")}
        >
          All Enrollments
        </button>
        <button
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === "waitlist"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setTab("waitlist")}
        >
          Waitlist
        </button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="relative flex-1 lg:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search swimmers or parents..."
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterSession} onValueChange={(v) => setFilterSession(v ?? "")}>
            <SelectTrigger size="sm" className="w-[160px]">
              <SelectValue placeholder="Session" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Sessions</SelectItem>
              {sessions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterLevel} onValueChange={(v) => setFilterLevel(v ?? "")}>
            <SelectTrigger size="sm" className="w-[120px]">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Levels</SelectItem>
              {SWIM_LEVELS.map((l) => (
                <SelectItem key={l.id} value={String(l.id)}>
                  L{l.id}: {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v ?? "")}>
            <SelectTrigger size="sm" className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Statuses</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="waitlisted">Waitlisted</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterPayment} onValueChange={(v) => setFilterPayment(v ?? "")}>
            <SelectTrigger size="sm" className="w-[130px]">
              <SelectValue placeholder="Payment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Payments</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterSession("");
                setFilterLevel("");
                setFilterStatus("");
                setFilterPayment("");
              }}
            >
              <X className="mr-1 size-3" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium">
            {selectedCount} selected
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => confirmEnrollments(selectedIds)}
            >
              <CheckCircle className="mr-1.5 size-3.5" />
              Confirm Selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openCancelDialog(selectedIds)}
            >
              <XCircle className="mr-1.5 size-3.5" />
              Cancel Selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => markPaid(selectedIds)}
            >
              <CreditCard className="mr-1.5 size-3.5" />
              Mark as Paid
            </Button>
          </div>
        </div>
      )}

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} enrollment{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* Table */}
      {error ? (
        <InlineError message={error} onRetry={fetchData} />
      ) : loading ? (
        <TableSkeleton rows={6} cols={tab === "waitlist" ? 10 : 9} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-10" />}
          title={tab === "waitlist" ? "No swimmers on the waitlist" : "No enrollments found"}
          description={search || hasFilters ? "Try adjusting your search or filters." : "Enrollments will appear here once swimmers are registered for classes."}
        />
      ) : (
      <>
      {/* Mobile cards */}
      <div className="space-y-3 sm:hidden">
        {filtered.map((e) => (
          <div key={e.id} className="rounded-lg border p-4 space-y-2 active:bg-muted/50">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">{e.swimmer_name}</span>
                <p className="text-xs text-muted-foreground">{e.parent_name}</p>
              </div>
              <Badge
                style={{ backgroundColor: getLevelColor(e.level), color: getLevelTextColor(e.level) }}
              >
                L{e.level}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {e.day_of_week.join(", ")} {formatTime(e.start_time)} · {e.session_name}
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {statusBadge(e.status)}
                {paymentBadge(e.payment_status)}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon-sm" className="min-h-[44px] min-w-[44px]" aria-label="Enrollment actions">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  {e.status !== "confirmed" && (
                    <DropdownMenuItem onClick={() => confirmEnrollments([e.id])}>
                      <CheckCircle className="mr-2 size-3.5" />
                      Confirm
                    </DropdownMenuItem>
                  )}
                  {e.status === "waitlisted" && (
                    <DropdownMenuItem onClick={() => promoteFromWaitlist(e.id)}>
                      <ArrowUp className="mr-2 size-3.5" />
                      Promote from Waitlist
                    </DropdownMenuItem>
                  )}
                  {e.status !== "cancelled" && (
                    <DropdownMenuItem onClick={() => openCancelDialog([e.id])}>
                      <XCircle className="mr-2 size-3.5" />
                      Cancel
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => issueMakeUpCredit(e)}>
                    <CreditCard className="mr-2 size-3.5" />
                    Issue Make-Up Credit
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
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>Swimmer</TableHead>
              <TableHead>Level</TableHead>
              <TableHead className="hidden md:table-cell">Session</TableHead>
              <TableHead className="hidden lg:table-cell">Schedule</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              {tab === "waitlist" && <TableHead className="text-right">Position</TableHead>}
              <TableHead className="hidden sm:table-cell">Date</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(
              filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(e.id)}
                      onCheckedChange={() => toggleOne(e.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <span className="font-medium">{e.swimmer_name}</span>
                      <p className="text-xs text-muted-foreground">{e.parent_name}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      style={{ backgroundColor: getLevelColor(e.level), color: getLevelTextColor(e.level) }}
                    >
                      L{e.level}: {getLevelName(e.level)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    {e.session_name}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                    {e.day_of_week.join(", ")} {formatTime(e.start_time)}
                  </TableCell>
                  <TableCell>{statusBadge(e.status)}</TableCell>
                  <TableCell>{paymentBadge(e.payment_status)}</TableCell>
                  {tab === "waitlist" && (
                    <TableCell className="text-right font-mono font-medium">
                      #{e.waitlist_position ?? "—"}
                    </TableCell>
                  )}
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                    {formatDateShort(e.enrolled_at)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon-sm" aria-label="Enrollment actions">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        {e.status !== "confirmed" && (
                          <DropdownMenuItem onClick={() => confirmEnrollments([e.id])}>
                            <CheckCircle className="mr-2 size-3.5" />
                            Confirm
                          </DropdownMenuItem>
                        )}
                        {e.status === "waitlisted" && (
                          <DropdownMenuItem onClick={() => promoteFromWaitlist(e.id)}>
                            <ArrowUp className="mr-2 size-3.5" />
                            Promote from Waitlist
                          </DropdownMenuItem>
                        )}
                        {e.status !== "cancelled" && (
                          <DropdownMenuItem onClick={() => openCancelDialog([e.id])}>
                            <XCircle className="mr-2 size-3.5" />
                            Cancel
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => issueMakeUpCredit(e)}>
                          <CreditCard className="mr-2 size-3.5" />
                          Issue Make-Up Credit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {e.payment_status !== "paid" && (
                          <DropdownMenuItem onClick={() => changePaymentStatus(e.id, "paid")}>
                            Mark as Paid
                          </DropdownMenuItem>
                        )}
                        {e.payment_status !== "pending" && (
                          <DropdownMenuItem onClick={() => changePaymentStatus(e.id, "pending")}>
                            Mark as Pending
                          </DropdownMenuItem>
                        )}
                        {e.payment_status !== "refunded" && (
                          <DropdownMenuItem onClick={() => changePaymentStatus(e.id, "refunded")}>
                            Mark as Refunded
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

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel Enrollment{cancelIds.length > 1 ? "s" : ""}</DialogTitle>
            <DialogDescription>
              This will cancel {cancelIds.length} enrollment{cancelIds.length > 1 ? "s" : ""}. Optionally provide a reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="cancel-reason">Reason (optional)</Label>
              <Textarea
                id="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g., Weather cancellation, family request..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
                Keep Enrolled
              </Button>
              <Button
                variant="destructive"
                onClick={executeCancellation}
                disabled={cancelling}
              >
                {cancelling && <Loader2 className="mr-2 size-4 animate-spin" />}
                Cancel Enrollment{cancelIds.length > 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
