"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Calendar, Clock, User, Users } from "lucide-react";
import { getLevelColor, getLevelTextColor, getLevelName, formatPrice } from "@/lib/swim-utils";
import { formatTime } from "@/lib/date-utils";
import type { ClassWithDetails } from "@/hooks/useClasses";

interface ClassCardProps {
  cls: ClassWithDetails;
  price: number;
  originalPrice?: number;
  earlyBirdActive: boolean;
  earlyBirdPct: number;
  onEnroll: (cls: ClassWithDetails) => void;
  priorityBlocked: boolean;
}

function formatClassType(type: string): string {
  switch (type) {
    case "semi_private":
      return "Semi-Private";
    case "private":
      return "Private";
    default:
      return "Group";
  }
}

function formatDuration(start: string, end: string): string {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  return `${mins} min`;
}

export function ClassCard({
  cls,
  price,
  originalPrice,
  earlyBirdActive,
  earlyBirdPct,
  onEnroll,
  priorityBlocked,
}: ClassCardProps) {
  const spotsLeft = cls.max_capacity - cls.confirmed_count;
  const isFull = spotsLeft <= 0;
  const fillPct = Math.min(
    (cls.confirmed_count / cls.max_capacity) * 100,
    100
  );

  return (
    <div className="rounded-lg border bg-card p-5 transition-shadow hover:shadow-md">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Badge
            style={{ backgroundColor: getLevelColor(cls.level), color: getLevelTextColor(cls.level) }}
          >
            L{cls.level}: {getLevelName(cls.level)}
          </Badge>
          <Badge variant="outline" className="ml-2">
            {formatClassType(cls.class_type)}
          </Badge>
        </div>
        {earlyBirdActive && (
          <Badge className="bg-green-500 text-white">
            Save {earlyBirdPct}%
          </Badge>
        )}
      </div>

      {/* Details */}
      <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Calendar className="size-3.5 shrink-0" />
          <span>{cls.day_of_week.join(", ")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="size-3.5 shrink-0" />
          <span>
            {formatTime(cls.start_time)} – {formatTime(cls.end_time)}{" "}
            ({formatDuration(cls.start_time, cls.end_time)})
          </span>
        </div>
        {cls.instructor?.profile?.full_name && (
          <div className="flex items-center gap-2">
            <User className="size-3.5 shrink-0" />
            <span>{cls.instructor.profile.full_name}</span>
          </div>
        )}
      </div>

      {/* Spots */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Users className="size-3" />
            {cls.confirmed_count}/{cls.max_capacity} enrolled
          </span>
          <span
            className={`font-medium ${
              spotsLeft <= 2 && spotsLeft > 0
                ? "text-orange-600"
                : spotsLeft <= 0
                  ? "text-red-600"
                  : "text-green-600"
            }`}
          >
            {isFull ? "Full" : `${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left`}
          </span>
        </div>
        <Progress value={fillPct} className="mt-1 h-1.5" />
      </div>

      {/* Price + Action */}
      <div className="mt-4 flex items-center justify-between">
        <div>
          {earlyBirdActive && originalPrice ? (
            <div className="flex items-baseline gap-2">
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(originalPrice * 100)}
              </span>
              <span className="text-lg font-bold text-foreground">
                {formatPrice(price * 100)}
              </span>
            </div>
          ) : (
            <span className="text-lg font-bold text-foreground">
              {formatPrice(price * 100)}
            </span>
          )}
        </div>
        {priorityBlocked ? (
          <Button size="sm" disabled>
            Priority Enrollment
          </Button>
        ) : isFull ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEnroll(cls)}
          >
            Join Waitlist
          </Button>
        ) : (
          <Button size="sm" onClick={() => onEnroll(cls)}>
            Enroll
          </Button>
        )}
      </div>
    </div>
  );
}
