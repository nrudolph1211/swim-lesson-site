import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendNotificationEmail,
  enrollmentConfirmedEmail,
  weatherCancellationEmail,
  waitlistPromotedEmail,
  levelPromotionEmail,
} from "@/lib/email";
import { getLevelName } from "@/lib/swim-utils";

/**
 * Internal API for triggering notifications + emails.
 * Called server-side (from server actions, webhooks, cron jobs).
 *
 * POST /api/notifications/trigger
 * Body: { type, data }
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("x-internal-key");
  if (authHeader !== process.env.INTERNAL_API_KEY && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type, data } = await request.json();
  const supabase = createAdminClient();

  try {
    switch (type) {
      case "enrollment_confirmed": {
        const { userId, email, parentName, swimmerName, level, dayOfWeek, startTime, endTime, sessionName } = data;

        await supabase.from("notifications").insert({
          user_id: userId,
          type: "enrollment_confirmed",
          title: "Enrollment Confirmed",
          message: `${swimmerName} is enrolled in L${level} (${dayOfWeek} ${startTime}).`,
          link: "/dashboard",
          read: false,
          email_sent: false,
        });

        const template = enrollmentConfirmedEmail({
          parentName,
          swimmerName,
          level,
          levelName: getLevelName(level),
          dayOfWeek,
          startTime,
          endTime,
          sessionName,
        });

        await sendNotificationEmail(userId, email, template, "enrollment_confirmed");
        break;
      }

      case "enrollment_cancelled": {
        const { userId, swimmerName, level, dayOfWeek, startTime } = data;

        await supabase.from("notifications").insert({
          user_id: userId,
          type: "enrollment_cancelled",
          title: "Enrollment Cancelled",
          message: `${swimmerName}'s L${level} class (${dayOfWeek} ${startTime}) has been cancelled.`,
          link: "/dashboard",
          read: false,
          email_sent: false,
        });
        // No email for cancellations (user-initiated)
        break;
      }

      case "waitlist_promoted": {
        const { userId, email, parentName, swimmerName, level, dayOfWeek, startTime, sessionName } = data;

        await supabase.from("notifications").insert({
          user_id: userId,
          type: "waitlist_promoted",
          title: "Moved off Waitlist!",
          message: `A spot opened up — ${swimmerName} is now enrolled in L${level} (${dayOfWeek} ${startTime}).`,
          link: "/dashboard",
          read: false,
          email_sent: false,
        });

        const template = waitlistPromotedEmail({
          parentName,
          swimmerName,
          level,
          levelName: getLevelName(level),
          dayOfWeek,
          startTime,
          sessionName,
        });

        await sendNotificationEmail(userId, email, template, "waitlist_promoted");
        break;
      }

      case "level_promotion": {
        const { userId, email, parentName, swimmerName, fromLevel, toLevel, swimmerId } = data;

        await supabase.from("notifications").insert({
          user_id: userId,
          type: "level_promotion",
          title: `${swimmerName} Promoted to Level ${toLevel}!`,
          message: `Congratulations! ${swimmerName} has advanced from Level ${fromLevel} to Level ${toLevel}: ${getLevelName(toLevel)}.`,
          link: `/dashboard?swimmer=${swimmerId}`,
          read: false,
          email_sent: false,
        });

        const template = levelPromotionEmail({
          parentName,
          swimmerName,
          fromLevel,
          toLevel,
          toLevelName: getLevelName(toLevel),
          swimmerId,
        });

        await sendNotificationEmail(userId, email, template, "level_promotion");
        break;
      }

      case "makeup_credit": {
        const { userId, swimmerName, credits } = data;

        await supabase.from("notifications").insert({
          user_id: userId,
          type: "makeup_credit",
          title: "Make-Up Credit Issued",
          message: `${swimmerName} received a make-up credit. You now have ${credits} credit${credits !== 1 ? "s" : ""} available.`,
          link: "/dashboard",
          read: false,
          email_sent: false,
        });
        // weather_cancellation email already handles this — no separate email
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown notification type: ${type}` }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Notification trigger error:", err);
    return NextResponse.json({ error: "Failed to trigger notification" }, { status: 500 });
  }
}
