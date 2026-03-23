"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { Clock, CalendarDays, Users, FileText } from "lucide-react";

const STEPS = [
  {
    icon: Clock,
    title: "Clock In & Out",
    description:
      "Use the clock at the top of the page to track your hours. Clock in when you arrive and clock out when you leave. Your hours are automatically calculated for payroll.",
  },
  {
    icon: CalendarDays,
    title: "Your Schedule",
    description:
      "The Today tab shows your classes for the day. Expand any class to see your student roster, take attendance, and print class lists. The Week tab shows your full weekly schedule.",
  },
  {
    icon: Users,
    title: "Student Management",
    description:
      "The Students tab lists all swimmers in your classes. View medical alerts, emergency contacts, and track skills. Medical notes are highlighted with a warning icon — always review before class.",
  },
  {
    icon: FileText,
    title: "Session Notes",
    description:
      "At the end of each session, use the Notes tab to leave feedback for each student and recommend whether they should promote, continue, or need review. Notes auto-save as you type.",
  },
];

interface OnboardingModalProps {
  userId: string;
  onComplete: () => void;
}

export function OnboardingModal({ userId, onComplete }: OnboardingModalProps) {
  const supabase = createClient();
  const [step, setStep] = useState(0);

  const handleComplete = async () => {
    await supabase
      .from("instructors")
      .update({ has_completed_onboarding: true })
      .eq("id", userId);
    onComplete();
  };

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            Welcome to the Instructor Portal!
          </DialogTitle>
          <DialogDescription className="text-center">
            Step {step + 1} of {STEPS.length}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center py-4 text-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <Icon className="size-8 text-primary" />
          </div>
          <h3 className="mb-2 text-lg font-bold">{current.title}</h3>
          <p className="text-sm text-muted-foreground">{current.description}</p>
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`size-2 rounded-full transition-colors ${
                i === step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          {step > 0 && (
            <Button
              variant="outline"
              className="h-12 flex-1 text-base"
              onClick={() => setStep((s) => s - 1)}
            >
              Back
            </Button>
          )}
          <Button
            className="h-12 flex-1 text-base font-bold"
            onClick={isLast ? handleComplete : () => setStep((s) => s + 1)}
          >
            {isLast ? "Get Started" : "Next"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
