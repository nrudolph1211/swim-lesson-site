import type { Metadata } from "next";
import { AccountSettings } from "@/components/dashboard/AccountSettings";

export const metadata: Metadata = { title: "Account Settings" };

export default function DashboardSettingsPage() {
  return <AccountSettings />;
}
