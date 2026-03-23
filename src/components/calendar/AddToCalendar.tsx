"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar, Download, Link2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { buildEnrollmentIcs } from "@/lib/ics";
import { toast } from "sonner";
import type { EnrollmentWithDetails } from "@/hooks/useEnrollments";

interface AddToCalendarProps {
  enrollment: EnrollmentWithDetails;
}

export function AddToCalendar({ enrollment }: AddToCalendarProps) {
  const supabase = createClient();
  const { user } = useAuthContext();
  const [loading, setLoading] = useState(false);

  const cls = enrollment.class;
  const swimmer = enrollment.swimmer;
  const session = cls?.session;

  const handleDownloadIcs = useCallback(async () => {
    if (!cls || !session || !swimmer) return;
    setLoading(true);

    try {
      // Fetch cancelled dates for this class
      const { data: cancellations } = await supabase
        .from("cancellations")
        .select("cancelled_date")
        .eq("class_id", cls.id);

      const cancelledDates = (cancellations ?? []).map((c) => c.cancelled_date);

      const ics = buildEnrollmentIcs({
        id: enrollment.id,
        swimmerName: `${swimmer.first_name} ${swimmer.last_name}`,
        level: cls.level,
        daysOfWeek: cls.day_of_week,
        startTime: cls.start_time,
        endTime: cls.end_time,
        sessionStart: session.start_date,
        sessionEnd: session.end_date,
        cancelledDates,
      });

      const blob = new Blob([ics], { type: "text/calendar" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `hac-swim-${swimmer.first_name.toLowerCase()}-l${cls.level}.ics`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Calendar file downloaded.");
    } catch {
      toast.error("Failed to generate calendar file.");
    } finally {
      setLoading(false);
    }
  }, [supabase, enrollment, cls, session, swimmer]);

  const handleCopyUrl = useCallback(async () => {
    if (!user) return;

    try {
      // Ensure calendar_token exists
      const { data: profile } = await supabase
        .from("profiles")
        .select("calendar_token")
        .eq("id", user.id)
        .single();

      let token = profile?.calendar_token;
      if (!token) {
        token = crypto.randomUUID();
        await supabase
          .from("profiles")
          .update({ calendar_token: token })
          .eq("id", user.id);
      }

      const url = `${window.location.origin}/api/calendar-feed?token=${token}`;
      await navigator.clipboard.writeText(url);
      toast.success("Calendar subscription URL copied!");
    } catch {
      toast.error("Failed to copy calendar URL.");
    }
  }, [supabase, user]);

  if (!cls || !session) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm">
            {loading ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : (
              <Calendar className="mr-1 size-3.5" />
            )}
            Calendar
          </Button>
        }
      />
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={handleDownloadIcs}>
          <Download className="mr-2 size-4" />
          Download .ics
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyUrl}>
          <Link2 className="mr-2 size-4" />
          Copy Subscription URL
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
