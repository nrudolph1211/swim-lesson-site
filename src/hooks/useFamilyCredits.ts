"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";

export function useFamilyCredits() {
  const { user } = useAuthContext();
  const supabase = createClient();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchBalance = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("family_credits")
      .select("amount, type")
      .eq("family_id", user.id);

    if (data) {
      const total = data.reduce((sum, row) => {
        return sum + Number(row.amount ?? 0);
      }, 0);
      setBalance(total);
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { balance, loading, refetch: fetchBalance };
}
