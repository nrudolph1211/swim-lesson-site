"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Star,
  Loader2,
  CheckCircle,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  Waves,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { CardSkeleton } from "@/components/ui/skeletons";
import { InlineError } from "@/components/ui/inline-error";

interface SurveyFormProps {
  swimmerId: string;
  sessionId: string;
}

type Phase = "form" | "positive" | "negative";

export function SurveyForm({ swimmerId, sessionId }: SurveyFormProps) {
  const supabase = createClient();
  const [swimmerName, setSwimmerName] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");

  // Form state
  const [overallRating, setOverallRating] = useState(0);
  const [instructorRating, setInstructorRating] = useState(0);
  const [facilityRating, setFacilityRating] = useState(0);
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState("");

  // Settings for review links
  const [googleUrl, setGoogleUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");

  const init = useCallback(async () => {
    setLoadError(null);
    try {
    // Verify swimmer exists
    const { data: swimmer } = await supabase
      .from("swimmers")
      .select("id, first_name, last_name, family_id")
      .eq("id", swimmerId)
      .single();

    if (!swimmer) {
      setNotFound(true);
      return;
    }

    // Verify session exists
    const { data: session } = await supabase
      .from("sessions")
      .select("id, name")
      .eq("id", sessionId)
      .single();

    if (!session) {
      setNotFound(true);
      return;
    }

    setSwimmerName(`${swimmer.first_name} ${swimmer.last_name}`);
    setSessionName(session.name);

    // Check if already submitted
    const { data: existing } = await supabase
      .from("surveys")
      .select("id")
      .eq("swimmer_id", swimmerId)
      .eq("session_id", sessionId)
      .maybeSingle();

    if (existing) {
      setAlreadySubmitted(true);
      return;
    }

    // Fetch review URLs
    const { data: settings } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["google_review_url", "facebook_review_url"]);

    for (const s of settings ?? []) {
      const val = typeof s.value === "string" ? s.value.replace(/"/g, "") : "";
      if (s.key === "google_review_url" && val) setGoogleUrl(val);
      if (s.key === "facebook_review_url" && val) setFacebookUrl(val);
    }

    } catch {
      setLoadError("Failed to load survey. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [supabase, swimmerId, sessionId]);

  useEffect(() => {
    init();
  }, [init]);

  const handleSubmit = async () => {
    if (overallRating === 0 || instructorRating === 0 || facilityRating === 0) {
      toast.error("Please provide all three ratings.");
      return;
    }
    if (wouldRecommend === null) {
      toast.error("Please tell us if you'd recommend our program.");
      return;
    }

    setSubmitting(true);

    // Get swimmer's family_id for the insert
    const { data: swimmer } = await supabase
      .from("swimmers")
      .select("family_id")
      .eq("id", swimmerId)
      .single();

    if (!swimmer) {
      toast.error("Swimmer not found.");
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from("surveys").insert({
      session_id: sessionId,
      family_id: swimmer.family_id,
      swimmer_id: swimmerId,
      overall_rating: overallRating,
      instructor_rating: instructorRating,
      facility_rating: facilityRating,
      would_recommend: wouldRecommend,
      feedback_text: feedback.trim() || null,
      display_name: swimmerName,
    });

    if (error) {
      toast.error("Failed to submit survey. Please try again.");
      setSubmitting(false);
      return;
    }

    const avgRating = (overallRating + instructorRating + facilityRating) / 3;
    const isPositive = avgRating >= 4 && wouldRecommend;

    if (!isPositive) {
      // Notify admin about negative feedback
      await supabase.from("notifications").insert({
        user_id: swimmer.family_id, // Will be caught by admin notification preferences
        type: "general",
        title: "Survey Feedback Received",
        message: `${swimmerName} left feedback (avg ${avgRating.toFixed(1)} stars). Review in the admin panel.`,
        link: "/admin/surveys",
        read: false,
        email_sent: false,
      });
    }

    setPhase(isPositive ? "positive" : "negative");
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
        <div className="text-center space-y-3">
          <CardSkeleton />
        </div>
        <CardSkeleton />
      </div>
    );
  }

  if (loadError) {
    return <InlineError message={loadError} onRetry={init} />;
  }

  if (notFound) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <Waves className="size-12 text-muted-foreground" />
        <h1 className="font-heading text-xl font-bold">Survey Not Found</h1>
        <p className="text-sm text-muted-foreground">
          This survey link is invalid or has expired.
        </p>
      </div>
    );
  }

  if (alreadySubmitted) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <CheckCircle className="size-12 text-green-500" />
        <h1 className="font-heading text-xl font-bold">Already Submitted</h1>
        <p className="text-sm text-muted-foreground">
          You&apos;ve already submitted a survey for {swimmerName} in this session. Thank you!
        </p>
      </div>
    );
  }

  // Positive thank-you screen
  if (phase === "positive") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <CheckCircle className="mx-auto size-16 text-green-500" />
        <h1 className="mt-4 font-heading text-2xl font-bold">Thank You!</h1>
        <p className="mt-2 text-muted-foreground">
          We&apos;re thrilled you had a great experience. It would mean a lot if you shared your thoughts online!
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {googleUrl && (
            <Button
              render={<a href={googleUrl} target="_blank" rel="noopener noreferrer" />}
            >
              <ExternalLink className="mr-2 size-4" />
              Review on Google
            </Button>
          )}
          {facebookUrl && (
            <Button
              variant="outline"
              render={<a href={facebookUrl} target="_blank" rel="noopener noreferrer" />}
            >
              <ExternalLink className="mr-2 size-4" />
              Review on Facebook
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Negative thank-you screen
  if (phase === "negative") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <CheckCircle className="mx-auto size-16 text-primary" />
        <h1 className="mt-4 font-heading text-2xl font-bold">Thank You for Your Feedback</h1>
        <p className="mt-2 text-muted-foreground">
          Your feedback has been shared with our team. We take every response seriously and will use it to improve the experience for all families.
        </p>
      </div>
    );
  }

  // Survey form
  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-8 text-center">
        <Waves className="mx-auto size-10 text-primary" />
        <h1 className="mt-3 font-heading text-2xl font-bold">Session Survey</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {swimmerName} — {sessionName}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-6 p-6">
          {/* Overall Rating */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Overall Experience</Label>
            <StarRating value={overallRating} onChange={setOverallRating} />
          </div>

          {/* Instructor Rating */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Instructor Quality</Label>
            <StarRating value={instructorRating} onChange={setInstructorRating} />
          </div>

          {/* Facility Rating */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Facility & Pool</Label>
            <StarRating value={facilityRating} onChange={setFacilityRating} />
          </div>

          {/* Would Recommend */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Would you recommend our swim lessons?
            </Label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setWouldRecommend(true)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-colors ${
                  wouldRecommend === true
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-border hover:border-green-300"
                }`}
              >
                <ThumbsUp className="size-4" />
                Yes
              </button>
              <button
                type="button"
                onClick={() => setWouldRecommend(false)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-colors ${
                  wouldRecommend === false
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-border hover:border-red-300"
                }`}
              >
                <ThumbsDown className="size-4" />
                No
              </button>
            </div>
          </div>

          {/* Feedback */}
          <div className="space-y-2">
            <Label htmlFor="feedback" className="text-sm font-semibold">
              Additional Feedback{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="feedback"
              placeholder="Tell us what went well or how we can improve..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="h-12 w-full text-base"
          >
            {submitting && <Loader2 className="mr-2 size-5 animate-spin" />}
            Submit Survey
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star)}
          className="rounded p-0.5 transition-transform hover:scale-110"
        >
          <Star
            className={`size-8 ${
              star <= (hover || value)
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            }`}
          />
        </button>
      ))}
    </div>
  );
}
