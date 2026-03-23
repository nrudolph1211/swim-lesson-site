"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Star,
  TrendingUp,
  MessageSquare,
  BarChart3,
  Download,
  Loader2,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { format, parseISO } from "date-fns";

interface SurveyRow {
  id: string;
  session_id: string;
  session_name: string;
  swimmer_name: string;
  display_name: string | null;
  overall_rating: number;
  instructor_rating: number;
  facility_rating: number;
  would_recommend: boolean;
  feedback_text: string | null;
  approved_for_display: boolean;
  created_at: string;
}

interface SessionOption {
  id: string;
  name: string;
}

export function SurveysManager() {
  const supabase = createClient();
  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterSession, setFilterSession] = useState("all");
  const [filterRating, setFilterRating] = useState("all");

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Fetch sessions for filter dropdown
    const { data: sessData } = await supabase
      .from("sessions")
      .select("id, name")
      .order("start_date", { ascending: false });
    setSessions(sessData ?? []);

    // Fetch surveys with joins
    const { data } = await supabase
      .from("surveys")
      .select(`
        id,
        session_id,
        overall_rating,
        instructor_rating,
        facility_rating,
        would_recommend,
        feedback_text,
        approved_for_display,
        display_name,
        created_at,
        session:sessions(name),
        swimmer:swimmers(first_name, last_name)
      `)
      .order("created_at", { ascending: false });

    if (data) {
      const mapped = data.map((s: Record<string, unknown>) => {
        const session = Array.isArray(s.session) ? s.session[0] : s.session;
        const swimmer = Array.isArray(s.swimmer) ? s.swimmer[0] : s.swimmer;
        return {
          id: s.id as string,
          session_id: s.session_id as string,
          session_name: session?.name ?? "Unknown",
          swimmer_name: swimmer
            ? `${swimmer.first_name} ${swimmer.last_name}`
            : "Unknown",
          display_name: s.display_name as string | null,
          overall_rating: s.overall_rating as number,
          instructor_rating: s.instructor_rating as number,
          facility_rating: s.facility_rating as number,
          would_recommend: s.would_recommend as boolean,
          feedback_text: s.feedback_text as string | null,
          approved_for_display: s.approved_for_display as boolean,
          created_at: s.created_at as string,
        };
      });
      setSurveys(mapped);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleDisplay = async (id: string, current: boolean) => {
    await supabase
      .from("surveys")
      .update({ approved_for_display: !current })
      .eq("id", id);
    setSurveys((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, approved_for_display: !current } : s
      )
    );
  };

  // Filtered surveys
  const filtered = surveys.filter((s) => {
    if (filterSession !== "all" && s.session_id !== filterSession) return false;
    if (filterRating !== "all" && s.overall_rating !== Number(filterRating))
      return false;
    return true;
  });

  // Metrics
  const total = surveys.length;
  const avgOverall =
    total > 0
      ? (surveys.reduce((sum, s) => sum + s.overall_rating, 0) / total).toFixed(
          1
        )
      : "0";
  const promoters = surveys.filter((s) => s.would_recommend).length;
  const detractors = surveys.filter((s) => !s.would_recommend).length;
  const nps =
    total > 0
      ? Math.round(((promoters - detractors) / total) * 100)
      : 0;

  // Rating distribution (1-5)
  const distribution = [1, 2, 3, 4, 5].map((r) => ({
    rating: r,
    count: surveys.filter((s) => s.overall_rating === r).length,
  }));
  const maxCount = Math.max(...distribution.map((d) => d.count), 1);

  // CSV export
  const exportCSV = () => {
    const headers = [
      "Date",
      "Session",
      "Swimmer",
      "Overall",
      "Instructor",
      "Facility",
      "Recommend",
      "Feedback",
      "Featured",
    ];
    const rows = filtered.map((s) => [
      format(parseISO(s.created_at), "yyyy-MM-dd"),
      s.session_name,
      s.swimmer_name,
      s.overall_rating,
      s.instructor_rating,
      s.facility_rating,
      s.would_recommend ? "Yes" : "No",
      `"${(s.feedback_text ?? "").replace(/"/g, '""')}"`,
      s.approved_for_display ? "Yes" : "No",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `surveys-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Survey Responses</h1>
          <p className="text-sm text-muted-foreground">
            Review parent feedback and manage testimonials.
          </p>
        </div>
        <Button variant="outline" onClick={exportCSV}>
          <Download className="mr-2 size-4" />
          Export CSV
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-yellow-100">
              <Star className="size-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{avgOverall}</p>
              <p className="text-xs text-muted-foreground">Avg Rating</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-green-100">
              <TrendingUp className="size-5 text-green-600" />
            </div>
            <div>
              <p className={`text-2xl font-bold ${nps >= 0 ? "text-green-600" : "text-red-600"}`}>
                {nps > 0 ? "+" : ""}{nps}
              </p>
              <p className="text-xs text-muted-foreground">NPS Score</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-blue-100">
              <MessageSquare className="size-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-xs text-muted-foreground">Total Responses</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-purple-100">
              <BarChart3 className="size-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {total > 0 ? `${Math.round((promoters / total) * 100)}%` : "0%"}
              </p>
              <p className="text-xs text-muted-foreground">Would Recommend</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rating Distribution */}
      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Rating Distribution</h3>
          <div className="space-y-2">
            {[...distribution].reverse().map((d) => (
              <div key={d.rating} className="flex items-center gap-3">
                <span className="w-12 text-right text-sm text-muted-foreground">
                  {d.rating} star{d.rating !== 1 ? "s" : ""}
                </span>
                <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full rounded bg-yellow-400 transition-all"
                    style={{ width: `${(d.count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-sm font-medium">{d.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={filterSession}
          onValueChange={(v) => v && setFilterSession(v)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Sessions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sessions</SelectItem>
            {sessions.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filterRating}
          onValueChange={(v) => v && setFilterRating(v)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Ratings" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ratings</SelectItem>
            {[5, 4, 3, 2, 1].map((r) => (
              <SelectItem key={r} value={String(r)}>
                {r} Star{r !== 1 ? "s" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Swimmer</TableHead>
                <TableHead>Session</TableHead>
                <TableHead className="text-center">Overall</TableHead>
                <TableHead className="text-center">Instructor</TableHead>
                <TableHead className="text-center">Facility</TableHead>
                <TableHead className="text-center">Recommend</TableHead>
                <TableHead>Feedback</TableHead>
                <TableHead className="text-center">Feature</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No survey responses yet.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-sm font-medium">
                      {s.swimmer_name}
                    </TableCell>
                    <TableCell className="text-sm">{s.session_name}</TableCell>
                    <TableCell className="text-center">
                      <RatingBadge rating={s.overall_rating} />
                    </TableCell>
                    <TableCell className="text-center">
                      <RatingBadge rating={s.instructor_rating} />
                    </TableCell>
                    <TableCell className="text-center">
                      <RatingBadge rating={s.facility_rating} />
                    </TableCell>
                    <TableCell className="text-center">
                      {s.would_recommend ? (
                        <ThumbsUp className="mx-auto size-4 text-green-600" />
                      ) : (
                        <ThumbsDown className="mx-auto size-4 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                      {s.feedback_text ?? "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={s.approved_for_display}
                        onCheckedChange={() =>
                          toggleDisplay(s.id, s.approved_for_display)
                        }
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(parseISO(s.created_at), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function RatingBadge({ rating }: { rating: number }) {
  const color =
    rating >= 4
      ? "bg-green-100 text-green-800"
      : rating >= 3
        ? "bg-yellow-100 text-yellow-800"
        : "bg-red-100 text-red-800";

  return (
    <Badge className={`${color} text-xs`}>
      <Star className="mr-0.5 size-3 fill-current" />
      {rating}
    </Badge>
  );
}
