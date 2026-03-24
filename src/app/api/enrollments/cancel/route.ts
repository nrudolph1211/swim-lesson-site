import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLevelName } from "@/lib/swim-utils";

/**
 * POST /api/enrollments/cancel
 * Body: { enrollmentId: string }
 *
 * Cancels an enrollment for the authenticated parent, triggers notification,
 * and auto-promotes the next waitlisted swimmer for the same class.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { enrollmentId } = await request.json();
  if (!enrollmentId) {
    return NextResponse.json({ error: "enrollmentId is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Fetch the enrollment and verify ownership
  const { data: enrollment, error: fetchErr } = await admin
    .from("enrollments")
    .select(
      `id, swimmer_id, class_id, status, payment_status,
       swimmer:swimmers!inner(first_name, last_name, family_id, current_level),
       class:classes!inner(level, day_of_week, start_time, session:sessions!inner(name, start_date))`
    )
    .eq("id", enrollmentId)
    .single();

  if (fetchErr || !enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  const swimmer = Array.isArray(enrollment.swimmer)
    ? enrollment.swimmer[0]
    : enrollment.swimmer;
  const cls = Array.isArray(enrollment.class)
    ? enrollment.class[0]
    : enrollment.class;
  const session = Array.isArray(cls?.session) ? cls.session[0] : cls?.session;

  // Verify the enrollment belongs to the authenticated user
  if (swimmer?.family_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (enrollment.status === "cancelled") {
    return NextResponse.json({ error: "Already cancelled" }, { status: 400 });
  }

  // Cancel the enrollment
  const { error: updateErr } = await admin
    .from("enrollments")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", enrollmentId);

  if (updateErr) {
    return NextResponse.json({ error: "Failed to cancel" }, { status: 500 });
  }

  // Create in-app notification for the parent
  const dayOfWeek = Array.isArray(cls?.day_of_week)
    ? cls.day_of_week.join(", ")
    : cls?.day_of_week ?? "";
  const startTime = cls?.start_time?.slice(0, 5) ?? "";

  await admin.from("notifications").insert({
    user_id: user.id,
    type: "enrollment_cancelled",
    title: "Enrollment Cancelled",
    message: `${swimmer?.first_name} ${swimmer?.last_name}'s L${cls?.level} class (${dayOfWeek} ${startTime}) has been cancelled.`,
    link: "/dashboard",
    read: false,
    email_sent: false,
  });

  // Auto-promote next waitlisted swimmer for the same class
  if (enrollment.status === "confirmed") {
    const { data: nextWaitlisted } = await admin
      .from("enrollments")
      .select(
        `id, swimmer_id,
         swimmer:swimmers!inner(first_name, last_name, family_id),
         class:classes!inner(level, day_of_week, start_time)`
      )
      .eq("class_id", enrollment.class_id)
      .eq("status", "waitlisted")
      .order("enrolled_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextWaitlisted) {
      const { error: promoteErr } = await admin
        .from("enrollments")
        .update({ status: "confirmed", waitlist_position: null })
        .eq("id", nextWaitlisted.id);

      if (!promoteErr) {
        const promotedSwimmer = Array.isArray(nextWaitlisted.swimmer)
          ? nextWaitlisted.swimmer[0]
          : nextWaitlisted.swimmer;
        const promotedCls = Array.isArray(nextWaitlisted.class)
          ? nextWaitlisted.class[0]
          : nextWaitlisted.class;

        if (promotedSwimmer?.family_id) {
          // Get parent email for waitlist promotion notification
          const { data: parentProfile } = await admin
            .from("profiles")
            .select("email, full_name")
            .eq("id", promotedSwimmer.family_id)
            .single();

          if (parentProfile) {
            // Trigger waitlist_promoted notification + email via internal API
            try {
              const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
              await fetch(`${baseUrl}/api/notifications/trigger`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-internal-key": process.env.INTERNAL_API_KEY ?? "",
                },
                body: JSON.stringify({
                  type: "waitlist_promoted",
                  data: {
                    userId: promotedSwimmer.family_id,
                    email: parentProfile.email,
                    parentName: parentProfile.full_name?.split(" ")[0] ?? "Parent",
                    swimmerName: `${promotedSwimmer.first_name} ${promotedSwimmer.last_name}`,
                    level: promotedCls?.level,
                    levelName: getLevelName(promotedCls?.level ?? 1),
                    dayOfWeek: Array.isArray(promotedCls?.day_of_week)
                      ? promotedCls.day_of_week.join(", ")
                      : "",
                    startTime: promotedCls?.start_time?.slice(0, 5) ?? "",
                    sessionName: session?.name ?? "",
                  },
                }),
              });
            } catch {
              // Non-blocking: notification failure shouldn't fail the cancellation
              console.error("Failed to send waitlist promotion notification");
            }
          }
        }
      }
    }
  }

  return NextResponse.json({ success: true });
}
