"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Testimonial {
  id: string;
  display_name: string;
  overall_rating: number;
  feedback_text: string;
}

export function TestimonialsCarousel() {
  const supabase = createClient();
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const fetchTestimonials = useCallback(async () => {
    const { data } = await supabase
      .from("surveys")
      .select("id, display_name, overall_rating, feedback_text")
      .eq("approved_for_display", true)
      .not("feedback_text", "is", null)
      .order("created_at", { ascending: false })
      .limit(12);

    if (data && data.length > 0) {
      setTestimonials(
        data.map((d) => ({
          id: d.id,
          display_name: d.display_name ?? "HAC Swim Family",
          overall_rating: d.overall_rating,
          feedback_text: d.feedback_text!,
        }))
      );
    }
    setLoaded(true);
  }, [supabase]);

  useEffect(() => {
    fetchTestimonials();
  }, [fetchTestimonials]);

  // Auto-advance every 6 seconds
  useEffect(() => {
    if (testimonials.length <= 1) return;
    const interval = setInterval(() => {
      setCurrent((c) => (c + 1) % testimonials.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [testimonials.length]);

  if (!loaded || testimonials.length === 0) return null;

  const prev = () =>
    setCurrent((c) => (c - 1 + testimonials.length) % testimonials.length);
  const next = () => setCurrent((c) => (c + 1) % testimonials.length);

  const t = testimonials[current];

  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center font-heading text-3xl font-bold sm:text-4xl">
          What Families Say
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-lg text-muted-foreground">
          Hear from parents who chose HAC Swim.
        </p>

        <div className="relative mt-12">
          <Card className="mx-auto max-w-2xl">
            <CardContent className="relative px-8 py-10 text-center">
              <Quote className="mx-auto mb-4 size-8 text-primary/20" />

              <p className="text-lg leading-relaxed text-foreground">
                &ldquo;{t.feedback_text}&rdquo;
              </p>

              <div className="mt-6 flex items-center justify-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`size-5 ${
                      star <= t.overall_rating
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }`}
                  />
                ))}
              </div>

              <p className="mt-3 text-sm font-medium text-muted-foreground">
                — {t.display_name}
              </p>
            </CardContent>
          </Card>

          {testimonials.length > 1 && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full"
                onClick={prev}
                aria-label="Previous testimonial"
              >
                <ChevronLeft className="size-5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full"
                onClick={next}
                aria-label="Next testimonial"
              >
                <ChevronRight className="size-5" />
              </Button>

              {/* Dots */}
              <div className="mt-6 flex justify-center gap-2" role="tablist" aria-label="Testimonial navigation">
                {testimonials.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrent(i)}
                    role="tab"
                    aria-selected={i === current}
                    aria-label={`Testimonial ${i + 1} of ${testimonials.length}`}
                    className={`size-2 rounded-full transition-colors ${
                      i === current ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
