"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

export function CampaignManager() {
  const supabase = createClient();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  // Compose state
  const [step, setStep] = useState(0); // 0 = history, 1 = compose, 2 = preview
  const [recipientCount, setRecipientCount] = useState(0);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [scheduleFor, setScheduleFor] = useState("");
  const [sending, setSending] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    setCampaigns((data ?? []) as Campaign[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // Count active instructors as recipients
  const countRecipients = useCallback(async () => {
    const { count } = await supabase
      .from("instructors")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);
    setRecipientCount(count ?? 0);
  }, [supabase]);

  // Merge tags for instructor communications
  const mergeTags = [
    { tag: "{instructor_name}", description: "Instructor's full name" },
    { tag: "{date}", description: "Date" },
    { tag: "{time}", description: "Time" },
    { tag: "{session_name}", description: "Session name" },
  ];

  const previewHtml = useMemo(() => {
    return bodyHtml
      .replace(/\{instructor_name\}/g, "Sarah Johnson")
      .replace(/\{date\}/g, "April 5, 2026")
      .replace(/\{time\}/g, "9:00 AM")
      .replace(/\{session_name\}/g, "Summer 2026");
  }, [bodyHtml]);

  const startCompose = () => {
    setStep(1);
    setSubject("");
    setBodyHtml("");
    setScheduleFor("");
    countRecipients();
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
      const { error } = await supabase.from("campaigns").insert({
        subject,
        body_html: bodyHtml,
        audience_type: "instructors",
        audience_filter: { type: "instructors" },
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

  // Step 1: Compose
  if (step === 1) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Step 1: Compose Message</h2>
          <Button variant="ghost" onClick={() => setStep(0)}>Cancel</Button>
        </div>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="size-5 text-primary" />
            <span className="text-lg font-bold">
              {recipientCount} active instructor{recipientCount !== 1 ? "s" : ""}
            </span>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div>
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Schedule Update for Next Week"
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

        <div className="flex justify-end">
          <Button onClick={() => setStep(2)} disabled={!subject.trim() || !bodyHtml.trim()}>
            <Eye className="mr-1 size-4" />
            Preview
            <ChevronRight className="ml-1 size-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Step 2: Preview & Send
  if (step === 2) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Step 2: Preview & Send</h2>
          <Button variant="ghost" onClick={() => setStep(0)}>Cancel</Button>
        </div>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2 text-sm">
              <Users className="size-4 text-muted-foreground" />
              <span><strong>{recipientCount}</strong> active instructors</span>
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
          <Button variant="outline" onClick={() => setStep(1)}>
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
          New Message
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
                  No messages yet. Send your first one!
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
                    {c.audience_type?.replace(/_/g, " ") ?? "Instructors"}
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
