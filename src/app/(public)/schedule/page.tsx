import type { Metadata } from "next";
import { ScheduleView } from "@/components/schedule/ScheduleView";

export const metadata: Metadata = {
  title: "Lesson Schedule",
  description:
    "View the current swim lesson schedule at Heights Athletic Club. Contact us to register.",
};

export default function SchedulePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <h1 className="font-heading text-3xl font-bold sm:text-4xl">
          Swim Lesson Schedule
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          View our current session&apos;s class schedule. Contact us to register.
        </p>
      </div>

      <ScheduleView />

      {/* Contact CTA */}
      <div className="mt-12 rounded-xl border bg-muted/40 p-6 text-center sm:p-8">
        <h2 className="font-heading text-xl font-semibold">
          Interested in lessons?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Contact us to register your child for swim lessons. We offer group,
          semi-private, and private instruction for ages 3 and up.
        </p>
        <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="tel:+12545003320"
            className="text-sm font-medium text-primary hover:underline"
          >
            (254) 500-3320
          </a>
          <span className="hidden text-muted-foreground sm:inline">|</span>
          <a
            href="mailto:craig@heightsathleticclub.com"
            className="text-sm font-medium text-primary hover:underline"
          >
            craig@heightsathleticclub.com
          </a>
        </div>
      </div>
    </div>
  );
}
