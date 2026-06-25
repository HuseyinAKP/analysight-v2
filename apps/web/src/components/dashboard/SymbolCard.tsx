"use client";

import { useQuery } from "@tanstack/react-query";
import { symbolsApi, analysisApi } from "@/lib/api";
import { fmt, fmtPct, cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import Link from "next/link";
import { SparkLine } from "./SparkLine";

// Fırsat skoru (0–100)
function calcScore(rsi: number, macd: number, macdSig: number): number {
  let s = 50;
  if (rsi <= 30) s += 20; else if (rsi <= 40) s += 10; else if (rsi >= 70) s -= 20; else if (rsi >= 60) s -= 5;
  if (macd > macdSig) s += 10; else s -= 10;
  return Math.min(Math.max(Math.round(s), 0), 100);
}

// Trafik ışığı skora göre
function TrafficLight({ score }: { score: number }) {
  const level = score >= 60 ? "green" : score >= 40 ? "yellow" : "red";
  const label = score >= 60 ? "Güçlü" : score >= 40 ? "Nötr" : "Zayıf";
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn("w-2 h-2 rounded-full",
        level === "green" ? "bg-emerald-400 shadow-sm shadow-emerald-400/60"
        : level === "yellow" ? "bg-yellow-400 shadow-sm shadow-yellow-400/60"
        : "bg-red-400 shadow-sm shadow-red-400/60")} />
      <span className={cn("text-[10px] font-semibold",
        level === "green" ? "text-emerald-400" : level === "yellow" ? "text-yellow-400" : "text-red-400")}>
        {label}
      </span>
      <span className="text-[10px] text-zinc-600">· {score}/100</span>
    </div>
  );
}

// RSI plain-language badge
function RSILabel({ rsi }: { rsi: number }) {
  if (rsi < 30) return <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-400/10 px-1.5 py-0.5 rounded">Aşırı Satım</span>;
  if (rsi > 70) return <span className="text-[10px] text-red-400 font-semibold bg-red-400/10 px-1.5 py-0.5 rounded">Aşırı Alım</span>;
  return <span className="text-[10px] text-zinc-500 font-semibold bg-zinc-800 px-1.5 py-0.5 rounded">RSI {rsi.toFixed(0)}</span>;
}

export function SymbolCard({ symbol }: { symbol: string }) {
  const { data: info, isLoading } = useQuery({
    queryKey: ["symbol", symbol],
    queryFn: () => symbolsApi.get(symbol),
  });
  const { data: indicators } = useQuery({
    queryKey: ["indicators", symbol],
    queryFn: () => analysisApi.indicators(symbol),
    enabled: !!info,
  });

  if (isLoading) return <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 animate-pulse h-36" />;
  if (!info) return null;

  const up   = info.change_pct > 0.05;
  const down = info.change_pct < -0.05;

  const sparkData = indicators?.series.close.slice(-20).map((v, i) => ({ i, v })) ?? [];
  const closes    = indicators?.series.close ?? [];
  const high60    = closes.length ? Math.max(...closes) : null;
  const low60     = closes.length ? Math.min(...closes) : null;
  const rsi       = indicators?.rsi;
  const score     = rsi != null && indicators ? calcScore(rsi, indicators.macd, indicators.macd_signal) : null;
  const lineColor = up ? "#34d399" : down ? "#f87171" : "#6b7280";
  const macdBull  = indicators ? indicators.macd > indicators.macd_signal : null;

  return (
    <Link href={`/symbol/${symbol}`} className="block group">
      <div className={cn(
        "bg-zinc-900 border rounded-xl p-4 transition-all duration-200 cursor-pointer",
        "hover:border-zinc-600 hover:bg-zinc-800/60 hover:shadow-lg hover:shadow-black/30 hover:-translate-y-px",
        up ? "border-emerald-900/40" : down ? "border-red-900/40" : "border-zinc-800"
      )}>

        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-white text-base group-hover:text-blue-300 transition-colors">
                {info.symbol}
              </span>
              <span className="text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded font-medium border border-zinc-700">
                {info.market}
              </span>
            </div>
            <p className="text-zinc-500 text-xs mt-0.5 truncate max-w-[150px]">{info.name}</p>
          </div>
          <div className="w-20 h-10 shrink-0 ml-2">
            <SparkLine data={sparkData} color={lineColor} />
          </div>
        </div>

        {/* Traffic light + score */}
        {score !== null && (
          <div className="mb-2.5">
            <TrafficLight score={score} />
          </div>
        )}

        {/* Price */}
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <span className="text-xl font-bold text-white tabular-nums">{fmt(info.price)}</span>
            <span className="text-xs text-zinc-600 ml-1">{info.currency}</span>
          </div>
          <div className={cn(
            "flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full",
            up ? "text-emerald-400 bg-emerald-500/10"
               : down ? "text-red-400 bg-red-500/10"
               : "text-zinc-400 bg-zinc-800")}>
            {up ? <TrendingUp className="w-3 h-3" /> : down ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {fmtPct(info.change_pct)}
          </div>
        </div>

        {/* Footer stats */}
        <div className="flex items-center justify-between pt-2.5 border-t border-zinc-800/80">
          {rsi != null && <RSILabel rsi={rsi} />}
          {macdBull !== null && (
            <span className={cn("text-[10px] font-medium",
              macdBull ? "text-emerald-400" : "text-red-400")}>
              {macdBull ? "↑ Momentum" : "↓ Momentum"}
            </span>
          )}
          <span className="text-[10px] text-zinc-600 group-hover:text-blue-400 transition-colors">
            Analiz →
          </span>
        </div>
      </div>
    </Link>
  );
}
