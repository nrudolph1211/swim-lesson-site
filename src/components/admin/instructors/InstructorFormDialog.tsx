"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2, Plus, Trash2 } from "lucide-react";

export interface InstructorFormData {
  full_name: string;
  email: string;
  phone: string;
  bio: string;
  photo_url: string;
  is_active: boolean;
  display_on_website: boolean;
  hourly_rate: string;
  certifications: { name: string; expiry_date: string }[];
}

const EMPTY_FORM: InstructorFormData = {
  full_name: "",
  email: "",
  phone: "",
  bio: "",
  photo_url: "",
  is_active: true,
  display_on_website: true,
  hourly_rate: "",
  certifications: [],
};

const CERT_OPTIONS = ["CPR", "First Aid", "Lifeguard", "WSI", "Other"];

interface InstructorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<InstructorFormData> | null;
  title: string;
  onSave: (data: InstructorFormData) => Promise<void>;
  isEdit?: boolean;
}

export function InstructorFormDialog({
  open,
  onOpenChange,
  initial,
  title,
  onSave,
  isEdit,
}: InstructorFormDialogProps) {
  const [form, setForm] = useState<InstructorFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY_FORM, ...initial });
    }
  }, [open, initial]);

  const set = (key: keyof InstructorFormData, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }));

  const addCert = () => {
    setForm((f) => ({
      ...f,
      certifications: [...f.certifications, { name: "CPR", expiry_date: "" }],
    }));
  };

  const updateCert = (idx: number, field: "name" | "expiry_date", value: string) => {
    setForm((f) => ({
      ...f,
      certifications: f.certifications.map((c, i) =>
        i === idx ? { ...c, [field]: value } : c
      ),
    }));
  };

  const removeCert = (idx: number) => {
    setForm((f) => ({
      ...f,
      certifications: f.certifications.filter((_, i) => i !== idx),
    }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoUploading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const ext = file.name.split(".").pop();
      const path = `instructors/${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from("photos")
        .upload(path, file, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from("photos").getPublicUrl(path);
      set("photo_url", urlData.publicUrl);
    } catch {
      // Silently fail — user can retry
    } finally {
      setPhotoUploading(false);
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

  const canSave = form.full_name.trim() && form.email.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update instructor details." : "Invite a new instructor. They'll receive an email to set their password."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name + Email */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="inst-name">Full Name *</Label>
              <Input
                id="inst-name"
                value={form.full_name}
                onChange={(e) => set("full_name", e.target.value)}
                placeholder="Jane Smith"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inst-email">Email *</Label>
              <Input
                id="inst-email"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="jane@example.com"
                disabled={isEdit}
              />
            </div>
          </div>

          {/* Phone + Rate */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="inst-phone">Phone</Label>
              <Input
                id="inst-phone"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="(254) 555-0123"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inst-rate">Hourly Rate ($)</Label>
              <Input
                id="inst-rate"
                type="number"
                step="0.01"
                min={0}
                value={form.hourly_rate}
                onChange={(e) => set("hourly_rate", e.target.value)}
                placeholder="25.00"
              />
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label htmlFor="inst-bio">Bio</Label>
            <Textarea
              id="inst-bio"
              value={form.bio}
              onChange={(e) => set("bio", e.target.value)}
              placeholder="Brief instructor bio for the website..."
              rows={3}
            />
          </div>

          {/* Photo Upload */}
          <div className="space-y-2">
            <Label>Photo</Label>
            <div className="flex items-center gap-3">
              {form.photo_url && (
                <img
                  src={form.photo_url}
                  alt="Instructor"
                  className="size-12 rounded-full object-cover"
                />
              )}
              <div>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={photoUploading}
                  className="w-auto text-sm"
                />
                {photoUploading && (
                  <p className="mt-1 text-xs text-muted-foreground">Uploading...</p>
                )}
              </div>
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => set("is_active", v)}
                id="inst-active"
              />
              <Label htmlFor="inst-active">Active</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.display_on_website}
                onCheckedChange={(v) => set("display_on_website", v)}
                id="inst-website"
              />
              <Label htmlFor="inst-website">Show on Website</Label>
            </div>
          </div>

          {/* Certifications */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Certifications</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addCert}>
                <Plus className="mr-1 size-3" />
                Add Cert
              </Button>
            </div>
            {form.certifications.length === 0 && (
              <p className="text-sm text-muted-foreground">No certifications added.</p>
            )}
            {form.certifications.map((cert, idx) => (
              <div key={idx} className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Select
                    value={cert.name}
                    onValueChange={(v) => v && updateCert(idx, "name", v)}
                  >
                    <SelectTrigger size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CERT_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 space-y-1">
                  <Input
                    type="date"
                    value={cert.expiry_date}
                    onChange={(e) => updateCert(idx, "expiry_date", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeCert(idx)}
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !canSave}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isEdit ? "Save Changes" : "Invite Instructor"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
