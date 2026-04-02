"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  Building2,
  Users,
  ShieldCheck,
  Bell,
  UserCog,
  Loader2,
  Save,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { AdminPageSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineError } from "@/components/ui/inline-error";
import { inviteAdmin, removeAdmin } from "@/app/admin/settings/actions";

// Settings defaults
const DEFAULTS: Record<string, unknown> = {
  business_name: "Heights Athletic Club",
  business_email: "swim@hacswim.com",
  business_phone: "(254) 213-5543",
  business_address: { street: "", city: "", state: "", zip: "" },
  pool_season_start: 4,
  pool_season_end: 10,
  default_capacity_l1: 4,
  default_capacity_l2: 5,
  default_capacity_l3: 6,
  default_capacity_l4: 6,
  default_capacity_l5: 8,
  makeup_credit_limit: 2,
  makeup_expiry: "end_of_session",
  cancellation_notice_hours: 24,
  late_enrollment_allowed: true,
  google_review_url: "",
  facebook_review_url: "",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function AdminSettings() {
  const supabase = createClient();
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("general");

  const fetchSettings = useCallback(async () => {
    setError(null);
    try {
      const { data, error: fetchError } = await supabase.from("settings").select("key, value");
      if (fetchError) throw fetchError;
      if (data) {
        const map: Record<string, unknown> = { ...DEFAULTS };
        for (const row of data) {
          map[row.key] = row.value;
        }
        setSettings(map);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load settings.";
      setError(message);
      toast.error("Failed to load settings.", { duration: Infinity });
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const get = (key: string): unknown => settings[key] ?? DEFAULTS[key];
  const getStr = (key: string): string => {
    const v = get(key);
    if (typeof v === "string") return v;
    if (typeof v === "number") return String(v);
    return "";
  };
  const getNum = (key: string): number => Number(get(key)) || 0;
  const getBool = (key: string): boolean => get(key) === true;
  const getObj = (key: string): Record<string, string> => {
    const v = get(key);
    return typeof v === "object" && v !== null ? (v as Record<string, string>) : {};
  };

  const set = (key: string, value: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const saveKeys = async (keys: string[], overrides?: Record<string, unknown>) => {
    setSaving(true);
    let hasError = false;
    for (const key of keys) {
      const val = overrides?.[key] ?? settings[key] ?? DEFAULTS[key];
      const { error: upsertError } = await supabase
        .from("settings")
        .upsert({ key, value: val, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (upsertError) {
        hasError = true;
        console.error(`Failed to save setting "${key}":`, upsertError.message);
      }
    }
    if (hasError) {
      toast.error("Some settings failed to save. Check the console for details.");
    } else {
      toast.success("Settings saved.");
    }
    setSaving(false);
  };

  if (loading) {
    return <AdminPageSkeleton />;
  }

  if (error) {
    return <InlineError message={error} onRetry={fetchSettings} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Admin Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure your swim program settings.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="general"><Building2 className="mr-1 size-3.5" />General</TabsTrigger>
          <TabsTrigger value="classes"><Users className="mr-1 size-3.5" />Classes</TabsTrigger>
          <TabsTrigger value="policies"><ShieldCheck className="mr-1 size-3.5" />Policies</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="mr-1 size-3.5" />Notifications</TabsTrigger>
          <TabsTrigger value="admins"><UserCog className="mr-1 size-3.5" />Admins</TabsTrigger>
        </TabsList>

        {/* TAB 1 — GENERAL */}
        <TabsContent value="general">
          <Card>
            <CardHeader><h2 className="font-heading text-lg font-semibold">Organization</h2></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Organization Name</Label>
                <Input value={getStr("business_name")} onChange={(e) => set("business_name", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input value={getStr("business_email")} onChange={(e) => set("business_email", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Contact Phone</Label>
                  <Input value={getStr("business_phone")} onChange={(e) => set("business_phone", e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Street"
                    value={getObj("business_address").street ?? ""}
                    onChange={(e) => set("business_address", { ...getObj("business_address"), street: e.target.value })}
                    className="col-span-2"
                  />
                  <Input
                    placeholder="City"
                    value={getObj("business_address").city ?? ""}
                    onChange={(e) => set("business_address", { ...getObj("business_address"), city: e.target.value })}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="State"
                      value={getObj("business_address").state ?? ""}
                      onChange={(e) => set("business_address", { ...getObj("business_address"), state: e.target.value })}
                    />
                    <Input
                      placeholder="ZIP"
                      value={getObj("business_address").zip ?? ""}
                      onChange={(e) => set("business_address", { ...getObj("business_address"), zip: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Pool Season Start</Label>
                  <Select value={String(getNum("pool_season_start"))} onValueChange={(v) => v && set("pool_season_start", Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Pool Season End</Label>
                  <Select value={String(getNum("pool_season_end"))} onValueChange={(v) => v && set("pool_season_end", Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Google Review URL</Label>
                  <Input value={getStr("google_review_url")} onChange={(e) => set("google_review_url", e.target.value)} placeholder="https://g.page/..." />
                </div>
                <div className="space-y-2">
                  <Label>Facebook Review URL</Label>
                  <Input value={getStr("facebook_review_url")} onChange={(e) => set("facebook_review_url", e.target.value)} placeholder="https://facebook.com/..." />
                </div>
              </div>
              <SaveButton saving={saving} onClick={() => saveKeys(["business_name", "business_email", "business_phone", "business_address", "pool_season_start", "pool_season_end", "google_review_url", "facebook_review_url"])} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2 — CLASS DEFAULTS */}
        <TabsContent value="classes">
          <Card>
            <CardHeader><h2 className="font-heading text-lg font-semibold">Default Class Capacity by Level</h2></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                These defaults are used when creating new classes.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Level</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-32">Default Capacity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { level: 1, name: "Water Introduction" },
                    { level: 2, name: "Beginner" },
                    { level: 3, name: "Intermediate" },
                    { level: 4, name: "Advanced" },
                    { level: 5, name: "Pre-Competitive" },
                  ].map((l) => (
                    <TableRow key={l.level}>
                      <TableCell>
                        <Badge variant="outline">L{l.level}</Badge>
                      </TableCell>
                      <TableCell>{l.name}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          className="w-20"
                          value={getNum(`default_capacity_l${l.level}`)}
                          onChange={(e) => set(`default_capacity_l${l.level}`, Number(e.target.value))}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <SaveButton saving={saving} onClick={() => saveKeys([1, 2, 3, 4, 5].map((l) => `default_capacity_l${l}`))} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4 — POLICIES */}
        <TabsContent value="policies">
          <Card>
            <CardHeader><h2 className="font-heading text-lg font-semibold">Program Policies</h2></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Make-up Credit Limit</Label>
                  <Input type="number" min={0} max={10} value={getNum("makeup_credit_limit")} onChange={(e) => set("makeup_credit_limit", Number(e.target.value))} />
                  <p className="text-xs text-muted-foreground">Max make-up credits per session per swimmer.</p>
                </div>
                <div className="space-y-2">
                  <Label>Make-up Expiry</Label>
                  <Select value={getStr("makeup_expiry")} onValueChange={(v) => v && set("makeup_expiry", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="end_of_session">End of Session</SelectItem>
                      <SelectItem value="30d">30 Days</SelectItem>
                      <SelectItem value="60d">60 Days</SelectItem>
                      <SelectItem value="never">Never</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cancellation Notice (hours)</Label>
                <Input type="number" min={0} max={168} value={getNum("cancellation_notice_hours")} onChange={(e) => set("cancellation_notice_hours", Number(e.target.value))} />
                <p className="text-xs text-muted-foreground">Hours of notice required before session start.</p>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="text-sm font-medium">Allow Late Enrollment</p>
                  <p className="text-xs text-muted-foreground">Allow enrollment after a session has started.</p>
                </div>
                <Switch checked={getBool("late_enrollment_allowed")} onCheckedChange={(v) => set("late_enrollment_allowed", v)} />
              </div>
              <SaveButton saving={saving} onClick={() => saveKeys(["makeup_credit_limit", "makeup_expiry", "cancellation_notice_hours", "late_enrollment_allowed"])} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5 — NOTIFICATIONS */}
        <TabsContent value="notifications">
          <NotificationTemplatesTab settings={settings} set={set} getStr={getStr} saveKeys={saveKeys} saving={saving} />
        </TabsContent>

        {/* TAB 7 — ADMINS */}
        <TabsContent value="admins">
          <AdminManagementTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SaveButton({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <Button onClick={onClick} disabled={saving}>
      {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
      Save Changes
    </Button>
  );
}

/* ── NOTIFICATION TEMPLATES TAB ── */
const TEMPLATE_KEYS = [
  { key: "tpl_enrollment_confirmed", label: "Enrollment Confirmed", defaultSubject: "Enrollment confirmed: {{swimmer_name}}", defaultBody: "{{swimmer_name}} is enrolled in {{session_name}} (Level {{level}})." },
  { key: "tpl_weather_cancellation", label: "Weather Cancellation", defaultSubject: "Class cancelled — {{date}}", defaultBody: "{{swimmer_name}}'s class on {{date}} has been cancelled due to weather. A make-up credit has been added." },
  { key: "tpl_waitlist_promoted", label: "Waitlist Promoted", defaultSubject: "A spot opened up!", defaultBody: "A spot opened up for {{swimmer_name}} in {{session_name}}. The enrollment is now confirmed." },
  { key: "tpl_lesson_reminder", label: "Lesson Reminder", defaultSubject: "Swim lesson tomorrow!", defaultBody: "{{swimmer_name}} has swim lessons tomorrow at {{time}}. Don't forget a towel and goggles!" },
  { key: "tpl_level_promotion", label: "Level Promotion", defaultSubject: "{{swimmer_name}} leveled up!", defaultBody: "Congratulations! {{swimmer_name}} has been promoted to Level {{new_level}}: {{level_name}}. Great progress!" },
];

function NotificationTemplatesTab({
  settings, set, getStr, saveKeys, saving,
}: {
  settings: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
  getStr: (k: string) => string;
  saveKeys: (keys: string[]) => Promise<void>;
  saving: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  const getTemplate = (key: string, field: "subject" | "body") => {
    const val = settings[`${key}_${field}`];
    if (typeof val === "string") return val;
    const tpl = TEMPLATE_KEYS.find((t) => t.key === key);
    return field === "subject" ? (tpl?.defaultSubject ?? "") : (tpl?.defaultBody ?? "");
  };

  const setTemplate = (key: string, field: "subject" | "body", value: string) => {
    set(`${key}_${field}`, value);
  };

  const resetTemplate = (key: string) => {
    const tpl = TEMPLATE_KEYS.find((t) => t.key === key);
    if (tpl) {
      set(`${key}_subject`, tpl.defaultSubject);
      set(`${key}_body`, tpl.defaultBody);
    }
  };

  const allKeys = TEMPLATE_KEYS.flatMap((t) => [`${t.key}_subject`, `${t.key}_body`]);

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-lg font-semibold">Email Templates</h2>
        <p className="text-xs text-muted-foreground">
          Available merge tags: {"{{swimmer_name}}, {{session_name}}, {{level}}, {{date}}, {{time}}, {{new_level}}, {{level_name}}"}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {TEMPLATE_KEYS.map((tpl) => (
          <div key={tpl.key} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{tpl.label}</h3>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setPreview(preview === tpl.key ? null : tpl.key)}>
                  {preview === tpl.key ? "Hide Preview" : "Preview"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => resetTemplate(tpl.key)}>
                  Reset
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Subject</Label>
              <Input
                value={getTemplate(tpl.key, "subject")}
                onChange={(e) => setTemplate(tpl.key, "subject", e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Body</Label>
              <Textarea
                value={getTemplate(tpl.key, "body")}
                onChange={(e) => setTemplate(tpl.key, "body", e.target.value)}
                rows={3}
                className="text-sm"
              />
            </div>
            {preview === tpl.key && (
              <div className="rounded-lg bg-muted p-3 text-sm">
                <p className="font-medium">
                  {getTemplate(tpl.key, "subject")
                    .replace(/\{\{swimmer_name\}\}/g, "Alex Smith")
                    .replace(/\{\{session_name\}\}/g, "Summer 2026")
                    .replace(/\{\{level\}\}/g, "3")
                    .replace(/\{\{date\}\}/g, "March 25, 2026")
                    .replace(/\{\{time\}\}/g, "9:00 AM")
                    .replace(/\{\{new_level\}\}/g, "4")
                    .replace(/\{\{level_name\}\}/g, "Advanced")}
                </p>
                <p className="mt-2 text-muted-foreground">
                  {getTemplate(tpl.key, "body")
                    .replace(/\{\{swimmer_name\}\}/g, "Alex Smith")
                    .replace(/\{\{session_name\}\}/g, "Summer 2026")
                    .replace(/\{\{level\}\}/g, "3")
                    .replace(/\{\{date\}\}/g, "March 25, 2026")
                    .replace(/\{\{time\}\}/g, "9:00 AM")
                    .replace(/\{\{new_level\}\}/g, "4")
                    .replace(/\{\{level_name\}\}/g, "Advanced")}
                </p>
              </div>
            )}
          </div>
        ))}
        <SaveButton saving={saving} onClick={() => saveKeys(allKeys)} />
      </CardContent>
    </Card>
  );
}

/* ── ADMIN MANAGEMENT TAB ── */
function AdminManagementTab() {
  const supabase = createClient();
  const [admins, setAdmins] = useState<{ id: string; full_name: string; email: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, created_at")
      .eq("role", "admin")
      .order("created_at");

    if (data) {
      // Get emails from auth — we'll use the profile data available
      setAdmins(data.map((a) => ({
        id: a.id,
        full_name: a.full_name ?? "Unknown",
        email: "", // Will be shown as profile ID since we can't access auth.users from client
        created_at: a.created_at,
      })));
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !inviteName.trim()) {
      toast.error("Name and email are required.");
      return;
    }
    setInviting(true);
    const result = await inviteAdmin(inviteEmail.trim(), inviteName.trim());
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`${inviteName} invited as admin. They'll receive a password reset email.`);
      setDialogOpen(false);
      setInviteName("");
      setInviteEmail("");
      await fetchAdmins();
    }
    setInviting(false);
  };

  const handleRemove = async (id: string, name: string) => {
    if (!confirm(`Remove admin access for ${name}? Their admin privileges will be revoked.`)) return;
    const result = await removeAdmin(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`${name} removed from admins.`);
      await fetchAdmins();
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Admin Users</h2>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <UserCog className="mr-2 size-4" />
            Invite Admin
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Since</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.full_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {a.id.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRemove(a.id, a.full_name)}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Admin</DialogTitle>
            <DialogDescription>
              Create a new admin account. They&apos;ll receive a password reset email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Jane Smith" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="admin@hacswim.com" />
            </div>
            <Button onClick={handleInvite} disabled={inviting} className="w-full">
              {inviting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Send Invite
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
