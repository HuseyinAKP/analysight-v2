"use client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, Zap, BarChart2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface VolumeSpike {
  date: string;
  volume: number;
  pct_above_avg: number;
  direction: "up" | "down";
  close: number;
}

interface MoneyFlowData {
  symbol: string;
  obv: { current: number; pct_change_20d: number; trend: string; divergence: string | null };
  mfi: { value: number | null; signal: string; period: number };
  cmf: { value: number | null; signal: string; period: number };
  volume: { trend_pct_10d: number; avg_30d: number; spikes: VolumeSpike[] };
  summary: { signal: string; signal_tr: string; color: string; bullets: string[] };
}

const SIGNAL_COLORS: Record<string, string> = {
  emerald: "text-emerald-400 bg-emerald-400/10 border-emerald-500/30",
  red:     "text-red-400 bg-red-400/10 border-red-500/30",
  yellow:  "text-yellow-400 bg-yellow-400/10 border-yellow-500/30",
};

const MFI_SIGNAL_TR: Record<string, string> = {
  overbought: "Aşırı Alım",
  oversold:   "Aşırı Satım",
  bullish:    "Yükseliş",
  bearish:    "Düşüş",
  neutral:    "Nötr",
};

const CMF_SIGNAL_TR: Record<string, string> = {
  accumulation: "Birikim",
  distribution: "Dağıtım",
  neutral:      "Nötr",
};

function Gauge({ value, min = 0, max = 100 }: { value: number; min?: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const color = value >= 80 ? "bg-red-500" : value <= 20 ? "bg-emerald-500" : value >= 60 ? "bg-orange-400" : value <= 40 ? "bg-blue-400" : "bg-zinc-400";
  return (
    <div className="relative w-full bg-zinc-800 rounded-full h-2">
      <div className={cn("h-2 rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

interface Props { symbol: string }

export function MoneyFlowPanel({ symbol }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["moneyflow", symbol],
    queryFn: () =>
      fetch(`${API}/api/analysis/${symbol}/money-flow`)
        .then(r => r.json()) as Promise<MoneyFlowData>,
    staleTime: 300_000,
  });

  if (isLoading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-zinc-800/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data || !data.obv) return null;

  const { obv, mfi, cmf, volume, summary } = data;
  const signalClass = SIGNAL_COLORS[summary.color] ?? SIGNAL_COLORS.yellow;
  const SummaryIcon = summary.signal === "BULLISH" ? TrendingUp : summary.signal === "BEARISH" ? TrendingDown : Minus;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Başlık */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-zinc-300">Para Akışı Analizi</h2>
        </div>
        <span className={cn("flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border", signalClass)}>
          <SummaryIcon className="w-3 h-3" />
          {summary.signal_tr}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Özet bullets */}
        {summary.bullets.length > 0 && (
          <ul className="space-y-1">
            {summary.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                {b}
              </li>
            ))}
          </ul>
        )}

        {/* 3 gösterge kartı */}
        <div className="grid grid-cols-3 gap-2">
          {/* OBV */}
          <div className="bg-zinc-800/60 rounded-xl p-3 space-y-1.5">
            <div className="text-[10px] text-zinc-500 font-medium">OBV Trendi</div>
            <div className={cn("text-sm font-bold",
              obv.trend === "up" ? "text-emerald-400" :
              obv.trend === "down" ? "text-red-400" : "text-zinc-400"
            )}>
              {obv.trend === "up" ? "↑ Yükseliş" : obv.trend === "down" ? "↓ Düşüş" : "→ Yatay"}
            </div>
            <div className="text-[10px] text-zinc-500">
              20g: {obv.pct_change_20d >= 0 ? "+" : ""}{obv.pct_change_20d}%
            </div>
            {obv.divergence && (
              <div className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full w-fit",
                obv.divergence === "bullish_divergence"
                  ? "bg-emerald-400/10 text-emerald-400"
                  : "bg-red-400/10 text-red-400"
              )}>
                {obv.divergence === "bullish_divergence" ? "Boğa Uyuşm." : "Ayı Uyuşm."}
              </div>
            )}
          </div>

          {/* MFI */}
          <div className="bg-zinc-800/60 rounded-xl p-3 space-y-1.5">
            <div className="text-[10px] text-zinc-500 font-medium">MFI ({mfi.period})</div>
            <div className="text-sm font-bold text-white">{mfi.value ?? "—"}</div>
            {mfi.value !== null && <Gauge value={mfi.value} />}
            <div className={cn("text-[10px] font-medium",
              mfi.signal === "overbought" ? "text-red-400" :
              mfi.signal === "oversold"   ? "text-emerald-400" :
              mfi.signal === "bullish"    ? "text-blue-400" :
              mfi.signal === "bearish"    ? "text-orange-400" : "text-zinc-500"
            )}>
              {MFI_SIGNAL_TR[mfi.signal] ?? mfi.signal}
            </div>
          </div>

          {/* CMF */}
          <div className="bg-zinc-800/60 rounded-xl p-3 space-y-1.5">
            <div className="text-[10px] text-zinc-500 font-medium">CMF ({cmf.period})</div>
            <div className={cn("text-sm font-bold",
              (cmf.value ?? 0) > 0.05 ? "text-emerald-400" :
              (cmf.value ?? 0) < -0.05 ? "text-red-400" : "text-zinc-400"
            )}>
              {cmf.value !== null ? (cmf.value >= 0 ? "+" : "") + cmf.value.toFixed(3) : "—"}
            </div>
            <div className="text-[10px] text-zinc-500">
              {CMF_SIGNAL_TR[cmf.signal] ?? cmf.signal}
            </div>
          </div>
        </div>

        {/* Hacim bilgisi */}
        <div className="bg-zinc-800/40 rounded-xl px-3 py-2 flex items-center justify-between">
          <div className="text-xs text-zinc-400">
            Hacim trendi (10g):{" "}
            <span className={cn("font-semibold",
              volume.trend_pct_10d > 10 ? "text-emerald-400" :
              volume.trend_pct_10d < -10 ? "text-red-400" : "text-zinc-300"
            )}>
              {volume.trend_pct_10d >= 0 ? "+" : ""}{volume.trend_pct_10d}%
            </span>
          </div>
          <div className="text-[10px] text-zinc-600">
            Ort. hacim: {_fmtVol(volume.avg_30d)}
          </div>
        </div>

        {/* Hacim spike'ları */}
        {volume.spikes.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className="w-3 h-3 text-yellow-400" />
              <span className="text-xs font-medium text-zinc-400">Anormal Hacim Günleri</span>
            </div>
            <div className="space-y-1.5">
              {volume.spikes.slice(0, 4).map((s, i) => (
                <div key={i} className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-1.5 text-xs",
                  s.direction === "up" ? "bg-emerald-400/5 border border-emerald-500/20"
                                       : "bg-red-400/5 border border-red-500/20"
                )}>
                  <span className="text-zinc-400">{s.date}</span>
                  <span className={s.direction === "up" ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
                    {s.direction === "up" ? "▲" : "▼"} {s.close.toLocaleString("tr-TR")}
                  </span>
                  <span className="text-yellow-400 font-bold">+{s.pct_above_avg.toFixed(0)}% hacim</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function _fmtVol(v: number): string {
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + "B";
  if (v >= 1_000_000)     return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000)         return (v / 1_000).toFixed(0) + "K";
  return v.toFixed(0);
}
