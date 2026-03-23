import type { Metadata } from "next";
import { AdminSettings } from "@/components/admin/settings/AdminSettings";

export const metadata: Metadata = { title: "Admin Settings" };

export default function AdminSettingsPage() {
  return <AdminSettings />;
}
