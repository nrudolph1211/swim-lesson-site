import type { Metadata } from "next";
import { WaiversManager } from "@/components/admin/waivers/WaiversManager";

export const metadata: Metadata = { title: "Waivers" };

export default function AdminWaiversPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-heading font-bold">Waivers</h1>
      <p className="text-muted-foreground mt-2 mb-6">
        View and track waiver status for all swimmers.
      </p>
      <WaiversManager />
    </div>
  );
}
