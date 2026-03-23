"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Calendar, Clock, User, Gift, XCircle, Loader2 } from "lucide-react";
import { getLevelName, getLevelColor, getLevelTextColor } from "@/lib/swim-utils";
import { formatTime } from "@/lib/date-utils";
import { toast } from "sonner";
import type { EnrollmentWithDetails } from "@/hooks/useEnrollments";
import { MakeUpBookingDialog } from "./MakeUpBookingDialog";
import { AddToCalendar } from "@/components/calendar/AddToCalendar";

interface EnrollmentCardProps {
  enrollment: EnrollmentWithDetails;
  onCancel: (id: string) => Promise<void>;
  onRefresh?: () => void;
}

export function EnrollmentCard({ enrollment, onCancel, onRefresh }: EnrollmentCardProps) {
  const [cancelling, setCancelling] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const cls = enrollment.class;
  const swimmer = enrollment.swimmer;

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await onCancel(enrollment.id);
      toast.success("Enrollment cancelled.");
      setConfirmOpen(false);
    } catch {
      toast.error("Failed to cancel enrollment.");
    } finally {
      setCancelling(false);
    }
  };

  const paymentBadge = () => {
    switch (enrollment.payment_status) {
      case "paid":
        return <Badge variant="outline" className="border-green-500 text-green-600">Paid</Badge>;
      case "refunded":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Refunded</Badge>;
      default:
        return <Badge variant="outline" className="border-orange-500 text-orange-600">Pending</Badge>;
    }
  };

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-heading text-sm font-semibold">
              {cls?.session?.name || "Session"}
            </h3>
            <Badge
              className="mt-1"
              style={{ backgroundColor: getLevelColor(cls?.level ?? 1), color: getLevelTextColor(cls?.level ?? 1) }}
            >
              L{cls?.level}: {getLevelName(cls?.level ?? 1)}
            </Badge>
          </div>
          {paymentBadge()}
        </div>

        <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="size-3.5" />
            <span>{cls?.day_of_week?.join(", ") || "TBD"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="size-3.5" />
            <span>
              {formatTime(cls?.start_time)} – {formatTime(cls?.end_time)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <User className="size-3.5" />
            <span>
              {swimmer?.first_name} {swimmer?.last_name}
              {cls?.instructor?.profile?.full_name &&
                ` • Instructor: ${cls.instructor.profile.full_name}`}
            </span>
          </div>
          {enrollment.makeup_credits > 0 && (
            <div className="flex items-center gap-2 text-accent">
              <Gift className="size-3.5" />
              <span>{enrollment.makeup_credits} makeup credit{enrollment.makeup_credits > 1 ? "s" : ""}</span>
            </div>
          )}
        </div>

        {enrollment.status === "confirmed" && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <AddToCalendar enrollment={enrollment} />
            {enrollment.makeup_credits > 0 && (
              <MakeUpBookingDialog
                enrollmentId={enrollment.id}
                swimmerId={enrollment.swimmer_id}
                swimmerName={`${swimmer?.first_name ?? ""} ${swimmer?.last_name ?? ""}`}
                swimmerLevel={swimmer?.current_level ?? cls?.level ?? 1}
                makeupCredits={enrollment.makeup_credits}
                sessionEndDate={cls?.session?.end_date ?? null}
                onBooked={() => onRefresh?.()}
              />
            )}
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <DialogTrigger
                render={
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                    <XCircle className="mr-1 size-3.5" />
                    Cancel
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancel Enrollment?</DialogTitle>
                  <DialogDescription>
                    This will cancel {swimmer?.first_name}&apos;s enrollment in{" "}
                    {cls?.session?.name}. This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end gap-2">
                  <DialogClose render={<Button variant="outline">Keep Enrollment</Button>} />
                  <Button
                    variant="destructive"
                    onClick={handleCancel}
                    disabled={cancelling}
                  >
                    {cancelling && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Yes, Cancel
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {enrollment.status === "waitlisted" && (
          <div className="mt-3">
            <Badge variant="secondary">Waitlisted</Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
