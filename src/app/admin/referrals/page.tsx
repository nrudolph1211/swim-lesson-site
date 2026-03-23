import type { Metadata } from "next";
import { ReferralsManager } from "@/components/admin/referrals/ReferralsManager";

export const metadata: Metadata = { title: "Referrals" };

export default function AdminReferralsPage() {
  return <ReferralsManager />;
}
