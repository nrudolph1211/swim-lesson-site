"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Calendar, Clock, Gift, Loader2, User, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineError } from "@/components/ui/inline-error";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { getLevelColor, getLevelTextColor, getLevelName } from "@/lib/swim-utils";
import { formatTime } from "@/lib/date-utils";
import { toast } from "sonner";

interface AvailableClass {
  id: string;
  level: number;
  day_of_week: string[];
  start_time: string;
  end_time: string;
  max_capacity: number;
  enrolled_count: number;
  instructor_name: string | null;
  session_name: string;
  session_end_date: string;
}

interface MakeUpBookingDialogProps {
  enrollmentId: string;
  swimmerId: string;
  swimmerName: string;
  swimmerLevel: number;
  makeupCredits: number;
  sessionEndDate: string | null;
  onBooked: () => void;
}

export function MakeUpBookingDialog({
  enrollmentId,
  swimmerId,
  swimmerName,
  swimmerLevel,
  makeupCredits,
  sessionEndDate,
  onBooked,
}: MakeUpBookingDialogProps) {
  const supabase = createClient();
  const { user } = useAuthContext();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [classes, setClasses] = useState<AvailableClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const fetchAvailableClasses = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
    // Get active sessions
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, name, end_date")
      .in("status", ["enrollment_open", "in_progress"]);

    if (!sessions?.length) {
      setClasses([]);
      return;
    }

    const sessionIds = sessions.map((s) => s.id);
    const sessionMap = new Map(sessions.map((s) => [s.id, { name: s.name, end_date: s.end_date }]));

    // Get classes at swimmer's level with open spots
    const { data: classData } = await supabase
      .from("classes")
      .select(`
        id, level, day_of_week, start_time, end_time, max_capacity, session_id,
        instructor:instructors(profile:profiles(full_name))
      `)
      .eq("level", swimmerLevel)
      .eq("is_active", true)
      .in("session_id", sessionIds);

    if (!classData?.length) {
      setClasses([]);
      return;
    }

    // Get enrollment counts for these classes
    const classIds = classData.map((c) => c.id);
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("class_id")
      .in("class_id", classIds)
      .eq("status", "confirmed");

    const countMap = new Map<string, number>();
    for (const e of enrollments ?? []) {
      countMap.set(e.class_id, (countMap.get(e.class_id) ?? 0) + 1);
    }

    // Filter to classes with open spots
    const available: AvailableClass[] = classData
      .map((c) => {
        const instructor = Array.isArray(c.instructor) ? c.instructor[0] : c.instructor;
        const profile = instructor?.profile;
        const profileObj = Array.isArray(profile) ? profile[0] : profile;
        const session = sessionMap.get(c.session_id);
        const enrolled = countMap.get(c.id) ?? 0;

        return {
          id: c.id,
          level: c.level,
          day_of_week: c.day_of_week,
          start_time: c.start_time,
          end_time: c.end_time,
          max_capacity: c.max_capacity,
          enrolled_count: enrolled,
          instructor_name: profileObj?.full_name ?? null,
          session_name: session?.name ?? "Unknown",
          session_end_date: session?.end_date ?? "",
        };
      })
      .filter((c) => c.enrolled_count < c.max_capacity)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    setClasses(available);
    } catch {
      setError("Failed to load available classes.");
    } finally {
      setLoading(false);
    }
  }, [supabase, swimmerLevel]);

  useEffect(() => {
    if (open) {
      fetchAvailableClasses();
      setSelectedClassId(null);
      setSelectedDate(null);
    }
  }, [open, fetchAvailableClasses]);

  // Generate upcoming dates for a class based on its day_of_week
  const getUpcomingDates = (cls: AvailableClass): string[] => {
    const dates: string[] = [];
    const dayMap: Record<string, number> = {
      Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
      Thursday: 4, Friday: 5, Saturday: 6,
    };
    const today = new Date();
    const endDate = cls.session_end_date ? new Date(cls.session_end_date) : null;

    // Look ahead 4 weeks
    for (let i = 1; i <= 28; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getDay()];
      if (cls.day_of_week.includes(dayName)) {
        if (endDate && d > endDate) break;
        dates.push(d.toISOString().split("T")[0]);
      }
      if (dates.length >= 8) break;
    }
    return dates;
  };

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  const handleBook = async () => {
    if (!selectedClassId || !selectedDate) return;
    setBooking(true);

    try {
      // 1. Decrement makeup_credits on the enrollment
      const { error: creditError } = await supabase
        .from("enrollments")
        .update({ makeup_credits: makeupCredits - 1 })
        .eq("id", enrollmentId);

      if (creditError) throw creditError;

      // 2. Create attendance_record flagged as make-up
      // We need to find or create an enrollment-like reference.
      // For make-up attendance, we use the original enrollment_id with the new class date
      const { error: attendanceError } = await supabase
        .from("attendance_records")
        .insert({
          enrollment_id: enrollmentId,
          class_date: selectedDate,
          status: "present",
          recorded_by: user?.id ?? swimmerId,
          recorded_at: new Date().toISOString(),
        });

      if (attendanceError) throw attendanceError;

      toast.success(`Make-up class booked for ${new Date(selectedDate).toLocaleDateString()}!`);
      setOpen(false);
      onBooked();
    } catch {
      toast.error("Failed to book make-up class. Please try again.");
    } finally {
      setBooking(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Gift className="mr-1 size-3.5" />
            Book Make-Up ({makeupCredits})
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Book Make-Up Class</DialogTitle>
          <DialogDescription>
            Use a make-up credit to attend another L{swimmerLevel} class for {swimmerName}.
          </DialogDescription>
        </DialogHeader>

        {/* Credits info */}
        <div className="flex items-center gap-2 rounded-lg bg-accent/10 p-3 text-sm">
          <Gift className="size-4 text-accent" />
          <span>
            <strong>{makeupCredits}</strong> credit{makeupCredits > 1 ? "s" : ""} available
          </span>
          {sessionEndDate && (
            <span className="ml-auto text-xs text-muted-foreground">
              Expires end of session
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-3 py-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : error ? (
          <InlineError message={error} onRetry={fetchAvailableClasses} className="min-h-0 py-8" />
        ) : classes.length === 0 ? (
          <EmptyState
            icon={<AlertCircle className="size-8" />}
            title="No Classes Available"
            description={`No available L${swimmerLevel} classes with open spots right now.`}
            className="py-8"
          />
        ) : !selectedClassId ? (
          /* Step 1: Choose a class */
          <div className="space-y-2">
            <p className="text-sm font-medium">Choose a class:</p>
            {classes.map((cls) => (
              <button
                key={cls.id}
                className="w-full rounded-lg border-2 p-3 text-left transition-colors hover:border-accent hover:bg-accent/5"
                onClick={() => setSelectedClassId(cls.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge
                      style={{ backgroundColor: getLevelColor(cls.level), color: getLevelTextColor(cls.level) }}
                    >
                      L{cls.level}
                    </Badge>
                    <span className="font-medium">
                      {cls.day_of_week.join(", ")}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {cls.enrolled_count}/{cls.max_capacity} enrolled
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5" />
                    {formatTime(cls.start_time)} – {formatTime(cls.end_time)}
                  </span>
                  {cls.instructor_name && (
                    <span className="flex items-center gap-1">
                      <User className="size-3.5" />
                      {cls.instructor_name}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{cls.session_name}</p>
              </button>
            ))}
          </div>
        ) : (
          /* Step 2: Choose a date */
          <div className="space-y-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSelectedClassId(null); setSelectedDate(null); }}
            >
              &larr; Back to classes
            </Button>

            {selectedClass && (
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Badge
                    style={{ backgroundColor: getLevelColor(selectedClass.level), color: getLevelTextColor(selectedClass.level) }}
                  >
                    L{selectedClass.level}
                  </Badge>
                  <span className="font-medium">
                    {selectedClass.day_of_week.join(", ")} {formatTime(selectedClass.start_time)} – {formatTime(selectedClass.end_time)}
                  </span>
                </div>
                {selectedClass.instructor_name && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Instructor: {selectedClass.instructor_name}
                  </p>
                )}
              </div>
            )}

            <p className="text-sm font-medium">Choose a date:</p>
            <div className="grid grid-cols-2 gap-2">
              {selectedClass && getUpcomingDates(selectedClass).map((date) => (
                <button
                  key={date}
                  className={`rounded-lg border-2 p-3 text-center transition-colors ${
                    selectedDate === date
                      ? "border-accent bg-accent/10"
                      : "hover:border-accent/50"
                  }`}
                  onClick={() => setSelectedDate(date)}
                >
                  <Calendar className="mx-auto mb-1 size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{formatDate(date)}</span>
                </button>
              ))}
            </div>

            {selectedDate && (
              <Button
                onClick={handleBook}
                disabled={booking}
                className="h-12 w-full text-base"
              >
                {booking ? (
                  <Loader2 className="mr-2 size-5 animate-spin" />
                ) : (
                  <Gift className="mr-2 size-5" />
                )}
                Confirm Make-Up for {formatDate(selectedDate)}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
