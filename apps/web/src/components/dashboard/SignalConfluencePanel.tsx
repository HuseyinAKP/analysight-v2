"use client";
import { Confluence, ConfluenceSignal } from "@/lib/api";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props { confluence: Confluence; symbol: string }

function SignalBadge({ signal }: { signal: ConfluenceSignal["signal"] }) {
  if (signal === "bull") return (
    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
      <TrendingUp className="w-3 h-3" /> Yükseliş
    </span>
  );
  if (signal === "bear") return (
    <span className="flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">
      <TrendingDown className="w-3 h-3" /> Düşüş
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[11px] font-bold text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
      <Minus className="w-3 h-3" /> Nötr
    </span>
  );
}

export function SignalConfluencePanel({ confluence }: Props) {
  const { score, bull_count, bear_count, neutral_count, signals } = confluence;

  const scoreColor = score >= 62 ? "text-emerald-400" : score >= 40 ? "text-yellow-400" : "text-red-400";
  const trackBull  = score >= 62 ? "bg-emerald-400" : score >= 40 ? "bg-yellow-400" : "bg-red-400";
  const total      = bull_count + bear_count + neutral_count;

  const label = score >= 62 ? "Güçlü Yükseliş Sinyali" : score >= 40 ? "Karışık Sinyaller" : "Güçlü Düşüş Sinyali";
  const desc  = score >= 62
    ? "Göstergelerin çoğunluğu yukarı yönlü bir hareketi destekliyor."
    : score >= 40
    ? "Göstergeler birbirini çelişiyor — dikkatli hareket edin."
    : "Göstergelerin çoğunluğu aşağı yönlü bir hareketi işaret ediyor.";

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 mb-0.5">Sinyal Uyumu</h2>
          <p className="text-xs text-zinc-500">{desc}</p>
        </div>
        {/* Score ring */}
        <div className="shrink-0 text-right">
          <div className={cn("text-3xl font-extrabold tabular-nums", scoreColor)}>{score}</div>
          <div className="text-[10px] text-zinc-500">/ 100</div>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
          <span>{label}</span>
          <span>{bull_count} yükseliş · {bear_count} düşüş · {neutral_count} nötr</span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden flex">
          <div className="bg-emerald-400 h-full transition-all" style={{ width: `${(bull_count/total)*100}%` }} />
          <div className="bg-zinc-600 h-full transition-all" style={{ width: `${(neutral_count/total)*100}%` }} />
          <div className="bg-red-400 h-full transition-all" style={{ width: `${(bear_count/total)*100}%` }} />
        </div>
        <div className="flex items-center gap-4 mt-1.5 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />Yükseliş</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-zinc-600" />Nötr</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" />Düşüş</span>
        </div>
      </div>

      {/* Signal table */}
      <div className="space-y-1.5">
        {signals.map(sig => (
          <div key={sig.key}
            className={cn(
              "flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors",
              sig.signal === "bull" ? "border-emerald-900/40 bg-emerald-950/30"
              : sig.signal === "bear" ? "border-red-900/40 bg-red-950/20"
              : "border-zinc-800 bg-zinc-800/30"
            )}>
            <div className="flex items-center gap-3 min-w-0">
              <SignalBadge signal={sig.signal} />
              <div className="min-w-0">
                <div className="text-zinc-300 font-semibold truncate">{sig.label}</div>
                <div className="text-zinc-500 text-[10px] truncate">{sig.note}</div>
              </div>
            </div>
            <div className={cn(
              "font-mono text-xs font-bold shrink-0 ml-3",
              sig.signal === "bull" ? "text-emerald-400" : sig.signal === "bear" ? "text-red-400" : "text-zinc-500"
            )}>
              {sig.value}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-zinc-600 pt-1 border-t border-zinc-800">
        Sinyal uyumu analitik amaçlıdır; yatırım tavsiyesi değildir.
      </p>
    </div>
  );
}
