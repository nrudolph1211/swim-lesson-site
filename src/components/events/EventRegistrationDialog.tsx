"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  ShieldAlert,
  User,
} from "lucide-react";
import { getLevelColor, getLevelTextColor, getLevelName } from "@/lib/swim-utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useSwimmers } from "@/hooks/useSwimmers";
import { formatTimePublic } from "@/lib/date-utils";
import type { EventData } from "./EventCard";
import Link from "next/link";

interface EventRegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: EventData;
  onSuccess: () => void;
}

type Step = "select-swimmer" | "summary";

export function EventRegistrationDialog({
  open,
  onOpenChange,
  event,
  onSuccess,
}: EventRegistrationDialogProps) {
  const router = useRouter();
  const supabase = createClient();
  const { swimmers, getWaiverStatus } = useSwimmers();
  const [step, setStep] = useState<Step>("select-swimmer");
  const [selectedSwimmer, setSelectedSwimmer] = useState<(typeof swimmers)[number] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isFull = event.registered_count >= event.max_capacity;

  useEffect(() => {
    if (open) {
      setStep("select-swimmer");
      setSelectedSwimmer(null);
    }
  }, [open]);

  const levelEligible = (level: number) =>
    level >= event.level_min && level <= event.level_max;

  const handleSelectSwimmer = (swimmer: (typeof swimmers)[number]) => {
    const waiverStatus = getWaiverStatus(swimmer.id);
    if (waiverStatus === "required") return;
    setSelectedSwimmer(swimmer);
    setStep("summary");
  };

  const handleRegister = async () => {
    if (!selectedSwimmer) return;
    setSubmitting(true);

    try {
      const status = isFull ? "waitlisted" : "confirmed";

      // Check for duplicate registration
      const { data: existing } = await supabase
        .from("event_registrations")
        .select("id")
        .eq("event_id", event.id)
        .eq("swimmer_id", selectedSwimmer.id)
        .in("status", ["confirmed", "waitlisted"])
        .maybeSingle();

      if (existing) {
        toast.error(`${selectedSwimmer.first_name} is already registered for this event.`);
        setSubmitting(false);
        return;
      }

      const { error } = await supabase.from("event_registrations").insert({
        event_id: event.id,
        swimmer_id: selectedSwimmer.id,
        status,
        payment_status: "pending",
      });

      if (error) throw error;

      if (isFull) {
        toast.success(`${selectedSwimmer.first_name} joined the waitlist!`);
        onSuccess();
      } else {
        // Redirect to payment
        const price = event.member_price; // simplified — would check membership
        const res = await fetch("/api/stripe/create-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enrollment_id: event.id, // Use event_id as reference
            class_id: event.id,
            swimmer_name: `${selectedSwimmer.first_name} ${selectedSwimmer.last_name}`,
            session_name: event.name,
            level: selectedSwimmer.current_level,
            amount: Math.round(price * 100),
            credits_applied: 0,
          }),
        });

        const data = await res.json();
        if (data.url) {
          router.push(data.url);
        } else {
          // If payment setup fails, still confirm registration
          toast.success(`${selectedSwimmer.first_name} registered! Payment pending.`);
          onSuccess();
        }
      }
    } catch {
      toast.error("Failed to register. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isFull ? "Join Waitlist" : "Register"} — {event.name}
          </DialogTitle>
          <DialogDescription>
            {event.event_type.charAt(0).toUpperCase() + event.event_type.slice(1)} •{" "}
            Levels {event.level_min}–{event.level_max}
          </DialogDescription>
        </DialogHeader>

        {step === "select-swimmer" && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Select a swimmer:</p>
            {swimmers.length === 0 ? (
              <div className="space-y-2 py-4 text-center">
                <p className="text-sm text-muted-foreground">No swimmers on your account.</p>
                <Link href="/dashboard">
                  <Button variant="outline" size="sm">Add a Swimmer</Button>
                </Link>
              </div>
            ) : (
              swimmers.map((swimmer) => {
                const waiverStatus = getWaiverStatus(swimmer.id);
                const eligible = levelEligible(swimmer.current_level);

                return (
                  <button
                    key={swimmer.id}
                    disabled={waiverStatus === "required" || !eligible}
                    onClick={() => handleSelectSwimmer(swimmer)}
                    className="flex w-full items-center justify-between rounded-lg border-2 p-3 text-left transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                        <User className="size-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {swimmer.first_name} {swimmer.last_name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge
                            className="text-[10px]"
                            style={{ backgroundColor: getLevelColor(swimmer.current_level), color: getLevelTextColor(swimmer.current_level) }}
                          >
                            L{swimmer.current_level}
                          </Badge>
                          {!eligible && (
                            <span className="text-red-500">
                              Level {swimmer.current_level} — requires L{event.level_min}–{event.level_max}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {waiverStatus === "required" ? (
                        <Badge variant="destructive" className="text-[10px]">
                          <ShieldAlert className="mr-1 size-3" />
                          Waiver needed
                        </Badge>
                      ) : waiverStatus === "expiring" ? (
                        <Badge className="bg-yellow-100 text-[10px] text-yellow-800">
                          <AlertTriangle className="mr-1 size-3" />
                          Expiring
                        </Badge>
                      ) : (
                        <CheckCircle className="size-4 text-green-500" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}

        {step === "summary" && selectedSwimmer && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setStep("select-swimmer")}>
              &larr; Back
            </Button>

            <div className="rounded-lg border p-4 text-sm">
              <p className="font-semibold">{selectedSwimmer.first_name} {selectedSwimmer.last_name}</p>
              <div className="mt-2 space-y-1 text-muted-foreground">
                <p>Event: <strong>{event.name}</strong></p>
                <p>Date: {event.start_date} {event.start_date !== event.end_date && `– ${event.end_date}`}</p>
                {event.daily_start_time && (
                  <p>Time: {formatTimePublic(event.daily_start_time)} – {formatTimePublic(event.daily_end_time)}</p>
                )}
                <p>Price: <strong>${event.member_price}</strong></p>
              </div>
            </div>

            {isFull && (
              <div className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
                This event is full. {selectedSwimmer.first_name} will be added to the waitlist and notified when a spot opens.
              </div>
            )}

            <Button
              onClick={handleRegister}
              disabled={submitting}
              className="h-12 w-full text-base"
            >
              {submitting && <Loader2 className="mr-2 size-5 animate-spin" />}
              {isFull ? "Join Waitlist" : `Pay $${event.member_price} & Register`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
