import type { Metadata } from "next";
import { SwimmersTable } from "@/components/admin/swimmers/SwimmersTable";

export const metadata: Metadata = { title: "Swimmers" };

export default function AdminSwimmersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Swimmers</h1>
        <p className="text-sm text-muted-foreground">
          View and manage all swimmers across families.
        </p>
      </div>
      <SwimmersTable />
    </div>
  );
}
