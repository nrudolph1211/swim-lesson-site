import type { Metadata } from "next";
import { PromotionsManager } from "@/components/admin/promotions/PromotionsManager";

export const metadata: Metadata = { title: "Promotions" };

export default function AdminPromotionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Promotions</h1>
        <p className="text-sm text-muted-foreground">
          Review and approve level promotion requests from instructors.
        </p>
      </div>
      <PromotionsManager />
    </div>
  );
}
