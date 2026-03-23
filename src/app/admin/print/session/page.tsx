import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { PrintSession } from "@/components/print/PrintSession";

export const metadata = { title: "Print Session Overview" };

export default async function PrintSessionPage() {
  const { user, profile } = await getUser();
  if (!user) redirect("/login");
  if (profile?.role !== "admin") redirect("/dashboard");

  return <PrintSession />;
}
