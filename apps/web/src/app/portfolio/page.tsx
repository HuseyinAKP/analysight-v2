"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useState as useStateSupabase } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Plus, Trash2, ChevronRight,
  Briefcase, BarChart2, RefreshCw,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Types ────────────────────────────────────────────────────────────────────
type Position = {
  id: string;
  symbol: string;
  quantity: number;
  avg_price: number;
  currency: string;
  note?: string;
  current_price?: number;
  current_value?: number;
  cost_basis?: number;
  pnl?: number;
  pnl_pct?: number;
};

type Summary = {
  total_cost: number;
  total_value: number;
  total_pnl: number;
  total_pnl_pct: number;
  position_count: number;
  allocation: { symbol: string; value: number; weight: number; pnl_pct?: number }[];
};

// ── Supabase session hook ─────────────────────────────────────────────────────
function useToken() {
  const [token, setToken] = useStateSupabase<string | null>(null);
  useEffect(() => {
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    sb.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_ev, session) => {
      setToken(session?.access_token ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);
  return token;
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function apiFetch(path: string, options?: RequestInit) {
  const r = await fetch(`${API}/api/portfolio/${path}`, options);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ── P&L rengi ─────────────────────────────────────────────────────────────────
function pnlColor(pct?: number | null) {
  if (pct == null) return "text-zinc-500";
  if (pct > 0) return "text-emerald-400";
  if (pct < 0) return "text-red-400";
  return "text-zinc-400";
}

// ── Pozisyon satırı ────────────────────────────────────────────────────────────
function PositionRow({ pos, onDelete }: { pos: Position; onDelete: (id: string) => void }) {
  const hasPnl = pos.pnl != null;
  return (
    <div className="flex items-center gap-3 py-3 px-4 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 transition-colors">
      {/* Symbol */}
      <Link href={`/symbol/${pos.symbol}`} className="w-20 shrink-0">
        <span className="text-sm font-bold text-white hover:text-blue-400 transition-colors">
          {pos.symbol}
        </span>
      </Link>

      {/* Miktar + ortalama maliyet */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-400">
          {pos.quantity} lot × {pos.avg_price.toFixed(2)} {pos.currency}
        </p>
        {pos.cost_basis != null && (
          <p className="text-[10px] text-zinc-600">
            Maliyet: {pos.cost_basis.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} {pos.currency}
          </p>
        )}
      </div>

      {/* Anlık değer */}
      <div className="text-right shrink-0 w-28">
        {pos.current_price != null ? (
          <>
            <p className="text-sm font-mono text-white">{pos.current_price.toFixed(2)}</p>
            <p className="text-[10px] text-zinc-500">
              {pos.current_value?.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} {pos.currency}
            </p>
          </>
        ) : (
          <p className="text-xs text-zinc-600">—</p>
        )}
      </div>

      {/* P&L */}
      <div className="text-right shrink-0 w-20">
        {hasPnl ? (
          <>
            <p className={cn("text-sm font-bold font-mono", pnlColor(pos.pnl_pct))}>
              {pos.pnl_pct! > 0 ? "+" : ""}{pos.pnl_pct!.toFixed(1)}%
            </p>
            <p className={cn("text-[10px] font-mono", pnlColor(pos.pnl))}>
              {pos.pnl! > 0 ? "+" : ""}{pos.pnl!.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
            </p>
          </>
        ) : (
          <p className="text-xs text-zinc-600">—</p>
        )}
      </div>

      {/* Analiz + Sil */}
      <div className="flex items-center gap-1 shrink-0">
        <Link
          href={`/symbol/${pos.symbol}`}
          className="p-1.5 rounded-lg text-zinc-600 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
        >
          <BarChart2 className="w-3.5 h-3.5" />
        </Link>
        <button
          onClick={() => onDelete(pos.id)}
          className="p-1.5 rounded-lg text-zinc-700 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Pozisyon ekleme formu ─────────────────────────────────────────────────────
function AddPositionForm({ onAdd }: { onAdd: (v: { symbol: string; quantity: number; avg_price: number; note?: string }) => void }) {
  const [sym, setSym]   = useState("");
  const [qty, setQty]   = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sym || !qty || !price) return;
    onAdd({ symbol: sym.toUpperCase(), quantity: parseFloat(qty), avg_price: parseFloat(price), note });
    setSym(""); setQty(""); setPrice(""); setNote("");
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap gap-2 items-end">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Sembol</label>
        <input
          value={sym} onChange={e => setSym(e.target.value.toUpperCase())}
          placeholder="THYAO"
          className="w-24 px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none"
          required
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Lot</label>
        <input
          value={qty} onChange={e => setQty(e.target.value)} type="number" step="any"
          placeholder="100"
          className="w-24 px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none"
          required
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Ortalama Maliyet</label>
        <input
          value={price} onChange={e => setPrice(e.target.value)} type="number" step="any"
          placeholder="250.50"
          className="w-32 px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none"
          required
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Not (opsiyonel)</label>
        <input
          value={note} onChange={e => setNote(e.target.value)}
          placeholder="kısa vadeli..."
          className="w-40 px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" /> Ekle
      </button>
    </form>
  );
}

// ── Ana Sayfa ─────────────────────────────────────────────────────────────────
export default function PortfolioPage() {
  const token   = useToken();
  const qc      = useQueryClient();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const { data: posData, isLoading, refetch } = useQuery({
    queryKey: ["portfolio-positions", token],
    queryFn:  () => apiFetch("positions", { headers }),
    enabled:  !!token,
    staleTime: 60_000,
  });

  const { data: summary } = useQuery<Summary>({
    queryKey: ["portfolio-summary", token],
    queryFn:  () => apiFetch("summary", { headers }),
    enabled:  !!token,
    staleTime: 60_000,
  });

  const addMut = useMutation({
    mutationFn: (body: object) =>
      apiFetch("positions", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio-positions"] });
      qc.invalidateQueries({ queryKey: ["portfolio-summary"] });
    },
  });

  const delMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`positions/${id}`, { method: "DELETE", headers }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio-positions"] });
      qc.invalidateQueries({ queryKey: ["portfolio-summary"] });
    },
  });

  // Auth yok
  if (!token) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <Briefcase className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Portföy Takibi</h1>
        <p className="text-zinc-500 text-sm mb-6">
          Portföyünüzü takip etmek için giriş yapmanız gerekiyor.
        </p>
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Giriş Yap <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  const positions: Position[] = posData?.positions ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Briefcase className="w-5 h-5 text-blue-400" />
          <h1 className="text-xl font-bold text-white">Portföyüm</h1>
          <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full">
            {positions.length} pozisyon
          </span>
        </div>
        <button
          onClick={() => refetch()}
          className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Özet kartları */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Toplam Değer",  value: summary.total_value.toLocaleString("tr-TR", { maximumFractionDigits: 0 }) + " ₺", sub: null },
            { label: "Toplam Maliyet", value: summary.total_cost.toLocaleString("tr-TR", { maximumFractionDigits: 0 }) + " ₺", sub: null },
            {
              label: "Toplam K/Z",
              value: (summary.total_pnl >= 0 ? "+" : "") + summary.total_pnl.toLocaleString("tr-TR", { maximumFractionDigits: 0 }) + " ₺",
              pct: summary.total_pnl_pct,
            },
            {
              label: "Getiri",
              value: (summary.total_pnl_pct >= 0 ? "+" : "") + summary.total_pnl_pct.toFixed(2) + "%",
              pct: summary.total_pnl_pct,
            },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">{card.label}</p>
              <p className={cn("text-base font-bold font-mono",
                "pct" in card && card.pct != null ? pnlColor(card.pct) : "text-white"
              )}>
                {card.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Pozisyon ekleme */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Pozisyon Ekle
        </p>
        <AddPositionForm
          onAdd={(v) => addMut.mutate({ ...v, currency: "TRY" })}
        />
        {addMut.isError && (
          <p className="text-xs text-red-400">{String(addMut.error)}</p>
        )}
      </div>

      {/* Pozisyon listesi */}
      <div className="space-y-2">
        {isLoading && (
          <div className="space-y-2">
            {[1,2,3].map(i => (
              <div key={i} className="h-14 rounded-xl bg-zinc-800/40 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && positions.length === 0 && (
          <div className="text-center py-12 text-zinc-600">
            <Briefcase className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Henüz pozisyon yok.</p>
            <p className="text-xs mt-1">Yukarıdan ilk hisseni ekle.</p>
          </div>
        )}

        {positions.map((pos) => (
          <PositionRow
            key={pos.id}
            pos={pos}
            onDelete={(id) => delMut.mutate(id)}
          />
        ))}
      </div>

      {/* Dağılım */}
      {summary && summary.allocation.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            Dağılım
          </p>
          <div className="space-y-2">
            {summary.allocation.map((a) => (
              <div key={a.symbol} className="flex items-center gap-3">
                <span className="text-xs font-semibold text-zinc-400 w-16 shrink-0">{a.symbol}</span>
                <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500/70 transition-all duration-700"
                    style={{ width: `${a.weight}%` }}
                  />
                </div>
                <span className="text-[10px] text-zinc-500 w-10 text-right">{a.weight}%</span>
                {a.pnl_pct != null && (
                  <span className={cn("text-[10px] font-mono w-14 text-right", pnlColor(a.pnl_pct))}>
                    {a.pnl_pct > 0 ? "+" : ""}{a.pnl_pct.toFixed(1)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
