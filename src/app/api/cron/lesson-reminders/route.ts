import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotificationEmail, lessonReminderEmail } from "@/lib/email";
import { getLevelName } from "@/lib/swim-utils";

export async function GET(request: Request) {
  // Verify cron secret (Vercel Cron sends this header)
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Tomorrow's date and day name
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = tomorrow.toISOString().split("T")[0];
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const tomorrowDay = dayNames[tomorrow.getDay()];
  const tomorrowFormatted = tomorrow.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // Check for cancellations on this date
  const { data: cancellations } = await supabase
    .from("cancellations")
    .select("class_id")
    .eq("cancelled_date", tomorrowDate);

  const cancelledClassIds = new Set((cancellations ?? []).map((c) => c.class_id));

  // Get active sessions
  const { data: sessions } = await supabase
    .from("sessions")
    .select("id")
    .in("status", ["enrollment_open", "in_progress"])
    .lte("start_date", tomorrowDate)
    .gte("end_date", tomorrowDate);

  if (!sessions?.length) {
    return NextResponse.json({ sent: 0, reason: "no_active_sessions" });
  }

  const sessionIds = sessions.map((s) => s.id);

  // Get classes for tomorrow's day of week
  const { data: classes } = await supabase
    .from("classes")
    .select(`
      id, level, start_time, instructor_id,
      instructor:profiles!classes_instructor_id_fkey(full_name)
    `)
    .in("session_id", sessionIds)
    .eq("is_active", true)
    .contains("day_of_week", [tomorrowDay]);

  if (!classes?.length) {
    return NextResponse.json({ sent: 0, reason: "no_classes_tomorrow" });
  }

  // Filter out cancelled classes
  const activeClasses = classes.filter((c) => !cancelledClassIds.has(c.id));
  if (activeClasses.length === 0) {
    return NextResponse.json({ sent: 0, reason: "all_classes_cancelled" });
  }

  const classIds = activeClasses.map((c) => c.id);

  // Get confirmed enrollments for these classes
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select(`
      id, class_id, swimmer_id,
      swimmer:swimmers(first_name, last_name, family_id)
    `)
    .in("class_id", classIds)
    .eq("status", "confirmed");

  if (!enrollments?.length) {
    return NextResponse.json({ sent: 0, reason: "no_enrollments" });
  }

  // Check which reminders were already sent today (deduplication)
  const { data: existingLogs } = await supabase
    .from("email_logs")
    .select("recipient_email, notification_type")
    .eq("notification_type", "lesson_reminder")
    .gte("created_at", new Date().toISOString().split("T")[0] + "T00:00:00");

  const alreadySent = new Set(
    (existingLogs ?? []).map((l) => `${l.recipient_email}:lesson_reminder`)
  );

  // Build class lookup
  const classMap = new Map(
    activeClasses.map((c) => {
      const instructor = Array.isArray(c.instructor) ? c.instructor[0] : c.instructor;
      return [
        c.id,
        {
          level: c.level,
          startTime: c.start_time.slice(0, 5),
          instructorName: instructor?.full_name ?? "Your Instructor",
        },
      ];
    })
  );

  // Group by family (parent) to avoid sending duplicate emails
  const familyReminders = new Map<
    string,
    { swimmerName: string; level: number; startTime: string; instructorName: string }[]
  >();

  for (const e of enrollments) {
    const sw = Array.isArray(e.swimmer) ? e.swimmer[0] : e.swimmer;
    if (!sw) continue;

    const classInfo = classMap.get(e.class_id);
    if (!classInfo) continue;

    const familyId = sw.family_id;
    const list = familyReminders.get(familyId) ?? [];
    list.push({
      swimmerName: `${sw.first_name} ${sw.last_name}`,
      level: classInfo.level,
      startTime: classInfo.startTime,
      instructorName: classInfo.instructorName,
    });
    familyReminders.set(familyId, list);
  }

  // Get parent profiles
  const parentIds = Array.from(familyReminders.keys());
  const { data: parents } = await supabase
    .from("profiles")
    .select("id, email, full_name, email_notifications")
    .in("id", parentIds);

  const parentMap = new Map(
    (parents ?? []).map((p) => [p.id, p])
  );

  let sentCount = 0;

  for (const [familyId, reminders] of familyReminders) {
    const parent = parentMap.get(familyId);
    if (!parent) continue;

    // Check preferences
    if (parent.email_notifications === false) continue;

    // Dedup check
    const dedupKey = `${parent.email}:lesson_reminder`;
    if (alreadySent.has(dedupKey)) continue;

    // Send one email per swimmer (or could batch, but individual is clearer)
    for (const r of reminders) {
      const template = lessonReminderEmail({
        parentName: parent.full_name?.split(" ")[0] ?? "Parent",
        swimmerName: r.swimmerName,
        level: r.level,
        levelName: getLevelName(r.level),
        day: tomorrowFormatted,
        startTime: r.startTime,
        instructorName: r.instructorName,
      });

      await sendNotificationEmail(familyId, parent.email, template, "lesson_reminder");
      sentCount++;
    }

    alreadySent.add(dedupKey);
  }

  return NextResponse.json({ sent: sentCount, families: familyReminders.size });
}
