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
import { SWIM_LEVELS, getLevelName } from "@/lib/swim-utils";

export interface ClassFormData {
  level: number;
  class_type: string;
  day_of_week: string[];
  start_time: string;
  end_time: string;
  instructor_id: string;
  max_capacity: number;
}

const EMPTY_FORM: ClassFormData = {
  level: 1,
  class_type: "group",
  day_of_week: [],
  start_time: "09:00",
  end_time: "09:30",
  instructor_id: "",
  max_capacity: 4,
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
  onSave: (data: ClassFormData) => Promise<void>;
}

const CLASS_TYPE_OPTIONS = [
  { value: "group", label: "Group" },
  { value: "semi_private", label: "Semi-Private" },
  { value: "private", label: "Private" },
];

export function ClassFormDialog({
  open,
  onOpenChange,
  initial,
  title,
  instructors,
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
    form.max_capacity > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Configure the class details.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Level */}
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
                {SWIM_LEVELS.map((lvl) => (
                  <SelectItem key={lvl.id} value={String(lvl.id)}>
                    L{lvl.id}: {lvl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Class Type */}
          <div className="space-y-2">
            <Label>Class Type</Label>
            <Select
              value={form.class_type}
              onValueChange={(v) => v && set("class_type", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select class type" />
              </SelectTrigger>
              <SelectContent>
                {CLASS_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                onChange={(e) => set("start_time", e.target.value)}
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
