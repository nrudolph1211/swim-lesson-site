import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { InstructorPortal } from "@/components/instructor/InstructorPortal";

export const metadata = {
  title: "Instructor Portal",
};

export default async function InstructorPage() {
  const { user, profile } = await getUser();

  if (!user) {
    redirect("/login?redirect=/instructor");
  }

  if (profile?.role !== "instructor" && profile?.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <InstructorPortal
      userId={user.id}
      userName={profile?.full_name ?? "Instructor"}
    />
  );
}
