"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import {
  PROGRAM_DEFAULTS,
  getDefaultBasePrice,
  type ProgramType,
  type SeasonType,
} from "@/lib/pricing";
import { SWIM_LEVELS, getLevelName } from "@/lib/swim-utils";

export interface ClassFormData {
  level: number;
  class_type: string;
  program_type: string;
  day_of_week: string[];
  start_time: string;
  end_time: string;
  instructor_id: string;
  max_capacity: number;
  base_price: string;
}

const EMPTY_FORM: ClassFormData = {
  level: 1,
  class_type: "group",
  program_type: "",
  day_of_week: [],
  start_time: "09:00",
  end_time: "09:30",
  instructor_id: "",
  max_capacity: 4,
  base_price: "",
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface InstructorOption {
  id: string;
  name: string;
}

interface ClassFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<ClassFormData> | null;
  title: string;
  instructors: InstructorOption[];
  seasonType?: SeasonType;
  onSave: (data: ClassFormData) => Promise<void>;
}

const PROGRAM_TYPE_OPTIONS: { value: ProgramType; label: string }[] = [
  { value: "parent_child", label: "Parent & Child (6mo–3yr)" },
  { value: "preschool_group", label: "Preschool Group (3–5yr)" },
  { value: "youth_beginner", label: "Youth Beginner L1–4 (6–12yr)" },
  { value: "youth_intermediate", label: "Youth Intermediate+ L5 (6–12yr)" },
  { value: "teen_adult", label: "Teen/Adult Group (13+)" },
  { value: "semi_private", label: "Semi-Private (All Ages)" },
  { value: "private_single", label: "Private — Single Lesson" },
  { value: "private_4pack", label: "Private — 4-Lesson Package" },
  { value: "private_8pack", label: "Private — 8-Lesson Package" },
];

function deriveClassType(programType: string): string {
  if (programType.startsWith("private")) return "private";
  if (programType === "semi_private") return "semi_private";
  return "group";
}

/** Returns allowed levels for a given program type, or null if level is fixed. */
function getAllowedLevels(programType: string): number[] | null {
  switch (programType) {
    case "youth_beginner":
      return [1, 2, 3, 4];
    case "youth_intermediate":
      return [5];
    case "parent_child":
      return [0];
    case "preschool_group":
      return [1];
    default:
      return null; // any level or N/A
  }
}

function deriveEndTime(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(":").map(Number);
  const totalMin = h * 60 + m + durationMinutes;
  const eh = Math.floor(totalMin / 60);
  const em = totalMin % 60;
  return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
}

export function ClassFormDialog({
  open,
  onOpenChange,
  initial,
  title,
  instructors,
  seasonType = "summer_intensive",
  onSave,
}: ClassFormDialogProps) {
  const [form, setForm] = useState<ClassFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY_FORM, ...initial });
    }
  }, [open, initial]);

  const set = (key: keyof ClassFormData, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleDay = (day: string) => {
    setForm((f) => ({
      ...f,
      day_of_week: f.day_of_week.includes(day)
        ? f.day_of_week.filter((d) => d !== day)
        : [...f.day_of_week, day],
    }));
  };

  const handleProgramTypeChange = (programType: string | null) => {
    if (!programType) return;
    const pt = programType as ProgramType;
    const defaults = PROGRAM_DEFAULTS[pt];
    if (!defaults) return;

    const defaultPrice = getDefaultBasePrice(pt, seasonType);
    const classType = deriveClassType(pt);
    const endTime = deriveEndTime(form.start_time, defaults.durationMinutes);

    setForm((f) => ({
      ...f,
      program_type: pt,
      class_type: classType,
      level: defaults.level ?? f.level,
      max_capacity: defaults.maxCapacity,
      base_price: String(defaultPrice),
      end_time: endTime,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save class.";
      console.error("Failed to save class:", err);
      const { toast } = await import("sonner");
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const canSave =
    form.day_of_week.length > 0 &&
    form.start_time &&
    form.end_time &&
    form.max_capacity > 0 &&
    form.base_price;

  const defaultPrice = form.program_type
    ? getDefaultBasePrice(form.program_type as ProgramType, seasonType)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Configure the class details.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Program Type */}
          <div className="space-y-2">
            <Label>Program Type</Label>
            <Select
              value={form.program_type}
              onValueChange={handleProgramTypeChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select program type" />
              </SelectTrigger>
              <SelectContent>
                {PROGRAM_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Level selector — only shown when program type allows multiple levels */}
          {(() => {
            const allowed = form.program_type ? getAllowedLevels(form.program_type) : null;
            if (allowed && allowed.length > 1) {
              return (
                <div className="space-y-2">
                  <Label>Level</Label>
                  <Select
                    value={String(form.level)}
                    onValueChange={(v) => v && set("level", Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      {allowed.map((lvl) => (
                        <SelectItem key={lvl} value={String(lvl)}>
                          L{lvl}: {getLevelName(lvl)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            }
            return null;
          })()}

          {/* Base Price */}
          <div className="space-y-2">
            <Label htmlFor="c-price">Session Price ($)</Label>
            <Input
              id="c-price"
              type="number"
              step="0.01"
              min={0}
              value={form.base_price}
              onChange={(e) => set("base_price", e.target.value)}
              placeholder="140.00"
            />
            {defaultPrice != null && (
              <p className="text-xs text-muted-foreground">
                Default for {PROGRAM_TYPE_OPTIONS.find((o) => o.value === form.program_type)?.label}: ${defaultPrice.toFixed(2)}
                {seasonType !== "summer_intensive" && " (shoulder season)"}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              This is the base session price. Discounts (member, military, early-bird, sibling) are applied at checkout.
            </p>
          </div>

          {/* Days */}
          <div className="space-y-2">
            <Label>Days of Week</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => (
                <label
                  key={day}
                  className="flex cursor-pointer items-center gap-1.5 text-sm"
                >
                  <Checkbox
                    checked={form.day_of_week.includes(day)}
                    onCheckedChange={() => toggleDay(day)}
                  />
                  {day.slice(0, 3)}
                </label>
              ))}
            </div>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="c-start">Start Time</Label>
              <Input
                id="c-start"
                type="time"
                value={form.start_time}
                onChange={(e) => {
                  const newStart = e.target.value;
                  set("start_time", newStart);
                  // Auto-recalculate end_time if a program type is selected
                  if (form.program_type) {
                    const defaults = PROGRAM_DEFAULTS[form.program_type as ProgramType];
                    if (defaults) {
                      set("end_time", deriveEndTime(newStart, defaults.durationMinutes));
                    }
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-end">End Time</Label>
              <Input
                id="c-end"
                type="time"
                value={form.end_time}
                onChange={(e) => set("end_time", e.target.value)}
              />
            </div>
          </div>

          {/* Instructor */}
          <div className="space-y-2">
            <Label>Instructor</Label>
            <Select
              value={form.instructor_id || "__none__"}
              onValueChange={(v) => set("instructor_id", v === "__none__" ? "" : v)}
            >
              <SelectTrigger>
                {form.instructor_id
                  ? instructors.find((i) => i.id === form.instructor_id)?.name ?? "Select instructor"
                  : "Unassigned"}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {instructors.map((inst) => (
                  <SelectItem key={inst.id} value={inst.id}>
                    {inst.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Capacity */}
          <div className="space-y-2">
            <Label htmlFor="c-cap">Max Capacity</Label>
            <Input
              id="c-cap"
              type="number"
              min={1}
              value={form.max_capacity}
              onChange={(e) => set("max_capacity", Number(e.target.value))}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !canSave}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
