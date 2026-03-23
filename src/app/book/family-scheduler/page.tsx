import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { FamilyScheduler } from "@/components/book/FamilyScheduler";

export const metadata = {
  title: "Family Scheduler",
  description: "Find the best class schedule for your whole family.",
};

export default async function FamilySchedulerPage() {
  const { user } = await getUser();
  if (!user) redirect("/login?redirect=/book/family-scheduler");

  return <FamilyScheduler />;
}
