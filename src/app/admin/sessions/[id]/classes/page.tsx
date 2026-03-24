import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClassesManager } from "@/components/admin/sessions/ClassesManager";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export const metadata = { title: "Session Classes" };

export default async function SessionClassesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("id, name, start_date, end_date, status, season_type")
    .eq("id", id)
    .single();

  if (!session) {
    redirect("/admin/sessions");
  }

  const dateRange = [
    session.start_date
      ? format(parseISO(session.start_date), "MMM d, yyyy")
      : "TBD",
    session.end_date
      ? format(parseISO(session.end_date), "MMM d, yyyy")
      : "TBD",
  ].join(" – ");

  return (
    <div className="space-y-4">
      <Link href="/admin/sessions">
        <Button variant="ghost" size="sm" className="-ml-2">
          <ChevronLeft className="mr-1 size-4" />
          Back to Sessions
        </Button>
      </Link>

      <ClassesManager
        sessionId={session.id}
        sessionName={session.name}
        sessionDates={dateRange}
        seasonType={session.season_type}
      />
    </div>
  );
}
