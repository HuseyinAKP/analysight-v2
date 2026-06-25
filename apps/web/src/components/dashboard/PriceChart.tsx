"use client";
import { useState } from "react";
import { Indicators } from "@/lib/api";
import {
  ComposedChart, Line, Bar, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";

interface Props { indicators: Indicators; symbol: string }

type Period = "1M" | "2M" | "3M" | "6M";
const PERIODS: Period[] = ["1M", "2M", "3M", "6M"];
const PERIOD_SLICES: Record<Period, number> = { "1M": 22, "2M": 44, "3M": 66, "6M": 90 };

export function PriceChart({ indicators }: Props) {
  const [period, setPeriod]   = useState<Period>("2M");
  const [showEma, setShowEma] = useState(true);
  const [showBB, setShowBB]   = useState(true);
  const [showVwap, setShowVwap] = useState(true);
  const [showVolume, setShowVolume] = useState(true);

  const { series } = indicators;
  const n = Math.min(PERIOD_SLICES[period], series.dates.length);

  const data = series.dates.slice(-n).map((date, i) => {
    const offset = series.dates.length - n;
    const idx    = offset + i;
    return {
      date,
      close:    series.close[idx],
      ema20:    series.ema20?.[idx],
      ema50:    series.ema50?.[idx],
      ema200:   series.ema200?.[idx],
      bb_upper: series.bb_upper?.[idx],
      bb_lower: series.bb_lower?.[idx],
      vwap:     series.vwap?.[idx],
      volume:   series.volume?.[idx],
    };
  });

  const last = data[data.length - 1];
  const bbPct = last && last.bb_upper && last.bb_lower
    ? ((last.close - last.bb_lower) / (last.bb_upper - last.bb_lower) * 100).toFixed(0)
    : "—";

  const maxVol = Math.max(...data.map(d => d.volume ?? 0));

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-zinc-300">Fiyat Grafiği</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Toggles */}
          {[
            { key: "bb",    label: "Bollinger", color: "blue",   on: showBB,     set: setShowBB },
            { key: "ema",   label: "EMA",       color: "purple", on: showEma,    set: setShowEma },
            { key: "vwap",  label: "VWAP",      color: "yellow", on: showVwap,   set: setShowVwap },
            { key: "vol",   label: "Hacim",     color: "zinc",   on: showVolume, set: setShowVolume },
          ].map(({ key, label, color, on, set }) => (
            <button key={key} onClick={() => set(v => !v)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-md border transition-colors",
                on
                  ? `bg-${color}-500/15 border-${color}-500/30 text-${color}-400`
                  : "bg-zinc-800 border-zinc-700 text-zinc-500"
              )}>
              {label}
            </button>
          ))}

          {/* Period tabs */}
          <div className="flex bg-zinc-800 rounded-lg p-0.5 border border-zinc-700">
            {PERIODS.map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-md transition-colors",
                  period === p ? "bg-zinc-600 text-white" : "text-zinc-500 hover:text-zinc-300"
                )}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stat badges */}
      <div className="flex items-center gap-4 text-[11px] text-zinc-500 flex-wrap">
        <span>BB %B: <span className="text-white font-mono">{bbPct}%</span></span>
        <span>EMA20: <span className="text-blue-400 font-mono">{last?.ema20?.toFixed(2)}</span></span>
        <span>EMA50: <span className="text-purple-400 font-mono">{last?.ema50?.toFixed(2)}</span></span>
        {showVwap && last?.vwap && (
          <span>VWAP: <span className="text-yellow-400 font-mono">{last.vwap.toFixed(2)}</span></span>
        )}
        {last?.ema200 && (
          <span>EMA200: <span className={cn("font-mono", last.close > last.ema200 ? "text-emerald-400" : "text-red-400")}>
            {last.ema200.toFixed(2)}
          </span></span>
        )}
      </div>

      {/* Price chart */}
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
          <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: "#52525b", fontSize: 10 }} tickLine={false} axisLine={false}
            tickFormatter={v => v.slice(5)} interval={Math.floor(n / 5)} />
          <YAxis tick={{ fill: "#52525b", fontSize: 10 }} tickLine={false} axisLine={false}
            domain={["auto", "auto"]} width={58}
            tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v.toFixed(1)} />
          <Tooltip
            contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 10, fontSize: 12 }}
            labelStyle={{ color: "#a1a1aa", marginBottom: 4 }}
            formatter={(val, name) => {
              const lbl: Record<string, string> = { close: "Fiyat", ema20: "EMA 20", ema50: "EMA 50",
                ema200: "EMA 200", bb_upper: "BB Üst", bb_lower: "BB Alt", vwap: "VWAP" };
              return [typeof val === "number" ? val.toFixed(2) : val, lbl[name as string] ?? name];
            }}
          />

          {/* Bollinger fill */}
          {showBB && (
            <>
              <Area type="monotone" dataKey="bb_upper" stroke="#3b82f6" strokeWidth={1}
                strokeOpacity={0.4} fill="#3b82f6" fillOpacity={0.05} dot={false} legendType="none" />
              <Area type="monotone" dataKey="bb_lower" stroke="#3b82f6" strokeWidth={1}
                strokeOpacity={0.4} fill="#18181b" fillOpacity={1} dot={false} legendType="none" />
            </>
          )}

          {/* EMA lines */}
          {showEma && (
            <>
              <Line type="monotone" dataKey="ema20" stroke="#60a5fa" strokeWidth={1.5} dot={false} legendType="none" />
              <Line type="monotone" dataKey="ema50" stroke="#a78bfa" strokeWidth={1.5} dot={false} legendType="none" strokeDasharray="5 3" />
              <Line type="monotone" dataKey="ema200" stroke="#f97316" strokeWidth={1} dot={false} legendType="none" strokeDasharray="4 4" />
            </>
          )}

          {/* VWAP */}
          {showVwap && (
            <Line type="monotone" dataKey="vwap" stroke="#facc15" strokeWidth={1.5} dot={false} legendType="none" strokeDasharray="6 3" />
          )}

          {/* Price */}
          <Line type="monotone" dataKey="close" stroke="#f59e0b" strokeWidth={2} dot={false} legendType="none" />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Volume chart */}
      {showVolume && (
        <ResponsiveContainer width="100%" height={60}>
          <ComposedChart data={data} margin={{ left: 0, right: 4, top: 0, bottom: 0 }}>
            <XAxis dataKey="date" hide />
            <YAxis hide domain={[0, maxVol * 1.5]} />
            <Bar dataKey="volume" fill="#3f3f46" opacity={0.7} radius={[1, 1, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {/* Legend row */}
      <div className="flex items-center gap-4 text-[11px] text-zinc-500 pt-1 border-t border-zinc-800 flex-wrap">
        <LegendDot color="#f59e0b" label="Fiyat" />
        {showEma && <>
          <LegendDot color="#60a5fa" label="EMA 20" />
          <LegendDot color="#a78bfa" label="EMA 50" dashed />
          <LegendDot color="#f97316" label="EMA 200" dashed />
        </>}
        {showBB  && <LegendDot color="#3b82f6" label="Bollinger" />}
        {showVwap && <LegendDot color="#facc15" label="VWAP" dashed />}
        {showVolume && <LegendDot color="#3f3f46" label="Hacim" />}
      </div>
    </div>
  );
}

function LegendDot({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-0.5 w-5 rounded-full" style={{
        background: dashed
          ? `repeating-linear-gradient(to right, ${color} 0, ${color} 4px, transparent 4px, transparent 7px)`
          : color,
      }} />
      {label}
    </span>
  );
}
