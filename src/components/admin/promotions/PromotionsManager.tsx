"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  CheckCircle,
  XCircle,
  ArrowRight,
  Trophy,
  Eye,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { getLevelColor, getLevelTextColor, getLevelName, calculateAge } from "@/lib/swim-utils";

interface PromotionRequest {
  id: string;
  swimmer_id: string;
  swimmer_name: string;
  swimmer_age: number;
  from_level: number;
  to_level: number;
  requested_by: string;
  instructor_name: string;
  status: string;
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  skills_mastered: number;
  skills_total: number;
  family_id: string;
}

type TabKey = "pending" | "approved" | "denied";

export function PromotionsManager() {
  const supabase = createClient();
  const [requests, setRequests] = useState<PromotionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("pending");

  // Deny dialog
  const [denyDialogOpen, setDenyDialogOpen] = useState(false);
  const [denyId, setDenyId] = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState("");
  const [denying, setDenying] = useState(false);

  // Skill detail sheet
  const [skillSheetSwimmer, setSkillSheetSwimmer] = useState<{
    id: string;
    name: string;
    level: number;
  } | null>(null);
  const [skillDetails, setSkillDetails] = useState<
    { skill_name: string; status: string; description: string | null }[]
  >([]);

  const [acting, setActing] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("promotion_requests")
        .select(
          "id, swimmer_id, from_level, to_level, requested_by, status, admin_notes, reviewed_at, created_at, swimmer:swimmers(first_name, last_name, date_of_birth, current_level, family_id), instructor:profiles!requested_by(full_name)"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;

      if (!data) {
        setLoading(false);
        return;
      }

      // Get skill mastery counts for each request's from_level + swimmer
      const enriched: PromotionRequest[] = [];

      for (const r of data) {
        const sw = r.swimmer as unknown as
          | { first_name: string; last_name: string; date_of_birth: string; current_level: number; family_id: string }
          | { first_name: string; last_name: string; date_of_birth: string; current_level: number; family_id: string }[]
          | null;
        const s = Array.isArray(sw) ? sw[0] : sw;

        const inst = r.instructor as unknown as
          | { full_name: string }
          | { full_name: string }[]
          | null;
        const i = Array.isArray(inst) ? inst[0] : inst;

        // Get skill counts
        const [skillsRes, recordsRes] = await Promise.all([
          supabase
            .from("skills")
            .select("id")
            .eq("level", r.from_level),
          supabase
            .from("skill_records")
            .select("skill_id")
            .eq("swimmer_id", r.swimmer_id)
            .eq("status", "mastered"),
        ]);

        const skillIds = new Set((skillsRes.data ?? []).map((sk) => sk.id));
        const masteredInLevel = (recordsRes.data ?? []).filter((rec) =>
          skillIds.has(rec.skill_id)
        ).length;

        enriched.push({
          id: r.id,
          swimmer_id: r.swimmer_id,
          swimmer_name: s ? `${s.first_name} ${s.last_name}` : "Unknown",
          swimmer_age: s ? calculateAge(s.date_of_birth) : 0,
          from_level: r.from_level,
          to_level: r.to_level,
          requested_by: r.requested_by,
          instructor_name: i?.full_name ?? "Unknown",
          status: r.status,
          admin_notes: r.admin_notes,
          reviewed_at: r.reviewed_at,
          created_at: r.created_at,
          skills_mastered: masteredInLevel,
          skills_total: skillsRes.data?.length ?? 0,
          family_id: s?.family_id ?? "",
        });
      }

      setRequests(enriched);
    } catch {
      toast.error("Failed to load promotion requests.", { duration: Infinity });
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    return requests.filter((r) => r.status === tab);
  }, [requests, tab]);

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  // ── Actions ──────────────────────────────────────────────────

  const handleApprove = async (req: PromotionRequest) => {
    setActing(req.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Update promotion request
      const { error: reqError } = await supabase
        .from("promotion_requests")
        .update({
          status: "approved",
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", req.id);
      if (reqError) throw reqError;

      // 2. Update swimmer's current level
      const { error: swimError } = await supabase
        .from("swimmers")
        .update({ current_level: req.to_level })
        .eq("id", req.swimmer_id);
      if (swimError) throw swimError;

      // 3. Reset skill records for new level
      const { data: newSkills } = await supabase
        .from("skills")
        .select("id")
        .eq("level", req.to_level);

      if (newSkills?.length) {
        const inserts = newSkills.map((s) => ({
          swimmer_id: req.swimmer_id,
          skill_id: s.id,
          status: "not_started",
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        }));

        await supabase
          .from("skill_records")
          .upsert(inserts, { onConflict: "swimmer_id,skill_id" });
      }

      // 4. Notify parent
      if (req.family_id) {
        await supabase.from("notifications").insert({
          user_id: req.family_id,
          type: "level_promotion",
          title: "Level Promotion!",
          message: `${req.swimmer_name} has been promoted from Level ${req.from_level} (${getLevelName(req.from_level)}) to Level ${req.to_level} (${getLevelName(req.to_level)})! Congratulations!`,
          link: `/admin/swimmers`,
        });
      }

      toast.success(`${req.swimmer_name} promoted to Level ${req.to_level}!`);
      await fetchData();
    } catch {
      toast.error("Failed to approve promotion.");
    } finally {
      setActing(null);
    }
  };

  const openDenyDialog = (id: string) => {
    setDenyId(id);
    setDenyReason("");
    setDenyDialogOpen(true);
  };

  const handleDeny = async () => {
    if (!denyId) return;
    setDenying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const req = requests.find((r) => r.id === denyId);

      const { error } = await supabase
        .from("promotion_requests")
        .update({
          status: "denied",
          admin_notes: denyReason.trim() || null,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", denyId);
      if (error) throw error;

      // Notify instructor (NOT parent)
      if (req) {
        await supabase.from("notifications").insert({
          user_id: req.requested_by,
          type: "general",
          title: "Promotion Request Denied",
          message: `The promotion request for ${req.swimmer_name} from Level ${req.from_level} to Level ${req.to_level} was denied.${denyReason ? ` Reason: ${denyReason}` : ""}`,
        });
      }

      toast.success("Promotion request denied.");
      setDenyDialogOpen(false);
      await fetchData();
    } catch {
      toast.error("Failed to deny promotion.");
    } finally {
      setDenying(false);
    }
  };

  const viewSkillDetail = async (swimmerId: string, name: string, level: number) => {
    setSkillSheetSwimmer({ id: swimmerId, name, level });

    const [skillsRes, recordsRes] = await Promise.all([
      supabase
        .from("skills")
        .select("id, skill_name, skill_order, description")
        .eq("level", level)
        .order("skill_order"),
      supabase
        .from("skill_records")
        .select("skill_id, status")
        .eq("swimmer_id", swimmerId),
    ]);

    const recordMap = new Map<string, string>();
    for (const r of recordsRes.data ?? []) {
      recordMap.set(r.skill_id, r.status);
    }

    setSkillDetails(
      (skillsRes.data ?? []).map((s) => ({
        skill_name: s.skill_name,
        status: recordMap.get(s.id) ?? "not_started",
        description: s.description,
      }))
    );
  };

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border p-1">
        {(["pending", "approved", "denied"] as TabKey[]).map((t) => (
          <button
            key={t}
            className={`relative rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab(t)}
          >
            {t}
            {t === "pending" && pendingCount > 0 && (
              <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Trophy className="size-10" />}
          title={`No ${tab} promotion requests`}
          description={tab === "pending" ? "All promotion requests have been reviewed." : `There are no ${tab} promotion requests to display.`}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((req) => (
            <Card key={req.id}>
              <CardContent className="p-4">
                {/* Swimmer info */}
                <div className="mb-3">
                  <h3 className="text-lg font-bold">{req.swimmer_name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Age {req.swimmer_age}
                  </p>
                </div>

                {/* Level change */}
                <div className="mb-3 flex items-center gap-2">
                  <Badge
                    style={{ backgroundColor: getLevelColor(req.from_level), color: getLevelTextColor(req.from_level) }}
                  >
                    L{req.from_level}
                  </Badge>
                  <ArrowRight className="size-4 text-muted-foreground" />
                  <Badge
                    style={{ backgroundColor: getLevelColor(req.to_level), color: getLevelTextColor(req.to_level) }}
                  >
                    L{req.to_level}: {getLevelName(req.to_level)}
                  </Badge>
                </div>

                {/* Skills mastered */}
                <p className="mb-1 text-sm">
                  <Trophy className="mr-1 inline size-3.5 text-green-500" />
                  <span className="font-medium">
                    {req.skills_mastered}/{req.skills_total}
                  </span>{" "}
                  skills mastered
                </p>

                {/* Instructor */}
                <p className="mb-1 text-sm text-muted-foreground">
                  Recommended by {req.instructor_name}
                </p>

                {/* Date */}
                <p className="text-xs text-muted-foreground">
                  {format(new Date(req.created_at), "MMM d, yyyy")}
                </p>

                {/* Admin notes (for approved/denied) */}
                {req.admin_notes && (
                  <p className="mt-2 rounded bg-muted/50 p-2 text-sm">
                    {req.admin_notes}
                  </p>
                )}

                {req.reviewed_at && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Reviewed {format(new Date(req.reviewed_at), "MMM d, yyyy")}
                  </p>
                )}

                {/* Actions */}
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      viewSkillDetail(req.swimmer_id, req.swimmer_name, req.from_level)
                    }
                  >
                    <Eye className="mr-1 size-3.5" />
                    Skills
                  </Button>

                  {tab === "pending" && (
                    <>
                      <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => handleApprove(req)}
                        disabled={acting === req.id}
                      >
                        {acting === req.id ? (
                          <Loader2 className="mr-1 size-3.5 animate-spin" />
                        ) : (
                          <CheckCircle className="mr-1 size-3.5" />
                        )}
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => openDenyDialog(req.id)}
                      >
                        <XCircle className="mr-1 size-3.5" />
                        Deny
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Deny Dialog */}
      <Dialog open={denyDialogOpen} onOpenChange={setDenyDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Deny Promotion</DialogTitle>
            <DialogDescription>
              The instructor will be notified. The parent will NOT be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="deny-reason">Reason *</Label>
              <Textarea
                id="deny-reason"
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                placeholder="Explain why the promotion is denied..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDenyDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeny}
                disabled={denying || !denyReason.trim()}
              >
                {denying && <Loader2 className="mr-2 size-4 animate-spin" />}
                Deny Promotion
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Skill Detail Sheet */}
      <Sheet
        open={!!skillSheetSwimmer}
        onOpenChange={(o) => !o && setSkillSheetSwimmer(null)}
      >
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {skillSheetSwimmer?.name} — Level {skillSheetSwimmer?.level} Skills
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {skillDetails.map((skill, idx) => {
              const statusConfig: Record<string, { label: string; color: string }> = {
                not_started: { label: "Not Started", color: "bg-gray-200 text-gray-600" },
                introduced: { label: "Introduced", color: "bg-blue-100 text-blue-700" },
                practicing: { label: "Practicing", color: "bg-yellow-100 text-yellow-700" },
                mastered: { label: "Mastered", color: "bg-green-100 text-green-700" },
              };
              const cfg = statusConfig[skill.status] ?? statusConfig.not_started;

              return (
                <div key={idx} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{skill.skill_name}</span>
                    <Badge variant="outline" className={cfg.color}>
                      {cfg.label}
                    </Badge>
                  </div>
                  {skill.description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {skill.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
