"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SWIM_LEVELS } from "@/lib/swim-utils";
import { X } from "lucide-react";
import type { ClassFilters as Filters, SessionOption } from "@/hooks/useClasses";

interface ClassFiltersProps {
  sessions: SessionOption[];
  filters: Filters;
  onFilterChange: (filters: Filters) => void;
  onClear: () => void;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME_OPTIONS = [
  { value: "morning", label: "Morning (before 12pm)" },
  { value: "afternoon", label: "Afternoon (12–4pm)" },
  { value: "evening", label: "Evening (after 4pm)" },
];
const CLASS_TYPES = [
  { value: "group", label: "Group" },
  { value: "private", label: "Private" },
  { value: "semi_private", label: "Semi-Private" },
];

function toggleInArray<T>(arr: T[], value: T): T[] {
  return arr.includes(value)
    ? arr.filter((v) => v !== value)
    : [...arr, value];
}

export function ClassFiltersPanel({
  sessions,
  filters,
  onFilterChange,
  onClear,
}: ClassFiltersProps) {
  const hasActiveFilters =
    filters.levels.length > 0 ||
    filters.days.length > 0 ||
    filters.timeOfDay.length > 0 ||
    filters.classType.length > 0;

  return (
    <div className="space-y-6">
      {/* Session Selector */}
      {sessions.length > 1 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Session</Label>
          <Select
            value={filters.sessionId ?? ""}
            onValueChange={(val) =>
              onFilterChange({ ...filters, sessionId: val })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select session" />
            </SelectTrigger>
            <SelectContent>
              {sessions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Level */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Level</Label>
        <div className="space-y-2">
          {SWIM_LEVELS.map((level) => (
            <label
              key={level.id}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <Checkbox
                checked={filters.levels.includes(level.id)}
                onCheckedChange={() =>
                  onFilterChange({
                    ...filters,
                    levels: toggleInArray(filters.levels, level.id),
                  })
                }
              />
              <span
                className="inline-block size-2.5 rounded-full"
                style={{ backgroundColor: level.color }}
              />
              <span>L{level.id}: {level.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Day of Week */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Day</Label>
        <div className="space-y-2">
          {DAYS.map((day) => (
            <label
              key={day}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <Checkbox
                checked={filters.days.includes(day)}
                onCheckedChange={() =>
                  onFilterChange({
                    ...filters,
                    days: toggleInArray(filters.days, day),
                  })
                }
              />
              <span>{day}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Time of Day */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Time of Day</Label>
        <div className="space-y-2">
          {TIME_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <Checkbox
                checked={filters.timeOfDay.includes(opt.value)}
                onCheckedChange={() =>
                  onFilterChange({
                    ...filters,
                    timeOfDay: toggleInArray(filters.timeOfDay, opt.value),
                  })
                }
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Class Type */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Class Type</Label>
        <div className="space-y-2">
          {CLASS_TYPES.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <Checkbox
                checked={filters.classType.includes(opt.value)}
                onCheckedChange={() =>
                  onFilterChange({
                    ...filters,
                    classType: toggleInArray(filters.classType, opt.value),
                  })
                }
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Clear */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClear} className="w-full">
          <X className="mr-1 size-3.5" />
          Clear Filters
        </Button>
      )}
    </div>
  );
}
