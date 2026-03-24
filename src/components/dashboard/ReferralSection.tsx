"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Copy, Link2, Gift, Users, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { CardSkeleton } from "@/components/ui/skeletons";
import { InlineError } from "@/components/ui/inline-error";
import { useSettings } from "@/hooks/useSettings";

function generateRandomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "HAC-";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function ReferralSection() {
  const { user } = useAuthContext();
  const supabase = createClient();
  const { getNumber: getSettingNumber, loading: settingsLoading } = useSettings(["referral_credit_amount"]);
  const creditAmount = getSettingNumber("referral_credit_amount", 25);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [stats, setStats] = useState({ sent: 0, signedUp: 0, credited: 0, creditsEarned: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrCreate = useCallback(async () => {
    if (!user) return;
    setError(null);

    try {
      // Fetch all referrals where this user is the referrer
      const { data: referrals, error: fetchErr } = await supabase
        .from("referrals")
        .select("referral_code, status, credit_amount")
        .eq("referrer_id", user.id);

      if (fetchErr) throw fetchErr;

      if (referrals && referrals.length > 0) {
        // Already has a code — use the first one
        setReferralCode(referrals[0].referral_code);
        setStats({
          sent: referrals.length,
          signedUp: referrals.filter((r) => r.status === "signed_up").length,
          credited: referrals.filter((r) => r.status === "credited").length,
          creditsEarned: referrals
            .filter((r) => r.status === "credited")
            .reduce((sum, r) => sum + Number(r.credit_amount || 0), 0),
        });
      } else {
        // Auto-generate on first visit
        const code = generateRandomCode();
        const { error: insertErr } = await supabase.from("referrals").insert({
          referrer_id: user.id,
          referral_code: code,
          status: "pending",
        });
        if (insertErr) throw insertErr;
        setReferralCode(code);
        setStats({ sent: 0, signedUp: 0, credited: 0, creditsEarned: 0 });
      }
    } catch {
      setError("Failed to load referral information.");
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    fetchOrCreate();
  }, [fetchOrCreate]);

  const copyCode = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode);
    toast.success("Code copied!");
  };

  const copyLink = () => {
    if (!referralCode) return;
    const link = `${window.location.origin}/register?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    toast.success("Referral link copied!");
  };

  if (loading || settingsLoading) return <CardSkeleton />;

  if (error) return <InlineError message={error} onRetry={fetchOrCreate} />;

  return (
    <Card>
      <CardHeader className="pb-2">
        <h3 className="font-heading text-base font-semibold">
          <Gift className="mr-2 inline size-4" />
          Refer a Friend
        </h3>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Earn <strong>${creditAmount}</strong> when a friend enrolls. They get <strong>${creditAmount} off</strong> too!
        </p>

        {referralCode && (
          <>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={referralCode}
                className="font-mono text-sm tracking-wider"
              />
              <Button variant="outline" size="icon" onClick={copyCode} title="Copy code">
                <Copy className="size-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={copyLink} title="Copy link">
                <Link2 className="size-4" />
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <Users className="mx-auto size-4 text-muted-foreground" />
                <p className="mt-1 text-lg font-bold">{stats.sent}</p>
                <p className="text-[11px] text-muted-foreground">Referrals</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <CheckCircle className="mx-auto size-4 text-muted-foreground" />
                <p className="mt-1 text-lg font-bold">{stats.credited}</p>
                <p className="text-[11px] text-muted-foreground">Converted</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <Gift className="mx-auto size-4 text-green-600" />
                <p className="mt-1 text-lg font-bold text-green-600">
                  ${stats.creditsEarned}
                </p>
                <p className="text-[11px] text-muted-foreground">Earned</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
