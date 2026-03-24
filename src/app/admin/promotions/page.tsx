import type { Metadata } from "next";
import { PromotionsManager } from "@/components/admin/promotions/PromotionsManager";
import { PromoCodesManager } from "@/components/admin/promotions/PromoCodesManager";

export const metadata: Metadata = { title: "Promotions & Promo Codes" };

export default function AdminPromotionsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold">Promotions</h1>
        <p className="text-sm text-muted-foreground">
          Manage level promotions and discount codes.
        </p>
      </div>
      <PromoCodesManager />
      <PromotionsManager />
    </div>
  );
}
