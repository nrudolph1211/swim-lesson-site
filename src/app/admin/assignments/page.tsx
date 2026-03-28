import type { Metadata } from "next";
import { AssignmentsManager } from "@/components/admin/assignments/AssignmentsManager";

export const metadata: Metadata = { title: "Class Assignments" };

export default function AdminAssignmentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Class Assignments</h1>
        <p className="text-sm text-muted-foreground">
          Assign swimmers to classes and manage rosters.
        </p>
      </div>
      <AssignmentsManager />
    </div>
  );
}
