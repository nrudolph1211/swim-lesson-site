"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";

export interface SwimmerRow {
  id: string;
  family_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  current_level: number;
  medical_notes: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  swim_experience: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WaiverRow {
  id: string;
  swimmer_id: string;
  signed_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  waiver_version: string | null;
}

export function useSwimmers() {
  const { user } = useAuthContext();
  const [swimmers, setSwimmers] = useState<SwimmerRow[]>([]);
  const [waivers, setWaivers] = useState<WaiverRow[]>([]);
  const [currentWaiverVersion, setCurrentWaiverVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSwimmers = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const supabase = createClient();
    const [swimmerRes, waiverRes, settingsRes] = await Promise.all([
      supabase
        .from("swimmers")
        .select("*")
        .eq("family_id", user.id)
        .eq("is_active", true)
        .order("created_at"),
      supabase
        .from("waivers")
        .select("id, swimmer_id, signed_at, expires_at, is_active, waiver_version")
        .eq("signed_by", user.id)
        .eq("is_active", true),
      supabase
        .from("settings")
        .select("value")
        .eq("key", "waiver_version")
        .maybeSingle(),
    ]);

    if (swimmerRes.data) setSwimmers(swimmerRes.data);
    if (waiverRes.data) setWaivers(waiverRes.data);
    if (settingsRes.data) {
      const v = settingsRes.data.value;
      setCurrentWaiverVersion(
        typeof v === "string" ? v.replace(/"/g, "") : v != null ? String(v) : null
      );
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSwimmers();
  }, [fetchSwimmers]);

  const addSwimmer = async (data: {
    first_name: string;
    last_name: string;
    date_of_birth: string;
    current_level: number;
    medical_notes?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    emergency_contact_relationship?: string;
    swim_experience?: string;
  }) => {
    if (!user) return null;
    const supabase = createClient();
    const { data: swimmer, error } = await supabase
      .from("swimmers")
      .insert({ ...data, family_id: user.id })
      .select()
      .single();
    if (error) {
      console.error("Add swimmer error:", error);
      throw error;
    }
    await fetchSwimmers();
    return swimmer;
  };

  const getWaiverStatus = (swimmerId: string): "active" | "expiring" | "required" => {
    const waiver = waivers.find((w) => w.swimmer_id === swimmerId);
    if (!waiver || !waiver.signed_at) return "required";

    // If admin bumped the waiver version, old waivers are no longer valid
    if (
      currentWaiverVersion &&
      waiver.waiver_version &&
      waiver.waiver_version !== currentWaiverVersion
    ) {
      return "required";
    }

    if (waiver.expires_at) {
      const expiresAt = new Date(waiver.expires_at);
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      if (expiresAt < new Date()) return "required";
      if (expiresAt < thirtyDaysFromNow) return "expiring";
    }
    return "active";
  };

  return { swimmers, waivers, loading, addSwimmer, fetchSwimmers, getWaiverStatus };
}
