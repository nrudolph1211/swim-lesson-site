import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Users,
  BookOpen,
  BarChart3,
  AlertTriangle,
  UserPlus,
  CalendarPlus,
  Plus,
  CloudOff,
  Trophy,
  Award,
  ClipboardList,
} from "lucide-react";
import { ScheduleHeatmap } from "@/components/admin/charts/ScheduleHeatmap";
import { formatDistanceToNow } from "date-fns";

export const metadata = { title: "Admin Dashboard" };

// Map day_of_week text[] entries to short day names for the heatmap
const DAY_MAP: Record<string, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
};

const LEVEL_NAMES: Record<number, string> = {
  1: "Water Intro",
  2: "Beginner",
  3: "Intermediate",
  4: "Advanced",
  5: "Pre-Competitive",
};

const LEVEL_COLORS: Record<number, string> = {
  1: "bg-sky-100 text-sky-800",
  2: "bg-blue-100 text-blue-800",
  3: "bg-indigo-100 text-indigo-800",
  4: "bg-violet-100 text-violet-800",
  5: "bg-purple-100 text-purple-800",
};

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // ── Fetch all data in parallel ──────────────────────────────
  const [
    swimmersRes,
    activeSessionsRes,
    classesRes,
    activeInstructorsRes,
    skillsMasteredRes,
    classAssignmentsRes,
    recentSwimmersRes,
    expiringCertsRes,
    pendingPromotionsRes,
  ] = await Promise.all([
    // 1. Active swimmers count
    supabase
      .from("swimmers")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),

    // 2. Active sessions
    supabase
      .from("sessions")
      .select("id, name, status")
      .in("status", ["enrollment_open", "in_progress"]),

    // 3. All classes in active sessions (for heatmap + total classes metric)
    supabase
      .from("classes")
      .select("id, session_id, max_capacity, level, day_of_week, start_time, is_active, session:sessions!inner(status)")
      .in("session.status", ["enrollment_open", "in_progress"])
      .eq("is_active", true),

    // 4. Active instructors count
    supabase
      .from("instructors")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),

    // 5. Skills mastered count
    supabase
      .from("skill_records")
      .select("id", { count: "exact", head: true })
      .eq("status", "mastered"),

    // 6. Class assignments count
    supabase
      .from("class_assignments")
      .select("id, class_id", { count: "exact" }),

    // 7. Recent swimmers
    supabase
      .from("swimmers")
      .select("id, first_name, last_name, created_at")
      .order("created_at", { ascending: false })
      .limit(10),

    // 8. Expiring instructor certs (within 30 days)
    supabase
      .from("instructors")
      .select("id, certifications, profile:profiles(full_name)")
      .eq("is_active", true),

    // 9. Pending promotions
    supabase
      .from("promotion_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  // ── Process metrics ─────────────────────────────────────────
  const activeSwimmers = swimmersRes.count ?? 0;
  const totalClasses = classesRes.data?.length ?? 0;
  const activeInstructors = activeInstructorsRes.count ?? 0;
  const skillsMastered = skillsMasteredRes.count ?? 0;

  // ── Swimmers by level (based on class assignments) ────────
  const swimmersByLevel: Record<number, number> = {};
  const assignmentsByClassId: Record<string, number> = {};
  for (const a of classAssignmentsRes.data ?? []) {
    assignmentsByClassId[a.class_id] = (assignmentsByClassId[a.class_id] ?? 0) + 1;
  }
  for (const cls of classesRes.data ?? []) {
    const level = cls.level as number;
    if (level) {
      swimmersByLevel[level] = (swimmersByLevel[level] ?? 0) + (assignmentsByClassId[cls.id] ?? 0);
    }
  }
  const levelChartData = [1, 2, 3, 4, 5].map((level) => ({
    level,
    count: swimmersByLevel[level] ?? 0,
  }));
  const maxLevelCount = Math.max(...levelChartData.map((d) => d.count), 1);

  // ── Schedule heatmap ────────────────────────────────────────
  const heatmapData: Record<string, number> = {};
  let heatmapMax = 0;
  for (const cls of classesRes.data ?? []) {
    const hour = parseInt((cls.start_time as string)?.slice(0, 2) ?? "0", 10);
    const days = (cls.day_of_week as string[]) ?? [];
    for (const day of days) {
      const short = DAY_MAP[day];
      if (!short) continue;
      const key = `${short}-${hour}`;
      heatmapData[key] = (heatmapData[key] ?? 0) + 1;
      if (heatmapData[key] > heatmapMax) heatmapMax = heatmapData[key];
    }
  }

  // ── Recent activity ─────────────────────────────────────────
  type Activity = {
    id: string;
    type: "swimmer";
    description: string;
    timestamp: string;
  };

  const activities: Activity[] = [];

  for (const s of recentSwimmersRes.data ?? []) {
    activities.push({
      id: `s-${s.id}`,
      type: "swimmer",
      description: `${s.first_name} ${s.last_name} added`,
      timestamp: s.created_at ?? new Date().toISOString(),
    });
  }

  activities.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const recentActivities = activities.slice(0, 10);

  // ── Action items ────────────────────────────────────────────
  // Expiring certs: check certifications jsonb for expiry dates within 30 days
  let expiringCerts = 0;
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  for (const inst of expiringCertsRes.data ?? []) {
    const certs = (inst.certifications ?? []) as Array<{
      expiry?: string;
      expires?: string;
    }>;
    for (const cert of certs) {
      const expStr = cert.expiry ?? cert.expires;
      if (expStr) {
        const expDate = new Date(expStr);
        if (expDate <= thirtyDaysFromNow && expDate >= now) {
          expiringCerts++;
        }
      }
    }
  }

  // Unassigned classes: classes with no assignments
  const assignedClassIds = new Set(
    (classAssignmentsRes.data ?? []).map((a: { class_id: string }) => a.class_id)
  );
  const unassignedClasses = (classesRes.data ?? []).filter(
    (cls) => !assignedClassIds.has(cls.id)
  ).length;

  const pendingPromotions = pendingPromotionsRes.count ?? 0;

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold">Dashboard</h1>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Active Swimmers"
          value={activeSwimmers}
          icon={<Users className="size-4" />}
          href="/admin/swimmers"
        />
        <MetricCard
          title="Total Classes"
          value={totalClasses}
          icon={<BookOpen className="size-4" />}
          href="/admin/sessions"
        />
        <MetricCard
          title="Active Instructors"
          value={activeInstructors}
          icon={<BarChart3 className="size-4" />}
          href="/admin/instructors"
        />
        <MetricCard
          title="Skills Mastered"
          value={skillsMastered}
          icon={<Award className="size-4" />}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-sm font-semibold">Swimmers by Level</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {levelChartData.map((d) => (
                <div key={d.level} className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={`w-28 justify-center ${LEVEL_COLORS[d.level] ?? ""}`}
                  >
                    L{d.level} {LEVEL_NAMES[d.level]}
                  </Badge>
                  <div className="flex-1">
                    <div className="h-6 w-full rounded-md bg-muted">
                      <div
                        className="flex h-full items-center rounded-md bg-primary/80 px-2 text-xs font-medium text-primary-foreground transition-all"
                        style={{
                          width: `${Math.max((d.count / maxLevelCount) * 100, d.count > 0 ? 12 : 0)}%`,
                        }}
                      >
                        {d.count > 0 && d.count}
                      </div>
                    </div>
                  </div>
                  <span className="w-8 text-right text-sm font-medium tabular-nums">
                    {d.count}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-sm font-semibold">Weekly Lesson Schedule</h3>
          </CardHeader>
          <CardContent>
            <ScheduleHeatmap data={heatmapData} maxCount={heatmapMax} />
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <h3 className="text-sm font-semibold">Recent Activity</h3>
          </CardHeader>
          <CardContent>
            {recentActivities.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No recent activity.
              </p>
            ) : (
              <div className="space-y-3">
                {recentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 text-sm"
                  >
                    <div className="mt-0.5 shrink-0">
                      <UserPlus className="size-3.5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p>{activity.description}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.timestamp), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Items + Quick Actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <h3 className="text-sm font-semibold">Action Items</h3>
            </CardHeader>
            <CardContent className="space-y-2">
              <ActionItem
                icon={<AlertTriangle className="size-3.5 text-yellow-600" />}
                label="Expiring certifications"
                count={expiringCerts}
                href="/admin/instructors"
              />
              <ActionItem
                icon={<ClipboardList className="size-3.5 text-orange-600" />}
                label="Unassigned classes"
                count={unassignedClasses}
                href="/admin/sessions"
              />
              <ActionItem
                icon={<Trophy className="size-3.5 text-green-600" />}
                label="Pending promotions"
                count={pendingPromotions}
                href="/admin/promotions"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <h3 className="text-sm font-semibold">Quick Actions</h3>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/admin/sessions">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <CalendarPlus className="mr-2 size-3.5" />
                  Create Session
                </Button>
              </Link>
              <Link href="/admin/sessions">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Plus className="mr-2 size-3.5" />
                  Add Class
                </Button>
              </Link>
              <Link href="/admin/communicate">
                <Button variant="outline" size="sm" className="w-full justify-start text-destructive hover:text-destructive">
                  <CloudOff className="mr-2 size-3.5" />
                  Weather Cancellation
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function MetricCard({
  title,
  value,
  icon,
  subtitle,
  href,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  subtitle?: string;
  href?: string;
}) {
  const content = (
    <Card className={href ? "transition-shadow hover:shadow-md" : ""}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{title}</span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <p className="mt-2 text-3xl font-bold">{value}</p>
        {subtitle && (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

function ActionItem({
  icon,
  label,
  count,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-md border p-2.5 text-sm transition-colors hover:bg-muted/50"
    >
      <div className="flex items-center gap-2">
        {icon}
        <span>{label}</span>
      </div>
      <Badge variant={count > 0 ? "destructive" : "secondary"}>{count}</Badge>
    </Link>
  );
}
