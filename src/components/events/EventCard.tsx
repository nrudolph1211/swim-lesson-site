"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Calendar,
  Clock,
  Users,
  DollarSign,
  BarChart3,
} from "lucide-react";
import { getLevelColor, getLevelTextColor, getLevelName } from "@/lib/swim-utils";
import { format, parseISO } from "date-fns";
import { formatDateShort, formatTimePublic } from "@/lib/date-utils";
import { EventRegistrationDialog } from "./EventRegistrationDialog";

export interface EventData {
  id: string;
  name: string;
  description: string | null;
  event_type: string;
  start_date: string;
  end_date: string;
  daily_start_time: string | null;
  daily_end_time: string | null;
  level_min: number;
  level_max: number;
  max_capacity: number;
  member_price: number;
  non_member_price: number;
  military_price: number;
  instructor_name: string | null;
  status: string;
  image_url: string | null;
  registered_count: number;
}

interface EventCardProps {
  event: EventData;
  isLoggedIn: boolean;
  onRegistered?: () => void;
}

export function EventCard({ event, isLoggedIn, onRegistered }: EventCardProps) {
  const [registerOpen, setRegisterOpen] = useState(false);

  const isFull = event.registered_count >= event.max_capacity;
  const spotsLeft = event.max_capacity - event.registered_count;

  const typeBadge = () => {
    switch (event.event_type) {
      case "camp":
        return <Badge className="bg-blue-100 text-blue-800">Camp</Badge>;
      case "workshop":
        return <Badge className="bg-purple-100 text-purple-800">Workshop</Badge>;
      case "clinic":
        return <Badge className="bg-green-100 text-green-800">Clinic</Badge>;
      default:
        return <Badge variant="outline">{event.event_type}</Badge>;
    }
  };

  const formatDateRange = () => {
    const start = parseISO(event.start_date);
    const end = parseISO(event.end_date);
    if (event.start_date === event.end_date) {
      return format(start, "EEEE, MMMM d, yyyy");
    }
    return `${formatDateShort(event.start_date)} – ${formatDateShort(event.end_date)}`;
  };

  return (
    <>
      <Card className="overflow-hidden transition-shadow hover:shadow-lg">
        {event.image_url && (
          <div className="h-48 w-full overflow-hidden bg-muted">
            <img
              src={event.image_url}
              alt={event.name}
              className="size-full object-cover"
            />
          </div>
        )}
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="mb-2 flex items-center gap-2">
                {typeBadge()}
                {isFull ? (
                  <Badge variant="destructive">Full</Badge>
                ) : (
                  <Badge className="bg-green-100 text-green-800">
                    {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left
                  </Badge>
                )}
              </div>
              <h3 className="font-heading text-xl font-bold">{event.name}</h3>
            </div>
          </div>

          {event.description && (
            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
              {event.description}
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="size-4 shrink-0" />
              <span>{formatDateRange()}</span>
            </div>
            {event.daily_start_time && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="size-4 shrink-0" />
                <span>
                  {formatTimePublic(event.daily_start_time)}
                  {event.daily_end_time && ` – ${formatTimePublic(event.daily_end_time)}`}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="size-4 shrink-0" />
              <span>
                {event.level_min === event.level_max
                  ? `Level ${event.level_min}`
                  : `Levels ${event.level_min}–${event.level_max}`}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="size-4 shrink-0" />
              <span>
                {event.registered_count}/{event.max_capacity} registered
              </span>
            </div>
          </div>

          {/* Level badges */}
          <div className="mt-3 flex flex-wrap gap-1">
            {Array.from({ length: event.level_max - event.level_min + 1 }, (_, i) => event.level_min + i).map((level) => (
              <Badge
                key={level}
                className="text-[10px]"
                style={{ backgroundColor: getLevelColor(level), color: getLevelTextColor(level) }}
              >
                L{level}: {getLevelName(level)}
              </Badge>
            ))}
          </div>

          {event.instructor_name && (
            <p className="mt-2 text-sm text-muted-foreground">
              Instructor: <strong>{event.instructor_name}</strong>
            </p>
          )}

          {/* Price + Register */}
          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <div>
              <div className="flex items-center gap-1">
                <DollarSign className="size-4 text-muted-foreground" />
                <span className="text-xl font-bold">${event.member_price}</span>
                <span className="text-sm text-muted-foreground">/member</span>
              </div>
              {event.non_member_price > event.member_price && (
                <p className="text-xs text-muted-foreground">
                  Non-member: ${event.non_member_price}
                </p>
              )}
            </div>
            {isLoggedIn ? (
              <Button
                onClick={() => setRegisterOpen(true)}
                disabled={event.status === "full" && isFull}
              >
                {isFull ? "Join Waitlist" : "Register"}
              </Button>
            ) : (
              <Button render={<a href="/login?redirect=/events" />}>
                Sign in to Register
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoggedIn && (
        <EventRegistrationDialog
          open={registerOpen}
          onOpenChange={setRegisterOpen}
          event={event}
          onSuccess={() => {
            setRegisterOpen(false);
            onRegistered?.();
          }}
        />
      )}
    </>
  );
}
