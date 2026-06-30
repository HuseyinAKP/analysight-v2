"use client";
import { API_BASE } from "@/lib/api";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Indicators } from "@/lib/api";

// ── Signal helpers ────────────────────────────────────────────────────────────
type Signal = "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell";

interface IndicatorRow {
  name: string;
  value: string;
  signal: Signal;
  description: string;
}

const SIGNAL_CONFIG: Record<Signal, { label: string; short: string; color: string; bg: string }> = {
  strong_buy:  { label: "Güçlü Al",  short: "G.AL",  color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30" },
  buy:         { label: "Al",        short: "AL",    color: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-500/20" },
  neutral:     { label: "Nötr",      short: "NÖTR",  color: "text-zinc-400",   bg: "bg-zinc-700/50 border-zinc-600"          },
  sell:        { label: "Sat",       short: "SAT",   color: "text-red-300",    bg: "bg-red-500/10 border-red-500/20"         },
  strong_sell: { label: "Güçlü Sat", short: "G.SAT", color: "text-red-400",    bg: "bg-red-500/15 border-red-500/30"         },
};

function signalFromValue(val: number, buyThresh: number, sellThresh: number, invert = false): Signal {
  if (invert) {
    if (val >= sellThresh) return "strong_sell";
    if (val >= buyThresh)  return "sell";
    if (val <= -sellThresh) return "strong_buy";
    if (val <= -buyThresh)  return "buy";
    return "neutral";
  }
  if (val >= sellThresh) return "strong_buy";
  if (val >= buyThresh)  return "buy";
  if (val <= -sellThresh) return "strong_sell";
  if (val <= -buyThresh)  return "sell";
  return "neutral";
}

// ── Compute all signals from indicators ───────────────────────────────────────
function buildRows(ind: Indicators): IndicatorRow[] {
  const rows: IndicatorRow[] = [];

  // RSI
  const rsi = ind.rsi;
  let rsiSignal: Signal = "neutral";
  if (rsi < 25) rsiSignal = "strong_buy";
  else if (rsi < 35) rsiSignal = "buy";
  else if (rsi > 75) rsiSignal = "strong_sell";
  else if (rsi > 65) rsiSignal = "sell";
  rows.push({
    name: "RSI (14)",
    value: rsi.toFixed(1),
    signal: rsiSignal,
    description: rsi < 30 ? "Aşırı satılmış bölge" : rsi > 70 ? "Aşırı alınmış bölge" : "Nötr bölge",
  });

  // MACD
  const macdDiff = ind.macd - ind.macd_signal;
  let macdSignal: Signal = "neutral";
  if (macdDiff > 0 && ind.macd > 0) macdSignal = "strong_buy";
  else if (macdDiff > 0) macdSignal = "buy";
  else if (macdDiff < 0 && ind.macd < 0) macdSignal = "strong_sell";
  else if (macdDiff < 0) macdSignal = "sell";
  rows.push({
    name: "MACD",
    value: ind.macd.toFixed(3),
    signal: macdSignal,
    description: macdDiff > 0 ? "Sinyal çizgisinin üzerinde" : "Sinyal çizgisinin altında",
  });

  // EMA 20 vs 50
  const ema20 = ind.series.ema20?.slice(-1)[0];
  const ema50 = ind.series.ema50?.slice(-1)[0];
  const close = ind.series.close.slice(-1)[0];
  if (ema20 && ema50) {
    const ema20Signal: Signal = close > ema20
      ? (ema20 > ema50 ? "strong_buy" : "buy")
      : (ema20 < ema50 ? "strong_sell" : "sell");
    rows.push({
      name: "EMA 20/50",
      value: `${ema20.toFixed(2)} / ${ema50.toFixed(2)}`,
      signal: ema20Signal,
      description: ema20 > ema50 ? "Kısa vadeli EMA uzun vadeli üstünde" : "Kısa vadeli EMA uzun vadeli altında",
    });
  }

  // EMA 200
  const ema200 = ind.series.ema200?.slice(-1)[0];
  if (ema200) {
    const diff200Pct = ((close - ema200) / ema200) * 100;
    let ema200Signal: Signal = "neutral";
    if (diff200Pct > 5) ema200Signal = "strong_buy";
    else if (diff200Pct > 0) ema200Signal = "buy";
    else if (diff200Pct < -5) ema200Signal = "strong_sell";
    else ema200Signal = "sell";
    rows.push({
      name: "EMA 200",
      value: ema200.toFixed(2),
      signal: ema200Signal,
      description: diff200Pct > 0 ? `EMA200 %${Math.abs(diff200Pct).toFixed(1)} üzerinde` : `EMA200 %${Math.abs(diff200Pct).toFixed(1)} altında`,
    });
  }

  // Bollinger Band
  const bbUpper = ind.series.bb_upper?.slice(-1)[0];
  const bbLower = ind.series.bb_lower?.slice(-1)[0];
  if (bbUpper && bbLower) {
    const bbPct = (close - bbLower) / (bbUpper - bbLower) * 100;
    let bbSignal: Signal = "neutral";
    if (bbPct < 10) bbSignal = "strong_buy";
    else if (bbPct < 25) bbSignal = "buy";
    else if (bbPct > 90) bbSignal = "strong_sell";
    else if (bbPct > 75) bbSignal = "sell";
    rows.push({
      name: "Bollinger Band",
      value: `${bbPct.toFixed(0)}%`,
      signal: bbSignal,
      description: bbPct < 20 ? "Alt banda yakın" : bbPct > 80 ? "Üst banda yakın" : "Bant ortasında",
    });
  }

  // VWAP
  const vwap = ind.series.vwap?.slice(-1)[0];
  if (vwap) {
    const vwapDiff = ((close - vwap) / vwap) * 100;
    let vwapSignal: Signal = "neutral";
    if (vwapDiff > 2) vwapSignal = "buy";
    else if (vwapDiff > 0) vwapSignal = "buy";
    else if (vwapDiff < -2) vwapSignal = "sell";
    else vwapSignal = "sell";
    rows.push({
      name: "VWAP",
      value: vwap.toFixed(2),
      signal: vwapSignal,
      description: vwapDiff > 0 ? "Fiyat VWAP üzerinde" : "Fiyat VWAP altında",
    });
  }

  // ADX (from indicators if available)
  if (typeof ind.adx === "number") {
    const adxSignal: Signal = ind.adx > 40 ? "strong_buy" : ind.adx > 25 ? "buy" : "neutral";
    rows.push({
      name: "ADX (Trend Gücü)",
      value: ind.adx.toFixed(1),
      signal: adxSignal,
      description: ind.adx > 40 ? "Çok güçlü trend" : ind.adx > 25 ? "Güçlü trend" : "Zayıf / yok trend",
    });
  }

  // Stochastic
  if (typeof ind.stoch_k === "number" && typeof ind.stoch_d === "number") {
    let stochSignal: Signal = "neutral";
    if (ind.stoch_k < 20) stochSignal = "strong_buy";
    else if (ind.stoch_k < 30) stochSignal = "buy";
    else if (ind.stoch_k > 80) stochSignal = "strong_sell";
    else if (ind.stoch_k > 70) stochSignal = "sell";
    rows.push({
      name: "Stokastik %K/%D",
      value: `${ind.stoch_k.toFixed(0)} / ${ind.stoch_d.toFixed(0)}`,
      signal: stochSignal,
      description: ind.stoch_k < 20 ? "Aşırı satılmış" : ind.stoch_k > 80 ? "Aşırı alınmış" : "Nötr",
    });
  }

  // Williams %R
  if (typeof ind.williams_r === "number") {
    let wrSignal: Signal = "neutral";
    if (ind.williams_r < -80) wrSignal = "strong_buy";
    else if (ind.williams_r < -60) wrSignal = "buy";
    else if (ind.williams_r > -20) wrSignal = "strong_sell";
    else if (ind.williams_r > -40) wrSignal = "sell";
    rows.push({
      name: "Williams %R",
      value: ind.williams_r.toFixed(1),
      signal: wrSignal,
      description: ind.williams_r < -80 ? "Aşırı satılmış" : ind.williams_r > -20 ? "Aşırı alınmış" : "Nötr",
    });
  }

  return rows;
}

// ── Summary score ─────────────────────────────────────────────────────────────
function computeSummary(rows: IndicatorRow[]): {
  score: number; label: string; signal: Signal;
  buy: number; sell: number; neutral: number;
} {
  const weights: Record<Signal, number> = {
    strong_buy: 2, buy: 1, neutral: 0, sell: -1, strong_sell: -2,
  };
  let total = 0;
  let buy = 0, sell = 0, neutral = 0;
  for (const r of rows) {
    total += weights[r.signal];
    if (r.signal === "buy" || r.signal === "strong_buy") buy++;
    else if (r.signal === "sell" || r.signal === "strong_sell") sell++;
    else neutral++;
  }
  const maxScore = rows.length * 2;
  const score = maxScore === 0 ? 50 : Math.round(((total + maxScore) / (2 * maxScore)) * 100);

  let signal: Signal = "neutral";
  let label = "Nötr";
  if (score >= 75) { signal = "strong_buy";  label = "Güçlü Al"; }
  else if (score >= 60) { signal = "buy";    label = "Al"; }
  else if (score <= 25) { signal = "strong_sell"; label = "Güçlü Sat"; }
  else if (score <= 40) { signal = "sell";   label = "Sat"; }

  return { score, label, signal, buy, sell, neutral };
}

// ── Gauge visualization ───────────────────────────────────────────────────────
function Gauge({ score }: { score: number }) {
  const angle = (score / 100) * 180 - 90; // -90 to +90 degrees
  const r = 48;
  const cx = 60, cy = 60;

  const arcPath = (startAngle: number, endAngle: number, color: string) => {
    const start = polarToCartesian(cx, cy, r, startAngle);
    const end = polarToCartesian(cx, cy, r, endAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return (
      <path
        d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`}
        stroke={color} strokeWidth="8" fill="none" strokeLinecap="round"
      />
    );
  };

  return (
    <svg width="120" height="70" viewBox="0 0 120 70">
      {arcPath(180, 216, "#ef4444")}
      {arcPath(216, 252, "#f97316")}
      {arcPath(252, 288, "#71717a")}
      {arcPath(288, 324, "#86efac")}
      {arcPath(324, 360, "#10b981")}
      {/* Needle */}
      <line
        x1={cx} y1={cy}
        x2={cx + Math.cos((angle * Math.PI) / 180) * (r - 8)}
        y2={cy + Math.sin((angle * Math.PI) / 180) * (r - 8)}
        stroke="white" strokeWidth="2" strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r="3" fill="white" />
    </svg>
  );
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// ── AI Verdict ────────────────────────────────────────────────────────────────
async function fetchAIVerdict(symbol: string, summary: ReturnType<typeof computeSummary>): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/api/analysis/${symbol}/claude-analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt_type: "teknik" }),
    });
    if (res.ok) {
      const d = await res.json();
      return d.content;
    }
  } catch {}
  // Fallback
  const cfg = SIGNAL_CONFIG[summary.signal];
  return `Teknik göstergeler genel olarak **${cfg.label}** sinyali veriyor (${summary.buy} alım, ${summary.sell} satım, ${summary.neutral} nötr).

Bu sinyal tek başına yeterli değildir. Hacim, haber akışı ve makro görünüm ile birlikte değerlendirin.`;
}

// ── Main Component ────────────────────────────────────────────────────────────
const _TV_REC_TR: Record<string, string> = {
  STRONG_BUY: "Güçlü Al", BUY: "Al", NEUTRAL: "Nötr",
  SELL: "Sat", STRONG_SELL: "Güçlü Sat",
};
function _tvRecTr(r: string) { return _TV_REC_TR[r] ?? r; }

interface Props { indicators: Indicators; symbol: string }

export function TechnicalSummary({ indicators, symbol }: Props) {
  const rows = buildRows(indicators);
  const summary = computeSummary(rows);
  const cfg = SIGNAL_CONFIG[summary.signal];

  const [verdict, setVerdict] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const getVerdict = useCallback(async () => {
    setLoading(true);
    const text = await fetchAIVerdict(symbol, summary);
    setVerdict(text);
    setLoading(false);
  }, [symbol, summary]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-300">Teknik Özet</h2>
        <span className="text-[10px] text-zinc-600">Investing.com tarzı</span>
      </div>

      {/* TradingView Gerçek Rating */}
      {indicators.tv_rating && (
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
              TradingView Rating
            </span>
            <span className="text-[10px] text-zinc-600">Gerçek zamanlı</span>
          </div>
          <div className="flex items-center gap-4">
            {/* Ana öneri */}
            <div className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-bold border",
              indicators.tv_rating.recommendation === "STRONG_BUY"  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" :
              indicators.tv_rating.recommendation === "BUY"         ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" :
              indicators.tv_rating.recommendation === "STRONG_SELL" ? "bg-red-500/15 border-red-500/30 text-red-400" :
              indicators.tv_rating.recommendation === "SELL"        ? "bg-red-500/10 border-red-500/20 text-red-300" :
                                                                       "bg-zinc-800 border-zinc-700 text-zinc-300"
            )}>
              {indicators.tv_rating.recommendation_tr}
            </div>
            {/* Ossilatör + MA */}
            <div className="flex gap-3 text-xs text-zinc-500">
              <span>Osilatör: <strong className="text-zinc-300">{_tvRecTr(indicators.tv_rating.oscillators.recommendation)}</strong></span>
              <span>·</span>
              <span>MA: <strong className="text-zinc-300">{_tvRecTr(indicators.tv_rating.moving_averages.recommendation)}</strong></span>
            </div>
            {/* Al/Sat/Nötr sayaçlar */}
            <div className="ml-auto flex gap-2 text-[10px]">
              <span className="text-emerald-400">{(indicators.tv_rating.oscillators.buy ?? 0) + (indicators.tv_rating.moving_averages.buy ?? 0)} Al</span>
              <span className="text-zinc-500">{(indicators.tv_rating.oscillators.neutral ?? 0) + (indicators.tv_rating.moving_averages.neutral ?? 0)} Nötr</span>
              <span className="text-red-400">{(indicators.tv_rating.oscillators.sell ?? 0) + (indicators.tv_rating.moving_averages.sell ?? 0)} Sat</span>
            </div>
          </div>
        </div>
      )}

      {/* Summary row */}
      <div className="flex items-center gap-6 px-4 py-4 border-b border-zinc-800">
        {/* Gauge */}
        <div className="shrink-0">
          <Gauge score={summary.score} />
        </div>

        {/* Overall signal */}
        <div className="flex-1">
          <p className="text-[10px] text-zinc-500 mb-1 uppercase tracking-wide">Genel Sinyal</p>
          <p className={cn("text-xl font-bold", cfg.color)}>{cfg.label}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Skor {summary.score}/100</p>
        </div>

        {/* Count badges */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-zinc-400">{summary.buy} Alım</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-zinc-500" />
            <span className="text-zinc-400">{summary.neutral} Nötr</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-zinc-400">{summary.sell} Satım</span>
          </div>
        </div>
      </div>

      {/* Indicator table */}
      <div className="divide-y divide-zinc-800/60">
        {(expanded ? rows : rows.slice(0, 5)).map((row) => {
          const sc = SIGNAL_CONFIG[row.signal];
          return (
            <div key={row.name} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-xs text-zinc-400 w-32 shrink-0">{row.name}</span>
              <span className="text-xs font-mono text-white flex-1">{row.value}</span>
              <span className="text-[10px] text-zinc-500 flex-1 hidden sm:block">{row.description}</span>
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border shrink-0", sc.bg, sc.color)}>
                {sc.short}
              </span>
            </div>
          );
        })}
      </div>

      {rows.length > 5 && (
        <button onClick={() => setExpanded(v => !v)}
          className="w-full py-2 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors border-t border-zinc-800">
          {expanded ? "Daha az göster" : `+${rows.length - 5} gösterge daha göster`}
        </button>
      )}

      {/* AI Verdict */}
      <div className="px-4 py-4 border-t border-zinc-800 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-zinc-300">AI Teknik Yorumu</p>
          <button onClick={getVerdict} disabled={loading}
            className={cn(
              "text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all",
              loading
                ? "bg-zinc-800 border-zinc-700 text-zinc-500"
                : verdict
                ? "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"
                : "bg-blue-600 hover:bg-blue-500 border-blue-500 text-white"
            )}>
            {loading ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin" />
                Analiz ediliyor…
              </span>
            ) : verdict ? "Yenile" : "AI Yorumu Al"}
          </button>
        </div>

        {!verdict && !loading && (
          <p className="text-xs text-zinc-600">
            Tüm göstergeleri birleştiren, sade dilde teknik analiz yorumu alın.
          </p>
        )}

        {verdict && !loading && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 space-y-1.5">
            {verdict.split("\n").map((line, i) => {
              if (!line.trim()) return <div key={i} className="h-0.5" />;
              const html = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
              if (line.startsWith("**"))
                return <p key={i} className="font-bold text-white text-xs" dangerouslySetInnerHTML={{ __html: html }} />;
              if (line.startsWith("- "))
                return <p key={i} className="text-zinc-300 text-xs pl-2">· {line.replace(/^- /, "")}</p>;
              return <p key={i} className="text-zinc-300 text-xs" dangerouslySetInnerHTML={{ __html: html }} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
