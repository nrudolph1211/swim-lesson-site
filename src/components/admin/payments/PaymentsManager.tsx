"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  DollarSign,
  Clock,
  RefreshCcw,
  MoreHorizontal,
  Plus,
  Loader2,
  Search,
  Ban,
} from "lucide-react";
import { AdminPageSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatTime } from "@/lib/date-utils";

interface PaymentRecord {
  id: string;
  enrollment_id: string | null;
  family_id: string;
  amount: number;
  currency: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  status: string;
  payment_method: string;
  description: string | null;
  created_at: string;
  completed_at: string | null;
  family_name: string;
  swimmer_name: string | null;
  class_level: number | null;
  class_time: string | null;
}

interface EnrollmentOption {
  id: string;
  swimmer_name: string;
  level: number;
  session_name: string;
  day_of_week: string[];
  start_time: string;
  family_id: string;
}

export function PaymentsManager() {
  const supabase = createClient();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Manual payment state
  const [manualOpen, setManualOpen] = useState(false);
  const [enrollmentOptions, setEnrollmentOptions] = useState<EnrollmentOption[]>([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [manualForm, setManualForm] = useState({
    enrollment_id: "",
    method: "cash" as "cash" | "check" | "comp",
    amount: "",
    note: "",
  });
  const [savingManual, setSavingManual] = useState(false);

  // Refund state
  const [refundPayment, setRefundPayment] = useState<PaymentRecord | null>(null);
  const [refunding, setRefunding] = useState(false);

  const fetchPayments = useCallback(async () => {
    setLoading(true);

    try {
      const { data: paymentData, error } = await supabase
        .from("payments")
        .select(`
          id, enrollment_id, family_id, amount, currency,
          stripe_checkout_session_id, stripe_payment_intent_id,
          status, payment_method, description, created_at, completed_at,
          family:profiles!family_id(full_name),
          enrollment:enrollments(
            swimmer:swimmers(first_name, last_name),
            class:classes(level, start_time)
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const mapped: PaymentRecord[] = (paymentData ?? []).map((p: Record<string, unknown>) => {
        const family = Array.isArray(p.family) ? p.family[0] : p.family;
        const enrollment = Array.isArray(p.enrollment) ? p.enrollment[0] : p.enrollment;
        const swimmer = enrollment?.swimmer;
        const sw = Array.isArray(swimmer) ? swimmer[0] : swimmer;
        const cls = enrollment?.class;
        const cl = Array.isArray(cls) ? cls[0] : cls;

        return {
          id: p.id as string,
          enrollment_id: p.enrollment_id as string | null,
          family_id: p.family_id as string,
          amount: Number(p.amount),
          currency: (p.currency as string) ?? "usd",
          stripe_checkout_session_id: p.stripe_checkout_session_id as string | null,
          stripe_payment_intent_id: p.stripe_payment_intent_id as string | null,
          status: p.status as string,
          payment_method: p.payment_method as string,
          description: p.description as string | null,
          created_at: p.created_at as string,
          completed_at: p.completed_at as string | null,
          family_name: (family as { full_name: string })?.full_name ?? "Unknown",
          swimmer_name: sw ? `${sw.first_name} ${sw.last_name}` : null,
          class_level: cl?.level ?? null,
          class_time: cl?.start_time ?? null,
        };
      });

      setPayments(mapped);
    } catch {
      toast.error("Failed to load payments.", { duration: Infinity });
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Summary stats
  const stats = useMemo(() => {
    const completed = payments.filter((p) => p.status === "completed");
    const pending = payments.filter((p) => p.status === "pending");
    const refunded = payments.filter((p) => p.status === "refunded");

    return {
      totalRevenue: completed.reduce((sum, p) => sum + p.amount, 0),
      pendingCount: pending.length,
      pendingAmount: pending.reduce((sum, p) => sum + p.amount, 0),
      refundedCount: refunded.length,
      refundedAmount: refunded.reduce((sum, p) => sum + p.amount, 0),
    };
  }, [payments]);

  // Filtered payments
  const filtered = useMemo(() => {
    let result = payments;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.family_name.toLowerCase().includes(q) ||
          (p.swimmer_name ?? "").toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter);
    }
    if (methodFilter !== "all") {
      result = result.filter((p) => p.payment_method === methodFilter);
    }
    if (dateFrom) {
      result = result.filter((p) => p.created_at >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((p) => p.created_at <= dateTo + "T23:59:59");
    }

    return result;
  }, [payments, search, statusFilter, methodFilter, dateFrom, dateTo]);

  // Load unpaid enrollments for manual payment
  const loadEnrollmentOptions = async () => {
    setLoadingEnrollments(true);

    const { data } = await supabase
      .from("enrollments")
      .select(`
        id, swimmer_id,
        swimmer:swimmers(first_name, last_name, family_id),
        class:classes(level, day_of_week, start_time, session:sessions(name))
      `)
      .in("payment_status", ["pending"])
      .eq("status", "confirmed");

    const options: EnrollmentOption[] = (data ?? []).map((e: Record<string, unknown>) => {
      const swimmer = Array.isArray(e.swimmer) ? e.swimmer[0] : e.swimmer;
      const cls = Array.isArray(e.class) ? e.class[0] : e.class;
      const session = cls?.session;
      const sess = Array.isArray(session) ? session[0] : session;

      return {
        id: e.id as string,
        swimmer_name: swimmer ? `${swimmer.first_name} ${swimmer.last_name}` : "Unknown",
        level: cls?.level ?? 1,
        session_name: sess?.name ?? "Unknown",
        day_of_week: cls?.day_of_week ?? [],
        start_time: cls?.start_time ?? "",
        family_id: swimmer?.family_id ?? "",
      };
    });

    setEnrollmentOptions(options);
    setLoadingEnrollments(false);
  };

  const openManualPayment = () => {
    setManualForm({ enrollment_id: "", method: "cash", amount: "", note: "" });
    setManualOpen(true);
    loadEnrollmentOptions();
  };

  const saveManualPayment = async () => {
    if (!manualForm.enrollment_id || !manualForm.amount) {
      toast.error("Please select an enrollment and enter an amount.");
      return;
    }

    setSavingManual(true);
    try {
      const enrollment = enrollmentOptions.find((e) => e.id === manualForm.enrollment_id);
      if (!enrollment) throw new Error("Enrollment not found");

      // Create payment record
      const { error: payError } = await supabase.from("payments").insert({
        enrollment_id: manualForm.enrollment_id,
        family_id: enrollment.family_id,
        amount: parseFloat(manualForm.amount),
        status: "completed",
        payment_method: manualForm.method,
        description: manualForm.note || `Manual ${manualForm.method} payment`,
        completed_at: new Date().toISOString(),
      });

      if (payError) throw payError;

      // Update enrollment payment status
      const { error: enrollError } = await supabase
        .from("enrollments")
        .update({ payment_status: "paid" })
        .eq("id", manualForm.enrollment_id);

      if (enrollError) throw enrollError;

      toast.success("Manual payment recorded.");
      setManualOpen(false);
      fetchPayments();
    } catch {
      toast.error("Failed to record payment.");
    } finally {
      setSavingManual(false);
    }
  };

  const issueRefund = async () => {
    if (!refundPayment) return;
    setRefunding(true);

    try {
      // Update payment status
      const { error: payError } = await supabase
        .from("payments")
        .update({ status: "refunded" })
        .eq("id", refundPayment.id);

      if (payError) throw payError;

      // Update enrollment if linked
      if (refundPayment.enrollment_id) {
        await supabase
          .from("enrollments")
          .update({ payment_status: "refunded" })
          .eq("id", refundPayment.enrollment_id);
      }

      toast.success("Refund issued successfully.");
      setRefundPayment(null);
      fetchPayments();
    } catch {
      toast.error("Failed to issue refund.");
    } finally {
      setRefunding(false);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "refunded":
        return <Badge className="bg-red-100 text-red-800">Refunded</Badge>;
      case "failed":
        return <Badge className="bg-gray-100 text-gray-800">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const methodBadge = (method: string) => {
    switch (method) {
      case "stripe":
        return <Badge variant="outline" className="border-purple-300 text-purple-700">Stripe</Badge>;
      case "cash":
        return <Badge variant="outline" className="border-green-300 text-green-700">Cash</Badge>;
      case "check":
        return <Badge variant="outline" className="border-blue-300 text-blue-700">Check</Badge>;
      case "comp":
        return <Badge variant="outline" className="border-gray-300 text-gray-700">Comp</Badge>;
      default:
        return <Badge variant="outline">{method}</Badge>;
    }
  };

  if (loading) {
    return <AdminPageSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-green-100">
              <DollarSign className="size-6 text-green-700" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-yellow-100">
              <Clock className="size-6 text-yellow-700" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Payments</p>
              <p className="text-2xl font-bold">
                {stats.pendingCount}
                <span className="ml-1 text-base font-normal text-muted-foreground">
                  (${stats.pendingAmount.toFixed(2)})
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-red-100">
              <RefreshCcw className="size-6 text-red-700" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Refunds Issued</p>
              <p className="text-2xl font-bold">
                {stats.refundedCount}
                <span className="ml-1 text-base font-normal text-muted-foreground">
                  (${stats.refundedAmount.toFixed(2)})
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or ID..."
            className="pl-9"
          />
        </div>
        <div className="w-36">
          <Label className="mb-1 text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-36">
          <Label className="mb-1 text-xs">Method</Label>
          <Select value={methodFilter} onValueChange={(v) => v && setMethodFilter(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              <SelectItem value="stripe">Stripe</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="check">Check</SelectItem>
              <SelectItem value="comp">Comp</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-36">
          <Label className="mb-1 text-xs">From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="w-36">
          <Label className="mb-1 text-xs">To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <Button onClick={openManualPayment}>
          <Plus className="mr-1.5 size-4" />
          Record Manual Payment
        </Button>
      </div>

      {/* Payments Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead>Swimmer</TableHead>
              <TableHead>Class</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <EmptyState
                    icon={<DollarSign className="size-10" />}
                    title="No payments found"
                    description="Try adjusting your filters or search terms."
                  />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {format(new Date(p.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="font-medium">{p.family_name}</TableCell>
                  <TableCell>{p.swimmer_name ?? "—"}</TableCell>
                  <TableCell>
                    {p.class_level != null ? (
                      <span>L{p.class_level} {formatTime(p.class_time)}</span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ${p.amount.toFixed(2)}
                  </TableCell>
                  <TableCell>{methodBadge(p.payment_method)}</TableCell>
                  <TableCell>{statusBadge(p.status)}</TableCell>
                  <TableCell>
                    {p.status === "completed" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon" className="size-8" aria-label="Payment actions">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setRefundPayment(p)}>
                            <Ban className="mr-2 size-4" />
                            Issue Refund
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing {filtered.length} of {payments.length} payment{payments.length !== 1 ? "s" : ""}
      </p>

      {/* Record Manual Payment Dialog */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Manual Payment</DialogTitle>
            <DialogDescription>
              Record a cash, check, or comp payment for a pending enrollment.
            </DialogDescription>
          </DialogHeader>

          {loadingEnrollments ? (
            <div className="space-y-4 py-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-md" />
              ))}
            </div>
          ) : enrollmentOptions.length === 0 ? (
            <EmptyState
              icon={<DollarSign className="size-10" />}
              title="No pending enrollments"
              description="All enrollments have been paid."
            />
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Enrollment</Label>
                <Select
                  value={manualForm.enrollment_id}
                  onValueChange={(v) => v && setManualForm((f) => ({ ...f, enrollment_id: v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select enrollment..." />
                  </SelectTrigger>
                  <SelectContent>
                    {enrollmentOptions.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.swimmer_name} — L{e.level} {e.day_of_week.join(", ")} {formatTime(e.start_time)} ({e.session_name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Payment Method</Label>
                <Select
                  value={manualForm.method}
                  onValueChange={(v) => v && setManualForm((f) => ({ ...f, method: v as "cash" | "check" | "comp" }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="comp">Comp (Complimentary)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Amount ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualForm.amount}
                  onChange={(e) => setManualForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Note (optional)</Label>
                <Textarea
                  value={manualForm.note}
                  onChange={(e) => setManualForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="Check #1234, cash received by front desk, etc."
                  className="mt-1"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <DialogClose render={<Button variant="outline">Cancel</Button>} />
                <Button onClick={saveManualPayment} disabled={savingManual}>
                  {savingManual && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Record Payment
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Refund Confirmation Dialog */}
      <Dialog open={!!refundPayment} onOpenChange={(o) => !o && setRefundPayment(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Issue Refund?</DialogTitle>
            <DialogDescription>
              This will mark the payment as refunded and update the enrollment status.
              {refundPayment?.payment_method === "stripe" &&
                " You will still need to process the refund in the Stripe dashboard."}
            </DialogDescription>
          </DialogHeader>
          {refundPayment && (
            <div className="rounded-lg border p-3 text-sm">
              <p><strong>Parent:</strong> {refundPayment.family_name}</p>
              {refundPayment.swimmer_name && (
                <p><strong>Swimmer:</strong> {refundPayment.swimmer_name}</p>
              )}
              <p><strong>Amount:</strong> ${refundPayment.amount.toFixed(2)}</p>
              <p><strong>Method:</strong> {refundPayment.payment_method}</p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRefundPayment(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={issueRefund} disabled={refunding}>
              {refunding && <Loader2 className="mr-2 size-4 animate-spin" />}
              Confirm Refund
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
