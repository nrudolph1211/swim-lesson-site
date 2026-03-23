import type { Metadata } from "next";
import { InstructorsManager } from "@/components/admin/instructors/InstructorsManager";

export const metadata: Metadata = { title: "Instructors" };

export default function AdminInstructorsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Instructors</h1>
        <p className="text-sm text-muted-foreground">
          Manage instructors, certifications, and schedules.
        </p>
      </div>
      <InstructorsManager />
    </div>
  );
}
