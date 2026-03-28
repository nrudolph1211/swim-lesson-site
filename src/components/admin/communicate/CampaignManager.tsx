"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  Send,
  Eye,
  Clock,
  Users,
  Mail,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

type AudienceType = "all_active" | "by_level" | "by_session" | "by_class" | "waitlisted" | "inactive";

interface Campaign {
  id: string;
  subject: string;
  body_html: string;
  audience_type: string;
  audience_filter: Record<string, unknown> | null;
  recipient_count: number;
  status: string;
  scheduled_for: string | null;
  sent_at: string | null;
  created_at: string;
}

interface SessionOption {
  id: string;
  name: string;
}

interface ClassOption {
  id: string;
  label: string;
}

export function CampaignManager() {
  const supabase = createClient();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  // Compose state
  const [step, setStep] = useState(0); // 0 = history, 1 = audience, 2 = compose, 3 = preview
  const [audienceType, setAudienceType] = useState<AudienceType>("all_active");
  const [audienceLevel, setAudienceLevel] = useState("1");
  const [audienceSessionId, setAudienceSessionId] = useState("");
  const [audienceClassId, setAudienceClassId] = useState("");
  const [recipientCount, setRecipientCount] = useState(0);
  const [countLoading, setCountLoading] = useState(false);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [scheduleFor, setScheduleFor] = useState("");
  const [sending, setSending] = useState(false);

  // Options
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    setCampaigns((data ?? []) as Campaign[]);
    setLoading(false);
  }, [supabase]);

  const fetchOptions = useCallback(async () => {
    const { data: sessionData } = await supabase
      .from("sessions")
      .select("id, name")
      .order("start_date", { ascending: false });
    setSessions((sessionData ?? []) as SessionOption[]);

    const { data: classData } = await supabase
      .from("classes")
      .select("id, level, day_of_week, start_time, session:sessions(name)")
      .eq("is_active", true);
    setClassOptions(
      (classData ?? []).map((c: Record<string, unknown>) => {
        const sess = Array.isArray(c.session) ? c.session[0] : c.session;
        return {
          id: c.id as string,
          label: `L${c.level} ${(c.day_of_week as string[]).join(",")} ${(c.start_time as string).slice(0, 5)} (${(sess as { name: string })?.name ?? ""})`,
        };
      })
    );
  }, [supabase]);

  useEffect(() => {
    fetchCampaigns();
    fetchOptions();
  }, [fetchCampaigns, fetchOptions]);

  // Count recipients based on audience selection
  const countRecipients = useCallback(async () => {
    setCountLoading(true);

    let query = supabase.from("class_assignments").select("swimmer:swimmers(family_id)", { count: "exact", head: true });

    switch (audienceType) {
      case "all_active":
        query = query.eq("status", "active");
        break;
      case "by_level": {
        // Join through classes to filter by level
        const levelNum = parseInt(audienceLevel);
        const { data: levelClassIds } = await supabase
          .from("classes")
          .select("id")
          .eq("level", levelNum)
          .eq("is_active", true);
        const lcIds = (levelClassIds ?? []).map((c) => c.id);
        if (lcIds.length > 0) {
          query = query.in("class_id", lcIds).eq("status", "active");
        } else {
          setRecipientCount(0);
          setCountLoading(false);
          return;
        }
        break;
      }
      case "by_session": {
        if (audienceSessionId) {
          // Join through classes to filter by session
          const { data: sessClassIds } = await supabase
            .from("classes")
            .select("id")
            .eq("session_id", audienceSessionId)
            .eq("is_active", true);
          const scIds = (sessClassIds ?? []).map((c) => c.id);
          if (scIds.length > 0) {
            query = query.in("class_id", scIds).eq("status", "active");
          } else {
            setRecipientCount(0);
            setCountLoading(false);
            return;
          }
        }
        break;
      }
      case "by_class":
        if (audienceClassId) {
          query = query.eq("class_id", audienceClassId).eq("status", "active");
        }
        break;
      case "waitlisted":
        // No waitlist in class_assignments, return 0
        setRecipientCount(0);
        setCountLoading(false);
        return;
      case "inactive":
        query = query.eq("status", "dropped");
        break;
    }

    const { count } = await query;
    setRecipientCount(count ?? 0);
    setCountLoading(false);
  }, [supabase, audienceType, audienceSessionId, audienceClassId, audienceLevel]);

  useEffect(() => {
    if (step === 1) {
      countRecipients();
    }
  }, [step, audienceType, audienceSessionId, audienceClassId, audienceLevel, countRecipients]);

  // Merge tags
  const mergeTags = [
    { tag: "{parent_name}", description: "Parent's full name" },
    { tag: "{swimmer_name}", description: "Swimmer's name" },
    { tag: "{level}", description: "Swim level" },
    { tag: "{session_name}", description: "Session name" },
  ];

  const previewHtml = useMemo(() => {
    return bodyHtml
      .replace(/\{parent_name\}/g, "Jane Smith")
      .replace(/\{swimmer_name\}/g, "Tommy Smith")
      .replace(/\{level\}/g, "3")
      .replace(/\{session_name\}/g, "Summer 2026");
  }, [bodyHtml]);

  const startCompose = () => {
    setStep(1);
    setAudienceType("all_active");
    setSubject("");
    setBodyHtml("");
    setScheduleFor("");
  };

  const handleSend = async (scheduled: boolean) => {
    if (!subject.trim()) {
      toast.error("Please enter a subject.");
      return;
    }
    if (!bodyHtml.trim()) {
      toast.error("Please enter a message body.");
      return;
    }

    setSending(true);
    try {
      const filter: Record<string, unknown> = { type: audienceType };
      if (audienceType === "by_level") filter.level = parseInt(audienceLevel);
      if (audienceType === "by_session") filter.session_id = audienceSessionId;
      if (audienceType === "by_class") filter.class_id = audienceClassId;

      const { error } = await supabase.from("campaigns").insert({
        subject,
        body_html: bodyHtml,
        audience_type: audienceType,
        audience_filter: filter,
        recipient_count: recipientCount,
        status: scheduled ? "scheduled" : "sending",
        scheduled_for: scheduled && scheduleFor ? new Date(scheduleFor).toISOString() : null,
        sent_at: scheduled ? null : new Date().toISOString(),
      });

      if (error) throw error;

      toast.success(scheduled ? "Campaign scheduled!" : "Campaign sent!");
      setStep(0);
      fetchCampaigns();
    } catch {
      toast.error("Failed to create campaign.");
    } finally {
      setSending(false);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-green-100 text-green-800">Sent</Badge>;
      case "sending":
        return <Badge className="bg-blue-100 text-blue-800">Sending</Badge>;
      case "scheduled":
        return <Badge className="bg-yellow-100 text-yellow-800">Scheduled</Badge>;
      case "draft":
        return <Badge variant="outline">Draft</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading && step === 0) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Step 1: Audience selection
  if (step === 1) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Step 1: Select Audience</h2>
          <Button variant="ghost" onClick={() => setStep(0)}>Cancel</Button>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Audience</Label>
            <Select value={audienceType} onValueChange={(v) => v && setAudienceType(v as AudienceType)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all_active">All Active Families</SelectItem>
                <SelectItem value="by_level">By Level</SelectItem>
                <SelectItem value="by_session">By Session</SelectItem>
                <SelectItem value="by_class">By Class</SelectItem>
                <SelectItem value="waitlisted">Waitlisted</SelectItem>
                <SelectItem value="inactive">Inactive / Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {audienceType === "by_level" && (
            <div>
              <Label>Level</Label>
              <Select value={audienceLevel} onValueChange={(v) => v && setAudienceLevel(v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((l) => (
                    <SelectItem key={l} value={String(l)}>Level {l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {audienceType === "by_session" && (
            <div>
              <Label>Session</Label>
              <Select value={audienceSessionId} onValueChange={(v) => v && setAudienceSessionId(v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select session..." /></SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {audienceType === "by_class" && (
            <div>
              <Label>Class</Label>
              <Select value={audienceClassId} onValueChange={(v) => v && setAudienceClassId(v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select class..." /></SelectTrigger>
                <SelectContent>
                  {classOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Users className="size-5 text-primary" />
              {countLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <span className="text-lg font-bold">{recipientCount} recipient{recipientCount !== 1 ? "s" : ""}</span>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => setStep(2)} disabled={recipientCount === 0}>
            Next: Compose
            <ChevronRight className="ml-1 size-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Step 2: Compose
  if (step === 2) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Step 2: Compose Message</h2>
          <Button variant="ghost" onClick={() => setStep(0)}>Cancel</Button>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Summer Session Update"
              className="mt-1"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label>Body</Label>
              <div className="flex gap-1">
                {mergeTags.map((t) => (
                  <button
                    key={t.tag}
                    onClick={() => setBodyHtml((prev) => prev + t.tag)}
                    className="rounded border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
                    title={t.description}
                  >
                    {t.tag}
                  </button>
                ))}
              </div>
            </div>
            <Textarea
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              placeholder="Write your message here. Use merge tags above to personalize. HTML is supported."
              rows={10}
              className="font-mono text-sm"
            />
          </div>

          <div>
            <Label>Schedule (optional)</Label>
            <Input
              type="datetime-local"
              value={scheduleFor}
              onChange={(e) => setScheduleFor(e.target.value)}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">Leave empty to send immediately.</p>
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep(1)}>
            <ChevronLeft className="mr-1 size-4" />
            Back
          </Button>
          <Button onClick={() => setStep(3)} disabled={!subject.trim() || !bodyHtml.trim()}>
            <Eye className="mr-1 size-4" />
            Preview
          </Button>
        </div>
      </div>
    );
  }

  // Step 3: Preview & Send
  if (step === 3) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Step 3: Preview & Send</h2>
          <Button variant="ghost" onClick={() => setStep(0)}>Cancel</Button>
        </div>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2 text-sm">
              <Users className="size-4 text-muted-foreground" />
              <span><strong>{recipientCount}</strong> recipients</span>
              <span className="text-muted-foreground">•</span>
              <span className="capitalize text-muted-foreground">{audienceType.replace(/_/g, " ")}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Mail className="size-4 text-muted-foreground" />
              <span>Subject: <strong>{subject}</strong></span>
            </div>
          </CardContent>
        </Card>

        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">Preview (sample data):</p>
          <div className="rounded-lg border bg-white p-4">
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep(2)}>
            <ChevronLeft className="mr-1 size-4" />
            Back to Edit
          </Button>
          <div className="flex gap-2">
            {scheduleFor && (
              <Button
                variant="outline"
                onClick={() => handleSend(true)}
                disabled={sending}
              >
                {sending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Clock className="mr-1 size-4" />}
                Schedule
              </Button>
            )}
            <Button onClick={() => handleSend(false)} disabled={sending}>
              {sending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-1 size-4" />}
              Send Now
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Step 0: Campaign history
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}</p>
        <Button onClick={startCompose}>
          <Send className="mr-1.5 size-4" />
          New Campaign
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Audience</TableHead>
              <TableHead className="text-right">Recipients</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No campaigns yet. Send your first one!
                </TableCell>
              </TableRow>
            ) : (
              campaigns.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {format(new Date(c.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="font-medium">{c.subject}</TableCell>
                  <TableCell className="capitalize text-sm text-muted-foreground">
                    {c.audience_type?.replace(/_/g, " ") ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">{c.recipient_count}</TableCell>
                  <TableCell>{statusBadge(c.status)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
