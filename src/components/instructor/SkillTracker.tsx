"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle, Trophy, PartyPopper, ListChecks } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { getLevelColor, getLevelTextColor, getLevelName } from "@/lib/swim-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineError } from "@/components/ui/inline-error";

type SkillStatus = "not_started" | "introduced" | "practicing" | "mastered";

interface Skill {
  id: string;
  skill_name: string;
  skill_order: number;
  description: string | null;
}

interface SkillRecord {
  skill_id: string;
  status: SkillStatus;
  notes: string;
}

const STATUS_OPTIONS: { value: SkillStatus; label: string; symbol: string; color: string }[] = [
  { value: "not_started", label: "Not Started", symbol: "○", color: "bg-gray-200 text-gray-600" },
  { value: "introduced", label: "Introduced", symbol: "◐", color: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "practicing", label: "Practicing", symbol: "◑", color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  { value: "mastered", label: "Mastered", symbol: "●", color: "bg-green-100 text-green-700 border-green-300" },
];

interface SkillTrackerProps {
  swimmerId: string;
  swimmerName: string;
  currentLevel: number;
  instructorId: string;
  onClose?: () => void;
}

export function SkillTracker({
  swimmerId,
  swimmerName,
  currentLevel,
  instructorId,
  onClose,
}: SkillTrackerProps) {
  const supabase = createClient();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [records, setRecords] = useState<Map<string, SkillRecord>>(new Map());
  const [loading, setLoading] = useState(true);
  const [promotionRequested, setPromotionRequested] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [skillsRes, recordsRes, promoRes] = await Promise.all([
        supabase
          .from("skills")
          .select("id, skill_name, skill_order, description")
          .eq("level", currentLevel)
          .order("skill_order"),
        supabase
          .from("skill_records")
          .select("skill_id, status, notes")
          .eq("swimmer_id", swimmerId),
        supabase
          .from("promotion_requests")
          .select("id")
          .eq("swimmer_id", swimmerId)
          .eq("from_level", currentLevel)
          .in("status", ["pending", "approved"])
          .limit(1),
      ]);

      if (skillsRes.error) throw skillsRes.error;
      if (recordsRes.error) throw recordsRes.error;

      setSkills(skillsRes.data ?? []);

      const map = new Map<string, SkillRecord>();
      for (const r of recordsRes.data ?? []) {
        map.set(r.skill_id, {
          skill_id: r.skill_id,
          status: r.status as SkillStatus,
          notes: r.notes ?? "",
        });
      }
      setRecords(map);

      setPromotionRequested((promoRes.data?.length ?? 0) > 0);
    } catch {
      setError("Failed to load skill data.");
      toast.error("Failed to load skill data.", { duration: Infinity });
    } finally {
      setLoading(false);
    }
  }, [supabase, swimmerId, currentLevel]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const saveRecord = useCallback(
    async (skillId: string, status: SkillStatus, notes: string) => {
      try {
        const { error: saveErr } = await supabase
          .from("skill_records")
          .upsert(
            {
              swimmer_id: swimmerId,
              skill_id: skillId,
              status,
              notes: notes || null,
              updated_by: instructorId,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "swimmer_id,skill_id" }
          );
        if (saveErr) throw saveErr;
      } catch {
        toast.error("Failed to save skill progress.", { duration: Infinity });
      }
    },
    [supabase, swimmerId, instructorId]
  );

  const handleStatusChange = (skillId: string, newStatus: SkillStatus) => {
    setRecords((prev) => {
      const next = new Map(prev);
      const existing = next.get(skillId) ?? { skill_id: skillId, status: "not_started", notes: "" };
      const updated = { ...existing, status: newStatus };
      next.set(skillId, updated);

      // Debounce save — read notes from the UPDATED record to avoid stale data
      const timer = debounceTimers.current.get(skillId);
      if (timer) clearTimeout(timer);
      debounceTimers.current.set(
        skillId,
        setTimeout(() => {
          saveRecord(skillId, newStatus, updated.notes ?? "");
        }, 500)
      );

      return next;
    });
  };

  const handleNoteChange = (skillId: string, notes: string) => {
    setRecords((prev) => {
      const next = new Map(prev);
      const existing = next.get(skillId) ?? { skill_id: skillId, status: "not_started" as SkillStatus, notes: "" };
      const updated = { ...existing, notes };
      next.set(skillId, updated);

      // Debounce save — read status from the UPDATED record to avoid stale data
      const timer = debounceTimers.current.get(`note-${skillId}`);
      if (timer) clearTimeout(timer);
      debounceTimers.current.set(
        `note-${skillId}`,
        setTimeout(() => {
          saveRecord(skillId, updated.status ?? "not_started", notes);
        }, 500)
      );

      return next;
    });
  };

  const handleRecommendPromotion = async () => {
    setRequesting(true);
    try {
      const toLevel = currentLevel + 1;

      const { error } = await supabase.from("promotion_requests").insert({
        swimmer_id: swimmerId,
        from_level: currentLevel,
        to_level: toLevel,
        requested_by: instructorId,
        status: "pending",
      });

      if (error) throw error;

      setPromotionRequested(true);
      toast.success(`Promotion to Level ${toLevel} recommended!`);
    } catch {
      toast.error("Failed to submit promotion request.");
    } finally {
      setRequesting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 py-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
        <Skeleton className="h-3 w-full rounded-full" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border-2 p-3 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex gap-1.5">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-10 flex-1 rounded-full" />
              ))}
            </div>
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <InlineError message={error} onRetry={fetchData} />;
  }

  if (skills.length === 0) {
    return (
      <EmptyState
        icon={<ListChecks className="size-10" />}
        title="No skills defined for this level"
        description={`Level ${currentLevel} doesn\u2019t have any skills configured yet.`}
      />
    );
  }

  const masteredCount = skills.filter(
    (s) => records.get(s.id)?.status === "mastered"
  ).length;
  const allMastered = skills.length > 0 && masteredCount === skills.length;
  const isMaxLevel = currentLevel >= 5;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">{swimmerName}</h3>
          <div className="flex items-center gap-2">
            <Badge
              style={{ backgroundColor: getLevelColor(currentLevel), color: getLevelTextColor(currentLevel) }}
            >
              L{currentLevel}: {getLevelName(currentLevel)}
            </Badge>
          </div>
        </div>
        {onClose && (
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      {/* Progress */}
      <div>
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="font-medium">
            {masteredCount} of {skills.length} skills mastered
          </span>
          <span className="text-muted-foreground">
            {skills.length > 0 ? Math.round((masteredCount / skills.length) * 100) : 0}%
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: skills.length > 0 ? `${(masteredCount / skills.length) * 100}%` : "0%" }}
          />
        </div>
      </div>

      {/* All mastered banner */}
      {allMastered && (
        <div className="rounded-xl border-2 border-green-500 bg-green-50 p-4 text-center dark:bg-green-950/30">
          <PartyPopper className="mx-auto mb-2 size-8 text-green-600" />
          {isMaxLevel ? (
            <>
              <p className="text-lg font-bold text-green-700 dark:text-green-400">
                Program Complete!
              </p>
              <p className="text-sm text-green-600 dark:text-green-500">
                {swimmerName} has mastered all Level 5 skills. Congratulations!
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-bold text-green-700 dark:text-green-400">
                {swimmerName} has completed all Level {currentLevel} skills!
              </p>
              {promotionRequested ? (
                <div className="mt-2 flex items-center justify-center gap-2 text-green-600">
                  <CheckCircle className="size-5" />
                  <span className="font-semibold">Promotion Recommended</span>
                </div>
              ) : (
                <Button
                  onClick={handleRecommendPromotion}
                  disabled={requesting}
                  className="mt-2 h-12 bg-green-600 text-base font-bold hover:bg-green-700"
                >
                  {requesting ? (
                    <Loader2 className="mr-2 size-5 animate-spin" />
                  ) : (
                    <Trophy className="mr-2 size-5" />
                  )}
                  Recommend for Level {currentLevel + 1}
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {/* Skill Rows */}
      <div className="space-y-2">
        {skills.map((skill) => {
          const record = records.get(skill.id);
          const currentStatus = record?.status ?? "not_started";
          const currentNotes = record?.notes ?? "";

          return (
            <div key={skill.id} className="rounded-xl border-2 bg-card p-3">
              <div className="mb-2">
                <p className="text-base font-bold">{skill.skill_name}</p>
                {skill.description && (
                  <p className="text-sm text-muted-foreground">{skill.description}</p>
                )}
              </div>

              {/* Status Buttons */}
              <div className="mb-2 flex gap-1.5">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleStatusChange(skill.id, opt.value)}
                    className={`flex-1 rounded-full border-2 px-2 py-3 min-h-[48px] text-center text-sm font-bold transition-all active:scale-[0.95] ${
                      currentStatus === opt.value
                        ? opt.color + " border-current shadow-sm"
                        : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="mr-1">{opt.symbol}</span>
                    <span className="hidden sm:inline">{opt.label}</span>
                  </button>
                ))}
              </div>

              {/* Note */}
              <Input
                value={currentNotes}
                onChange={(e) => handleNoteChange(skill.id, e.target.value)}
                placeholder="Optional note..."
                className="h-9 text-sm"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
