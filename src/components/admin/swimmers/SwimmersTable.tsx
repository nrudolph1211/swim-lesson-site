"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  SWIM_LEVELS,
  getLevelColor,
  getLevelTextColor,
  getLevelName,
  calculateAge,
} from "@/lib/swim-utils";
import { SwimmerDetail } from "./SwimmerDetail";

interface SwimmerRow {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  current_level: number;
  is_active: boolean;
  parent_name: string;
  waiver_status: "active" | "expiring" | "none";
  enrollment_count: number;
}

export function SwimmersTable() {
  const supabase = createClient();
  const [swimmers, setSwimmers] = useState<SwimmerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Filters
  const [filterLevels, setFilterLevels] = useState<number[]>([]);
  const [filterWaiver, setFilterWaiver] = useState<string>("");
  const [filterActive, setFilterActive] = useState<string>("active");

  // Detail sheet
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchSwimmers = useCallback(async () => {
    setLoading(true);

    const { data: swimmerData } = await supabase
      .from("swimmers")
      .select("id, first_name, last_name, date_of_birth, current_level, is_active, family:profiles!family_id(full_name)")
      .order("last_name");

    if (!swimmerData) {
      setLoading(false);
      return;
    }

    const swimmerIds = swimmerData.map((s) => s.id);

    // Fetch waivers and assignment counts in parallel
    const [waiverRes, assignRes] = await Promise.all([
      supabase
        .from("waivers")
        .select("swimmer_id, is_active, expires_at")
        .in("swimmer_id", swimmerIds)
        .eq("is_active", true),
      supabase
        .from("class_assignments")
        .select("swimmer_id")
        .in("swimmer_id", swimmerIds)
        .eq("status", "active"),
    ]);

    const waiverMap = new Map<string, { is_active: boolean; expires_at: string | null }>();
    for (const w of waiverRes.data ?? []) {
      waiverMap.set(w.swimmer_id, w);
    }

    const enrollCountMap = new Map<string, number>();
    for (const e of assignRes.data ?? []) {
      enrollCountMap.set(e.swimmer_id, (enrollCountMap.get(e.swimmer_id) ?? 0) + 1);
    }

    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    setSwimmers(
      swimmerData.map((s) => {
        const family = s.family as unknown as
          | { full_name: string }
          | { full_name: string }[]
          | null;
        const fObj = Array.isArray(family) ? family[0] : family;

        const waiver = waiverMap.get(s.id);
        let waiverStatus: "active" | "expiring" | "none" = "none";
        if (waiver?.is_active) {
          if (waiver.expires_at) {
            const exp = new Date(waiver.expires_at);
            if (exp < now) waiverStatus = "none";
            else if (exp < thirtyDays) waiverStatus = "expiring";
            else waiverStatus = "active";
          } else {
            waiverStatus = "active";
          }
        }

        return {
          id: s.id,
          first_name: s.first_name,
          last_name: s.last_name,
          date_of_birth: s.date_of_birth,
          current_level: s.current_level,
          is_active: s.is_active,
          parent_name: fObj?.full_name ?? "Unknown",
          waiver_status: waiverStatus,
          enrollment_count: enrollCountMap.get(s.id) ?? 0,
        };
      })
    );

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchSwimmers();
  }, [fetchSwimmers]);

  const toggleLevel = (lvl: number) => {
    setFilterLevels((prev) =>
      prev.includes(lvl) ? prev.filter((l) => l !== lvl) : [...prev, lvl]
    );
  };

  const filtered = useMemo(() => {
    return swimmers.filter((s) => {
      // Search
      if (search) {
        const q = search.toLowerCase();
        const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
        if (!fullName.includes(q) && !s.parent_name.toLowerCase().includes(q)) {
          return false;
        }
      }
      // Level
      if (filterLevels.length > 0 && !filterLevels.includes(s.current_level)) {
        return false;
      }
      // Waiver
      if (filterWaiver && s.waiver_status !== filterWaiver) {
        return false;
      }
      // Active
      if (filterActive === "active" && !s.is_active) return false;
      if (filterActive === "inactive" && s.is_active) return false;
      return true;
    });
  }, [swimmers, search, filterLevels, filterWaiver, filterActive]);

  const hasFilters =
    filterLevels.length > 0 || filterWaiver !== "" || filterActive !== "active";

  return (
    <div className="space-y-4">
      {/* Search + Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="relative flex-1 lg:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search swimmers or parents..."
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Level filter checkboxes */}
          {SWIM_LEVELS.map((l) => (
            <label
              key={l.id}
              className="flex cursor-pointer items-center gap-1 text-xs"
            >
              <Checkbox
                checked={filterLevels.includes(l.id)}
                onCheckedChange={() => toggleLevel(l.id)}
              />
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: l.color }}
              />
              L{l.id}
            </label>
          ))}

          <Select value={filterWaiver} onValueChange={(v) => setFilterWaiver(v ?? "")}>
            <SelectTrigger size="sm" className="w-[130px]">
              <SelectValue placeholder="Waiver" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Waivers</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expiring">Expiring</SelectItem>
              <SelectItem value="none">No Waiver</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterActive} onValueChange={(v) => setFilterActive(v ?? "active")}>
            <SelectTrigger size="sm" className="w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterLevels([]);
                setFilterWaiver("");
                setFilterActive("active");
              }}
            >
              <X className="mr-1 size-3" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Results */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} swimmer{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* Mobile cards */}
      <div className="space-y-3 sm:hidden">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No swimmers found.</p>
        ) : (
          filtered.map((s) => (
            <button
              key={s.id}
              className="w-full rounded-lg border p-4 text-left active:bg-muted/50 space-y-1"
              onClick={() => setSelectedId(s.id)}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-primary">
                  {s.first_name} {s.last_name}
                  {!s.is_active && <Badge variant="secondary" className="ml-2">Inactive</Badge>}
                </span>
                <Badge style={{ backgroundColor: getLevelColor(s.current_level), color: getLevelTextColor(s.current_level) }}>
                  L{s.current_level}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Age {calculateAge(s.date_of_birth)} · {s.parent_name}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{s.enrollment_count} enrollment{s.enrollment_count !== 1 ? "s" : ""}</span>
                {s.waiver_status === "active" && <Badge variant="outline" className="border-green-500 text-green-600 text-xs">Waiver</Badge>}
                {s.waiver_status === "expiring" && <Badge variant="outline" className="border-yellow-500 text-yellow-600 text-xs">Expiring</Badge>}
                {s.waiver_status === "none" && <Badge variant="destructive" className="text-xs">No Waiver</Badge>}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden sm:table-cell">Age</TableHead>
              <TableHead>Level</TableHead>
              <TableHead className="hidden md:table-cell">Parent</TableHead>
              <TableHead>Waiver</TableHead>
              <TableHead className="text-right">Enrollments</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No swimmers found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => (
                <TableRow key={s.id} className="cursor-pointer" onClick={() => setSelectedId(s.id)}>
                  <TableCell className="font-medium text-primary">
                    {s.first_name} {s.last_name}
                    {!s.is_active && (
                      <Badge variant="secondary" className="ml-2">
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {calculateAge(s.date_of_birth)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      style={{ backgroundColor: getLevelColor(s.current_level), color: getLevelTextColor(s.current_level) }}
                    >
                      L{s.current_level}: {getLevelName(s.current_level)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    {s.parent_name}
                  </TableCell>
                  <TableCell>
                    {s.waiver_status === "active" && (
                      <Badge variant="outline" className="border-green-500 text-green-600">
                        Active
                      </Badge>
                    )}
                    {s.waiver_status === "expiring" && (
                      <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                        Expiring
                      </Badge>
                    )}
                    {s.waiver_status === "none" && (
                      <Badge variant="destructive">Required</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{s.enrollment_count}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Swimmer Details</SheetTitle>
          </SheetHeader>
          {selectedId && (
            <SwimmerDetail
              swimmerId={selectedId}
              onUpdated={() => {
                fetchSwimmers();
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
