"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineError } from "@/components/ui/inline-error";

interface TimeEntry {
  id: string;
  clock_in: string;
  clock_out: string | null;
  hours_worked: number | null;
  status: string;
}

export function ClockInOut({ userId }: { userId: string }) {
  const supabase = createClient();
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([]);
  const [weekHours, setWeekHours] = useState(0);
  const [periodHours, setPeriodHours] = useState(0);
  const [elapsed, setElapsed] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Active entry (clocked in, no clock_out)
      const { data: active, error: activeErr } = await supabase
        .from("time_entries")
        .select("id, clock_in, clock_out, hours_worked, status")
        .eq("instructor_id", userId)
        .is("clock_out", null)
        .eq("status", "clocked_in")
        .limit(1)
        .maybeSingle();

      if (activeErr) throw activeErr;
      setActiveEntry(active);

      // Recent entries
      const { data: recent, error: recentErr } = await supabase
        .from("time_entries")
        .select("id, clock_in, clock_out, hours_worked, status")
        .eq("instructor_id", userId)
        .not("clock_out", "is", null)
        .order("clock_in", { ascending: false })
        .limit(5);

      if (recentErr) throw recentErr;
      setRecentEntries(recent ?? []);

      // Week hours (Monday to now)
      const now = new Date();
      const dayOfWeek = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
      monday.setHours(0, 0, 0, 0);

      const { data: weekEntries } = await supabase
        .from("time_entries")
        .select("hours_worked")
        .eq("instructor_id", userId)
        .gte("clock_in", monday.toISOString())
        .not("hours_worked", "is", null);

      setWeekHours(
        (weekEntries ?? []).reduce((sum, e) => sum + (e.hours_worked ?? 0), 0)
      );

      // Pay period hours (1st and 16th)
      const periodStart = new Date(now);
      periodStart.setDate(now.getDate() >= 16 ? 16 : 1);
      periodStart.setHours(0, 0, 0, 0);

      const { data: periodEntries } = await supabase
        .from("time_entries")
        .select("hours_worked")
        .eq("instructor_id", userId)
        .gte("clock_in", periodStart.toISOString())
        .not("hours_worked", "is", null);

      setPeriodHours(
        (periodEntries ?? []).reduce((sum, e) => sum + (e.hours_worked ?? 0), 0)
      );
    } catch {
      setError("Failed to load time tracking data.");
      toast.error("Failed to load time tracking data.", { duration: Infinity });
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Live timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (activeEntry) {
      const update = () => {
        const start = new Date(activeEntry.clock_in).getTime();
        const diff = Date.now() - start;
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        setElapsed(`${hours}h ${mins}m`);
      };
      update();
      timerRef.current = setInterval(update, 1000);
    } else {
      setElapsed("");
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeEntry]);

  const handleClockIn = async () => {
    setActing(true);
    try {
      // Guard: check for existing active entry to prevent double clock-in
      const { data: existing } = await supabase
        .from("time_entries")
        .select("id")
        .eq("instructor_id", userId)
        .is("clock_out", null)
        .eq("status", "clocked_in")
        .limit(1)
        .maybeSingle();

      if (existing) {
        toast.error("You are already clocked in.");
        await fetchData();
        return;
      }

      const { error } = await supabase.from("time_entries").insert({
        instructor_id: userId,
        clock_in: new Date().toISOString(),
        status: "clocked_in",
      });
      if (error) throw error;
      toast.success("Clocked in!");
      await fetchData();
    } catch {
      toast.error("Failed to clock in.");
    } finally {
      setActing(false);
    }
  };

  const handleClockOut = async () => {
    if (!activeEntry) return;
    setActing(true);
    try {
      const clockOut = new Date();
      const clockIn = new Date(activeEntry.clock_in);
      const hoursWorked = Number(
        ((clockOut.getTime() - clockIn.getTime()) / 3600000).toFixed(2)
      );

      const { error } = await supabase
        .from("time_entries")
        .update({
          clock_out: clockOut.toISOString(),
          hours_worked: hoursWorked,
          status: "completed",
        })
        .eq("id", activeEntry.id);
      if (error) throw error;
      toast.success(`Clocked out! ${hoursWorked}h logged.`);
      await fetchData();
    } catch {
      toast.error("Failed to clock out.");
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 rounded-xl border-2 bg-card p-4">
        <Skeleton className="mx-auto h-14 w-full rounded-md" />
        <div className="flex justify-center gap-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    );
  }

  if (error) {
    return <InlineError message={error} onRetry={fetchData} />;
  }

  return (
    <div className="space-y-3 rounded-xl border-2 bg-card p-4">
      {/* Clock Button */}
      {activeEntry ? (
        <div className="space-y-2">
          <p className="text-center text-lg font-bold">
            Clocked in: {elapsed}
          </p>
          <Button
            onClick={handleClockOut}
            disabled={acting}
            className="h-14 w-full min-h-[56px] text-lg font-bold active:scale-[0.97]"
            variant="destructive"
          >
            {acting ? <Loader2 className="mr-2 size-5 animate-spin" /> : null}
            Clock Out
          </Button>
        </div>
      ) : (
        <Button
          onClick={handleClockIn}
          disabled={acting}
          className="h-14 w-full min-h-[56px] bg-green-600 text-lg font-bold hover:bg-green-700 active:scale-[0.97]"
        >
          {acting ? <Loader2 className="mr-2 size-5 animate-spin" /> : null}
          Clock In
        </Button>
      )}

      {/* Stats */}
      <div className="flex justify-center gap-6 text-sm font-medium">
        <span>This Week: {weekHours.toFixed(1)}h</span>
        <span className="text-muted-foreground">|</span>
        <span>Pay Period: {periodHours.toFixed(1)}h</span>
      </div>

      {/* Recent Log */}
      {recentEntries.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground">Recent</p>
          {recentEntries.map((e) => {
            const d = new Date(e.clock_in);
            const day = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
            const timeIn = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
            const timeOut = e.clock_out
              ? new Date(e.clock_out).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
              : "—";
            return (
              <div
                key={e.id}
                className="flex justify-between text-xs text-muted-foreground"
              >
                <span>{day}</span>
                <span>{timeIn} – {timeOut}</span>
                <span className="font-medium">{e.hours_worked ?? 0}h</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
