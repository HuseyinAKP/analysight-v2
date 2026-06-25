"use client";
import { Indicators, SymbolInfo } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { TooltipInfo, TIPS } from "@/components/ui/TooltipInfo";

interface Props { indicators: Indicators; info: SymbolInfo }

function Item({ label, value, sub, valueClass, tip }: {
  label: string; value: string; sub?: string; valueClass?: string;
  tip?: { title: string; content: string };
}) {
  return (
    <div className="px-4 py-2.5 border-r border-gray-800 last:border-r-0 min-w-0">
      <div className="flex items-center gap-1 mb-0.5">
        <p className="text-[11px] text-gray-500 truncate">{label}</p>
        {tip && <TooltipInfo title={tip.title} content={tip.content} side="bottom" />}
      </div>
      <p className={cn("text-sm font-mono font-semibold text-white truncate", valueClass)}>{value}</p>
      {sub && <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}

export function StatBar({ indicators, info }: Props) {
  const closes = indicators.series.close;
  const high = Math.max(...closes);
  const low  = Math.min(...closes);
  const rsi  = indicators.rsi;

  const rsiLabel = rsi >= 70 ? "Aşırı Alım" : rsi <= 30 ? "Aşırı Satım" : "Nötr";
  const rsiColor = rsi >= 70 ? "text-red-400" : rsi <= 30 ? "text-emerald-400" : "text-gray-300";

  const macdBull = indicators.macd > indicators.macd_signal;

  // BB position %
  const bbRange = indicators.bb_upper - indicators.bb_lower;
  const bbPos   = bbRange > 0 ? ((info.price - indicators.bb_lower) / bbRange * 100) : 50;

  const ema20Trend = info.price > indicators.ema20 ? "Fiyat EMA üstünde" : "Fiyat EMA altında";
  const ema20Color = info.price > indicators.ema20 ? "text-emerald-400" : "text-red-400";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 divide-x-0 sm:divide-x divide-gray-800">
        <Item label="RSI (14)" value={`${fmt(rsi, 1)}`} sub={rsiLabel} valueClass={rsiColor} tip={TIPS.rsi} />
        <Item label="MACD" value={fmt(indicators.macd, 4)} sub={macdBull ? "↑ Yükseliş sinyali" : "↓ Düşüş sinyali"} valueClass={macdBull ? "text-emerald-400" : "text-red-400"} tip={TIPS.macd} />
        <Item label="BB Pozisyonu" value={`%${bbPos.toFixed(0)}`} sub={bbPos > 80 ? "Üst banda yakın" : bbPos < 20 ? "Alt banda yakın" : "Orta bölge"} tip={TIPS.bb} />
        <Item label="EMA 20" value={fmt(indicators.ema20)} sub={ema20Trend} valueClass={ema20Color} tip={TIPS.ema20} />
        <Item label="60g Yüksek" value={fmt(high)} />
        <Item label="60g Düşük" value={fmt(low)} />
      </div>
    </div>
  );
}
