import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateLessonDates, buildIcsCalendar } from "@/lib/ics";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Find user by calendar_token
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("calendar_token", token)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const isInstructor = profile.role === "instructor";

  try {
    const ics = isInstructor
      ? await buildInstructorFeed(supabase, profile.id)
      : await buildParentFeed(supabase, profile.id);

    return new NextResponse(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": "attachment; filename=hac-swim-schedule.ics",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (err) {
    console.error("Calendar feed error:", err);
    return NextResponse.json({ error: "Failed to generate feed" }, { status: 500 });
  }
}

async function buildParentFeed(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string
) {
  // Get family's swimmers
  const { data: swimmers } = await supabase
    .from("swimmers")
    .select("id, first_name, last_name")
    .eq("family_id", userId)
    .eq("is_active", true);

  if (!swimmers?.length) return buildIcsCalendar([]);

  const swimmerIds = swimmers.map((s) => s.id);
  const swimmerMap = Object.fromEntries(
    swimmers.map((s) => [s.id, `${s.first_name} ${s.last_name}`])
  );

  // Get active class assignments
  const { data: enrollments } = await supabase
    .from("class_assignments")
    .select(`
      id, swimmer_id,
      class:classes!inner(
        id, level, day_of_week, start_time, end_time,
        session:sessions!inner(start_date, end_date, status)
      )
    `)
    .in("swimmer_id", swimmerIds)
    .eq("status", "active");

  if (!enrollments?.length) return buildIcsCalendar([]);

  // Get all cancellations for these classes
  const classIds = enrollments.map((e) => {
    const cls = Array.isArray(e.class) ? e.class[0] : e.class;
    return cls?.id;
  }).filter(Boolean) as string[];

  const { data: cancellations } = await supabase
    .from("cancellations")
    .select("class_id, cancelled_date")
    .in("class_id", classIds);

  const cancelMap = new Map<string, string[]>();
  for (const c of cancellations ?? []) {
    const existing = cancelMap.get(c.class_id) ?? [];
    existing.push(c.cancelled_date);
    cancelMap.set(c.class_id, existing);
  }

  // Generate events
  const allEvents: { uid: string; summary: string; startDate: string; startTime: string; endTime: string }[] = [];

  for (const enrollment of enrollments) {
    const cls = Array.isArray(enrollment.class) ? enrollment.class[0] : enrollment.class;
    if (!cls) continue;
    const session = Array.isArray(cls.session) ? cls.session[0] : cls.session;
    if (!session || session.status === "cancelled") continue;

    const swimmerName = swimmerMap[enrollment.swimmer_id] ?? "Swimmer";
    const cancelled = cancelMap.get(cls.id) ?? [];

    const dates = generateLessonDates(
      session.start_date,
      session.end_date,
      cls.day_of_week,
      cancelled
    );

    for (let i = 0; i < dates.length; i++) {
      allEvents.push({
        uid: `${enrollment.id}-${i}@hacswim.com`,
        summary: `HAC Swim - Level ${cls.level} (${swimmerName})`,
        startDate: dates[i],
        startTime: cls.start_time,
        endTime: cls.end_time,
      });
    }
  }

  return buildIcsCalendar(allEvents);
}

async function buildInstructorFeed(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string
) {
  // Get classes assigned to this instructor
  const { data: classes } = await supabase
    .from("classes")
    .select(`
      id, level, day_of_week, start_time, end_time,
      session:sessions!inner(name, start_date, end_date, status)
    `)
    .eq("instructor_id", userId);

  if (!classes?.length) return buildIcsCalendar([]);

  const classIds = classes.map((c) => c.id);

  const { data: cancellations } = await supabase
    .from("cancellations")
    .select("class_id, cancelled_date")
    .in("class_id", classIds);

  const cancelMap = new Map<string, string[]>();
  for (const c of cancellations ?? []) {
    const existing = cancelMap.get(c.class_id) ?? [];
    existing.push(c.cancelled_date);
    cancelMap.set(c.class_id, existing);
  }

  const allEvents: { uid: string; summary: string; startDate: string; startTime: string; endTime: string }[] = [];

  for (const cls of classes) {
    const session = Array.isArray(cls.session) ? cls.session[0] : cls.session;
    if (!session || session.status === "cancelled") continue;

    const cancelled = cancelMap.get(cls.id) ?? [];
    const dates = generateLessonDates(
      session.start_date,
      session.end_date,
      cls.day_of_week,
      cancelled
    );

    for (let i = 0; i < dates.length; i++) {
      allEvents.push({
        uid: `instructor-${cls.id}-${i}@hacswim.com`,
        summary: `HAC Swim - Level ${cls.level} (${session.name})`,
        startDate: dates[i],
        startTime: cls.start_time,
        endTime: cls.end_time,
      });
    }
  }

  return buildIcsCalendar(allEvents);
}
