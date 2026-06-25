"use client";
import { useState } from "react";
import { Indicators } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { TooltipInfo, TIPS } from "@/components/ui/TooltipInfo";
import {
  ComposedChart, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Bar, Cell, CartesianGrid,
} from "recharts";

// ---- Sinyal helpers ----
function rsiSignal(rsi: number) {
  if (rsi >= 80) return { label: "Güçlü Aşırı Alım", color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20",       dot: "#f87171" };
  if (rsi >= 70) return { label: "Aşırı Alım",       color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/20", dot: "#fb923c" };
  if (rsi <= 20) return { label: "Güçlü Aşırı Satım",color: "text-emerald-300", bg: "bg-emerald-500/15 border-emerald-400/20",dot:"#6ee7b7" };
  if (rsi <= 30) return { label: "Aşırı Satım",      color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20",dot:"#34d399" };
  if (rsi >= 55) return { label: "Yükseliş Eğilimi", color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20",     dot: "#60a5fa" };
  if (rsi <= 45) return { label: "Düşüş Eğilimi",    color: "text-yellow-400",  bg: "bg-yellow-500/10 border-yellow-500/20", dot: "#fbbf24" };
  return         { label: "Nötr Bölge",              color: "text-gray-400",    bg: "bg-gray-800 border-gray-700",           dot: "#6b7280" };
}

function macdSignal(macd: number, signal: number, hist: number) {
  if (macd > signal && hist > 0) return { label: "Yükseliş · Momentum Artıyor", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" };
  if (macd > signal && hist < 0) return { label: "Yükseliş · Momentum Zayıflıyor", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" };
  if (macd < signal && hist < 0) return { label: "Düşüş · Momentum Artıyor", color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20" };
  return { label: "Düşüş · Momentum Zayıflıyor", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" };
}

function bbSignal(price: number, upper: number, lower: number, middle: number) {
  const pct = (price - lower) / (upper - lower) * 100;
  if (pct > 90) return { label: "Üst Banda Çok Yakın — Dikkat", color: "text-red-400" };
  if (pct > 75) return { label: "Üst Banda Yakın", color: "text-orange-400" };
  if (pct < 10) return { label: "Alt Banda Çok Yakın — Fırsat?", color: "text-emerald-400" };
  if (pct < 25) return { label: "Alt Banda Yakın", color: "text-blue-400" };
  if (price > middle) return { label: "Orta Bandın Üstünde", color: "text-gray-300" };
  return { label: "Orta Bandın Altında", color: "text-gray-400" };
}

// ---- RSI Gauge ----
function RsiGauge({ value }: { value: number }) {
  const sig = rsiSignal(value);
  const pct = Math.min(Math.max(value, 0), 100);
  const trackW = 200;
  const r = 75;
  const cx = trackW / 2;
  const cy = 90;
  const arcLen = Math.PI * r;
  const dashOffset = arcLen - (pct / 100) * arcLen;

  return (
    <div className="flex flex-col items-center py-2">
      <svg viewBox="0 0 200 100" className="w-40 h-20">
        {/* Track */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="#1f2937" strokeWidth="10" strokeLinecap="round"
        />
        {/* Fill */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={pct >= 70 ? "#ef4444" : pct <= 30 ? "#10b981" : "#3b82f6"}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={arcLen}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        {/* Value */}
        <text x={cx} y={cy - 10} textAnchor="middle" fill="white" fontSize="22" fontWeight="bold" fontFamily="monospace">
          {value.toFixed(0)}
        </text>
        {/* Labels */}
        <text x={cx - r - 2} y={cy + 14} textAnchor="middle" fill="#6b7280" fontSize="9">0</text>
        <text x={cx + r + 2} y={cy + 14} textAnchor="middle" fill="#6b7280" fontSize="9">100</text>
        <text x={cx - r * 0.71 - 4} y={cy - r * 0.71 + 14} textAnchor="middle" fill="#10b981" fontSize="8">30</text>
        <text x={cx + r * 0.71 + 4} y={cy - r * 0.71 + 14} textAnchor="middle" fill="#ef4444" fontSize="8">70</text>
      </svg>
      <span className={cn("text-xs font-semibold -mt-1", sig.color)}>{sig.label}</span>
    </div>
  );
}

// ---- Indicator card ----
function IndCard({ label, value, signal, tip }: { label: string; value: string; signal: { label: string; color: string; bg: string }; tip?: { title: string; content: string } }) {
  return (
    <div className={cn("border rounded-xl p-3 space-y-1", signal.bg)}>
      <div className="flex items-center gap-1">
        <p className="text-xs text-gray-500">{label}</p>
        {tip && <TooltipInfo title={tip.title} content={tip.content} side="top" />}
      </div>
      <p className="font-mono font-bold text-white text-lg leading-none">{value}</p>
      <p className={cn("text-xs font-medium", signal.color)}>{signal.label}</p>
    </div>
  );
}

type Tab = "RSI" | "MACD" | "BB";

export function TechnicalPanel({ indicators }: { indicators: Indicators }) {
  const [tab, setTab] = useState<Tab>("RSI");

  const rsi  = indicators.rsi;
  const rsiS = rsiSignal(rsi);
  const macdS = macdSignal(indicators.macd, indicators.macd_signal, indicators.macd_histogram);
  const bbS   = bbSignal(
    indicators.series.close[indicators.series.close.length - 1] ?? 0,
    indicators.bb_upper, indicators.bb_lower, indicators.bb_middle,
  );

  const rsiData  = indicators.series.rsi.map((v, i) => ({ i, rsi: v }));
  const macdData = indicators.series.macd.map((v, i) => ({
    i, macd: v,
    signal: indicators.series.macd_signal[i],
    histogram: indicators.series.macd_histogram[i],
  }));

  const n = indicators.series.close.length;
  const bbData = indicators.series.close.map((close, i) => ({
    i,
    close,
    upper: indicators.series.bb_upper[i],
    lower: indicators.series.bb_lower[i],
    middle: indicators.series.bb_middle[i],
  }));

  const TABS: Tab[] = ["RSI", "MACD", "BB"];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
      <h2 className="text-sm font-semibold text-gray-300">Teknik Göstergeler</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <IndCard label="RSI (14)" value={fmt(rsi, 1)} signal={rsiS} tip={TIPS.rsi} />
        <IndCard label="MACD" value={`${fmt(indicators.macd, 3)} / ${fmt(indicators.macd_signal, 3)}`} signal={macdS} tip={TIPS.macd} />
        <IndCard label="Bollinger" value={`${indicators.bb_lower.toFixed(1)} – ${indicators.bb_upper.toFixed(1)}`} signal={{ ...bbS, bg: "bg-gray-800 border-gray-700" }} tip={TIPS.bb} />
      </div>

      {/* EMA summary */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: "EMA 20",  val: indicators.ema20,  color: "text-blue-400",   tip: TIPS.ema20  },
          { label: "EMA 50",  val: indicators.ema50,  color: "text-purple-400", tip: TIPS.ema50  },
          { label: "EMA 200", val: indicators.ema200, color: "text-yellow-400", tip: TIPS.ema200 },
        ].map(e => (
          <div key={e.label} className="bg-gray-800 border border-gray-700 rounded-lg p-2">
            <div className="flex items-center justify-center gap-1 mb-1">
              <p className="text-[10px] text-gray-500">{e.label}</p>
              <TooltipInfo title={e.tip.title} content={e.tip.content} side="top" />
            </div>
            <p className={cn("text-sm font-mono font-bold", e.color)}>{fmt(e.val)}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div>
        <div className="flex bg-gray-800 rounded-lg p-0.5 border border-gray-700 mb-4 w-fit">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "text-xs px-4 py-1.5 rounded-md transition-colors font-medium",
                tab === t ? "bg-gray-600 text-white shadow" : "text-gray-500 hover:text-gray-300"
              )}
            >{t}</button>
          ))}
        </div>

        {tab === "RSI" && (
          <div className="space-y-3">
            <RsiGauge value={rsi} />
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={rsiData}>
                <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" vertical={false} />
                <YAxis domain={[0, 100]} hide />
                <XAxis dataKey="i" hide />
                <Tooltip
                  contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 11 }}
                  formatter={(v) => (typeof v === "number" ? [v.toFixed(1), "RSI"] : [v, "RSI"])}
                />
                <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 3" strokeOpacity={0.6} />
                <ReferenceLine y={30} stroke="#10b981" strokeDasharray="4 3" strokeOpacity={0.6} />
                <ReferenceLine y={50} stroke="#374151" strokeDasharray="2 4" strokeOpacity={0.4} />
                <Line type="monotone" dataKey="rsi" stroke={rsiS.dot} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex justify-between text-[10px] text-gray-600 px-1">
              <span className="text-emerald-500">Aşırı Satım ≤ 30</span>
              <span>Nötr 30–70</span>
              <span className="text-red-500">Aşırı Alım ≥ 70</span>
            </div>
          </div>
        )}

        {tab === "MACD" && (
          <div className="space-y-1">
            <div className={cn("text-xs px-3 py-2 rounded-lg border mb-3", macdS.bg)}>
              <span className={macdS.color}>{macdS.label}</span>
              <span className="text-gray-500 ml-2">· MACD: {fmt(indicators.macd, 4)} · Sinyal: {fmt(indicators.macd_signal, 4)}</span>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <ComposedChart data={macdData}>
                <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" vertical={false} />
                <YAxis hide domain={["auto", "auto"]} />
                <XAxis dataKey="i" hide />
                <Tooltip
                  contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 11 }}
                  formatter={(v, name) => {
                    const labels: Record<string, string> = { macd: "MACD", signal: "Sinyal", histogram: "Histogram" };
                    return [typeof v === "number" ? v.toFixed(4) : v, labels[name as string] ?? name];
                  }}
                />
                <ReferenceLine y={0} stroke="#374151" />
                <Bar dataKey="histogram" name="histogram" radius={[2,2,0,0]}>
                  {macdData.map((d, i) => (
                    <Cell key={i} fill={d.histogram >= 0 ? "#10b981" : "#ef4444"} fillOpacity={0.7} />
                  ))}
                </Bar>
                <Line type="monotone" dataKey="macd"   stroke="#60a5fa" strokeWidth={1.5} dot={false} name="macd" />
                <Line type="monotone" dataKey="signal" stroke="#f97316" strokeWidth={1.5} dot={false} name="signal" strokeDasharray="5 3" />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="flex gap-4 text-[10px] text-gray-500 px-1">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-400 inline-block rounded" />MACD</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-orange-400 inline-block rounded" />Sinyal</span>
              <span className="flex items-center gap-1"><span className="w-3 h-2 bg-emerald-500/60 inline-block rounded-sm" />Histogram (+)</span>
              <span className="flex items-center gap-1"><span className="w-3 h-2 bg-red-500/60 inline-block rounded-sm" />Histogram (-)</span>
            </div>
          </div>
        )}

        {tab === "BB" && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "BB Üst",  val: indicators.bb_upper,  color: "text-blue-400" },
                { label: "BB Orta", val: indicators.bb_middle, color: "text-gray-300" },
                { label: "BB Alt",  val: indicators.bb_lower,  color: "text-blue-400" },
              ].map(b => (
                <div key={b.label} className="bg-gray-800 rounded-lg p-2">
                  <p className="text-[10px] text-gray-500 mb-1">{b.label}</p>
                  <p className={cn("text-sm font-mono font-bold", b.color)}>{fmt(b.val)}</p>
                </div>
              ))}
            </div>
            <div className={cn("text-xs px-3 py-2 rounded-lg border bg-gray-800 border-gray-700")}>
              <span className={bbS.color}>{bbS.label}</span>
              <span className="text-gray-500 ml-2">· ATR: {fmt(indicators.atr, 4)}</span>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <ComposedChart data={bbData}>
                <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" vertical={false} />
                <YAxis hide domain={["auto", "auto"]} />
                <XAxis dataKey="i" hide />
                <Tooltip
                  contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 11 }}
                  formatter={(v, name) => {
                    const labels: Record<string, string> = { close: "Fiyat", upper: "BB Üst", lower: "BB Alt", middle: "BB Orta" };
                    return [typeof v === "number" ? v.toFixed(2) : v, labels[name as string] ?? name];
                  }}
                />
                <Line type="monotone" dataKey="upper"  stroke="#3b82f6" strokeWidth={1}   dot={false} name="upper"  strokeOpacity={0.5} />
                <Line type="monotone" dataKey="lower"  stroke="#3b82f6" strokeWidth={1}   dot={false} name="lower"  strokeOpacity={0.5} />
                <Line type="monotone" dataKey="middle" stroke="#6b7280" strokeWidth={1}   dot={false} name="middle" strokeDasharray="4 2" />
                <Line type="monotone" dataKey="close"  stroke="#f59e0b" strokeWidth={2}   dot={false} name="close" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

