"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export type MacroData = {
  date: string;
  usdtry: number | null;
  usdtry_note: string | null;
  bist_day_pct: number | null;
  bist_level: number | null;
  vix: number | null;
  vix_note: string | null;
  us10y: number | null;
  gold_30d_pct: number | null;
  oil_30d_pct: number | null;
};

const fmtPct = (v: number | null, decimals = 1) =>
  v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(decimals)}%`;

const pctColor = (v: number | null) =>
  v == null ? "text-zinc-600"
  : v >= 1   ? "text-emerald-400"
  : v <= -1  ? "text-red-400"
  : "text-zinc-400";

const Icon = ({ v }: { v: number | null }) =>
  v == null ? <Minus className="w-3 h-3 text-zinc-700" />
  : v >= 0  ? <TrendingUp className="w-3 h-3 text-emerald-400" />
  : <TrendingDown className="w-3 h-3 text-red-400" />;

// ── Tek gösterge kutusu ───────────────────────────────────────────────────────
function Indicator({ label, value, note, className }: {
  label: string; value: string; note?: string | null; className?: string;
}) {
  return (
    <div className={cn("bg-zinc-800/50 rounded-lg p-2.5 min-w-0", className)}>
      <p className="text-[10px] text-zinc-600 mb-1 truncate">{label}</p>
      <p className="text-xs font-bold text-white truncate">{value}</p>
      {note && <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{note}</p>}
    </div>
  );
}

// ── Ana bileşen ───────────────────────────────────────────────────────────────
export function MacroSnapshot({ macro, compact = false }: {
  macro: MacroData;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex flex-wrap gap-2 text-xs">
        {macro.usdtry && (
          <span className="flex items-center gap-1 bg-zinc-800 rounded px-2 py-1">
            <span className="text-zinc-500">USD/TRY</span>
            <span className="text-white font-mono">{macro.usdtry.toFixed(2)}</span>
          </span>
        )}
        {macro.bist_day_pct != null && (
          <span className={cn("flex items-center gap-1 bg-zinc-800 rounded px-2 py-1", pctColor(macro.bist_day_pct))}>
            <Icon v={macro.bist_day_pct} />
            <span>BIST {fmtPct(macro.bist_day_pct)}</span>
          </span>
        )}
        {macro.vix && (
          <span className={cn("flex items-center gap-1 bg-zinc-800 rounded px-2 py-1",
            macro.vix > 30 ? "text-red-400" : macro.vix > 20 ? "text-amber-400" : "text-zinc-400")}>
            <span className="text-zinc-500">VIX</span>
            <span className="font-mono">{macro.vix.toFixed(1)}</span>
          </span>
        )}
        {macro.us10y && (
          <span className="flex items-center gap-1 bg-zinc-800 rounded px-2 py-1 text-zinc-400">
            <span className="text-zinc-500">10Y</span>
            <span className="font-mono">{macro.us10y.toFixed(2)}%</span>
          </span>
        )}
        {macro.gold_30d_pct != null && (
          <span className={cn("flex items-center gap-1 bg-zinc-800 rounded px-2 py-1", pctColor(macro.gold_30d_pct))}>
            <span className="text-zinc-500">Altın 30g</span>
            <span>{fmtPct(macro.gold_30d_pct)}</span>
          </span>
        )}
        {macro.oil_30d_pct != null && (
          <span className={cn("flex items-center gap-1 bg-zinc-800 rounded px-2 py-1", pctColor(macro.oil_30d_pct))}>
            <span className="text-zinc-500">Petrol 30g</span>
            <span>{fmtPct(macro.oil_30d_pct)}</span>
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
        Makro Bağlam · {macro.date}
      </p>
      <div className="grid grid-cols-3 gap-2">
        <Indicator
          label="USD/TRY"
          value={macro.usdtry ? macro.usdtry.toFixed(2) : "—"}
          note={macro.usdtry_note}
        />
        <Indicator
          label="BIST100 (gün)"
          value={fmtPct(macro.bist_day_pct)}
          className={pctColor(macro.bist_day_pct)}
        />
        <Indicator
          label="VIX"
          value={macro.vix ? macro.vix.toFixed(1) : "—"}
          note={macro.vix_note}
          className={macro.vix && macro.vix > 30 ? "border border-red-500/20" : undefined}
        />
        <Indicator
          label="ABD 10Y Faiz"
          value={macro.us10y ? `${macro.us10y.toFixed(2)}%` : "—"}
        />
        <Indicator
          label="Altın (30g)"
          value={fmtPct(macro.gold_30d_pct)}
          className={pctColor(macro.gold_30d_pct)}
        />
        <Indicator
          label="Petrol (30g)"
          value={fmtPct(macro.oil_30d_pct)}
          className={pctColor(macro.oil_30d_pct)}
        />
      </div>
    </div>
  );
}
