"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, ExternalLink, Calendar, Clock, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getLevelColor, getLevelName } from "@/lib/swim-utils";
import { formatTime } from "@/lib/date-utils";

interface CompactClass {
  id: string;
  level: number;
  day_of_week: string[];
  start_time: string;
  end_time: string;
  spots_left: number;
}

interface SessionInfo {
  id: string;
  name: string;
  status: string;
}

export default function EmbedWidgetPage() {
  const supabase = createClient();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [classes, setClasses] = useState<CompactClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [offSeason, setOffSeason] = useState(false);

  // Email capture
  const [email, setEmail] = useState("");
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailSubmitted, setEmailSubmitted] = useState(false);

  const siteUrl = typeof window !== "undefined"
    ? window.location.origin.replace("/embed/widget", "")
    : "";

  const fetchData = useCallback(async () => {
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, name, status")
      .eq("status", "enrollment_open")
      .order("start_date", { ascending: false })
      .limit(1);

    if (!sessions?.length) {
      setOffSeason(true);
      setLoading(false);
      return;
    }

    const sess = sessions[0];
    setSession(sess);

    const { data: classData } = await supabase
      .from("classes")
      .select("id, level, day_of_week, start_time, end_time, max_capacity")
      .eq("session_id", sess.id)
      .eq("is_active", true)
      .order("level")
      .order("start_time");

    if (!classData?.length) {
      setOffSeason(true);
      setLoading(false);
      return;
    }

    // Get enrollment counts
    const classIds = classData.map((c) => c.id);
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("class_id")
      .in("class_id", classIds)
      .eq("status", "confirmed");

    const countMap = new Map<string, number>();
    for (const e of enrollments ?? []) {
      countMap.set(e.class_id, (countMap.get(e.class_id) ?? 0) + 1);
    }

    setClasses(
      classData.map((c) => ({
        id: c.id,
        level: c.level,
        day_of_week: c.day_of_week,
        start_time: c.start_time,
        end_time: c.end_time,
        spots_left: c.max_capacity - (countMap.get(c.id) ?? 0),
      }))
    );
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setEmailSubmitting(true);

    await supabase.from("email_subscribers").upsert(
      { email, source: "embed_widget", subscribed_at: new Date().toISOString() },
      { onConflict: "email" }
    );

    setEmailSubmitted(true);
    setEmailSubmitting(false);
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", maxWidth: 400, margin: "0 auto", padding: 0, background: "#fff" }}>
      {/* Header */}
      <div style={{ background: "#1B4F72", padding: "16px 20px", textAlign: "center" }}>
        <span style={{ color: "#fff", fontSize: 18, fontWeight: 700, letterSpacing: -0.5 }}>
          HAC Swim Lessons
        </span>
        <p style={{ color: "#a0c4e8", fontSize: 12, margin: "4px 0 0" }}>
          Heights Athletic Club — Harker Heights, TX
        </p>
      </div>

      <div style={{ padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 32 }}>
            <Loader2 className="mx-auto size-6 animate-spin text-[#2E86C1]" />
          </div>
        ) : offSeason ? (
          /* Off-season email capture */
          <div style={{ textAlign: "center" }}>
            <Calendar style={{ width: 32, height: 32, margin: "0 auto 12px", color: "#2E86C1" }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: "#1C2833" }}>
              Enrollment Opens Soon
            </p>
            <p style={{ fontSize: 13, color: "#5D6D7E", margin: "8px 0 16px" }}>
              Get notified when registration opens for the next session.
            </p>

            {emailSubmitted ? (
              <div style={{ background: "#ecfdf5", border: "1px solid #34d399", borderRadius: 8, padding: 12 }}>
                <p style={{ color: "#059669", fontSize: 13, fontWeight: 600 }}>
                  You&apos;re on the list! We&apos;ll notify you when enrollment opens.
                </p>
              </div>
            ) : (
              <form onSubmit={handleEmailSubmit} style={{ display: "flex", gap: 8 }}>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ flex: 1, fontSize: 13 }}
                />
                <Button type="submit" size="sm" disabled={emailSubmitting}>
                  {emailSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Notify Me"}
                </Button>
              </form>
            )}
          </div>
        ) : (
          /* Active session — class list */
          <>
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#1C2833" }}>
                {session?.name}
              </p>
              <p style={{ fontSize: 12, color: "#5D6D7E" }}>
                {classes.length} classes available
              </p>
            </div>

            <div style={{ maxHeight: 260, overflowY: "auto", marginBottom: 16 }}>
              {classes.slice(0, 8).map((cls) => (
                <div
                  key={cls.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 0",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: getLevelColor(cls.level),
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    L{cls.level}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "#1C2833", margin: 0 }}>
                      {getLevelName(cls.level)}
                    </p>
                    <p style={{ fontSize: 11, color: "#5D6D7E", margin: 0 }}>
                      {cls.day_of_week.join(", ")} • {formatTime(cls.start_time)}–{formatTime(cls.end_time)}
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: cls.spots_left <= 0 ? "#E74C3C" : cls.spots_left <= 2 ? "#E67E22" : "#27AE60",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {cls.spots_left <= 0 ? "Full" : `${cls.spots_left} left`}
                  </span>
                </div>
              ))}
              {classes.length > 8 && (
                <p style={{ textAlign: "center", fontSize: 12, color: "#5D6D7E", padding: 8 }}>
                  + {classes.length - 8} more classes
                </p>
              )}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <a
                href={`${origin}/book`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ flex: 1, display: "block" }}
              >
                <Button variant="outline" size="sm" className="w-full text-xs">
                  View All Classes
                  <ExternalLink className="ml-1 size-3" />
                </Button>
              </a>
              <a
                href={`${origin}/register`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ flex: 1, display: "block" }}
              >
                <Button size="sm" className="w-full text-xs">
                  Register Now
                  <ExternalLink className="ml-1 size-3" />
                </Button>
              </a>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid #eee", padding: "8px 16px", textAlign: "center" }}>
        <a
          href={`${origin}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 10, color: "#999", textDecoration: "none" }}
        >
          Powered by HAC Swim
        </a>
      </div>
    </div>
  );
}
