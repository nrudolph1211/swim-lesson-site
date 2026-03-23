"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2, FileCheck } from "lucide-react";
import { CardSkeleton } from "@/components/ui/skeletons";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useSettings } from "@/hooks/useSettings";
import { toast } from "sonner";
import type { SwimmerRow } from "@/hooks/useSwimmers";

interface WaiverFormProps {
  swimmer: SwimmerRow;
}

const WAIVER_SECTIONS = [
  {
    title: "SECTION 1: ASSUMPTION OF RISK",
    text: `I, the undersigned parent or legal guardian of the minor swimmer named above ("Participant"), acknowledge that participation in swim lessons and aquatic activities at Heights Athletic Club ("HAC"), located at 301 E FM 2410 Rd, Harker Heights, TX 76548, involves inherent risks.

These risks include, but are not limited to: drowning, near-drowning, slipping on wet surfaces, injuries from contact with pool walls, floors, or equipment, exposure to water-borne illness, sunburn, heat exhaustion, hypothermia, muscle cramps, sprains, strains, fractures, and other injuries that may occur in or around the pool facility.

I understand that while HAC employs certified swim instructors and maintains lifeguard supervision during lessons, no amount of supervision or instruction can eliminate all risk. Swimming and aquatic activities are inherently dangerous. I voluntarily assume all risks associated with Participant's enrollment in swim lessons at HAC, including risks that are not specifically identified herein.`,
  },
  {
    title: "SECTION 2: RELEASE OF LIABILITY",
    text: `In consideration of Participant being permitted to enroll in swim lessons at HAC, I, on behalf of myself, Participant, and our respective heirs, assigns, personal representatives, and estate, hereby RELEASE, WAIVE, DISCHARGE, AND COVENANT NOT TO SUE Heights Athletic Club, its owners, officers, directors, employees, agents, instructors, lifeguards, volunteers, and affiliates (collectively, "Released Parties") from any and all liability, claims, demands, actions, or causes of action whatsoever arising out of or related to any loss, damage, or injury, including death, that may be sustained by Participant or any property belonging to Participant, WHETHER CAUSED BY THE NEGLIGENCE OF THE RELEASED PARTIES OR OTHERWISE, while Participant is participating in swim lessons, using pool facilities, or while in, on, or around the HAC premises.

I further agree that this Release of Liability shall be binding upon my heirs, executors, administrators, personal representatives, and assigns. I understand that this is a complete release of liability to the fullest extent permitted by the laws of the State of Texas.`,
  },
  {
    title: "SECTION 3: INDEMNIFICATION",
    text: `I agree to INDEMNIFY, DEFEND, AND HOLD HARMLESS the Released Parties from any and all claims, actions, suits, procedures, costs, expenses, damages, and liabilities, including attorney's fees, arising out of or in connection with Participant's involvement in swim lessons or use of HAC pool facilities.

This indemnification shall include, but not be limited to, any claim brought by or on behalf of Participant, any co-participant, any third party, or any family member for injuries, damages, or losses sustained during or as a result of participation in swim lessons, regardless of whether such claims are based on the negligence of the Released Parties.

I further agree to pay all costs and expenses, including reasonable attorney's fees, incurred by the Released Parties in defending any such claim or action.`,
  },
  {
    title: "SECTION 4: ACKNOWLEDGMENT",
    text: `I acknowledge and understand the following:

1. SWIM LESSONS DO NOT GUARANTEE WATER SAFETY. Completion of any swim lesson level does not mean that my child is "drown-proof" or safe in all aquatic environments. Constant adult supervision of children in and around water remains essential at all times, regardless of swimming ability.

2. MEDICAL FITNESS. I certify that Participant is physically fit and has no medical condition that would prevent safe participation in swim lessons. I agree to disclose any known medical conditions, allergies, disabilities, or limitations that may affect Participant's ability to safely participate. I understand that if any medical condition arises or changes, it is my responsibility to notify HAC immediately.

3. RULES AND INSTRUCTIONS. I agree that Participant will abide by all facility rules and follow the instructions of HAC swim instructors and staff. I understand that failure to do so may result in dismissal from the program without refund.

4. PHOTO/VIDEO CONSENT. I grant HAC permission to take photographs or video recordings of Participant during swim lessons for promotional, educational, or social media purposes, unless I notify HAC in writing to opt out.

5. EMERGENCY MEDICAL TREATMENT. In the event of an emergency, I authorize HAC staff to administer first aid and/or call emergency medical services (911) for Participant. I understand that I am responsible for all costs of emergency medical treatment.

6. This waiver and release shall remain in effect for the duration of the validity period indicated below. This agreement shall be governed by and construed in accordance with the laws of the State of Texas. If any provision of this agreement is found to be unenforceable, the remaining provisions shall remain in full force and effect.

BY SIGNING BELOW, I ACKNOWLEDGE THAT I HAVE READ THIS WAIVER IN ITS ENTIRETY, UNDERSTAND ITS TERMS, AND SIGN IT VOLUNTARILY.`,
  },
];

const SETTINGS_KEYS = ["waiver_validity_months", "waiver_version"];

export function WaiverForm({ swimmer }: WaiverFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const { user, profile } = useAuthContext();
  const { getNumber, getString, loading: settingsLoading } = useSettings(SETTINGS_KEYS);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [readChecked, setReadChecked] = useState(false);
  const [medicalChecked, setMedicalChecked] = useState(false);
  const [medicalNotes, setMedicalNotes] = useState(swimmer.medical_notes ?? "");
  const [signature, setSignature] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Within 50px of the bottom = scrolled to bottom
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    if (atBottom) setHasScrolledToBottom(true);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Check immediately in case content is shorter than container
    if (el.scrollHeight <= el.clientHeight + 50) {
      setHasScrolledToBottom(true);
    }
  }, []);

  const canSubmit =
    readChecked &&
    medicalChecked &&
    signature.trim().length >= 3 &&
    !submitting;

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;
    setSubmitting(true);

    try {
      const validityMonths = getNumber("waiver_validity_months", 12);
      const waiverVersion = getString("waiver_version", "1.0");

      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + validityMonths);

      // Deactivate any existing active waivers for this swimmer
      await supabase
        .from("waivers")
        .update({ is_active: false })
        .eq("swimmer_id", swimmer.id)
        .eq("signed_by", user.id)
        .eq("is_active", true);

      // Insert new waiver
      const { error: waiverErr } = await supabase.from("waivers").insert({
        swimmer_id: swimmer.id,
        signed_by: user.id,
        signature_data: signature.trim(),
        waiver_version: waiverVersion,
        expires_at: expiresAt.toISOString(),
        is_active: true,
      });

      if (waiverErr) throw waiverErr;

      // Update medical notes if changed
      if (medicalNotes.trim() !== (swimmer.medical_notes ?? "").trim()) {
        await supabase
          .from("swimmers")
          .update({ medical_notes: medicalNotes.trim() || null })
          .eq("id", swimmer.id);
      }

      // Create notification
      await supabase.from("notifications").insert({
        user_id: user.id,
        title: "Waiver Signed",
        message: `Liability waiver for ${swimmer.first_name} ${swimmer.last_name} has been signed and is valid until ${expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`,
        type: "general",
      });

      toast.success("Waiver signed successfully!");
      router.push("/dashboard");
    } catch {
      toast.error("Failed to submit waiver. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (settingsLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold">
          Liability Waiver & Medical Release
        </h1>
        <p className="mt-1 text-lg text-muted-foreground">
          {swimmer.first_name} {swimmer.last_name}
        </p>
      </div>

      {/* Waiver Text */}
      <Card>
        <CardHeader className="pb-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Heights Athletic Club — Swim Program Waiver
          </p>
        </CardHeader>
        <CardContent>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="max-h-[400px] space-y-6 overflow-y-auto rounded-md border bg-muted/30 p-4 text-sm leading-relaxed"
          >
            {WAIVER_SECTIONS.map((section, i) => (
              <div key={i}>
                <h3 className="mb-2 text-sm font-bold">{section.title}</h3>
                <p className="whitespace-pre-line text-muted-foreground">
                  {section.text}
                </p>
              </div>
            ))}
          </div>

          {!hasScrolledToBottom && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Please scroll to the bottom to read the entire waiver.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Medical Disclosure */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <h2 className="text-sm font-semibold">Medical Disclosure</h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="medical-notes">
              Medical conditions, allergies, or special needs
            </Label>
            <Textarea
              id="medical-notes"
              value={medicalNotes}
              onChange={(e) => setMedicalNotes(e.target.value)}
              placeholder="List any medical conditions, allergies, medications, or special accommodations the instructor should be aware of."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Pre-filled from swimmer&apos;s profile. Update if needed.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Agreements & Signature */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <h2 className="text-sm font-semibold">Agreement & Signature</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Read & understood checkbox */}
          <label
            className={`flex items-start gap-3 rounded-md border p-3 transition-colors ${
              hasScrolledToBottom
                ? "cursor-pointer hover:bg-muted/50"
                : "cursor-not-allowed opacity-50"
            }`}
          >
            <Checkbox
              checked={readChecked}
              onCheckedChange={(v) => setReadChecked(v === true)}
              disabled={!hasScrolledToBottom}
              className="mt-0.5"
            />
            <span className="text-sm">
              I have read and understood this waiver in its entirety.
            </span>
          </label>

          {/* Medical accuracy checkbox */}
          <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50">
            <Checkbox
              checked={medicalChecked}
              onCheckedChange={(v) => setMedicalChecked(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm">
              I confirm the medical information provided above is accurate and
              complete to the best of my knowledge.
            </span>
          </label>

          {/* Signature */}
          <div className="space-y-2">
            <Label htmlFor="signature">
              Type your full legal name as signature
            </Label>
            <Input
              id="signature"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder={profile?.full_name ?? "Full Legal Name"}
              className="font-serif text-lg italic"
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              readOnly
              value={new Date().toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
              className="bg-muted/50"
            />
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full"
            size="lg"
          >
            {submitting ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <FileCheck className="mr-2 size-4" />
            )}
            Sign Waiver
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
