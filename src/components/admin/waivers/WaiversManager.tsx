"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ShieldCheck, ShieldAlert, Clock, RefreshCw, Loader2, FileText } from "lucide-react";
import { formatDateShort } from "@/lib/date-utils";
import { getLevelName, getLevelColor, getLevelTextColor } from "@/lib/swim-utils";

interface WaiverRecord {
  id: string;
  swimmer_id: string;
  signed_by: string;
  signed_at: string | null;
  waiver_version: string | null;
  signature_data: string | null;
  expires_at: string | null;
  is_active: boolean;
  swimmer: { first_name: string; last_name: string; current_level: number } | null;
  parent: { full_name: string; email: string } | null;
}

type StatusFilter = "all" | "active" | "expiring" | "expired" | "inactive";

export function WaiversManager() {
  const supabase = createClient();
  const [waivers, setWaivers] = useState<WaiverRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    fetchWaivers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchWaivers() {
    setLoading(true);
    const { data } = await supabase
      .from("waivers")
      .select("id, swimmer_id, signed_by, signed_at, waiver_version, signature_data, expires_at, is_active, swimmer:swimmers(first_name, last_name, current_level), parent:profiles!signed_by(full_name, email)")
      .order("signed_at", { ascending: false });

    setWaivers((data as unknown as WaiverRecord[]) ?? []);
    setLoading(false);
  }

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  function getWaiverStatus(w: WaiverRecord): "active" | "expiring" | "expired" | "inactive" {
    if (!w.is_active) return "inactive";
    if (!w.expires_at) return "active";
    const exp = new Date(w.expires_at);
    if (exp < now) return "expired";
    if (exp < thirtyDaysFromNow) return "expiring";
    return "active";
  }

  const filtered = useMemo(() => {
    return waivers.filter((w) => {
      const status = getWaiverStatus(w);
      if (statusFilter !== "all" && status !== statusFilter) return false;

      if (search) {
        const q = search.toLowerCase();
        const swimmerName = `${w.swimmer?.first_name ?? ""} ${w.swimmer?.last_name ?? ""}`.toLowerCase();
        const parentName = (w.parent?.full_name ?? "").toLowerCase();
        if (!swimmerName.includes(q) && !parentName.includes(q)) return false;
      }

      return true;
    });
  }, [waivers, search, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c = { all: waivers.length, active: 0, expiring: 0, expired: 0, inactive: 0 };
    for (const w of waivers) {
      const s = getWaiverStatus(w);
      c[s]++;
    }
    return c;
  }, [waivers]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusBadge = (w: WaiverRecord) => {
    const status = getWaiverStatus(w);
    switch (status) {
      case "active":
        return <Badge variant="outline" className="border-green-500 text-green-700"><ShieldCheck className="mr-1 size-3" />Active</Badge>;
      case "expiring":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-700"><Clock className="mr-1 size-3" />Expiring Soon</Badge>;
      case "expired":
        return <Badge variant="destructive"><ShieldAlert className="mr-1 size-3" />Expired</Badge>;
      case "inactive":
        return <Badge variant="secondary">Inactive</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Waiver Records</h2>
          <p className="text-sm text-muted-foreground">
            {counts.active} active · {counts.expiring} expiring · {counts.expired} expired
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchWaivers} disabled={loading}>
          <RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by swimmer or parent name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({counts.all})</SelectItem>
            <SelectItem value="active">Active ({counts.active})</SelectItem>
            <SelectItem value="expiring">Expiring ({counts.expiring})</SelectItem>
            <SelectItem value="expired">Expired ({counts.expired})</SelectItem>
            <SelectItem value="inactive">Inactive ({counts.inactive})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="size-10 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No waivers found.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Swimmer</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Signed By</TableHead>
                <TableHead>Signed At</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">
                    {w.swimmer?.first_name} {w.swimmer?.last_name}
                  </TableCell>
                  <TableCell>
                    {w.swimmer && (
                      <Badge
                        variant="outline"
                        style={{
                          backgroundColor: getLevelColor(w.swimmer.current_level),
                          color: getLevelTextColor(w.swimmer.current_level),
                          borderColor: getLevelColor(w.swimmer.current_level),
                        }}
                      >
                        L{w.swimmer.current_level}: {getLevelName(w.swimmer.current_level)}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{w.parent?.full_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{w.parent?.email ?? ""}</p>
                    </div>
                  </TableCell>
                  <TableCell>{w.signed_at ? formatDateShort(w.signed_at) : "—"}</TableCell>
                  <TableCell>{w.expires_at ? formatDateShort(w.expires_at) : "—"}</TableCell>
                  <TableCell>{w.waiver_version ?? "—"}</TableCell>
                  <TableCell>{statusBadge(w)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
