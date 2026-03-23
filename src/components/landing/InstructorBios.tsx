"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface InstructorBio {
  id: string;
  name: string;
  bio: string;
  photo_url: string | null;
  certifications: string[];
}

export function InstructorBios() {
  const supabase = createClient();
  const [instructors, setInstructors] = useState<InstructorBio[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchInstructors = useCallback(async () => {
    const { data } = await supabase
      .from("instructors")
      .select("id, bio, photo_url, certifications, profile:profiles(full_name)")
      .eq("is_active", true)
      .eq("display_on_website", true)
      .limit(8);

    if (data && data.length > 0) {
      setInstructors(
        data.map((d) => {
          const profile = Array.isArray(d.profile) ? d.profile[0] : d.profile;
          return {
            id: d.id,
            name: profile?.full_name ?? "Instructor",
            bio: d.bio ?? "",
            photo_url: d.photo_url,
            certifications: d.certifications ?? [],
          };
        })
      );
    }
    setLoaded(true);
  }, [supabase]);

  useEffect(() => {
    fetchInstructors();
  }, [fetchInstructors]);

  if (!loaded || instructors.length === 0) return null;

  return (
    <section className="border-y bg-muted/40 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center font-heading text-3xl font-bold sm:text-4xl">
          Meet Our Instructors
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-lg text-muted-foreground">
          Certified, experienced, and passionate about teaching kids to swim safely.
        </p>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {instructors.map((inst) => (
            <Card key={inst.id} className="overflow-hidden transition-shadow hover:shadow-md">
              {/* Avatar / Photo */}
              <div className="flex h-40 items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                {inst.photo_url ? (
                  <img
                    src={inst.photo_url}
                    alt={inst.name}
                    className="size-24 rounded-full object-cover ring-4 ring-white shadow-md"
                  />
                ) : (
                  <div className="flex size-24 items-center justify-center rounded-full bg-primary text-3xl font-bold text-white ring-4 ring-white shadow-md">
                    {inst.name.charAt(0)}
                  </div>
                )}
              </div>

              <CardContent className="p-4 text-center">
                <h3 className="font-heading text-base font-semibold">{inst.name}</h3>

                {inst.certifications.length > 0 && (
                  <div className="mt-2 flex flex-wrap justify-center gap-1">
                    {inst.certifications.slice(0, 3).map((cert, i) => (
                      <Badge key={i} variant="outline" className="text-[10px]">
                        <Award className="mr-0.5 size-2.5" />
                        {cert}
                      </Badge>
                    ))}
                  </div>
                )}

                {inst.bio && (
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground line-clamp-3">
                    {inst.bio}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
