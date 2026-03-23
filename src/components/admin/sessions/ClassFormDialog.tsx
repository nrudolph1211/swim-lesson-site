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
import { SWIM_LEVELS } from "@/lib/swim-utils";

export interface ClassFormData {
  level: number;
  class_type: string;
  day_of_week: string[];
  start_time: string;
  end_time: string;
  instructor_id: string;
  max_capacity: number;
  member_price: string;
  non_member_price: string;
  military_price: string;
}

const EMPTY_FORM: ClassFormData = {
  level: 1,
  class_type: "group",
  day_of_week: [],
  start_time: "09:00",
  end_time: "09:30",
  instructor_id: "",
  max_capacity: 4,
  member_price: "",
  non_member_price: "",
  military_price: "",
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const CAPACITY_BY_LEVEL: Record<number, number> = {
  1: 4,
  2: 4,
  3: 5,
  4: 6,
  5: 6,
};

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

  const handleLevelChange = (level: string | null) => {
    if (!level) return;
    const lvl = Number(level);
    set("level", lvl);
    // Auto-fill capacity if using default
    if (form.max_capacity === CAPACITY_BY_LEVEL[form.level] || form.max_capacity === 0) {
      set("max_capacity", CAPACITY_BY_LEVEL[lvl] ?? 4);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
      onOpenChange(false);
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Level</Label>
              <Select
                value={String(form.level)}
                onValueChange={handleLevelChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SWIM_LEVELS.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      <span
                        className="mr-2 inline-block size-2 rounded-full"
                        style={{ backgroundColor: l.color }}
                      />
                      L{l.id}: {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Class Type</Label>
              <Select
                value={form.class_type}
                onValueChange={(v) => set("class_type", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="group">Group</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="semi_private">Semi-Private</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
              value={form.instructor_id}
              onValueChange={(v) => set("instructor_id", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select instructor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Unassigned</SelectItem>
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
            <p className="text-xs text-muted-foreground">
              Default: L1-2 = 4, L3 = 5, L4-5 = 6
            </p>
          </div>

          {/* Prices */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="c-price-member">Member $</Label>
              <Input
                id="c-price-member"
                type="number"
                step="0.01"
                min={0}
                value={form.member_price}
                onChange={(e) => set("member_price", e.target.value)}
                placeholder="150.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-price-non">Non-Member $</Label>
              <Input
                id="c-price-non"
                type="number"
                step="0.01"
                min={0}
                value={form.non_member_price}
                onChange={(e) => set("non_member_price", e.target.value)}
                placeholder="175.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-price-mil">Military $</Label>
              <Input
                id="c-price-mil"
                type="number"
                step="0.01"
                min={0}
                value={form.military_price}
                onChange={(e) => set("military_price", e.target.value)}
                placeholder="135.00"
              />
            </div>
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
