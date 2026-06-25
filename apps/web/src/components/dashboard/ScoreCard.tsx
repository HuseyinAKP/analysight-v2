"use client";

import { cn } from "@/lib/utils";
import { Star, TrendingUp, Shield, Zap, ChevronRight } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Indicators {
  rsi: number;
  macd: number;
  macd_signal: number;
  ema20: number;
  ema50: number;
  ema200: number;
  atr: number;
  adx?: number;
  stoch_k?: number;
  confluence: { score: number; bull_count: number; bear_count: number };
}
interface Risk {
  stop_loss:    number;
  target1:      number;
  rr_ratio_t1:  number;
  atr:          number;
}
interface Scenarios {
  uncertainty_index: number;
  scenarios: {
    bull: { probability: number };
    bear: { probability: number };
  };
}

interface Props {
  symbol:     string;
  price:      number;
  indicators: Indicators;
  risk:       Risk;
  scenarios:  Scenarios;
  compact?:   boolean;   // slim version for watchlist cards
}

// ── Scoring engine ────────────────────────────────────────────────────────────
interface SubScore { label: string; score: number; max: number; detail: string }

function calcScores(price: number, ind: Indicators, risk: Risk, sc: Scenarios) {
  const scores: SubScore[] = [];

  // ── 1. Teknik Skor (0-10) ────────────────────────────────────────────────
  let teknik = 0;
  const confScore = ind.confluence.score; // 0-100

  // EMA alignment (max 3 pts)
  const aboveEma20  = price > ind.ema20;
  const aboveEma50  = price > ind.ema50;
  const aboveEma200 = price > ind.ema200;
  teknik += aboveEma20  ? 1 : 0;
  teknik += aboveEma50  ? 1 : 0;
  teknik += aboveEma200 ? 1 : 0;

  // Confluence score (max 4 pts)
  teknik += confScore >= 70 ? 4 : confScore >= 55 ? 3 : confScore >= 40 ? 2 : confScore >= 25 ? 1 : 0;

  // Bull/Bear signal balance (max 3 pts)
  const bullRatio = ind.confluence.bull_count / Math.max(ind.confluence.bull_count + ind.confluence.bear_count, 1);
  teknik += bullRatio >= 0.75 ? 3 : bullRatio >= 0.55 ? 2 : bullRatio >= 0.4 ? 1 : 0;

  teknik = Math.min(10, teknik);
  const emaLabel = [aboveEma20 ? "EMA20✓" : "EMA20✗", aboveEma50 ? "EMA50✓" : "EMA50✗", aboveEma200 ? "EMA200✓" : "EMA200✗"].join(" ");
  scores.push({ label: "Teknik", score: teknik, max: 10, detail: `${emaLabel} · Uyum ${confScore}/100` });

  // ── 2. Momentum Skoru (0-10) ─────────────────────────────────────────────
  let momentum = 0;

  // RSI zone (max 3 pts)
  const rsi = ind.rsi;
  if (rsi >= 50 && rsi <= 65)       momentum += 3;
  else if (rsi >= 40 && rsi < 50)   momentum += 2;
  else if (rsi >= 65 && rsi <= 72)  momentum += 2;
  else if (rsi < 30)                momentum += 2;  // oversold = opportunity
  else if (rsi > 72)                momentum += 0;  // overbought = risk
  else                              momentum += 1;

  // MACD (max 3 pts)
  const macdBull = ind.macd > ind.macd_signal;
  const macdGap  = Math.abs(ind.macd - ind.macd_signal);
  momentum += macdBull ? (macdGap > Math.abs(ind.macd) * 0.1 ? 3 : 2) : 1;

  // ADX trend strength (max 2 pts)
  const adx = ind.adx ?? 20;
  momentum += adx >= 30 ? 2 : adx >= 20 ? 1 : 0;

  // Stochastic (max 2 pts)
  const stoch = ind.stoch_k ?? 50;
  if (stoch >= 40 && stoch <= 70)    momentum += 2;
  else if (stoch < 20)               momentum += 2; // oversold
  else if (stoch > 80)               momentum += 0; // overbought
  else                               momentum += 1;

  momentum = Math.min(10, momentum);
  scores.push({
    label: "Momentum",
    score: momentum,
    max:   10,
    detail: `RSI ${rsi.toFixed(0)} · MACD ${macdBull ? "↑" : "↓"} · ADX ${adx.toFixed(0)}`,
  });

  // ── 3. Risk Skoru (0-10) ─────────────────────────────────────────────────
  let riskScore = 0;

  // R/R ratio (max 4 pts)
  const rr = risk.rr_ratio_t1;
  riskScore += rr >= 3 ? 4 : rr >= 2 ? 3 : rr >= 1.5 ? 2 : rr >= 1 ? 1 : 0;

  // Uncertainty (max 3 pts) — lower is better
  const unc = sc.uncertainty_index; // 0-100
  riskScore += unc <= 30 ? 3 : unc <= 50 ? 2 : unc <= 70 ? 1 : 0;

  // Bull probability (max 3 pts)
  const bullProb = sc.scenarios.bull.probability;
  riskScore += bullProb >= 40 ? 3 : bullProb >= 30 ? 2 : bullProb >= 20 ? 1 : 0;

  riskScore = Math.min(10, riskScore);
  scores.push({
    label: "Risk/Ödül",
    score: riskScore,
    max:   10,
    detail: `R/R ${rr.toFixed(1)}x · Belirsizlik ${unc.toFixed(0)}/100`,
  });

  // ── Total (weighted avg → out of 10) ────────────────────────────────────
  const weights    = [0.4, 0.35, 0.25];
  const total      = scores.reduce((s, sc, i) => s + sc.score * weights[i], 0);
  const totalRound = Math.round(total * 10) / 10;

  return { scores, total: totalRound };
}

// ── Visual helpers ─────────────────────────────────────────────────────────────
function scoreColor(score: number, max: number) {
  const pct = score / max;
  if (pct >= 0.75) return "text-emerald-400";
  if (pct >= 0.55) return "text-yellow-400";
  if (pct >= 0.35) return "text-orange-400";
  return "text-red-400";
}

function scoreBg(score: number, max: number) {
  const pct = score / max;
  if (pct >= 0.75) return "bg-emerald-500";
  if (pct >= 0.55) return "bg-yellow-500";
  if (pct >= 0.35) return "bg-orange-500";
  return "bg-red-500";
}

function scoreLabel(total: number): { text: string; color: string; bg: string } {
  if (total >= 8.0) return { text: "Çok Güçlü",    color: "text-emerald-300", bg: "bg-emerald-500/15 border-emerald-500/30" };
  if (total >= 6.5) return { text: "Güçlü",         color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" };
  if (total >= 5.0) return { text: "Nötr",           color: "text-yellow-400",  bg: "bg-yellow-500/10 border-yellow-500/20"  };
  if (total >= 3.5) return { text: "Zayıf",          color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/20"  };
  return               { text: "Çok Zayıf",    color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20"        };
}

function StarRating({ score }: { score: number }) {
  const full  = Math.floor(score / 2);
  const half  = score % 2 >= 1 ? 1 : 0;
  const empty = 5 - full - half;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: full  }).map((_, i) => <Star key={`f${i}`} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />)}
      {half === 1 && <Star className="w-3.5 h-3.5 fill-yellow-400/50 text-yellow-400" />}
      {Array.from({ length: empty }).map((_, i) => <Star key={`e${i}`} className="w-3.5 h-3.5 text-zinc-700" />)}
    </div>
  );
}

// ── Sub-score row ─────────────────────────────────────────────────────────────
function SubScoreRow({ item, icon: Icon }: { item: SubScore; icon: React.ElementType }) {
  const pct = (item.score / item.max) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-zinc-300">
          <Icon className="w-3.5 h-3.5 text-zinc-500" />
          <span className="font-medium">{item.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-600">{item.detail}</span>
          <span className={cn("text-xs font-bold tabular-nums w-8 text-right", scoreColor(item.score, item.max))}>
            {item.score}/{item.max}
          </span>
        </div>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700", scoreBg(item.score, item.max))}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Compact badge (for SymbolCard, watchlist, etc.) ────────────────────────────
export function ScoreBadge({ score }: { score: number }) {
  const lbl = scoreLabel(score);
  return (
    <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-bold", lbl.bg)}>
      <Star className="w-3 h-3 fill-current" />
      <span className={lbl.color}>{score.toFixed(1)}</span>
      <span className={cn("text-[10px]", lbl.color)}>{lbl.text}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function ScoreCard({ symbol, price, indicators, risk, scenarios, compact = false }: Props) {
  const { scores, total } = calcScores(price, indicators, risk, scenarios);
  const lbl               = scoreLabel(total);
  const icons             = [TrendingUp, Zap, Shield];

  if (compact) {
    return (
      <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
        <div className="text-center shrink-0">
          <p className={cn("text-2xl font-black tabular-nums", lbl.color)}>{total.toFixed(1)}</p>
          <p className="text-[9px] text-zinc-600 -mt-0.5">/ 10</p>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StarRating score={total} />
            <span className={cn("text-xs font-semibold", lbl.color)}>{lbl.text}</span>
          </div>
          <div className="flex gap-2">
            {scores.map(s => (
              <div key={s.label} className="flex items-center gap-1">
                <span className="text-[9px] text-zinc-600">{s.label.slice(0, 3)}</span>
                <span className={cn("text-[9px] font-bold", scoreColor(s.score, s.max))}>{s.score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
          <span className="font-semibold text-white text-sm">Yatırım Puanı</span>
        </div>
        <span className="text-[10px] text-zinc-600">{symbol}</span>
      </div>

      {/* Big score */}
      <div className="flex items-center gap-5">
        {/* Score ring */}
        <div className="relative w-20 h-20 shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="32" fill="none" stroke="#27272a" strokeWidth="8" />
            <circle
              cx="40" cy="40" r="32" fill="none"
              stroke={total >= 6.5 ? "#10b981" : total >= 5 ? "#eab308" : total >= 3.5 ? "#f97316" : "#ef4444"}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${(total / 10) * 201} 201`}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("text-2xl font-black tabular-nums leading-none", lbl.color)}>
              {total.toFixed(1)}
            </span>
            <span className="text-[9px] text-zinc-600">/ 10</span>
          </div>
        </div>

        {/* Label + stars */}
        <div className="space-y-2">
          <div className={cn("inline-block px-3 py-1 rounded-xl border text-sm font-bold", lbl.bg)}>
            <span className={lbl.color}>{lbl.text}</span>
          </div>
          <StarRating score={total} />
          <p className="text-[10px] text-zinc-500">
            Teknik · Momentum · Risk/Ödül ağırlıklı skor
          </p>
        </div>
      </div>

      {/* Sub-score bars */}
      <div className="space-y-4 border-t border-zinc-800 pt-4">
        {scores.map((item, i) => (
          <SubScoreRow key={item.label} item={item} icon={icons[i]} />
        ))}
      </div>

      {/* Score breakdown table */}
      <div className="grid grid-cols-3 gap-2 border-t border-zinc-800 pt-4">
        {scores.map(item => (
          <div key={item.label}
            className="bg-zinc-950 border border-zinc-800 rounded-xl text-center py-3 px-2">
            <p className="text-[9px] text-zinc-600 uppercase font-semibold mb-1">{item.label}</p>
            <p className={cn("text-xl font-black tabular-nums", scoreColor(item.score, item.max))}>
              {item.score}
            </p>
            <p className="text-[9px] text-zinc-700">/ {item.max}</p>
            {/* mini bar */}
            <div className="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full", scoreBg(item.score, item.max))}
                style={{ width: `${(item.score / item.max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Context note */}
      <div className={cn("rounded-xl border px-4 py-3", lbl.bg)}>
        <p className={cn("text-xs font-medium", lbl.color)}>
          {total >= 8.0 && "Güçlü teknik yapı, iyi risk/ödül dengesi. Momentum destekliyor."}
          {total >= 6.5 && total < 8.0 && "Genel olarak olumlu görünüm. Pozisyon yönetimine dikkat."}
          {total >= 5.0 && total < 6.5 && "Nötr bölge. Net bir sinyal bekleniyor."}
          {total >= 3.5 && total < 5.0 && "Zayıf teknik yapı. Yeni pozisyon açmadan önce onay bekle."}
          {total < 3.5 && "Yüksek risk bölgesi. Stop seviyelerine dikkat et."}
        </p>
      </div>

      <p className="text-[9px] text-zinc-700 text-center">
        Bu puan teknik göstergelerden hesaplanmaktadır. Yatırım tavsiyesi değildir.
      </p>
    </div>
  );
}
