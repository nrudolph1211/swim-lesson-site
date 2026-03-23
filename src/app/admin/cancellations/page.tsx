import type { Metadata } from "next";
import { CancellationManager } from "@/components/admin/cancellations/CancellationManager";

export const metadata: Metadata = { title: "Cancellations" };

export default function AdminCancellationsPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="font-heading text-3xl font-bold">Weather Cancellations</h1>
      <p className="mt-2 text-muted-foreground">
        Cancel classes due to weather or maintenance and automatically issue make-up credits.
      </p>
      <div className="mt-6">
        <CancellationManager />
      </div>
    </div>
  );
}
