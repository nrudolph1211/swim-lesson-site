import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { PrintSchedule } from "@/components/print/PrintSchedule";

export const metadata = { title: "Print Schedule" };

export default async function PrintSchedulePage() {
  const { user, profile } = await getUser();
  if (!user) redirect("/login");
  if (profile?.role !== "instructor" && profile?.role !== "admin") redirect("/login");

  return <PrintSchedule userId={user.id} />;
}
