"use server";

import { createAdminClient } from "@/lib/supabase/admin";

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

  // 4. Send password reset email
  const { error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email: input.email,
  });

  if (linkError) {
    // Non-fatal — instructor was created, just log the email issue
    console.error("Failed to generate recovery link:", linkError.message);
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

  // Update email if changed
  const { data: existing } = await supabaseAdmin.auth.admin.getUserById(input.id);
  if (existing?.user?.email !== input.email) {
    await supabaseAdmin.auth.admin.updateUserById(input.id, {
      email: input.email,
      email_confirm: true,
    });
  }

  return { success: true };
}
