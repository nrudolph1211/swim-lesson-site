import type { Metadata } from "next";
import { PaymentsManager } from "@/components/admin/payments/PaymentsManager";

export const metadata: Metadata = { title: "Payments" };

export default function AdminPaymentsPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="font-heading text-3xl font-bold">Payments</h1>
      <p className="mt-2 text-muted-foreground">
        Track revenue, record manual payments, and manage refunds.
      </p>
      <div className="mt-6">
        <PaymentsManager />
      </div>
    </div>
  );
}
