import { createAdminClient } from "@/lib/supabase/admin";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL ?? "HAC Swim <noreply@hacswim.com>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hacswim.com";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  type: string;
}

export async function sendEmail({ to, subject, html, type }: SendEmailInput) {
  const supabase = createAdminClient();
  let resendMessageId: string | null = null;
  let errorMessage: string | null = null;
  let status: "sent" | "failed" = "sent";

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message ?? `Resend API error: ${res.status}`);
    }

    const data = await res.json();
    resendMessageId = data.id ?? null;
  } catch (err) {
    status = "failed";
    errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error(`Email send failed [${type}] to ${to}:`, errorMessage);
  }

  // Log every attempt
  await supabase.from("email_logs").insert({
    recipient_email: to,
    subject,
    notification_type: type,
    status,
    resend_message_id: resendMessageId,
    error_message: errorMessage,
  });

  return { success: status === "sent", messageId: resendMessageId };
}

// ============================================================
// Branded wrapper
// ============================================================

function brandedHtml(body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:580px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
        <!-- Header -->
        <tr>
          <td style="background:#1B4F72;padding:24px 32px;text-align:center">
            <span style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px">HAC Swim</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;color:#1a1a1a;font-size:15px;line-height:1.6">
            ${body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#1B4F72;padding:20px 32px;text-align:center;font-size:12px;color:#a0c4e8">
            Heights Athletic Club &bull; Harker Heights, TX<br/>
            <a href="${SITE_URL}" style="color:#ffffff;text-decoration:none">hacswim.com</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;padding:12px 28px;background:#2E86C1;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;margin:16px 0">${label}</a>`;
}

// ============================================================
// 7 email templates
// ============================================================

export function enrollmentConfirmedEmail(data: {
  parentName: string;
  swimmerName: string;
  level: number;
  levelName: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  sessionName: string;
}) {
  const body = `
    <h2 style="margin:0 0 8px;color:#1B4F72">Enrollment Confirmed!</h2>
    <p>Hi ${data.parentName},</p>
    <p><strong>${data.swimmerName}</strong> is enrolled in swim lessons!</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;width:120px">Level</td><td style="padding:8px 0;border-bottom:1px solid #eee">Level ${data.level}: ${data.levelName}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">Day</td><td style="padding:8px 0;border-bottom:1px solid #eee">${data.dayOfWeek}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">Time</td><td style="padding:8px 0;border-bottom:1px solid #eee">${data.startTime} – ${data.endTime}</td></tr>
      <tr><td style="padding:8px 0;font-weight:600">Session</td><td style="padding:8px 0">${data.sessionName}</td></tr>
    </table>
    <p><strong>What to bring:</strong> Swimsuit, towel, goggles, and sunscreen. Arrive 5 minutes early for the first lesson.</p>
    <p style="color:#b45309;font-weight:500">Reminder: Please ensure your waiver is signed before the first class.</p>
    ${btn("View Dashboard", `${SITE_URL}/dashboard`)}
  `;
  return {
    subject: `Enrollment Confirmed: ${data.swimmerName} — Level ${data.level}`,
    html: brandedHtml(body),
  };
}

export function bookingReceiptEmail(data: {
  parentName: string;
  swimmerName: string;
  amount: string;
  method: string;
  date: string;
  level: number;
  levelName: string;
  dayOfWeek: string;
  startTime: string;
  sessionName: string;
}) {
  const body = `
    <h2 style="margin:0 0 8px;color:#1B4F72">Payment Receipt</h2>
    <p>Hi ${data.parentName},</p>
    <p>We've received your payment. Here are the details:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;width:120px">Amount</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:18px;font-weight:700">${data.amount}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">Method</td><td style="padding:8px 0;border-bottom:1px solid #eee">${data.method}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">Date</td><td style="padding:8px 0;border-bottom:1px solid #eee">${data.date}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">Swimmer</td><td style="padding:8px 0;border-bottom:1px solid #eee">${data.swimmerName}</td></tr>
      <tr><td style="padding:8px 0;font-weight:600">Class</td><td style="padding:8px 0">L${data.level}: ${data.levelName} — ${data.dayOfWeek} ${data.startTime} (${data.sessionName})</td></tr>
    </table>
    ${btn("View Dashboard", `${SITE_URL}/dashboard`)}
  `;
  return {
    subject: `Payment Receipt — $${data.amount}`,
    html: brandedHtml(body),
  };
}

export function weatherCancellationEmail(data: {
  parentName: string;
  swimmerName: string;
  date: string;
  reason: string;
  level: number;
  startTime: string;
  makeupCredits: number;
}) {
  const body = `
    <h2 style="margin:0 0 8px;color:#b45309">Class Cancelled</h2>
    <p>Hi ${data.parentName},</p>
    <p>We're sorry to inform you that <strong>${data.swimmerName}'s</strong> L${data.level} class at ${data.startTime} on <strong>${data.date}</strong> has been cancelled.</p>
    <p><strong>Reason:</strong> ${data.reason}</p>
    <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0;font-weight:600;color:#92400e">Make-Up Credit Issued</p>
      <p style="margin:4px 0 0;color:#78350f">You now have <strong>${data.makeupCredits}</strong> make-up credit${data.makeupCredits !== 1 ? "s" : ""} available. Use them to attend another class at the same level before the end of the session.</p>
    </div>
    ${btn("Book Make-Up Class", `${SITE_URL}/dashboard`)}
  `;
  return {
    subject: `Class Cancelled — ${data.date} (${data.reason})`,
    html: brandedHtml(body),
  };
}

export function waiverExpiringEmail(data: {
  parentName: string;
  swimmerName: string;
  expiryDate: string;
  swimmerId: string;
}) {
  const body = `
    <h2 style="margin:0 0 8px;color:#b45309">Waiver Expiring Soon</h2>
    <p>Hi ${data.parentName},</p>
    <p>The liability waiver for <strong>${data.swimmerName}</strong> will expire on <strong>${data.expiryDate}</strong>.</p>
    <p>Please renew it before the next class to avoid any interruptions.</p>
    ${btn("Sign Waiver", `${SITE_URL}/waiver/${data.swimmerId}`)}
  `;
  return {
    subject: `Waiver Expiring: ${data.swimmerName} — ${data.expiryDate}`,
    html: brandedHtml(body),
  };
}

export function waitlistPromotedEmail(data: {
  parentName: string;
  swimmerName: string;
  level: number;
  levelName: string;
  dayOfWeek: string;
  startTime: string;
  sessionName: string;
}) {
  const body = `
    <h2 style="margin:0 0 8px;color:#059669">A Spot Opened Up!</h2>
    <p>Hi ${data.parentName},</p>
    <p>Great news! A spot has opened up and <strong>${data.swimmerName}</strong> has been moved off the waitlist.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;width:120px">Level</td><td style="padding:8px 0;border-bottom:1px solid #eee">Level ${data.level}: ${data.levelName}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">Day</td><td style="padding:8px 0;border-bottom:1px solid #eee">${data.dayOfWeek}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">Time</td><td style="padding:8px 0;border-bottom:1px solid #eee">${data.startTime}</td></tr>
      <tr><td style="padding:8px 0;font-weight:600">Session</td><td style="padding:8px 0">${data.sessionName}</td></tr>
    </table>
    <p>Your enrollment is now confirmed. Please complete payment if you haven't already.</p>
    ${btn("View Dashboard", `${SITE_URL}/dashboard`)}
  `;
  return {
    subject: `Waitlist Update: ${data.swimmerName} is enrolled!`,
    html: brandedHtml(body),
  };
}

export function lessonReminderEmail(data: {
  parentName: string;
  swimmerName: string;
  level: number;
  levelName: string;
  day: string;
  startTime: string;
  instructorName: string;
}) {
  const body = `
    <h2 style="margin:0 0 8px;color:#1B4F72">Lesson Tomorrow!</h2>
    <p>Hi ${data.parentName},</p>
    <p>Just a friendly reminder that <strong>${data.swimmerName}</strong> has swim lessons tomorrow.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;width:120px">Day</td><td style="padding:8px 0;border-bottom:1px solid #eee">${data.day}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">Time</td><td style="padding:8px 0;border-bottom:1px solid #eee">${data.startTime}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">Level</td><td style="padding:8px 0;border-bottom:1px solid #eee">L${data.level}: ${data.levelName}</td></tr>
      <tr><td style="padding:8px 0;font-weight:600">Instructor</td><td style="padding:8px 0">${data.instructorName}</td></tr>
    </table>
    <p><strong>What to bring:</strong> Swimsuit, towel, goggles, and sunscreen. Arrive 5 minutes early.</p>
    ${btn("View Schedule", `${SITE_URL}/dashboard`)}
  `;
  return {
    subject: `Swim Lesson Tomorrow: ${data.swimmerName} — ${data.startTime}`,
    html: brandedHtml(body),
  };
}

export function levelPromotionEmail(data: {
  parentName: string;
  swimmerName: string;
  fromLevel: number;
  toLevel: number;
  toLevelName: string;
  swimmerId: string;
}) {
  const body = `
    <h2 style="margin:0 0 8px;color:#059669">Congratulations! 🎉</h2>
    <p>Hi ${data.parentName},</p>
    <p>We're thrilled to share that <strong>${data.swimmerName}</strong> has been promoted from <strong>Level ${data.fromLevel}</strong> to <strong>Level ${data.toLevel}: ${data.toLevelName}</strong>!</p>
    <p>Your child has demonstrated all the skills required to move up. This is a great achievement!</p>
    <div style="background:#ecfdf5;border:1px solid #34d399;border-radius:8px;padding:16px;margin:16px 0;text-align:center">
      <p style="margin:0;font-size:20px;font-weight:700;color:#059669">Level ${data.fromLevel} → Level ${data.toLevel}</p>
      <p style="margin:4px 0 0;color:#047857">${data.toLevelName}</p>
    </div>
    <p>You can view ${data.swimmerName}'s progress report and skills breakdown on the dashboard.</p>
    ${btn("View Progress", `${SITE_URL}/dashboard?swimmer=${data.swimmerId}`)}
  `;
  return {
    subject: `${data.swimmerName} Promoted to Level ${data.toLevel}! 🎉`,
    html: brandedHtml(body),
  };
}

// ============================================================
// Bulk / campaign email
// ============================================================

export function campaignEmail(data: {
  subject: string;
  bodyHtml: string;
}) {
  return {
    subject: data.subject,
    html: brandedHtml(data.bodyHtml),
  };
}

// ============================================================
// Helper: check email preference + send
// ============================================================

export async function sendNotificationEmail(
  userId: string,
  emailAddress: string,
  template: { subject: string; html: string },
  type: string
) {
  const supabase = createAdminClient();

  // Check email_notifications preference
  const { data: profile } = await supabase
    .from("profiles")
    .select("email_notifications")
    .eq("id", userId)
    .single();

  if (profile?.email_notifications === false) {
    return { success: false, reason: "email_notifications_disabled" };
  }

  const result = await sendEmail({
    to: emailAddress,
    subject: template.subject,
    html: template.html,
    type,
  });

  // Mark notification as email_sent
  if (result.success) {
    await supabase
      .from("notifications")
      .update({ email_sent: true })
      .eq("user_id", userId)
      .eq("type", type)
      .eq("email_sent", false)
      .order("created_at", { ascending: false })
      .limit(1);
  }

  return result;
}
