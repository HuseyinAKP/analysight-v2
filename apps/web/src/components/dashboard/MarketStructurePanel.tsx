"use client";
import { MarketStructure } from "@/lib/api";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/utils";
import { Activity } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from "recharts";

export function MarketStructurePanel({ data }: { data: MarketStructure }) {
  const { adx, stochastic, structure } = data;

  const biasColor = structure.bias === "bullish" ? "text-emerald-400"
    : structure.bias === "bearish" ? "text-red-400" : "text-gray-400";

  const stochData = stochastic.series_k.map((k, i) => ({
    i, k, d: stochastic.series_d[i],
  }));

  const adxData = adx.series.map((v, i) => ({ i, adx: v }));

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-cyan-400" />
        <h2 className="text-sm font-semibold text-gray-300">Piyasa Yapısı</h2>
      </div>

      {/* Structure bias */}
      <div className={cn(
        "border rounded-xl p-3",
        structure.bias === "bullish" ? "bg-emerald-500/5 border-emerald-500/20"
          : structure.bias === "bearish" ? "bg-red-500/5 border-red-500/20"
          : "bg-gray-800/50 border-gray-700"
      )}>
        <p className="text-xs text-gray-500 mb-1">Piyasa Yapısı</p>
        <p className={cn("text-base font-bold", biasColor)}>{structure.structure}</p>

        {structure.events.length > 0 && (
          <div className="mt-2 space-y-1">
            {structure.events.map((ev, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={cn("font-semibold", ev.sentiment === "bullish" ? "text-emerald-400" : "text-red-400")}>
                  {ev.type}
                </span>
                <span className="text-gray-500">{ev.date}</span>
                <span className="text-gray-400 font-mono ml-auto">{fmt(ev.price)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ADX */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-500">ADX — {adx.label}</p>
          <div className="flex gap-2 text-xs">
            <span className="text-emerald-400">DI+ {adx.di_plus}</span>
            <span className="text-red-400">DI− {adx.di_minus}</span>
            <span className="text-white font-mono font-bold">{adx.adx}</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={80}>
          <LineChart data={adxData}>
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" vertical={false} />
            <YAxis hide domain={[0, 60]} />
            <XAxis dataKey="i" hide />
            <Tooltip
              contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 11, borderRadius: 8 }}
              formatter={(v) => [typeof v === "number" ? v.toFixed(1) : v, "ADX"]}
            />
            <ReferenceLine y={25} stroke="#6b7280" strokeDasharray="3 3" label={{ value: "25", fill: "#6b7280", fontSize: 9 }} />
            <Line type="monotone" dataKey="adx" stroke="#06b6d4" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Stochastic */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-500">Stochastic — {stochastic.label}</p>
          <div className="flex gap-2 text-xs">
            <span className="text-blue-400">K: {stochastic.k}</span>
            <span className="text-orange-400">D: {stochastic.d}</span>
            <span className={cn("font-semibold", stochastic.signal === "Al" ? "text-emerald-400" : stochastic.signal === "Sat" ? "text-red-400" : "text-gray-400")}>
              {stochastic.signal}
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={80}>
          <LineChart data={stochData}>
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" vertical={false} />
            <YAxis hide domain={[0, 100]} />
            <XAxis dataKey="i" hide />
            <Tooltip
              contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 11, borderRadius: 8 }}
              formatter={(v, n) => [typeof v === "number" ? v.toFixed(1) : v, n === "k" ? "K" : "D"]}
            />
            <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
            <ReferenceLine y={20} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.5} />
            <Line type="monotone" dataKey="k" stroke="#60a5fa" strokeWidth={1.5} dot={false} name="k" />
            <Line type="monotone" dataKey="d" stroke="#fb923c" strokeWidth={1} dot={false} name="d" strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Swing points */}
      {(structure.swing_highs.length > 0 || structure.swing_lows.length > 0) && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] text-gray-500 mb-1.5">Son Swing Yüksekleri</p>
            {structure.swing_highs.slice(-3).reverse().map((s, i) => (
              <div key={i} className="flex justify-between text-[11px] py-0.5">
                <span className="text-gray-500">{s.date.slice(5)}</span>
                <span className="font-mono text-emerald-400">{fmt(s.price)}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-[10px] text-gray-500 mb-1.5">Son Swing Düşükleri</p>
            {structure.swing_lows.slice(-3).reverse().map((s, i) => (
              <div key={i} className="flex justify-between text-[11px] py-0.5">
                <span className="text-gray-500">{s.date.slice(5)}</span>
                <span className="font-mono text-red-400">{fmt(s.price)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
