"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  User,
  Bell,
  Key,
  Users,
  CreditCard,
  Shield,
  AlertTriangle,
  Loader2,
  Download,
  CheckCircle,
  Clock,
  XCircle,
  Pencil,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { CardSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineError } from "@/components/ui/inline-error";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useSwimmers, type SwimmerRow, type WaiverRow } from "@/hooks/useSwimmers";
import { getLevelColor, getLevelTextColor, getLevelName } from "@/lib/swim-utils";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import Link from "next/link";

function getPasswordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  if (score <= 1) return { score: 20, label: "Weak" };
  if (score === 2) return { score: 40, label: "Fair" };
  if (score === 3) return { score: 60, label: "Good" };
  if (score === 4) return { score: 80, label: "Strong" };
  return { score: 100, label: "Very Strong" };
}

export function AccountSettings() {
  const [tab, setTab] = useState("profile");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 font-heading text-2xl font-bold">Account Settings</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="profile">
            <User className="mr-1.5 size-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="mr-1.5 size-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="password">
            <Key className="mr-1.5 size-4" />
            Password
          </TabsTrigger>
          <TabsTrigger value="swimmers">
            <Users className="mr-1.5 size-4" />
            Swimmers
          </TabsTrigger>
          <TabsTrigger value="payments">
            <CreditCard className="mr-1.5 size-4" />
            Payments
          </TabsTrigger>
          <TabsTrigger value="waivers">
            <Shield className="mr-1.5 size-4" />
            Waivers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile"><ProfileSection /></TabsContent>
        <TabsContent value="notifications"><NotificationsSection /></TabsContent>
        <TabsContent value="password"><PasswordSection /></TabsContent>
        <TabsContent value="swimmers"><SwimmersSection /></TabsContent>
        <TabsContent value="payments"><PaymentsSection /></TabsContent>
        <TabsContent value="waivers"><WaiversSection /></TabsContent>
      </Tabs>

      {/* Danger Zone always visible */}
      <div className="mt-12">
        <DangerZone />
      </div>
    </div>
  );
}

/* ── PROFILE ── */
function ProfileSection() {
  const { user, profile, refreshProfile } = useAuthContext();
  const supabase = createClient();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [hacMemberId, setHacMemberId] = useState(profile?.hac_member_id ?? "");
  const [isMilitary, setIsMilitary] = useState(profile?.is_military ?? false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
      setHacMemberId(profile.hac_member_id ?? "");
      setIsMilitary(profile.is_military ?? false);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        hac_member_id: hacMemberId.trim() || null,
        is_military: isMilitary,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      console.error("Profile update error:", error);
      toast.error(`Failed to update profile: ${error.message}`);
    } else {
      toast.success("Profile updated.");
      await refreshProfile();
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-lg font-semibold">Profile Information</h2>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={user?.email ?? ""} readOnly className="bg-muted" />
          <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="(254) 555-0123"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="hacId">HAC Member ID</Label>
          <Input
            id="hacId"
            placeholder="HAC-12345"
            value={hacMemberId}
            onChange={(e) => setHacMemberId(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Enter your membership number for member pricing.
          </p>
        </div>

        <div className="flex items-start gap-3">
          <Checkbox
            id="military"
            checked={isMilitary}
            onCheckedChange={(checked) => setIsMilitary(checked === true)}
            className="mt-0.5"
          />
          <Label htmlFor="military" className="text-sm leading-snug">
            I am active duty military or a dependent stationed at Fort Cavazos
          </Label>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}

/* ── NOTIFICATIONS ── */
function NotificationsSection() {
  const { user } = useAuthContext();
  const supabase = createClient();
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [smsNotifs, setSmsNotifs] = useState(false);
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("email_notifications, sms_notifications, marketing_emails, phone_verified")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setEmailNotifs(data.email_notifications ?? true);
          setSmsNotifs(data.sms_notifications ?? false);
          setMarketingEmails(data.marketing_emails ?? false);
          setPhoneVerified(data.phone_verified ?? false);
        }
        setLoaded(true);
      });
  }, [user, supabase]);

  const save = async (updates: Record<string, boolean>) => {
    if (!user) return;
    setSaving(true);
    await supabase.from("profiles").update(updates).eq("id", user.id);
    toast.success("Preferences updated.");
    setSaving(false);
  };

  if (!loaded) return <CardSkeleton />;

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-lg font-semibold">Notification Preferences</h2>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Email Notifications</p>
            <p className="text-xs text-muted-foreground">
              Enrollment confirmations, lesson reminders, weather alerts
            </p>
          </div>
          <Switch
            checked={emailNotifs}
            onCheckedChange={(v) => {
              setEmailNotifs(v);
              save({ email_notifications: v });
            }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">SMS Notifications</p>
            <p className="text-xs text-muted-foreground">
              Text alerts for cancellations and urgent updates
            </p>
            {!phoneVerified && smsNotifs && (
              <p className="mt-1 text-xs text-yellow-600">
                Phone verification required to receive SMS.
              </p>
            )}
          </div>
          <Switch
            checked={smsNotifs}
            onCheckedChange={(v) => {
              setSmsNotifs(v);
              save({ sms_notifications: v });
            }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Marketing Emails</p>
            <p className="text-xs text-muted-foreground">
              Promotions, new sessions, events, and program updates
            </p>
          </div>
          <Switch
            checked={marketingEmails}
            onCheckedChange={(v) => {
              setMarketingEmails(v);
              save({ marketing_emails: v });
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/* ── PASSWORD ── */
function PasswordSection() {
  const supabase = createClient();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);

  const strength = useMemo(() => getPasswordStrength(newPw), [newPw]);

  const handleChange = async () => {
    if (!newPw || newPw.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("Passwords do not match.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password changed successfully.");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-lg font-semibold">Change Password</h2>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="currentPw">Current Password</Label>
          <Input
            id="currentPw"
            type="password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="newPw">New Password</Label>
          <Input
            id="newPw"
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            autoComplete="new-password"
            minLength={8}
          />
          {newPw.length > 0 && (
            <div className="space-y-1">
              <Progress value={strength.score} className="h-1.5" />
              <p className="text-xs text-muted-foreground">Strength: {strength.label}</p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPw">Confirm New Password</Label>
          <Input
            id="confirmPw"
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            autoComplete="new-password"
          />
          {confirmPw && newPw !== confirmPw && (
            <p className="text-xs text-destructive">Passwords do not match.</p>
          )}
        </div>

        <Button onClick={handleChange} disabled={saving || !newPw || !confirmPw}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          Update Password
        </Button>
      </CardContent>
    </Card>
  );
}

/* ── SWIMMERS ── */
function SwimmersSection() {
  const supabase = createClient();
  const { swimmers, fetchSwimmers } = useSwimmers();
  const [editSwimmer, setEditSwimmer] = useState<SwimmerRow | null>(null);
  const [deactivating, setDeactivating] = useState<string | null>(null);

  // Edit form state
  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");
  const [editDob, setEditDob] = useState("");
  const [editMedical, setEditMedical] = useState("");
  const [editEcName, setEditEcName] = useState("");
  const [editEcPhone, setEditEcPhone] = useState("");
  const [editEcRelation, setEditEcRelation] = useState("");
  const [saving, setSaving] = useState(false);

  const openEdit = (s: SwimmerRow) => {
    setEditSwimmer(s);
    setEditFirst(s.first_name);
    setEditLast(s.last_name);
    setEditDob(s.date_of_birth);
    setEditMedical(s.medical_notes ?? "");
    setEditEcName(s.emergency_contact_name ?? "");
    setEditEcPhone(s.emergency_contact_phone ?? "");
    setEditEcRelation(s.emergency_contact_relationship ?? "");
  };

  const handleSaveSwimmer = async () => {
    if (!editSwimmer) return;
    setSaving(true);
    const { error } = await supabase
      .from("swimmers")
      .update({
        first_name: editFirst.trim(),
        last_name: editLast.trim(),
        date_of_birth: editDob,
        medical_notes: editMedical.trim() || null,
        emergency_contact_name: editEcName.trim() || null,
        emergency_contact_phone: editEcPhone.trim() || null,
        emergency_contact_relationship: editEcRelation.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editSwimmer.id);

    if (error) {
      toast.error("Failed to update swimmer.");
    } else {
      toast.success(`${editFirst} updated.`);
      setEditSwimmer(null);
      await fetchSwimmers();
    }
    setSaving(false);
  };

  const handleDeactivate = async (id: string, name: string) => {
    setDeactivating(id);
    const { error } = await supabase
      .from("swimmers")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast.error("Failed to deactivate swimmer.");
    } else {
      toast.success(`${name} has been deactivated.`);
      await fetchSwimmers();
    }
    setDeactivating(null);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <h2 className="font-heading text-lg font-semibold">My Swimmers</h2>
        </CardHeader>
        <CardContent>
          {swimmers.length === 0 ? (
            <EmptyState
              icon={<Users className="size-10" />}
              title="No Swimmers"
              description="No swimmers on your account yet. Add a swimmer from the dashboard to get started."
            />
          ) : (
            <div className="space-y-3">
              {swimmers.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex size-10 items-center justify-center rounded-full text-sm font-bold"
                      style={{ backgroundColor: getLevelColor(s.current_level), color: getLevelTextColor(s.current_level) }}
                    >
                      L{s.current_level}
                    </div>
                    <div>
                      <p className="font-medium">
                        {s.first_name} {s.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getLevelName(s.current_level)} • DOB:{" "}
                        {format(parseISO(s.date_of_birth), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(s)}>
                      <Pencil className="mr-1 size-3" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={deactivating === s.id}
                      onClick={() => {
                        if (confirm(`Deactivate ${s.first_name}? This cannot be easily undone.`)) {
                          handleDeactivate(s.id, s.first_name);
                        }
                      }}
                    >
                      {deactivating === s.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        "Deactivate"
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editSwimmer} onOpenChange={(o) => !o && setEditSwimmer(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Swimmer</DialogTitle>
            <DialogDescription>Update swimmer information.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>First Name</Label>
                <Input value={editFirst} onChange={(e) => setEditFirst(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Last Name</Label>
                <Input value={editLast} onChange={(e) => setEditLast(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Date of Birth</Label>
              <Input type="date" value={editDob} onChange={(e) => setEditDob(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Medical Notes</Label>
              <Textarea
                value={editMedical}
                onChange={(e) => setEditMedical(e.target.value)}
                placeholder="Allergies, conditions, etc."
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <Label>Emergency Contact Name</Label>
              <Input value={editEcName} onChange={(e) => setEditEcName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Emergency Phone</Label>
                <Input value={editEcPhone} onChange={(e) => setEditEcPhone(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Relationship</Label>
                <Input
                  value={editEcRelation}
                  onChange={(e) => setEditEcRelation(e.target.value)}
                  placeholder="Parent, Guardian..."
                />
              </div>
            </div>
            <Button onClick={handleSaveSwimmer} disabled={saving} className="w-full">
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ── PAYMENTS ── */
interface PaymentRow {
  id: string;
  description: string | null;
  amount: number;
  status: string;
  payment_method: string;
  stripe_checkout_session_id: string | null;
  created_at: string;
  completed_at: string | null;
}

function PaymentsSection() {
  const { user } = useAuthContext();
  const supabase = createClient();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from("payments")
        .select("id, description, amount, status, payment_method, stripe_checkout_session_id, created_at, completed_at")
        .eq("family_id", user.id)
        .order("created_at", { ascending: false });
      if (fetchErr) throw fetchErr;
      setPayments(data ?? []);
    } catch {
      setError("Failed to load payment history.");
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const statusIcon = (s: string) => {
    switch (s) {
      case "completed":
        return <CheckCircle className="size-4 text-green-500" />;
      case "pending":
        return <Clock className="size-4 text-yellow-500" />;
      case "refunded":
        return <XCircle className="size-4 text-blue-500" />;
      default:
        return <XCircle className="size-4 text-red-500" />;
    }
  };

  const exportCSV = () => {
    const headers = ["Date", "Description", "Amount", "Status", "Method"];
    const rows = payments.map((p) => [
      format(parseISO(p.created_at), "yyyy-MM-dd"),
      `"${(p.description ?? "").replace(/"/g, '""')}"`,
      Number(p.amount).toFixed(2),
      p.status,
      p.payment_method,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payment-history-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <TableSkeleton rows={4} cols={5} />;
  }

  if (error) {
    return <InlineError message={error} onRetry={fetchPayments} />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <h2 className="font-heading text-lg font-semibold">Payment History</h2>
        {payments.length > 0 && (
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="mr-1 size-3" />
            CSV
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Method</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No payments yet.
                </TableCell>
              </TableRow>
            ) : (
              payments.map((p) => (
                <React.Fragment key={p.id}>
                  <TableRow>
                    <TableCell className="text-xs">
                      {format(parseISO(p.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {p.description ?? "Payment"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${Number(p.amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {statusIcon(p.status)}
                        <span className="text-xs capitalize">{p.status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs capitalize">{p.payment_method}</TableCell>
                    <TableCell>
                      {p.stripe_checkout_session_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setExpanded(expanded === p.id ? null : p.id)
                          }
                        >
                          {expanded === p.id ? (
                            <ChevronUp className="size-4" />
                          ) : (
                            <ChevronDown className="size-4" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {expanded === p.id && p.stripe_checkout_session_id && (
                    <TableRow>
                      <TableCell colSpan={6} className="bg-muted/50 text-xs">
                        <div className="flex items-center gap-2 py-1">
                          <span className="text-muted-foreground">
                            Stripe Session: {p.stripe_checkout_session_id}
                          </span>
                          {p.completed_at && (
                            <span className="text-muted-foreground">
                              • Completed: {format(parseISO(p.completed_at), "MMM d, yyyy h:mm a")}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ── WAIVERS ── */
function WaiversSection() {
  const { swimmers, waivers, fetchSwimmers } = useSwimmers();

  const getWaiver = (swimmerId: string): WaiverRow | undefined =>
    waivers.find((w) => w.swimmer_id === swimmerId);

  const getStatus = (w: WaiverRow | undefined) => {
    if (!w || !w.signed_at) return "required";
    if (w.expires_at) {
      const exp = new Date(w.expires_at);
      if (exp < new Date()) return "expired";
      const thirtyDays = new Date();
      thirtyDays.setDate(thirtyDays.getDate() + 30);
      if (exp < thirtyDays) return "expiring";
    }
    return "active";
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-lg font-semibold">Waiver Management</h2>
      </CardHeader>
      <CardContent>
        {swimmers.length === 0 ? (
          <EmptyState
            icon={<Shield className="size-10" />}
            title="No Swimmers"
            description="Add swimmers to your account to manage their waivers."
          />
        ) : (
          <div className="space-y-3">
            {swimmers.map((s) => {
              const waiver = getWaiver(s.id);
              const status = getStatus(waiver);

              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div>
                    <p className="font-medium">
                      {s.first_name} {s.last_name}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      {status === "active" && (
                        <>
                          <Badge className="bg-green-100 text-green-800 text-[10px]">Active</Badge>
                          <span>
                            Signed {waiver?.signed_at && format(parseISO(waiver.signed_at), "MMM d, yyyy")}
                          </span>
                          {waiver?.expires_at && (
                            <span>
                              • Expires {format(parseISO(waiver.expires_at), "MMM d, yyyy")}
                            </span>
                          )}
                        </>
                      )}
                      {status === "expiring" && (
                        <>
                          <Badge className="bg-yellow-100 text-yellow-800 text-[10px]">
                            Expiring Soon
                          </Badge>
                          {waiver?.expires_at && (
                            <span>
                              Expires {format(parseISO(waiver.expires_at), "MMM d, yyyy")}
                            </span>
                          )}
                        </>
                      )}
                      {status === "expired" && (
                        <Badge variant="destructive" className="text-[10px]">Expired</Badge>
                      )}
                      {status === "required" && (
                        <Badge variant="destructive" className="text-[10px]">Not Signed</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {waiver && status === "active" && (
                      <Link href={`/waiver/${s.id}`}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                    )}
                    {(status === "required" || status === "expired" || status === "expiring") && (
                      <Link href={`/waiver/${s.id}`}>
                        <Button size="sm">
                          {status === "required" ? "Sign Waiver" : "Renew"}
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── DANGER ZONE ── */
function DangerZone() {
  const { user, signOut } = useAuthContext();
  const supabase = createClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirmText !== "DELETE" || !user) return;
    setDeleting(true);

    // Soft-delete: deactivate profile and all swimmers
    await supabase
      .from("swimmers")
      .update({ is_active: false })
      .eq("family_id", user.id);

    await supabase
      .from("profiles")
      .update({
        full_name: "[Deleted Account]",
        phone: null,
        hac_member_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    toast.success("Account deactivated. Signing out...");
    setDeleting(false);
    setConfirmOpen(false);

    setTimeout(() => signOut(), 1500);
  };

  return (
    <>
      <Card className="border-destructive/30">
        <CardHeader>
          <h2 className="font-heading text-lg font-semibold text-destructive">Danger Zone</h2>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Delete My Account</p>
              <p className="text-xs text-muted-foreground">
                Permanently deactivate your account and all associated data.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmOpen(true)}
            >
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              Delete Your Account
            </DialogTitle>
            <DialogDescription>
              This will deactivate your account, remove your swimmers from active classes,
              and prevent future logins. This action cannot be easily reversed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                Type <strong>DELETE</strong> to confirm
              </Label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE"
                className="font-mono"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmText("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={confirmText !== "DELETE" || deleting}
                onClick={handleDelete}
              >
                {deleting && <Loader2 className="mr-2 size-4 animate-spin" />}
                Delete My Account
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
