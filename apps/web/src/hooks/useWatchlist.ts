"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

const LOCAL_KEY = "analysight_watchlist_v1";

function loadLocal(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : ["THYAO", "GARAN", "AAPL"];
  } catch { return []; }
}
function saveLocal(list: string[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
}

export function useWatchlist() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const supabase = createClient();

  // Auth durumunu izle
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Sembolleri yükle (user değişince yeniden yükle)
  useEffect(() => {
    if (!mounted) return;
    if (user) {
      supabase
        .from("watchlist")
        .select("symbol")
        .eq("user_id", user.id)
        .order("added_at")
        .then(({ data }) => {
          if (data) setSymbols(data.map((r) => r.symbol));
        });
    } else {
      setSymbols(loadLocal());
    }
  }, [user, mounted]);

  useEffect(() => { setMounted(true); }, []);

  const add = useCallback(async (sym: string) => {
    const upper = sym.toUpperCase().trim();
    if (!upper) return;
    setSymbols((prev) => {
      if (prev.includes(upper)) return prev;
      const next = [...prev, upper];
      if (!user) saveLocal(next);
      return next;
    });
    if (user) {
      await supabase.from("watchlist").upsert({ user_id: user.id, symbol: upper });
    }
  }, [user]);

  const remove = useCallback(async (sym: string) => {
    const upper = sym.toUpperCase();
    setSymbols((prev) => {
      const next = prev.filter((s) => s !== upper);
      if (!user) saveLocal(next);
      return next;
    });
    if (user) {
      await supabase.from("watchlist").delete().eq("user_id", user.id).eq("symbol", upper);
    }
  }, [user]);

  const toggle = useCallback(async (sym: string) => {
    const upper = sym.toUpperCase().trim();
    const isIn = symbols.includes(upper);
    if (isIn) await remove(upper);
    else await add(upper);
  }, [symbols, add, remove]);

  const has = useCallback((sym: string) => symbols.includes(sym.toUpperCase()), [symbols]);

  return { symbols, add, remove, toggle, has, mounted, user };
}
