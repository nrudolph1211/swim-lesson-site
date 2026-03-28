"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Baby } from "lucide-react";
import { calculateAge, getLevelName, getLevelColor } from "@/lib/swim-utils";
import type { SwimmerRow } from "@/hooks/useSwimmers";

interface SwimmerCardProps {
  swimmer: SwimmerRow;
}

export function SwimmerCard({ swimmer }: SwimmerCardProps) {
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
        </div>

        <div className="mt-4">
          <Link href={`/dashboard?swimmer=${swimmer.id}`}>
            <Button variant="outline" size="sm">
              View Progress
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
