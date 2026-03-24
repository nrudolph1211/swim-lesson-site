"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

export interface SessionFormData {
  name: string;
  start_date: string;
  end_date: string;
  enrollment_open_date: string;
  enrollment_close_date: string;
  status: string;
  season_type: string;
  early_bird_discount_percent: number;
  early_bird_deadline: string;
  priority_enrollment_start: string;
  priority_enrollment_end: string;
  re_enrollment_priority_enabled: boolean;
}

const EMPTY_FORM: SessionFormData = {
  name: "",
  start_date: "",
  end_date: "",
  enrollment_open_date: "",
  enrollment_close_date: "",
  status: "draft",
  season_type: "summer_intensive",
  early_bird_discount_percent: 0,
  early_bird_deadline: "",
  priority_enrollment_start: "",
  priority_enrollment_end: "",
  re_enrollment_priority_enabled: false,
};

interface SessionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<SessionFormData> | null;
  title: string;
  onSave: (data: SessionFormData) => Promise<void>;
}

export function SessionFormDialog({
  open,
  onOpenChange,
  initial,
  title,
  onSave,
}: SessionFormDialogProps) {
  const [form, setForm] = useState<SessionFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY_FORM, ...initial });
    }
  }, [open, initial]);

  const set = (key: keyof SessionFormData, value: string | number | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to save session:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Fill in the session details below.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="s-name">Session Name</Label>
            <Input
              id="s-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Summer 2026 — Session A"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="s-start">Start Date</Label>
              <Input
                id="s-start"
                type="date"
                value={form.start_date}
                onChange={(e) => set("start_date", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-end">End Date</Label>
              <Input
                id="s-end"
                type="date"
                value={form.end_date}
                onChange={(e) => set("end_date", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="s-enroll-open">Enrollment Opens</Label>
              <Input
                id="s-enroll-open"
                type="datetime-local"
                value={form.enrollment_open_date}
                onChange={(e) => set("enrollment_open_date", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-enroll-close">Enrollment Closes</Label>
              <Input
                id="s-enroll-close"
                type="datetime-local"
                value={form.enrollment_close_date}
                onChange={(e) => set("enrollment_close_date", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => v && set("status", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="enrollment_open">Enrollment Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Season Type</Label>
              <Select value={form.season_type} onValueChange={(v) => v && set("season_type", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summer_intensive">Summer Intensive</SelectItem>
                  <SelectItem value="shoulder_spring">Shoulder (Spring)</SelectItem>
                  <SelectItem value="shoulder_fall">Shoulder (Fall)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="s-eb-pct">Early Bird Discount %</Label>
              <Input
                id="s-eb-pct"
                type="number"
                min={0}
                max={100}
                value={form.early_bird_discount_percent}
                onChange={(e) =>
                  set("early_bird_discount_percent", Number(e.target.value))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-eb-dl">Early Bird Deadline</Label>
              <Input
                id="s-eb-dl"
                type="datetime-local"
                value={form.early_bird_deadline}
                onChange={(e) => set("early_bird_deadline", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="s-pri-start">Priority Enrollment Start</Label>
              <Input
                id="s-pri-start"
                type="datetime-local"
                value={form.priority_enrollment_start}
                onChange={(e) =>
                  set("priority_enrollment_start", e.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-pri-end">Priority Enrollment End</Label>
              <Input
                id="s-pri-end"
                type="datetime-local"
                value={form.priority_enrollment_end}
                onChange={(e) => set("priority_enrollment_end", e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={form.re_enrollment_priority_enabled}
              onCheckedChange={(v) => set("re_enrollment_priority_enabled", v)}
              id="s-re-enroll"
            />
            <Label htmlFor="s-re-enroll">
              Re-enrollment priority for returning families
            </Label>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
          >
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
