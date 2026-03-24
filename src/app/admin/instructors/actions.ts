"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

interface CreateInstructorInput {
  full_name: string;
  email: string;
  phone: string;
  bio: string;
  photo_url: string;
  is_active: boolean;
  display_on_website: boolean;
  hourly_rate: number | null;
  certifications: { name: string; expiry_date: string }[];
}

interface UpdateInstructorInput extends CreateInstructorInput {
  id: string;
}

function instructorInviteHtml(name: string, setupUrl: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hacswim.com";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 16px"><tr><td align="center">
<table width="100%" style="max-width:580px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
  <tr><td style="background:#1B4F72;padding:24px 32px;text-align:center">
    <span style="font-size:24px;font-weight:700;color:#fff;letter-spacing:-0.5px">HAC Swim</span>
  </td></tr>
  <tr><td style="padding:32px;color:#1a1a1a;font-size:15px;line-height:1.6">
    <h2 style="margin:0 0 8px;color:#1B4F72">Welcome to HAC Swim!</h2>
    <p>Hi ${name},</p>
    <p>You've been invited to join Heights Athletic Club as a swim instructor.</p>
    <p>Click the button below to set up your password and access the instructor portal where you can:</p>
    <ul style="color:#555;margin:12px 0">
      <li>View your class schedule</li>
      <li>Clock in/out and track hours</li>
      <li>Take attendance and track skill progress</li>
      <li>Add notes for students</li>
    </ul>
    <a href="${setupUrl}" style="display:inline-block;padding:14px 32px;background:#2E86C1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;margin:16px 0">Set Up Your Account</a>
    <p style="color:#999;font-size:13px;margin-top:16px">This link expires in 24 hours. If you have questions, contact the pool manager.</p>
  </td></tr>
  <tr><td style="background:#1B4F72;padding:20px 32px;text-align:center;font-size:12px;color:#a0c4e8">
    Heights Athletic Club &bull; Harker Heights, TX<br/>
    <a href="${siteUrl}" style="color:#fff;text-decoration:none">hacswim.com</a>
  </td></tr>
</table>
</td></tr></table></body></html>`;
}

export async function createInstructor(input: CreateInstructorInput) {
  const supabaseAdmin = createAdminClient();

  // 1. Create auth user
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    email_confirm: true,
    user_metadata: { full_name: input.full_name },
  });

  if (userError) {
    return { error: userError.message };
  }

  const userId = userData.user.id;

  // 2. Update profile
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({
      role: "instructor",
      full_name: input.full_name,
      phone: input.phone || null,
    })
    .eq("id", userId);

  if (profileError) {
    return { error: profileError.message };
  }

  // 3. Create instructor record
  const { error: instructorError } = await supabaseAdmin
    .from("instructors")
    .insert({
      id: userId,
      bio: input.bio || null,
      certifications: input.certifications,
      is_active: input.is_active,
      photo_url: input.photo_url || null,
      display_on_website: input.display_on_website,
      hourly_rate: input.hourly_rate,
    });

  if (instructorError) {
    return { error: instructorError.message };
  }

  // 4. Generate a password setup link and send via Resend
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hacswim.com";
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email: input.email,
  });

  if (linkError) {
    console.error("Failed to generate recovery link:", linkError.message);
  } else if (linkData?.properties?.hashed_token) {
    // Build a client-friendly URL that redirects through our app
    const setupUrl = `${siteUrl}/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=recovery&next=/instructor/setup`;

    try {
      await sendEmail({
        to: input.email,
        subject: "Welcome to HAC Swim — Set Up Your Account",
        html: instructorInviteHtml(input.full_name, setupUrl),
        type: "instructor_invite",
      });
    } catch (err) {
      console.error("Failed to send instructor invite email:", err);
    }
  }

  return { success: true, userId };
}

export async function updateInstructor(input: UpdateInstructorInput) {
  const supabaseAdmin = createAdminClient();

  // Update profile
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({
      full_name: input.full_name,
      phone: input.phone || null,
    })
    .eq("id", input.id);

  if (profileError) {
    return { error: profileError.message };
  }

  // Update instructor record
  const { error: instructorError } = await supabaseAdmin
    .from("instructors")
    .update({
      bio: input.bio || null,
      certifications: input.certifications,
      is_active: input.is_active,
      photo_url: input.photo_url || null,
      display_on_website: input.display_on_website,
      hourly_rate: input.hourly_rate,
    })
    .eq("id", input.id);

  if (instructorError) {
    return { error: instructorError.message };
  }

  // When deactivating an instructor, unassign them from all active classes
  if (!input.is_active) {
    await supabaseAdmin
      .from("classes")
      .update({ instructor_id: null })
      .eq("instructor_id", input.id)
      .eq("is_active", true);
  }

  // Update email if changed (skip if email is empty — client doesn't have access to auth email)
  if (input.email) {
    const { data: existing } = await supabaseAdmin.auth.admin.getUserById(input.id);
    if (existing?.user?.email !== input.email) {
      await supabaseAdmin.auth.admin.updateUserById(input.id, {
        email: input.email,
        email_confirm: true,
      });
    }
  }

  return { success: true };
}
