"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, TrendingUp, DollarSign, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDateShort } from "@/lib/date-utils";

interface ReferralRow {
  id: string;
  referral_code: string;
  status: string;
  credit_amount: number | null;
  created_at: string;
  referrer_name: string;
  referrer_email: string;
  referred_name: string | null;
  referred_email: string | null;
}

const statusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-800",
  signed_up: "bg-blue-100 text-blue-800",
  enrolled: "bg-yellow-100 text-yellow-800",
  credited: "bg-green-100 text-green-800",
};

export function ReferralsManager() {
  const supabase = createClient();
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReferrals = useCallback(async () => {
    setLoading(true);

    const { data } = await supabase
      .from("referrals")
      .select(`
        id,
        referral_code,
        status,
        credit_amount,
        created_at,
        referrer:profiles!referrals_referrer_id_fkey(full_name, email),
        referred:profiles!referrals_referred_id_fkey(full_name, email)
      `)
      .order("created_at", { ascending: false });

    if (data) {
      const mapped = data.map((r: Record<string, unknown>) => {
        const referrer = Array.isArray(r.referrer) ? r.referrer[0] : r.referrer;
        const referred = Array.isArray(r.referred) ? r.referred[0] : r.referred;

        return {
          id: r.id as string,
          referral_code: r.referral_code as string,
          status: r.status as string,
          credit_amount: r.credit_amount as number | null,
          created_at: r.created_at as string,
          referrer_name: referrer?.full_name ?? "Unknown",
          referrer_email: referrer?.email ?? "",
          referred_name: referred?.full_name ?? null,
          referred_email: referred?.email ?? null,
        };
      });
      setReferrals(mapped);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  // Stats
  const totalReferrals = referrals.length;
  const converted = referrals.filter((r) => r.status === "credited").length;
  const conversionRate = totalReferrals > 0 ? ((converted / totalReferrals) * 100).toFixed(1) : "0";
  const totalCreditsIssued = referrals
    .filter((r) => r.status === "credited")
    .reduce((sum, r) => sum + Number(r.credit_amount ?? 0), 0);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Referral Program</h1>
        <p className="text-sm text-muted-foreground">
          Track referral activity, conversions, and credits issued.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-blue-100">
              <Users className="size-5 text-blue-700" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalReferrals}</p>
              <p className="text-xs text-muted-foreground">Total Referrals</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-green-100">
              <TrendingUp className="size-5 text-green-700" />
            </div>
            <div>
              <p className="text-2xl font-bold">{conversionRate}%</p>
              <p className="text-xs text-muted-foreground">
                Conversion Rate ({converted}/{totalReferrals})
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-yellow-100">
              <DollarSign className="size-5 text-yellow-700" />
            </div>
            <div>
              <p className="text-2xl font-bold">${totalCreditsIssued}</p>
              <p className="text-xs text-muted-foreground">Credits Issued</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referrer</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Referred</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {referrals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No referrals yet.
                  </TableCell>
                </TableRow>
              ) : (
                referrals.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <p className="text-sm font-medium">{r.referrer_name}</p>
                      <p className="text-xs text-muted-foreground">{r.referrer_email}</p>
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        {r.referral_code}
                      </code>
                    </TableCell>
                    <TableCell>
                      {r.referred_name ? (
                        <>
                          <p className="text-sm font-medium">{r.referred_name}</p>
                          <p className="text-xs text-muted-foreground">{r.referred_email}</p>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[r.status] ?? "bg-gray-100 text-gray-800"}>
                        {r.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {r.credit_amount ? `$${Number(r.credit_amount)}` : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateShort(r.created_at)}
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
