"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { setupApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import Link from "next/link";

const SYMBOLS = ["THYAO","GARAN","EREGL","SISE","ASELS","AAPL","MSFT","NVDA"];

type Pattern = { name: string; type: string; description: string; strength: string; emoji: string };

function PatternCard({ p }: { p: Pattern }) {
  const border = p.type === "bullish" ? "border-emerald-500/30 bg-emerald-500/5"
    : p.type === "bearish" ? "border-red-500/30 bg-red-500/5"
    : "border-zinc-700 bg-zinc-800/30";
  const strengthColor = p.strength === "güçlü" ? "text-emerald-400" : p.strength === "orta" ? "text-yellow-400" : "text-zinc-500";
  return (
    <div className={cn("p-3.5 rounded-xl border", border)}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-lg">{p.emoji}</span>
        <span className="font-semibold text-sm text-white">{p.name}</span>
        <span className={cn("ml-auto text-[10px] font-bold uppercase", strengthColor)}>{p.strength}</span>
      </div>
      <p className="text-xs text-zinc-400 leading-relaxed">{p.description}</p>
    </div>
  );
}

function TradePlanCard({ plan, currency }: { plan: Record<string, unknown>; currency: string }) {
  const isLong = plan.direction === "long";
  const isShort = plan.direction === "short";
  const entry = plan.entry as number;
  const stop = plan.stop as number;
  const target1 = plan.target1 as number;
  const target2 = plan.target2 as number;
  const rr = plan.rr_ratio as number;

  const range = Math.max(target2, stop) - Math.min(target2, stop);
  const entryPct = ((entry - Math.min(target2, stop)) / range) * 100;
  const stopPct  = ((stop  - Math.min(target2, stop)) / range) * 100;
  const t1Pct    = ((target1 - Math.min(target2, stop)) / range) * 100;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Trade Planı</h3>
        <span className={cn("text-xs font-bold px-2.5 py-1 rounded-full",
          isLong ? "bg-emerald-500/20 text-emerald-400" : isShort ? "bg-red-500/20 text-red-400" : "bg-zinc-700 text-zinc-400")}>
          {isLong ? "⬆ LONG" : isShort ? "⬇ SHORT" : "⏸ BEKLE"}
        </span>
      </div>

      {/* Visual price ladder */}
      <div className="relative h-32 flex flex-col justify-between">
        <div className="absolute inset-y-0 left-6 w-px bg-zinc-700" />
        {[
          { label: "Hedef 2", price: target2, color: "text-emerald-400", dot: "bg-emerald-400", pct: t1Pct + 15 },
          { label: "Hedef 1", price: target1, color: "text-emerald-300", dot: "bg-emerald-300", pct: t1Pct },
          { label: "Giriş",   price: entry,   color: "text-blue-400",    dot: "bg-blue-400",    pct: entryPct },
          { label: "Stop",    price: stop,    color: "text-red-400",     dot: "bg-red-400",     pct: stopPct },
        ].sort((a,b) => b.pct - a.pct).map(item => (
          <div key={item.label} className="flex items-center gap-3">
            <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", item.dot)} />
            <span className={cn("text-xs font-medium", item.color)}>{item.label}</span>
            <span className="text-xs font-mono text-white ml-auto">{item.price.toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Risk", value: `%${(plan.risk_pct as number).toFixed(1)}` },
          { label: "R/R Oranı", value: `${rr}x` },
          { label: "Kur", value: currency },
        ].map(s => (
          <div key={s.label} className="bg-zinc-800/50 rounded-lg p-2 text-center">
            <p className="text-[10px] text-zinc-500">{s.label}</p>
            <p className="text-sm font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SetupPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["setup", selected],
    queryFn: () => setupApi.get(selected!),
    enabled: !!selected,
  });

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">📐 Trade Setup Analizi</h1>
          <p className="text-zinc-500 text-sm">Grafik pattern tespiti, destek/direnç, trade planı ve piyasa yorumu</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Symbol list */}
          <div className="xl:col-span-1 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <h3 className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Sembol Seç</h3>
            <div className="space-y-1">
              {SYMBOLS.map(s => (
                <button key={s} onClick={() => setSelected(s)}
                  className={cn("w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors",
                    selected === s ? "bg-blue-600 text-white" : "text-zinc-300 hover:bg-zinc-800 hover:text-white")}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Main */}
          <div className="xl:col-span-3 space-y-4">
            {(isLoading || isFetching) && selected && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center h-40">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!selected && !isLoading && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl text-center py-20 text-zinc-600">
                <div className="text-5xl mb-4">📐</div>
                <p>Soldan bir sembol seçin</p>
              </div>
            )}

            {data && !isFetching && (
              <>
                {/* Bias header */}
                <div className={cn("rounded-xl p-5 border flex items-center gap-4",
                  data.bias === "bullish" ? "bg-emerald-500/5 border-emerald-500/20"
                  : data.bias === "bearish" ? "bg-red-500/5 border-red-500/20"
                  : "bg-zinc-800/30 border-zinc-700")}>
                  <div className={cn("text-4xl font-black",
                    data.bias === "bullish" ? "text-emerald-400" : data.bias === "bearish" ? "text-red-400" : "text-yellow-400")}>
                    {data.bias === "bullish" ? "🐂" : data.bias === "bearish" ? "🐻" : "↔"}
                  </div>
                  <div>
                    <p className={cn("text-lg font-bold",
                      data.bias === "bullish" ? "text-emerald-400" : data.bias === "bearish" ? "text-red-400" : "text-yellow-400")}>
                      {data.bias_label} Eğilim
                    </p>
                    <p className="text-sm text-zinc-400">{selected} — {(data.current_price as number).toFixed(2)}</p>
                  </div>
                  <Link href={`/symbol/${selected}`} className="ml-auto text-xs px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg transition-colors">
                    Tam Analiz →
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Patterns */}
                  <div className="space-y-3">
                    <h3 className="text-xs text-zinc-500 uppercase tracking-wide">Tespit Edilen Patternler</h3>
                    {(data.patterns as Pattern[]).map((p, i) => <PatternCard key={i} p={p} />)}
                  </div>

                  {/* Trade plan + S/R */}
                  <div className="space-y-4">
                    <TradePlanCard plan={data.trade_plan as Record<string, unknown>} currency="TRY" />

                    {/* Support / Resistance */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                      <h3 className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Destek / Direnç</h3>
                      <div className="space-y-1.5">
                        {(data.support_resistance.resistances as number[]).map((r, i) => (
                          <div key={`r${i}`} className="flex items-center justify-between text-sm">
                            <span className="text-red-400/70 text-xs">Direnç {i + 1}</span>
                            <span className="font-mono text-red-400">{r.toFixed(2)}</span>
                          </div>
                        ))}
                        <div className="border-t border-zinc-700 my-2" />
                        {(data.support_resistance.supports as number[]).map((s, i) => (
                          <div key={`s${i}`} className="flex items-center justify-between text-sm">
                            <span className="text-emerald-400/70 text-xs">Destek {i + 1}</span>
                            <span className="font-mono text-emerald-400">{s.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Indicators strip */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <h3 className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Teknik Göstergeler</h3>
                  <div className="flex flex-wrap gap-4">
                    {[
                      { label: "RSI", value: (data.indicators.rsi as number).toFixed(1), color: (data.indicators.rsi as number) > 70 ? "text-red-400" : (data.indicators.rsi as number) < 30 ? "text-emerald-400" : "text-zinc-300" },
                      { label: "ADX", value: `${(data.indicators.adx as number).toFixed(1)} (${data.indicators.adx_label})`, color: "text-zinc-300" },
                      { label: "MACD", value: data.indicators.macd_bullish ? "Yükseliş ▲" : "Düşüş ▼", color: data.indicators.macd_bullish ? "text-emerald-400" : "text-red-400" },
                      { label: "Stoch", value: `${(data.indicators.stoch_k as number).toFixed(1)} — ${data.indicators.stoch_signal}`, color: data.indicators.stoch_signal === "Al" ? "text-emerald-400" : data.indicators.stoch_signal === "Sat" ? "text-red-400" : "text-zinc-300" },
                      { label: "EMA20", value: (data.indicators.ema20 as number).toFixed(2), color: "text-zinc-300" },
                      { label: "EMA50", value: (data.indicators.ema50 as number).toFixed(2), color: "text-zinc-300" },
                      { label: "ATR", value: (data.indicators.atr as number).toFixed(2), color: "text-zinc-300" },
                    ].map(s => (
                      <div key={s.label}>
                        <p className="text-[10px] text-zinc-500">{s.label}</p>
                        <p className={cn("text-sm font-bold", s.color)}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Commentary */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <h3 className="text-xs text-zinc-500 uppercase tracking-wide mb-3">💬 Piyasa Yorumu</h3>
                  <div className="space-y-2">
                    {(data.commentary as string[]).map((line, i) => (
                      <p key={i} className="text-sm text-zinc-300 leading-relaxed border-l-2 border-zinc-700 pl-3">
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
