import type { Metadata } from "next";
import { EnrollmentsTable } from "@/components/admin/enrollments/EnrollmentsTable";

export const metadata: Metadata = { title: "Enrollments" };

export default function AdminEnrollmentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Enrollments</h1>
        <p className="text-sm text-muted-foreground">
          Manage enrollments, waitlists, and payments.
        </p>
      </div>
      <EnrollmentsTable />
    </div>
  );
}
