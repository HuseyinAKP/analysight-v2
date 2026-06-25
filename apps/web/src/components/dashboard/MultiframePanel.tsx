"use client";
import { MultiframeData } from "@/lib/api";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props { data: MultiframeData }

function DirIcon({ d }: { d: "bull" | "bear" | "neutral" }) {
  if (d === "bull") return <TrendingUp className="w-4 h-4 text-emerald-400" />;
  if (d === "bear") return <TrendingDown className="w-4 h-4 text-red-400" />;
  return <Minus className="w-4 h-4 text-zinc-500" />;
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 62 ? "bg-emerald-400" : score >= 40 ? "bg-yellow-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${score}%` }} />
      </div>
      <span className={cn("text-xs font-bold tabular-nums w-7 text-right",
        score >= 62 ? "text-emerald-400" : score >= 40 ? "text-yellow-400" : "text-red-400")}>
        {score}
      </span>
    </div>
  );
}

export function MultiframePanel({ data }: Props) {
  const { frames } = data;

  // Overall alignment: how many agree
  const bullFrames = frames.filter(f => f.direction === "bull").length;
  const bearFrames = frames.filter(f => f.direction === "bear").length;
  const alignment  = bullFrames === frames.length ? "Tüm zaman dilimlerinde YÜKSELIŞ"
                   : bearFrames === frames.length ? "Tüm zaman dilimlerinde DÜŞÜŞ"
                   : bullFrames > bearFrames      ? "Genel eğilim YUKARI"
                   : bearFrames > bullFrames      ? "Genel eğilim AŞAĞI"
                   : "Zaman dilimleri arasında ÇATIŞMA";
  const alignColor = bullFrames > bearFrames ? "text-emerald-400" : bearFrames > bullFrames ? "text-red-400" : "text-yellow-400";

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-300 mb-0.5">Çoklu Zaman Dilimi Analizi</h2>
        <p className={cn("text-xs font-semibold", alignColor)}>{alignment}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-zinc-600 border-b border-zinc-800">
              <th className="pb-2 text-left font-medium">Dönem</th>
              <th className="pb-2 text-left font-medium">Yön</th>
              <th className="pb-2 text-left font-medium">Uyum Skoru</th>
              <th className="pb-2 text-left font-medium">RSI</th>
              <th className="pb-2 text-left font-medium">MACD</th>
              <th className="pb-2 text-left font-medium">EMA200</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {frames.map(f => (
              <tr key={f.timeframe} className="hover:bg-zinc-800/30 transition-colors">
                <td className="py-2.5 pr-4">
                  <span className="font-bold text-white">{f.timeframe}</span>
                  <span className="text-zinc-600 ml-1.5">{f.label}</span>
                </td>
                <td className="py-2.5 pr-4">
                  <span className={cn("flex items-center gap-1.5 font-semibold",
                    f.direction === "bull" ? "text-emerald-400" : f.direction === "bear" ? "text-red-400" : "text-zinc-500")}>
                    <DirIcon d={f.direction} />
                    {f.direction === "bull" ? "Yükseliş" : f.direction === "bear" ? "Düşüş" : "Nötr"}
                  </span>
                </td>
                <td className="py-2.5 pr-4 w-36">
                  <ScoreBar score={f.confluence_score} />
                </td>
                <td className="py-2.5 pr-4">
                  <span className={cn("font-mono font-semibold",
                    f.rsi < 40 ? "text-emerald-400" : f.rsi > 60 ? "text-red-400" : "text-zinc-400")}>
                    {f.rsi.toFixed(1)}
                  </span>
                </td>
                <td className="py-2.5 pr-4">
                  {f.macd_bullish
                    ? <span className="text-emerald-400 font-semibold">↑ Boğa</span>
                    : <span className="text-red-400 font-semibold">↓ Ayı</span>}
                </td>
                <td className="py-2.5">
                  <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold",
                    f.price_vs_ema200 === "above" ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400")}>
                    {f.price_vs_ema200 === "above" ? "Üstünde" : "Altında"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-zinc-600 pt-1 border-t border-zinc-800">
        Her zaman dilimi bağımsız olarak hesaplanmış teknik göstergeler içerir. Bloomberg tarzı çapraz dönem analizi.
      </p>
    </div>
  );
}
