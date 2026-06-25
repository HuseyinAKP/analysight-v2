"use client";

import { cn } from "@/lib/utils";
import { Target, TrendingUp, TrendingDown, Minus, ChevronRight } from "lucide-react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Scenarios {
  scenarios: {
    bull: { target: number; probability: number };
    base: { target: number; probability: number };
    bear: { target: number; probability: number };
  };
  uncertainty_index: number;
}
interface Indicators {
  rsi: number;
  macd: number;
  macd_signal: number;
  ema20: number;
  ema50: number;
  ema200: number;
  confluence: { score: number; bull_count: number; bear_count: number };
}
interface Risk {
  stop_loss: number;
  target1:   number;
  target2:   number;
  rr_ratio_t1: number;
  atr: number;
}

interface Props {
  symbol:     string;
  price:      number;
  scenarios:  Scenarios;
  indicators: Indicators;
  risk:       Risk;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function upside(current: number, target: number) {
  return ((target / current) - 1) * 100;
}

// Derive synthetic analyst consensus from technical data
function deriveConsensus(indicators: Indicators, price: number): {
  buy: number; hold: number; sell: number; rating: "AL" | "TUT" | "SAT"; label: string;
} {
  const score    = indicators.confluence.score;
  const aboveEma = price > indicators.ema200;
  const rsi      = indicators.rsi;
  const macdBull = indicators.macd > indicators.macd_signal;

  // Weighted scoring
  let buyScore = 0;
  if (score >= 65)    buyScore += 3;
  else if (score >= 50) buyScore += 1;
  else if (score < 35) buyScore -= 2;

  if (aboveEma)  buyScore += 2;
  else           buyScore -= 1;

  if (macdBull)  buyScore += 1;
  else           buyScore -= 1;

  if (rsi > 55 && rsi < 70) buyScore += 1;
  if (rsi > 75)              buyScore -= 1;
  if (rsi < 35)              buyScore += 1;

  // Map to distribution
  let buy = 0, hold = 0, sell = 0;
  const total = 12;

  if (buyScore >= 5) {
    buy = 8; hold = 3; sell = 1;
  } else if (buyScore >= 3) {
    buy = 6; hold = 4; sell = 2;
  } else if (buyScore >= 1) {
    buy = 4; hold = 5; sell = 3;
  } else if (buyScore >= -1) {
    buy = 3; hold = 5; sell = 4;
  } else {
    buy = 2; hold = 4; sell = 6;
  }

  // Normalize to total
  const sum = buy + hold + sell;
  buy  = Math.round((buy  / sum) * total);
  hold = Math.round((hold / sum) * total);
  sell = total - buy - hold;

  const rating: "AL" | "TUT" | "SAT" =
    buy > hold && buy > sell ? "AL" :
    sell > buy && sell > hold ? "SAT" : "TUT";

  const label =
    rating === "AL"  ? (buy >= 8 ? "Güçlü Al"   : "Al")   :
    rating === "SAT" ? (sell >= 8 ? "Güçlü Sat"  : "Sat") : "Tut";

  return { buy, hold, sell, rating, label };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function RatingBar({ buy, hold, sell }: { buy: number; hold: number; sell: number }) {
  const total = buy + hold + sell;
  const bPct  = (buy  / total) * 100;
  const hPct  = (hold / total) * 100;
  const sPct  = (sell / total) * 100;

  return (
    <div className="space-y-2">
      <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
        <div className="bg-emerald-500 rounded-l-full transition-all" style={{ width: `${bPct}%` }} />
        <div className="bg-yellow-500 transition-all" style={{ width: `${hPct}%` }} />
        <div className="bg-red-500 rounded-r-full transition-all" style={{ width: `${sPct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-zinc-500">
        <span className="text-emerald-400">▲ Al ({buy})</span>
        <span className="text-yellow-400">— Tut ({hold})</span>
        <span className="text-red-400">▼ Sat ({sell})</span>
      </div>
    </div>
  );
}

function TargetRow({
  label, target, current, color, barColor, maxPct,
}: {
  label: string; target: number; current: number; color: string;
  barColor: string; maxPct: number;
}) {
  const pct     = upside(current, target);
  const barW    = Math.min(Math.abs(pct) / maxPct * 100, 100);
  const isUp    = pct >= 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400 w-24 shrink-0">{label}</span>
        <span className={cn("font-bold font-mono", color)}>{fmt(target)} ₺</span>
        <span className={cn("text-[10px] font-mono w-16 text-right", isUp ? "text-emerald-400" : "text-red-400")}>
          {isUp ? "+" : ""}{pct.toFixed(1)}%
        </span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${barW}%` }} />
      </div>
    </div>
  );
}

function PriceGauge({
  current, stop, target1, target2, bull, bear,
}: {
  current: number; stop: number; target1: number; target2: number; bull: number; bear: number;
}) {
  const lo  = Math.min(stop, bear) * 0.97;
  const hi  = Math.max(bull, target2) * 1.03;
  const rng = hi - lo;

  const pos = (v: number) => ((v - lo) / rng) * 100;

  const points: { v: number; label: string; color: string; size: number }[] = [
    { v: stop,    label: "Stop",  color: "#ef4444", size: 2 },
    { v: bear,    label: "Ayı",   color: "#f97316", size: 2 },
    { v: current, label: "Şu An", color: "#ffffff", size: 3 },
    { v: target1, label: "H1",    color: "#60a5fa", size: 2 },
    { v: target2, label: "H2",    color: "#818cf8", size: 2 },
    { v: bull,    label: "Boğa",  color: "#10b981", size: 2 },
  ].sort((a, b) => a.v - b.v);

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-zinc-500 uppercase font-semibold">Fiyat Yolu Haritası</p>
      <div className="relative h-8 mt-4">
        {/* Track */}
        <div className="absolute top-3.5 left-0 right-0 h-1 bg-zinc-800 rounded-full" />
        {/* Colored zones */}
        <div className="absolute top-3.5 h-1 bg-red-500/30 rounded-l-full"
          style={{ left: 0, width: `${pos(current)}%` }} />
        <div className="absolute top-3.5 h-1 bg-emerald-500/30 rounded-r-full"
          style={{ left: `${pos(current)}%`, right: 0 }} />
        {/* Points */}
        {points.map(p => (
          <div key={p.label} className="absolute flex flex-col items-center"
            style={{ left: `${pos(p.v)}%`, transform: "translateX(-50%)" }}>
            <div className={cn("rounded-full border-2 border-zinc-950")}
              style={{
                width:  `${p.size * 5}px`,
                height: `${p.size * 5}px`,
                backgroundColor: p.color,
                marginTop: "6px",
              }} />
            <span className="text-[8px] text-zinc-500 mt-1 whitespace-nowrap">{p.label}</span>
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-3">
        {points.map(p => (
          <span key={p.label} className="flex items-center gap-1 text-[10px] text-zinc-500">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            {p.label}: <span className="text-zinc-300 font-mono">{fmt(p.v)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function AnalystTargets({ symbol, price, scenarios, indicators, risk }: Props) {
  const sc   = scenarios.scenarios;
  const cons = deriveConsensus(indicators, price);

  const maxPct = Math.max(
    Math.abs(upside(price, sc.bull.target)),
    Math.abs(upside(price, sc.bear.target)),
    5,
  );

  const ratingColor =
    cons.rating === "AL"  ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
    cons.rating === "SAT" ? "text-red-400 bg-red-500/10 border-red-500/20" :
                            "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";

  const RatingIcon =
    cons.rating === "AL"  ? TrendingUp  :
    cons.rating === "SAT" ? TrendingDown : Minus;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-white text-sm">Fiyat Hedefi & Konsensüs</span>
        </div>
        <Link href={`/symbol/${symbol}`}
          className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-0.5 transition-colors">
          Detay <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Consensus badge + distribution */}
      <div className="flex items-center gap-4">
        <div className={cn("flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold shrink-0", ratingColor)}>
          <RatingIcon className="w-4 h-4" />
          {cons.label}
        </div>
        <div className="flex-1">
          <RatingBar buy={cons.buy} hold={cons.hold} sell={cons.sell} />
        </div>
      </div>

      {/* Targets */}
      <div className="space-y-3 border-t border-zinc-800 pt-4">
        <p className="text-[10px] text-zinc-500 uppercase font-semibold">Hedef Fiyatlar</p>
        <TargetRow label="🐂 Boğa Hedefi"  target={sc.bull.target} current={price} color="text-emerald-400" barColor="bg-emerald-500" maxPct={maxPct} />
        <TargetRow label="📊 Baz Hedef"    target={sc.base.target} current={price} color="text-blue-400"    barColor="bg-blue-500"    maxPct={maxPct} />
        <TargetRow label="🐻 Ayı Hedefi"   target={sc.bear.target} current={price} color="text-red-400"     barColor="bg-red-500"     maxPct={maxPct} />
        <TargetRow label="🎯 Risk H1"       target={risk.target1}   current={price} color="text-violet-400"  barColor="bg-violet-500"  maxPct={maxPct} />
        <TargetRow label="🎯 Risk H2"       target={risk.target2}   current={price} color="text-purple-400"  barColor="bg-purple-500"  maxPct={maxPct} />
      </div>

      {/* Probability pills */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Boğa",  pct: sc.bull.probability, color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
          { label: "Baz",   pct: sc.base.probability, color: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
          { label: "Ayı",   pct: sc.bear.probability, color: "bg-red-500/15 text-red-400 border-red-500/20" },
        ].map(s => (
          <div key={s.label}
            className={cn("text-center rounded-xl border px-2 py-2", s.color)}>
            <p className="text-[10px] text-zinc-500">{s.label}</p>
            <p className="font-bold text-sm tabular-nums">{s.pct.toFixed(0)}%</p>
          </div>
        ))}
      </div>

      {/* R/R badge */}
      <div className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3">
        <div>
          <p className="text-[10px] text-zinc-500">Risk/Ödül Oranı</p>
          <p className="text-lg font-bold text-white">{risk.rr_ratio_t1.toFixed(1)}x</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-zinc-500">Stop → H1 Mesafesi</p>
          <p className="text-xs font-mono text-zinc-300">
            {fmt(risk.stop_loss)} → {fmt(risk.target1)} ₺
          </p>
        </div>
      </div>

      {/* Gauge */}
      <div className="border-t border-zinc-800 pt-4">
        <PriceGauge
          current={price}
          stop={risk.stop_loss}
          target1={risk.target1}
          target2={risk.target2}
          bull={sc.bull.target}
          bear={sc.bear.target}
        />
      </div>

      {/* Disclaimer */}
      <p className="text-[9px] text-zinc-700 text-center">
        Bu hedefler teknik analiz modelinden türetilmiştir. Analist görüşü değildir.
      </p>
    </div>
  );
}
