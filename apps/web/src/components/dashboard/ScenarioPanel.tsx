"use client";
import { Scenarios } from "@/lib/api";
import { fmt, fmtPct } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { AlertTriangle, TrendingUp, Minus, TrendingDown } from "lucide-react";

function UncertaintyMeter({ value }: { value: number }) {
  const low  = value < 35;
  const high = value > 65;
  const color    = high ? "bg-red-500"     : low ? "bg-emerald-500" : "bg-yellow-500";
  const textColor= high ? "text-red-400"   : low ? "text-emerald-400" : "text-yellow-400";
  const label    = high ? "Yüksek"         : low ? "Düşük" : "Orta";

  return (
    <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-gray-500 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          Belirsizlik Endeksi
        </span>
        <div className={cn("flex items-center gap-1.5 text-xs font-semibold", textColor)}>
          <span className={cn("w-1.5 h-1.5 rounded-full", color.replace("bg-", "bg-"))} />
          {label} · {value}
        </div>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700", color)}
          style={{ width: `${value}%` }}
        />
      </div>
      <p className="text-[10px] text-gray-600 mt-1.5">
        {high
          ? "Göstergeler çakışıyor — dikkatli olun"
          : low
          ? "Görece netlik var"
          : "Orta düzeyde belirsizlik"}
      </p>
    </div>
  );
}

const CONFIGS = {
  bull: {
    label: "Boğa Senaryosu",
    icon: <TrendingUp className="w-3.5 h-3.5" />,
    accent: "text-emerald-400",
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/5",
    bar: "bg-emerald-500",
    pctKey: "upside_pct",
    pctSign: "+",
  },
  base: {
    label: "Baz Senaryo",
    icon: <Minus className="w-3.5 h-3.5" />,
    accent: "text-blue-400",
    border: "border-blue-500/20",
    bg: "bg-blue-500/5",
    bar: "bg-blue-500",
    pctKey: "upside_pct",
    pctSign: "+",
  },
  bear: {
    label: "Ayı Senaryosu",
    icon: <TrendingDown className="w-3.5 h-3.5" />,
    accent: "text-red-400",
    border: "border-red-500/20",
    bg: "bg-red-500/5",
    bar: "bg-red-500",
    pctKey: "downside_pct",
    pctSign: "",
  },
} as const;

export function ScenarioPanel({ scenarios }: { scenarios: Scenarios }) {
  const { bull, base, bear } = scenarios.scenarios;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-300">Senaryo Bandı</h2>
          <p className="text-xs text-gray-600 mt-0.5">{scenarios.horizon_days} günlük fiyat hedefleri</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-600">Mevcut Fiyat</p>
          <p className="text-sm font-mono font-bold text-white">{fmt(scenarios.current_price)}</p>
        </div>
      </div>

      {/* Uncertainty meter */}
      <UncertaintyMeter value={scenarios.uncertainty_index} />

      {/* Probability distribution bar */}
      <div>
        <p className="text-xs text-gray-500 mb-2">Olasılık Dağılımı</p>
        <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
          <div className="bg-emerald-500 rounded-l-full" style={{ width: `${bull.probability}%` }} title={`Boğa %${bull.probability}`} />
          <div className="bg-blue-500"                   style={{ width: `${base.probability}%` }} title={`Baz %${base.probability}`} />
          <div className="bg-red-500 rounded-r-full"     style={{ width: `${bear.probability}%` }} title={`Ayı %${bear.probability}`} />
        </div>
        <div className="flex justify-between text-[10px] text-gray-500 mt-1">
          <span className="text-emerald-400">Boğa %{bull.probability}</span>
          <span className="text-blue-400">Baz %{base.probability}</span>
          <span className="text-red-400">Ayı %{bear.probability}</span>
        </div>
      </div>

      {/* Scenario cards */}
      <div className="space-y-2">
        {(["bull", "base", "bear"] as const).map(key => {
          const s   = scenarios.scenarios[key];
          const cfg = CONFIGS[key];
          const pct = key === "bear"
            ? (s as typeof bear).downside_pct
            : (s as typeof bull).upside_pct;
          const distFromCurrent = s.target - scenarios.current_price;

          return (
            <div key={key} className={cn("border rounded-xl p-3.5 transition-colors", cfg.bg, cfg.border)}>
              <div className="flex items-center justify-between mb-2">
                <div className={cn("flex items-center gap-1.5 text-xs font-semibold", cfg.accent)}>
                  {cfg.icon}
                  {cfg.label}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full border border-gray-700">
                    %{s.probability} olasılık
                  </span>
                </div>
              </div>

              <div className="flex items-baseline justify-between">
                <span className="font-mono font-bold text-white text-lg">{fmt(s.target)}</span>
                <div className="text-right">
                  <span className={cn("text-sm font-semibold", cfg.accent)}>
                    {pct >= 0 ? "+" : ""}{fmtPct(pct)}
                  </span>
                  <p className="text-[10px] text-gray-600">
                    {distFromCurrent >= 0 ? "+" : ""}{fmt(distFromCurrent)} fark
                  </p>
                </div>
              </div>

              {/* Probability bar */}
              <div className="mt-2.5 h-1 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-700", cfg.bar)}
                  style={{ width: `${s.probability}%`, opacity: 0.7 }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <p className="text-[10px] text-gray-600 text-center">
        Bu tahminler geçmiş fiyat verisi ve teknik analiz ile oluşturulmuştur.
        Kesin tahmin değildir.
      </p>
    </div>
  );
}
