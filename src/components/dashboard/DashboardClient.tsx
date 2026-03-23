"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Users, BookOpen, Clock, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSwimmers } from "@/hooks/useSwimmers";
import { useEnrollments } from "@/hooks/useEnrollments";
import {
  SwimmerCard,
  AddSwimmerDialog,
  EnrollmentCard,
  WeeklySchedule,
  ReferralSection,
} from "@/components/dashboard";
import { SwimmerProgress } from "@/components/dashboard/SwimmerProgress";
import { DashboardSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";

export function DashboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { swimmers, loading: swimmersLoading, addSwimmer, getWaiverStatus } = useSwimmers();
  const {
    enrollments,
    active,
    waitlisted,
    past,
    loading: enrollmentsLoading,
    cancelEnrollment,
    fetchEnrollments,
  } = useEnrollments();
  const [enrollmentTab, setEnrollmentTab] = useState("active");
  const [progressSwimmerId, setProgressSwimmerId] = useState<string | null>(null);

  // Handle payment return toast and swimmer progress param
  useEffect(() => {
    const payment = searchParams.get("payment");
    if (payment === "success") {
      toast.success("Payment successful! Your enrollment is confirmed.");
      router.replace("/dashboard");
    }
    const swimmerId = searchParams.get("swimmer");
    if (swimmerId) {
      setProgressSwimmerId(swimmerId);
    }
  }, [searchParams, router]);

  const loading = swimmersLoading || enrollmentsLoading;

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
            description="Add your first swimmer to get started with booking lessons."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {swimmers.map((swimmer) => (
              <SwimmerCard
                key={swimmer.id}
                swimmer={swimmer}
                waiverStatus={getWaiverStatus(swimmer.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Upcoming Lessons */}
      <section>
        <WeeklySchedule enrollments={enrollments} />
      </section>

      {/* My Enrollments */}
      <section>
        <h2 className="mb-4 font-heading text-lg font-semibold">My Enrollments</h2>
        <Tabs value={enrollmentTab} onValueChange={setEnrollmentTab}>
          <TabsList>
            <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
            <TabsTrigger value="waitlisted">Waitlisted ({waitlisted.length})</TabsTrigger>
            <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4">
            {active.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="size-10" />}
                title="No active enrollments"
                description="Browse available classes and enroll your swimmer."
                action={{ label: "Book a Lesson", onClick: () => router.push("/book") }}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {active.map((e) => (
                  <EnrollmentCard key={e.id} enrollment={e} onCancel={cancelEnrollment} onRefresh={fetchEnrollments} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="waitlisted" className="mt-4">
            {waitlisted.length === 0 ? (
              <EmptyState
                icon={<Clock className="size-10" />}
                title="No waitlisted enrollments"
                description="You'll see waitlisted classes here if a class is full."
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {waitlisted.map((e) => (
                  <EnrollmentCard key={e.id} enrollment={e} onCancel={cancelEnrollment} onRefresh={fetchEnrollments} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="mt-4">
            {past.length === 0 ? (
              <EmptyState
                icon={<Trophy className="size-10" />}
                title="No past enrollments"
                description="Completed lessons will appear here."
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {past.map((e) => (
                  <EnrollmentCard key={e.id} enrollment={e} onCancel={cancelEnrollment} onRefresh={fetchEnrollments} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </section>

      {/* Referral Section */}
      <section>
        <ReferralSection />
      </section>
    </div>
  );
}
