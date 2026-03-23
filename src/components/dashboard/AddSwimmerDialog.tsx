"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Plus, ChevronRight, ChevronLeft, Loader2, Check } from "lucide-react";
import { calculateAge, recommendLevel, getLevelName, getLevelColor, getLevelTextColor } from "@/lib/swim-utils";
import { toast } from "sonner";

interface AddSwimmerDialogProps {
  onAdd: (data: {
    first_name: string;
    last_name: string;
    date_of_birth: string;
    current_level: number;
    medical_notes?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    emergency_contact_relationship?: string;
    swim_experience?: string;
  }) => Promise<unknown>;
}

const QUESTIONS = [
  "Is your child comfortable putting their face in the water?",
  "Can your child float on their front or back without assistance?",
  "Can your child swim 15 yards unassisted?",
  "Can your child perform at least 2 different strokes?",
  "Can your child swim 50+ yards continuously and tread water for 1 minute?",
];

export function AddSwimmerDialog({ onAdd }: AddSwimmerDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");

  // Step 2
  const [experience, setExperience] = useState("");
  const [answers, setAnswers] = useState<boolean[]>([false, false, false, false, false]);

  // Step 3
  const [medicalNotes, setMedicalNotes] = useState("");
  const [ecName, setEcName] = useState("");
  const [ecPhone, setEcPhone] = useState("");
  const [ecRelationship, setEcRelationship] = useState("");

  const age = dob ? calculateAge(dob) : null;
  const level = useMemo(() => recommendLevel(answers), [answers]);

  const reset = () => {
    setStep(1);
    setFirstName("");
    setLastName("");
    setDob("");
    setExperience("");
    setAnswers([false, false, false, false, false]);
    setMedicalNotes("");
    setEcName("");
    setEcPhone("");
    setEcRelationship("");
  };

  const toggleAnswer = (index: number) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const canProceed = () => {
    if (step === 1) return firstName.trim() && lastName.trim() && dob;
    return true;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onAdd({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        date_of_birth: dob,
        current_level: level,
        medical_notes: medicalNotes.trim() || undefined,
        emergency_contact_name: ecName.trim() || undefined,
        emergency_contact_phone: ecPhone.trim() || undefined,
        emergency_contact_relationship: ecRelationship.trim() || undefined,
        swim_experience: experience.trim() || undefined,
      });
      toast.success(`${firstName} has been added!`);
      setOpen(false);
      reset();
    } catch {
      toast.error("Failed to add swimmer. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger render={<Button><Plus className="mr-2 size-4" />Add Swimmer</Button>} />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a Swimmer — Step {step} of 4</DialogTitle>
          <DialogDescription>
            {step === 1 && "Basic information about your child."}
            {step === 2 && "Help us recommend the right level."}
            {step === 3 && "Medical and emergency contact info."}
            {step === 4 && "Review and confirm."}
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{
                backgroundColor: s <= step ? "var(--primary)" : "var(--border)",
              }}
            />
          ))}
        </div>

        <div className="mt-2 min-h-[280px]">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sw-fn">First Name</Label>
                  <Input
                    id="sw-fn"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Emma"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sw-ln">Last Name</Label>
                  <Input
                    id="sw-ln"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Smith"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sw-dob">Date of Birth</Label>
                <Input
                  id="sw-dob"
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  required
                />
                {age !== null && (
                  <p className="text-sm text-muted-foreground">
                    Age: {age} year{age !== 1 ? "s" : ""} old
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Level Placement */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sw-exp">Swim Experience (optional)</Label>
                <Textarea
                  id="sw-exp"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder="Has your child had any previous swim lessons?"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                {QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleAnswer(i)}
                    className="flex w-full items-center gap-3 rounded-md border p-3 text-left text-sm transition-colors hover:bg-muted/50"
                  >
                    <div
                      className={`flex size-5 shrink-0 items-center justify-center rounded border transition-colors ${
                        answers[i]
                          ? "border-primary bg-primary text-white"
                          : "border-muted-foreground/30"
                      }`}
                    >
                      {answers[i] && <Check className="size-3" />}
                    </div>
                    {q}
                  </button>
                ))}
              </div>

              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="text-sm font-medium">
                  Recommended:{" "}
                  <Badge
                    className="ml-1"
                    style={{ backgroundColor: getLevelColor(level), color: getLevelTextColor(level) }}
                  >
                    Level {level}: {getLevelName(level)}
                  </Badge>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your instructor may adjust after the first lesson.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Medical & Emergency */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sw-med">
                  Medical Notes / Allergies (optional)
                </Label>
                <Textarea
                  id="sw-med"
                  value={medicalNotes}
                  onChange={(e) => setMedicalNotes(e.target.value)}
                  placeholder="Any conditions, allergies, or notes the instructor should know about"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ec-name">Emergency Contact Name</Label>
                <Input
                  id="ec-name"
                  value={ecName}
                  onChange={(e) => setEcName(e.target.value)}
                  placeholder="John Smith"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ec-phone">Phone</Label>
                  <Input
                    id="ec-phone"
                    type="tel"
                    value={ecPhone}
                    onChange={(e) => setEcPhone(e.target.value)}
                    placeholder="(254) 555-0123"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ec-rel">Relationship</Label>
                  <Input
                    id="ec-rel"
                    value={ecRelationship}
                    onChange={(e) => setEcRelationship(e.target.value)}
                    placeholder="Father"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-3">
              <div className="rounded-lg border p-4">
                <h4 className="font-heading text-sm font-semibold">
                  {firstName} {lastName}
                </h4>
                <div className="mt-2 grid grid-cols-2 gap-y-1.5 text-sm text-muted-foreground">
                  <span>Date of Birth:</span>
                  <span className="text-foreground">{dob}</span>
                  <span>Age:</span>
                  <span className="text-foreground">
                    {age} year{age !== 1 ? "s" : ""}
                  </span>
                  <span>Recommended Level:</span>
                  <Badge
                    className="w-fit"
                    style={{ backgroundColor: getLevelColor(level), color: getLevelTextColor(level) }}
                  >
                    L{level}: {getLevelName(level)}
                  </Badge>
                  {experience && (
                    <>
                      <span>Experience:</span>
                      <span className="text-foreground">{experience}</span>
                    </>
                  )}
                  {medicalNotes && (
                    <>
                      <span>Medical Notes:</span>
                      <span className="text-foreground">{medicalNotes}</span>
                    </>
                  )}
                  {ecName && (
                    <>
                      <span>Emergency Contact:</span>
                      <span className="text-foreground">
                        {ecName} ({ecRelationship}) {ecPhone}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between pt-2">
          {step > 1 ? (
            <Button variant="outline" size="sm" onClick={() => setStep(step - 1)}>
              <ChevronLeft className="mr-1 size-4" />
              Back
            </Button>
          ) : (
            <DialogClose render={<Button variant="ghost" size="sm">Cancel</Button>} />
          )}

          {step < 4 ? (
            <Button
              size="sm"
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
            >
              Next
              <ChevronRight className="ml-1 size-4" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Add Swimmer
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
