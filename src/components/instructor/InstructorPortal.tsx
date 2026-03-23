"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar, Download, Link2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { ClockInOut } from "./ClockInOut";
import { TodayTab } from "./TodayTab";
import { WeekTab } from "./WeekTab";
import { StudentsTab } from "./StudentsTab";
import { NotesTab } from "./NotesTab";
import { OnboardingModal } from "./OnboardingModal";

type TabKey = "today" | "week" | "students" | "notes";

const TABS: { key: TabKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "students", label: "Students" },
  { key: "notes", label: "Notes" },
];

interface InstructorPortalProps {
  userId: string;
  userName: string;
}

export function InstructorPortal({ userId, userName }: InstructorPortalProps) {
  const supabase = createClient();
  const [tab, setTab] = useState<TabKey>("today");
  const [showOnboarding, setShowOnboarding] = useState(false);

  const checkOnboarding = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("instructors")
        .select("has_completed_onboarding")
        .eq("id", userId)
        .single();

      if (error) throw error;

      if (data && !data.has_completed_onboarding) {
        setShowOnboarding(true);
      }
    } catch {
      toast.error("Failed to load onboarding status.", { duration: Infinity });
    }
  }, [supabase, userId]);

  useEffect(() => {
    checkOnboarding();
  }, [checkOnboarding]);

  const handleDownloadIcs = async () => {
    try {
      // Generate a calendar token if not present
      const { data: profile } = await supabase
        .from("profiles")
        .select("calendar_token")
        .eq("id", userId)
        .single();

      let token = profile?.calendar_token;
      if (!token) {
        token = crypto.randomUUID();
        await supabase
          .from("profiles")
          .update({ calendar_token: token })
          .eq("id", userId);
      }

      const url = `${window.location.origin}/api/calendar-feed?token=${token}`;
      const res = await fetch(url);
      const text = await res.text();

      const blob = new Blob([text], { type: "text/calendar" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "hac-swim-schedule.ics";
      a.click();
      URL.revokeObjectURL(a.href);

      toast.success("Calendar file downloaded.");
    } catch {
      toast.error("Failed to download calendar.");
    }
  };

  const handleCopyCalendarUrl = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("calendar_token")
        .eq("id", userId)
        .single();

      let token = profile?.calendar_token;
      if (!token) {
        token = crypto.randomUUID();
        await supabase
          .from("profiles")
          .update({ calendar_token: token })
          .eq("id", userId);
      }

      const url = `${window.location.origin}/api/calendar-feed?token=${token}`;
      await navigator.clipboard.writeText(url);
      toast.success("Calendar URL copied!");
    } catch {
      toast.error("Failed to copy calendar URL.");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-bold">
            Hey, {userName.split(" ")[0]}!
          </h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="icon" className="size-12" aria-label="Jump to date">
                <Calendar className="size-5" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleDownloadIcs}>
              <Download className="mr-2 size-4" />
              Download .ics
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyCalendarUrl}>
              <Link2 className="mr-2 size-4" />
              Copy Calendar URL
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Clock In/Out */}
      <ClockInOut userId={userId} />

      {/* Tabs */}
      <div className="flex rounded-xl border-2 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`flex-1 rounded-lg py-3.5 min-h-[48px] text-center text-base font-bold transition-colors active:scale-[0.97] ${
              tab === t.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            }`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "today" && <TodayTab userId={userId} />}
      {tab === "week" && <WeekTab userId={userId} />}
      {tab === "students" && <StudentsTab userId={userId} />}
      {tab === "notes" && <NotesTab userId={userId} />}

      {/* Onboarding */}
      {showOnboarding && (
        <OnboardingModal
          userId={userId}
          onComplete={() => setShowOnboarding(false)}
        />
      )}
    </div>
  );
}
