import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

function DashboardLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardClient />
    </Suspense>
  );
}

export const metadata = {
  title: "Dashboard",
};
