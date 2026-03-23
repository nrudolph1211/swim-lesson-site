"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, PartyPopper, Download, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getLevelColor, getLevelTextColor, getLevelName } from "@/lib/swim-utils";

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
  updated_at: string;
}

const STATUS_CONFIG: Record<SkillStatus, { label: string; bgColor: string; textColor: string }> = {
  not_started: { label: "Not Started", bgColor: "bg-gray-100 dark:bg-gray-800", textColor: "text-gray-500" },
  introduced: { label: "Introduced", bgColor: "bg-blue-50 dark:bg-blue-950/30", textColor: "text-blue-600" },
  practicing: { label: "Practicing", bgColor: "bg-yellow-50 dark:bg-yellow-950/30", textColor: "text-yellow-600" },
  mastered: { label: "Mastered", bgColor: "bg-green-50 dark:bg-green-950/30", textColor: "text-green-600" },
};

interface SwimmerProgressProps {
  swimmerId: string;
  swimmerName: string;
  currentLevel: number;
  onBack: () => void;
}

export function SwimmerProgress({
  swimmerId,
  swimmerName,
  currentLevel,
  onBack,
}: SwimmerProgressProps) {
  const supabase = createClient();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [records, setRecords] = useState<Map<string, SkillRecord>>(new Map());
  const [loading, setLoading] = useState(true);
  const [recentPromotion, setRecentPromotion] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [skillsRes, recordsRes, promoRes] = await Promise.all([
      supabase
        .from("skills")
        .select("id, skill_name, skill_order, description")
        .eq("level", currentLevel)
        .order("skill_order"),
      supabase
        .from("skill_records")
        .select("skill_id, status, updated_at")
        .eq("swimmer_id", swimmerId),
      // Check if promoted in last 30 days
      supabase
        .from("promotion_requests")
        .select("id")
        .eq("swimmer_id", swimmerId)
        .eq("to_level", currentLevel)
        .eq("status", "approved")
        .gte("reviewed_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .limit(1),
    ]);

    setSkills(skillsRes.data ?? []);

    const map = new Map<string, SkillRecord>();
    for (const r of recordsRes.data ?? []) {
      map.set(r.skill_id, {
        skill_id: r.skill_id,
        status: r.status as SkillStatus,
        updated_at: r.updated_at,
      });
    }
    setRecords(map);

    setRecentPromotion((promoRes.data?.length ?? 0) > 0);
    setLoading(false);
  }, [supabase, swimmerId, currentLevel]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const masteredCount = skills.filter(
    (s) => records.get(s.id)?.status === "mastered"
  ).length;
  const progressPct = skills.length > 0 ? (masteredCount / skills.length) * 100 : 0;

  // Build timeline from records that have updates
  const timeline = skills
    .filter((s) => records.has(s.id) && records.get(s.id)!.status !== "not_started")
    .map((s) => ({
      skill_name: s.skill_name,
      status: records.get(s.id)!.status,
      updated_at: records.get(s.id)!.updated_at,
    }))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="mr-1 size-4" />
        Back to Dashboard
      </Button>

      {/* Recent promotion banner */}
      {recentPromotion && (
        <div className="rounded-xl border-2 border-green-500 bg-green-50 p-4 text-center dark:bg-green-950/30">
          <PartyPopper className="mx-auto mb-2 size-8 text-green-600" />
          <p className="text-lg font-bold text-green-700 dark:text-green-400">
            Congratulations! {swimmerName} was promoted to Level {currentLevel}!
          </p>
          <Button variant="outline" size="sm" className="mt-2" disabled>
            <Download className="mr-1.5 size-4" />
            Download Certificate (Coming Soon)
          </Button>
        </div>
      )}

      {/* Header with level + progress */}
      <div>
        <h2 className="font-heading text-xl font-bold">{swimmerName}</h2>
        <div className="mt-1 flex items-center gap-2">
          <Badge
            style={{ backgroundColor: getLevelColor(currentLevel), color: getLevelTextColor(currentLevel) }}
          >
            L{currentLevel}: {getLevelName(currentLevel)}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {masteredCount}/{skills.length} mastered
          </span>
        </div>

        <div className="mt-3">
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="mt-1 text-right text-sm text-muted-foreground">
            {Math.round(progressPct)}% complete
          </p>
        </div>
      </div>

      {/* Skill Grid */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">Skills</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {skills.map((skill) => {
            const record = records.get(skill.id);
            const status = record?.status ?? "not_started";
            const config = STATUS_CONFIG[status];

            return (
              <div
                key={skill.id}
                className={`rounded-xl border p-4 ${config.bgColor}`}
              >
                <div className="flex items-start justify-between">
                  <h4 className="font-medium">{skill.skill_name}</h4>
                  <Badge
                    variant="outline"
                    className={`shrink-0 text-xs ${config.textColor}`}
                  >
                    {config.label}
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
      </div>

      {/* History Timeline */}
      {timeline.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Recent Activity</h3>
          <div className="space-y-2">
            {timeline.slice(0, 10).map((entry, idx) => {
              const config = STATUS_CONFIG[entry.status];
              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"
                >
                  <div
                    className={`size-2.5 shrink-0 rounded-full ${
                      entry.status === "mastered"
                        ? "bg-green-500"
                        : entry.status === "practicing"
                          ? "bg-yellow-500"
                          : entry.status === "introduced"
                            ? "bg-blue-500"
                            : "bg-gray-400"
                    }`}
                  />
                  <div className="flex-1">
                    <span className="font-medium">{entry.skill_name}</span>
                    <span className={`ml-2 text-xs ${config.textColor}`}>
                      {config.label}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.updated_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
