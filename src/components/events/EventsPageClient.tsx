"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { EventCard, type EventData } from "./EventCard";

export function EventsPageClient() {
  const supabase = createClient();
  const { user } = useAuthContext();
  const [events, setEvents] = useState<EventData[]>([]);
  const [pastEvents, setPastEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPast, setShowPast] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);

    // Active events
    const { data: activeData } = await supabase
      .from("events")
      .select("*, instructor:instructors(profile:profiles(full_name))")
      .in("status", ["registration_open", "full", "in_progress"])
      .order("start_date", { ascending: true });

    // Past events
    const { data: pastData } = await supabase
      .from("events")
      .select("*, instructor:instructors(profile:profiles(full_name))")
      .eq("status", "completed")
      .order("start_date", { ascending: false })
      .limit(10);

    // Get registration counts
    const allEvents = [...(activeData ?? []), ...(pastData ?? [])];
    const eventIds = allEvents.map((e) => e.id);

    let regCounts: Record<string, number> = {};
    if (eventIds.length > 0) {
      // Only count "confirmed" registrations toward capacity.
      // Waitlisted registrations should NOT inflate the count,
      // otherwise the 51st person sees "Full" instead of "Join Waitlist".
      const { data: regs } = await supabase
        .from("event_registrations")
        .select("event_id")
        .in("event_id", eventIds)
        .eq("status", "confirmed");

      for (const r of regs ?? []) {
        regCounts[r.event_id] = (regCounts[r.event_id] ?? 0) + 1;
      }
    }

    const mapEvent = (e: Record<string, unknown>): EventData => {
      const instructor = Array.isArray(e.instructor) ? e.instructor[0] : e.instructor;
      const profile = instructor?.profile;
      const prof = Array.isArray(profile) ? profile[0] : profile;

      return {
        id: e.id as string,
        name: e.name as string,
        description: e.description as string | null,
        event_type: e.event_type as string,
        start_date: e.start_date as string,
        end_date: e.end_date as string,
        daily_start_time: e.daily_start_time as string | null,
        daily_end_time: e.daily_end_time as string | null,
        level_min: e.level_min as number,
        level_max: e.level_max as number,
        max_capacity: e.max_capacity as number,
        member_price: Number(e.member_price),
        non_member_price: Number(e.non_member_price),
        military_price: Number(e.military_price),
        instructor_name: prof?.full_name ?? null,
        status: e.status as string,
        image_url: e.image_url as string | null,
        registered_count: regCounts[e.id as string] ?? 0,
      };
    };

    setEvents((activeData ?? []).map(mapEvent));
    setPastEvents((pastData ?? []).map(mapEvent));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div>
        <h1 className="font-heading text-3xl font-bold">Camps & Events</h1>
        <p className="mt-2 text-muted-foreground">
          Special programs, workshops, and seasonal camps at Heights Athletic Club.
        </p>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Calendar className="size-12 text-muted-foreground" />
          <h2 className="text-lg font-semibold">No upcoming events</h2>
          <p className="text-sm text-muted-foreground">
            Check back soon — new camps and events are added regularly!
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              isLoggedIn={!!user}
              onRegistered={fetchEvents}
            />
          ))}
        </div>
      )}

      {/* Past Events */}
      {pastEvents.length > 0 && (
        <div>
          <button
            onClick={() => setShowPast(!showPast)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {showPast ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            Past Events ({pastEvents.length})
          </button>
          {showPast && (
            <div className="mt-4 grid gap-6 opacity-75 md:grid-cols-2">
              {pastEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  isLoggedIn={false}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
