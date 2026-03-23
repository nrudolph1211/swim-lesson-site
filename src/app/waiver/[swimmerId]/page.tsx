import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WaiverForm } from "@/components/waiver/WaiverForm";

export const metadata = {
  title: "Sign Waiver",
};

export default async function WaiverPage({
  params,
}: {
  params: Promise<{ swimmerId: string }>;
}) {
  const { swimmerId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/waiver/${swimmerId}`);
  }

  // Verify swimmer belongs to this user
  const { data: swimmer } = await supabase
    .from("swimmers")
    .select("id, family_id, first_name, last_name, date_of_birth, current_level, medical_notes, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, swim_experience, is_active, created_at, updated_at")
    .eq("id", swimmerId)
    .eq("family_id", user.id)
    .single();

  if (!swimmer) {
    redirect("/dashboard");
  }

  return <WaiverForm swimmer={swimmer} />;
}
