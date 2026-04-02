import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { PrintRoster } from "@/components/print/PrintRoster";

export const metadata = { title: "Print Roster" };

export default async function PrintRosterPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { user, profile } = await getUser();
  if (!user) redirect("/login");
  if (profile?.role !== "instructor" && profile?.role !== "admin") redirect("/login");

  const { classId } = await params;
  return <PrintRoster classId={classId} />;
}
