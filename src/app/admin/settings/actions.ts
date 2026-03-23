"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function inviteAdmin(email: string, fullName: string) {
  const supabaseAdmin = createAdminClient();

  // Create auth user
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (userError) {
    return { error: userError.message };
  }

  const userId = userData.user.id;

  // Set role to admin
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({ role: "admin", full_name: fullName })
    .eq("id", userId);

  if (profileError) {
    return { error: profileError.message };
  }

  // Send password reset email so they can set their password
  const { error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  if (linkError) {
    console.error("Failed to generate recovery link:", linkError.message);
  }

  return { success: true, userId };
}

export async function removeAdmin(userId: string) {
  const supabaseAdmin = createAdminClient();

  // Downgrade to parent role
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ role: "parent" })
    .eq("id", userId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
