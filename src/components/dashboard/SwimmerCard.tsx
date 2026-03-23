"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Baby, FileCheck, ShieldAlert, AlertTriangle } from "lucide-react";
import { calculateAge, getLevelName, getLevelColor } from "@/lib/swim-utils";
import type { SwimmerRow } from "@/hooks/useSwimmers";

interface SwimmerCardProps {
  swimmer: SwimmerRow;
  waiverStatus: "active" | "expiring" | "required";
}

export function SwimmerCard({ swimmer, waiverStatus }: SwimmerCardProps) {
  const age = calculateAge(swimmer.date_of_birth);
  const levelColor = getLevelColor(swimmer.current_level);
  const levelName = getLevelName(swimmer.current_level);

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex size-10 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: levelColor }}
            >
              <Baby className="size-5" />
            </div>
            <div>
              <h3 className="font-heading text-base font-semibold">
                {swimmer.first_name} {swimmer.last_name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {age} years old
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge
            className="text-white"
            style={{ backgroundColor: levelColor }}
          >
            L{swimmer.current_level}: {levelName}
          </Badge>

          {waiverStatus === "active" && (
            <Badge variant="outline" className="border-green-500 text-green-600">
              <FileCheck className="mr-1 size-3" />
              Waiver Active
            </Badge>
          )}
          {waiverStatus === "expiring" && (
            <Badge variant="outline" className="border-yellow-500 text-yellow-600">
              <AlertTriangle className="mr-1 size-3" />
              Waiver Expiring
            </Badge>
          )}
          {waiverStatus === "required" && (
            <Badge variant="destructive">
              <ShieldAlert className="mr-1 size-3" />
              Waiver Required
            </Badge>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Link href={`/dashboard?swimmer=${swimmer.id}`}>
            <Button variant="outline" size="sm">
              View Progress
            </Button>
          </Link>
          {waiverStatus !== "active" && (
            <Link href={`/waiver/${swimmer.id}`}>
              <Button size="sm" variant="destructive">
                Sign Waiver
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
