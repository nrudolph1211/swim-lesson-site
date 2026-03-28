"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save, BookOpen, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { CardSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineError } from "@/components/ui/inline-error";
import {
  SWIM_LEVELS,
  getLevelColor,
  getLevelTextColor,
  getLevelName,
  calculateAge,
} from "@/lib/swim-utils";
import { formatTime } from "@/lib/date-utils";
import { format } from "date-fns";

interface SwimmerDetailProps {
  swimmerId: string;
  onUpdated: () => void;
}

interface SwimmerFull {
  id: string;
  family_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  current_level: number;
  medical_notes: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  swim_experience: string | null;
  is_active: boolean;
  created_at: string;
}

interface EnrollmentHistory {
  id: string;
  status: string;
  created_at: string;
  class: {
    level: number;
    day_of_week: string[];
    start_time: string;
    session: { name: string };
  };
}

interface WaiverHistory {
  id: string;
  signed_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  waiver_version: string;
}

export function SwimmerDetail({ swimmerId, onUpdated }: SwimmerDetailProps) {
  const supabase = createClient();
  const [swimmer, setSwimmer] = useState<SwimmerFull | null>(null);
  const [parentName, setParentName] = useState("");
  const [enrollments, setEnrollments] = useState<EnrollmentHistory[]>([]);
  const [waivers, setWaivers] = useState<WaiverHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [level, setLevel] = useState(1);
  const [medicalNotes, setMedicalNotes] = useState("");
  const [ecName, setEcName] = useState("");
  const [ecPhone, setEcPhone] = useState("");
  const [ecRel, setEcRel] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [swimmerRes, enrollRes, waiverRes] = await Promise.all([
        supabase
          .from("swimmers")
          .select("*, family:profiles!family_id(full_name)")
          .eq("id", swimmerId)
          .single(),
        supabase
          .from("class_assignments")
          .select(
            "id, status, created_at, class:classes(level, day_of_week, start_time, session:sessions(name))"
          )
          .eq("swimmer_id", swimmerId)
          .order("created_at", { ascending: false }),
        supabase
          .from("waivers")
          .select("id, signed_at, expires_at, is_active, waiver_version")
          .eq("swimmer_id", swimmerId)
          .order("signed_at", { ascending: false }),
      ]);

      if (swimmerRes.error) throw swimmerRes.error;

      if (swimmerRes.data) {
        const s = swimmerRes.data;
        setSwimmer(s);
        setFirstName(s.first_name);
        setLastName(s.last_name);
        setDob(s.date_of_birth);
        setLevel(s.current_level);
        setMedicalNotes(s.medical_notes ?? "");
        setEcName(s.emergency_contact_name ?? "");
        setEcPhone(s.emergency_contact_phone ?? "");
        setEcRel(s.emergency_contact_relationship ?? "");

        const family = s.family as unknown as
          | { full_name: string }
          | { full_name: string }[]
          | null;
        const fObj = Array.isArray(family) ? family[0] : family;
        setParentName(fObj?.full_name ?? "Unknown");
      }

      if (enrollRes.data) {
        setEnrollments(
          enrollRes.data.map((e: Record<string, unknown>) => ({
            ...e,
            class: Array.isArray(e.class) ? e.class[0] : e.class,
          })) as unknown as EnrollmentHistory[]
        );
      }

      if (waiverRes.data) {
        setWaivers(waiverRes.data as WaiverHistory[]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load swimmer details.";
      setError(message);
      toast.error("Failed to load swimmer details.", { duration: Infinity });
    } finally {
      setLoading(false);
    }
  }, [supabase, swimmerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("swimmers")
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          date_of_birth: dob,
          current_level: level,
          medical_notes: medicalNotes.trim() || null,
          emergency_contact_name: ecName.trim() || null,
          emergency_contact_phone: ecPhone.trim() || null,
          emergency_contact_relationship: ecRel.trim() || null,
        })
        .eq("id", swimmerId);
      if (error) throw error;
      toast.success("Swimmer updated.");
      onUpdated();
    } catch {
      toast.error("Failed to update swimmer.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <CardSkeleton />;
  }

  if (error) {
    return <InlineError message={error} onRetry={fetchData} />;
  }

  if (!swimmer) {
    return <EmptyState title="Swimmer not found" description="This swimmer may have been removed or the link is invalid." />;
  }

  const age = calculateAge(swimmer.date_of_birth);

  return (
    <div className="space-y-6 pb-4">
      {/* Header */}
      <div>
        <h3 className="font-heading text-lg font-semibold">
          {swimmer.first_name} {swimmer.last_name}
        </h3>
        <p className="text-sm text-muted-foreground">
          {age} years old • Parent: {parentName}
        </p>
      </div>

      {/* Edit Form */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="sd-fn" className="text-xs">First Name</Label>
            <Input id="sd-fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sd-ln" className="text-xs">Last Name</Label>
            <Input id="sd-ln" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="sd-dob" className="text-xs">Date of Birth</Label>
            <Input id="sd-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Level</Label>
            <Select value={String(level)} onValueChange={(v) => v && setLevel(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SWIM_LEVELS.map((l) => (
                  <SelectItem key={l.id} value={String(l.id)}>
                    L{l.id}: {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sd-med" className="text-xs">Medical Notes</Label>
          <Textarea id="sd-med" value={medicalNotes} onChange={(e) => setMedicalNotes(e.target.value)} rows={2} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="sd-ec" className="text-xs">Emergency Contact</Label>
            <Input id="sd-ec" value={ecName} onChange={(e) => setEcName(e.target.value)} placeholder="Name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sd-ecp" className="text-xs">Phone</Label>
            <Input id="sd-ecp" value={ecPhone} onChange={(e) => setEcPhone(e.target.value)} placeholder="Phone" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sd-ecr" className="text-xs">Relationship</Label>
            <Input id="sd-ecr" value={ecRel} onChange={(e) => setEcRel(e.target.value)} placeholder="Rel" />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Save className="mr-2 size-3.5" />}
          Save Changes
        </Button>
      </div>

      <Separator />

      {/* Enrollment History */}
      <div>
        <h4 className="mb-2 text-sm font-semibold">Enrollment History</h4>
        {enrollments.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="size-8" />}
            title="No enrollments"
            description="This swimmer has not been enrolled in any classes yet."
            className="py-6"
          />
        ) : (
          <div className="space-y-1.5">
            {enrollments.map((e) => {
              const cls = e.class;
              return (
                <div
                  key={e.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div>
                    <Badge
                      className="mr-2"
                      style={{ backgroundColor: getLevelColor(cls?.level ?? 1), color: getLevelTextColor(cls?.level ?? 1) }}
                    >
                      L{cls?.level}
                    </Badge>
                    <span className="text-muted-foreground">
                      {cls?.session?.name} • {cls?.day_of_week?.join(", ")} {formatTime(cls?.start_time)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        e.status === "active" ? "default" :
                        e.status === "completed" ? "secondary" : "outline"
                      }
                    >
                      {e.status}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Separator />

      {/* Waiver History */}
      <div>
        <h4 className="mb-2 text-sm font-semibold">Waiver History</h4>
        {waivers.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-8" />}
            title="No waivers signed"
            description="No waivers have been signed for this swimmer."
            className="py-6"
          />
        ) : (
          <div className="space-y-1.5">
            {waivers.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <div className="text-muted-foreground">
                  v{w.waiver_version} — Signed{" "}
                  {w.signed_at
                    ? format(new Date(w.signed_at), "MMM d, yyyy")
                    : "N/A"}
                </div>
                <div className="flex items-center gap-2">
                  {w.is_active ? (
                    <Badge variant="outline" className="border-green-500 text-green-600">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Expired</Badge>
                  )}
                  {w.expires_at && (
                    <span className="text-xs text-muted-foreground">
                      Exp: {format(new Date(w.expires_at), "MMM d, yyyy")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
