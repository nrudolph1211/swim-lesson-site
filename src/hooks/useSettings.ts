"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useSettings(keys: string[]) {
  const supabase = createClient();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", keys);

    if (data) {
      const map: Record<string, string> = {};
      for (const row of data) {
        map[row.key] = row.value;
      }
      setSettings(map);
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const getNumber = (key: string, fallback = 0): number => {
    const val = settings[key];
    if (val == null) return fallback;
    const str = typeof val === "string" ? val : String(val);
    const parsed = parseFloat(str.replace(/"/g, ""));
    return isNaN(parsed) ? fallback : parsed;
  };

  const getString = (key: string, fallback = ""): string => {
    const val = settings[key];
    if (val == null) return fallback;
    const str = typeof val === "string" ? val : String(val);
    return str.replace(/"/g, "");
  };

  const getBoolean = (key: string, fallback = false): boolean => {
    const val = settings[key];
    if (!val) return fallback;
    return val === "true";
  };

  return { settings, loading, getNumber, getString, getBoolean };
}
