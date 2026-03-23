import type { Metadata } from "next";
import { ReportsManager } from "@/components/admin/reports/ReportsManager";

export const metadata: Metadata = { title: "Reports" };

export default function AdminReportsPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="font-heading text-3xl font-bold">Reports</h1>
      <p className="mt-2 text-muted-foreground">
        Financial analytics, enrollment trends, attendance, and instructor performance.
      </p>
      <div className="mt-6">
        <ReportsManager />
      </div>
    </div>
  );
}
