import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Users,
  BookOpen,
  BarChart3,
  Clock,
  AlertTriangle,
  ShieldAlert,
  CreditCard,
  UserPlus,
  FileCheck,
  CalendarPlus,
  Plus,
  CloudOff,
  Trophy,
} from "lucide-react";
import { EnrollmentByLevelChart } from "@/components/admin/charts/EnrollmentByLevelChart";
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

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // ── Fetch all data in parallel ──────────────────────────────
  const [
    swimmersRes,
    activeSessionsRes,
    classesRes,
    enrollmentsRes,
    waitlistedRes,
    recentEnrollmentsRes,
    recentWaiversRes,
    recentSwimmersRes,
    unsignedWaiverCountRes,
    expiringCertsRes,
    pendingPaymentsRes,
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

    // 3. All classes in active sessions (for capacity + heatmap)
    supabase
      .from("classes")
      .select("id, session_id, max_capacity, level, day_of_week, start_time, is_active, session:sessions!inner(status)")
      .in("session.status", ["enrollment_open", "in_progress"])
      .eq("is_active", true),

    // 4. Confirmed enrollments in active sessions (join through classes)
    supabase
      .from("enrollments")
      .select("id, class_id, status, class:classes!inner(level, session:sessions!inner(status))")
      .eq("status", "confirmed")
      .in("class.session.status", ["enrollment_open", "in_progress"]),

    // 5. Waitlisted enrollments in active sessions
    supabase
      .from("enrollments")
      .select("id, class_id, class:classes!inner(session:sessions!inner(status))")
      .eq("status", "waitlisted")
      .in("class.session.status", ["enrollment_open", "in_progress"]),

    // 6. Recent enrollments
    supabase
      .from("enrollments")
      .select("id, status, enrolled_at, swimmer:swimmers(first_name, last_name), class:classes(level)")
      .order("enrolled_at", { ascending: false })
      .limit(10),

    // 7. Recent waivers
    supabase
      .from("waivers")
      .select("id, signed_at, swimmer:swimmers(first_name, last_name)")
      .order("signed_at", { ascending: false })
      .limit(5),

    // 8. Recent swimmers
    supabase
      .from("swimmers")
      .select("id, first_name, last_name, created_at")
      .order("created_at", { ascending: false })
      .limit(5),

    // 9. All confirmed swimmer IDs (for unsigned waiver check)
    supabase
      .from("enrollments")
      .select("swimmer_id")
      .eq("status", "confirmed"),

    // 10. Expiring instructor certs (within 30 days)
    supabase
      .from("instructors")
      .select("id, certifications, profile:profiles(full_name)")
      .eq("is_active", true),

    // 11. Pending payments
    supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("status", "confirmed")
      .eq("payment_status", "pending"),

    // 12. Pending promotions
    supabase
      .from("promotion_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  // ── Process metrics ─────────────────────────────────────────
  const activeSwimmers = swimmersRes.count ?? 0;
  const confirmedEnrollments = enrollmentsRes.data?.length ?? 0;
  const waitlistedCount = waitlistedRes.data?.length ?? 0;

  const totalCapacity = (classesRes.data ?? []).reduce(
    (sum, c) => sum + (c.max_capacity ?? 0),
    0
  );
  const occupancyRate =
    totalCapacity > 0
      ? Math.round((confirmedEnrollments / totalCapacity) * 100)
      : 0;

  // ── Enrollment by level ─────────────────────────────────────
  const enrollmentsByLevel: Record<number, number> = {};
  for (const e of enrollmentsRes.data ?? []) {
    const cls = e.class as unknown as { level?: number } | { level?: number }[] | null;
    const classObj = Array.isArray(cls) ? cls[0] : cls;
    const level = classObj?.level;
    if (level) {
      enrollmentsByLevel[level] = (enrollmentsByLevel[level] ?? 0) + 1;
    }
  }
  const levelChartData = [1, 2, 3, 4, 5].map((level) => ({
    level,
    count: enrollmentsByLevel[level] ?? 0,
  }));

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
    type: "enrollment" | "waiver" | "swimmer";
    description: string;
    timestamp: string;
  };

  const activities: Activity[] = [];

  for (const e of recentEnrollmentsRes.data ?? []) {
    const swimmer = e.swimmer as unknown as { first_name: string; last_name: string } | null;
    const name = swimmer
      ? `${swimmer.first_name} ${swimmer.last_name}`
      : "Unknown";
    activities.push({
      id: `e-${e.id}`,
      type: "enrollment",
      description: `${name} ${e.status === "confirmed" ? "enrolled" : e.status === "waitlisted" ? "joined waitlist" : "cancelled"}`,
      timestamp: e.enrolled_at ?? new Date().toISOString(),
    });
  }

  for (const w of recentWaiversRes.data ?? []) {
    const swimmer = w.swimmer as unknown as { first_name: string; last_name: string } | null;
    const name = swimmer
      ? `${swimmer.first_name} ${swimmer.last_name}`
      : "Unknown";
    activities.push({
      id: `w-${w.id}`,
      type: "waiver",
      description: `Waiver signed for ${name}`,
      timestamp: w.signed_at ?? new Date().toISOString(),
    });
  }

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
  // Unsigned waivers: enrolled swimmers without active, unexpired waivers
  const enrolledSwimmerIds = [
    ...new Set(
      (unsignedWaiverCountRes.data ?? []).map(
        (e: { swimmer_id: string }) => e.swimmer_id
      )
    ),
  ];

  let unsignedWaivers = 0;
  if (enrolledSwimmerIds.length > 0) {
    const { data: activeWaivers } = await supabase
      .from("waivers")
      .select("swimmer_id")
      .in("swimmer_id", enrolledSwimmerIds)
      .eq("is_active", true)
      .gte("expires_at", new Date().toISOString());

    const signedSet = new Set(
      (activeWaivers ?? []).map((w: { swimmer_id: string }) => w.swimmer_id)
    );
    unsignedWaivers = enrolledSwimmerIds.filter(
      (id: string) => !signedSet.has(id)
    ).length;
  }

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

  // Full classes
  const fullClasses = (classesRes.data ?? []).filter((cls) => {
    const enrolled = (enrollmentsRes.data ?? []).filter(
      (e) => e.class_id === cls.id
    ).length;
    return enrolled >= cls.max_capacity;
  }).length;

  const pendingPayments = pendingPaymentsRes.count ?? 0;
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
          title="Current Enrollments"
          value={confirmedEnrollments}
          icon={<BookOpen className="size-4" />}
          href="/admin/enrollments"
        />
        <MetricCard
          title="Occupancy Rate"
          value={`${occupancyRate}%`}
          icon={<BarChart3 className="size-4" />}
          subtitle={`${confirmedEnrollments} / ${totalCapacity} spots`}
        />
        <MetricCard
          title="Waitlisted"
          value={waitlistedCount}
          icon={<Clock className="size-4" />}
          href="/admin/enrollments"
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-sm font-semibold">Enrollment by Level</h3>
          </CardHeader>
          <CardContent>
            <EnrollmentByLevelChart data={levelChartData} />
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
                      {activity.type === "enrollment" && (
                        <BookOpen className="size-3.5 text-primary" />
                      )}
                      {activity.type === "waiver" && (
                        <FileCheck className="size-3.5 text-green-600" />
                      )}
                      {activity.type === "swimmer" && (
                        <UserPlus className="size-3.5 text-blue-600" />
                      )}
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
                icon={<ShieldAlert className="size-3.5 text-red-600" />}
                label="Unsigned waivers"
                count={unsignedWaivers}
                href="/admin/waivers"
              />
              <ActionItem
                icon={<AlertTriangle className="size-3.5 text-yellow-600" />}
                label="Expiring certifications"
                count={expiringCerts}
                href="/admin/instructors"
              />
              <ActionItem
                icon={<Users className="size-3.5 text-orange-600" />}
                label="Full classes"
                count={fullClasses}
                href="/admin/sessions"
              />
              <ActionItem
                icon={<CreditCard className="size-3.5 text-blue-600" />}
                label="Pending payments"
                count={pendingPayments}
                href="/admin/payments"
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
