"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Users } from "lucide-react";
import { useSwimmers } from "@/hooks/useSwimmers";
import { useClassAssignments } from "@/hooks/useClassAssignments";
import { useAuthContext } from "@/components/auth/AuthProvider";
import {
  SwimmerCard,
  AddSwimmerDialog,
  WeeklySchedule,
} from "@/components/dashboard";
import { SwimmerProgress } from "@/components/dashboard/SwimmerProgress";
import { DashboardSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";

export function DashboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthContext();
  const { swimmers, loading: swimmersLoading, addSwimmer } = useSwimmers();
  const { active: activeAssignments, loading: assignmentsLoading } = useClassAssignments(user?.id);
  const [progressSwimmerId, setProgressSwimmerId] = useState<string | null>(null);

  // Handle swimmer progress param
  useEffect(() => {
    const swimmerId = searchParams.get("swimmer");
    if (swimmerId) {
      setProgressSwimmerId(swimmerId);
    }
  }, [searchParams]);

  const loading = swimmersLoading || assignmentsLoading;

  if (loading) {
    return <DashboardSkeleton />;
  }

  // Show swimmer progress view
  if (progressSwimmerId) {
    const swimmer = swimmers.find((s) => s.id === progressSwimmerId);
    if (swimmer) {
      return (
        <div className="mx-auto max-w-4xl px-4 py-8">
          <SwimmerProgress
            swimmerId={swimmer.id}
            swimmerName={`${swimmer.first_name} ${swimmer.last_name}`}
            currentLevel={swimmer.current_level}
            onBack={() => {
              setProgressSwimmerId(null);
              router.replace("/dashboard");
            }}
          />
        </div>
      );
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">My Dashboard</h1>
        <AddSwimmerDialog onAdd={addSwimmer} />
      </div>

      {/* My Swimmers */}
      <section>
        <h2 className="mb-4 font-heading text-lg font-semibold">My Swimmers</h2>
        {swimmers.length === 0 ? (
          <EmptyState
            icon={<Users className="size-10" />}
            title="No swimmers yet"
            description="Add your first swimmer to get started."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {swimmers.map((swimmer) => (
              <SwimmerCard
                key={swimmer.id}
                swimmer={swimmer}
              />
            ))}
          </div>
        )}
      </section>

      {/* Class Schedule */}
      <section>
        <WeeklySchedule assignments={activeAssignments} />
      </section>

      {/* Empty state for no assignments */}
      {activeAssignments.length === 0 && swimmers.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Your swimmers haven&apos;t been assigned to classes yet. Contact HAC to get started with lessons.
          </p>
          <a
            href="mailto:craig@heightsathleticclub.com"
            className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
          >
            craig@heightsathleticclub.com
          </a>
        </div>
      )}
    </div>
  );
}
