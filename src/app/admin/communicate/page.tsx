import type { Metadata } from "next";
import { CampaignManager } from "@/components/admin/communicate/CampaignManager";

export const metadata: Metadata = { title: "Communications" };

export default function AdminCommunicatePage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="font-heading text-3xl font-bold">Communications</h1>
      <p className="mt-2 text-muted-foreground">
        Send messages to instructors about schedules, cancellations, and updates.
      </p>
      <div className="mt-6">
        <CampaignManager />
      </div>
    </div>
  );
}
