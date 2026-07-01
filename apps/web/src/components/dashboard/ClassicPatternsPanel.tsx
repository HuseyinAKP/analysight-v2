"use client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, Triangle } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Pattern {
  name: string;
  name_tr: string;
  direction: "bullish" | "bearish" | "neutral";
  confidence: number;
  start_idx: number;
  end_idx: number;
  description: string;
  target_pct: number | null;
}

const DIR_CONFIG = {
  bullish: { color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-500/20", label: "Yükseliş", Icon: TrendingUp },
  bearish: { color: "text-red-400",     bg: "bg-red-400/10 border-red-500/20",         label: "Düşüş",   Icon: TrendingDown },
  neutral: { color: "text-yellow-400",  bg: "bg-yellow-400/10 border-yellow-500/20",   label: "Nötr",    Icon: Minus },
};

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? "bg-emerald-500" : value >= 65 ? "bg-yellow-500" : "bg-zinc-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
        <div className={cn("h-1.5 rounded-full transition-all", color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[10px] text-zinc-500 w-8 text-right">{value}%</span>
    </div>
  );
}

interface Props { symbol: string }

export function ClassicPatternsPanel({ symbol }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["patterns", symbol],
    queryFn: () =>
      fetch(`${API}/api/analysis/${symbol}/patterns`)
        .then(r => r.json()) as Promise<{ patterns: Pattern[]; count: number }>,
    staleTime: 600_000,
  });

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Triangle className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-zinc-300">Formasyon Analizi</h2>
        </div>
        <span className="text-[10px] text-zinc-600">Klasik teknik formasyonlar</span>
      </div>

      <div className="p-4">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-20 bg-zinc-800/50 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && data && data.patterns.length === 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-zinc-500">Belirgin formasyon tespit edilmedi.</p>
            <p className="text-xs text-zinc-600 mt-1">Piyasa konsolidasyon aşamasında olabilir.</p>
          </div>
        )}

        {!isLoading && data && data.patterns.length > 0 && (
          <div className="space-y-3">
            {data.patterns.map((p, i) => {
              const cfg = DIR_CONFIG[p.direction];
              return (
                <div key={i} className={cn("rounded-xl border p-3.5 space-y-2.5", cfg.bg)}>
                  {/* Başlık satırı */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <cfg.Icon className={cn("w-4 h-4 shrink-0", cfg.color)} />
                      <div>
                        <span className="text-sm font-bold text-white">{p.name_tr}</span>
                        <span className="text-[10px] text-zinc-500 ml-1.5">{p.name}</span>
                      </div>
                    </div>
                    <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full shrink-0 border", cfg.bg, cfg.color)}>
                      {cfg.label}
                    </span>
                  </div>

                  {/* Güven çubuğu */}
                  <div>
                    <div className="text-[10px] text-zinc-500 mb-1">Güven Skoru</div>
                    <ConfidenceBar value={p.confidence} />
                  </div>

                  {/* Açıklama */}
                  <p className="text-xs text-zinc-400 leading-relaxed">{p.description}</p>

                  {/* Hedef */}
                  {p.target_pct != null && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-zinc-500">Hedef Hareket:</span>
                      <span className={cn("font-bold", p.target_pct >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {p.target_pct >= 0 ? "+" : ""}{p.target_pct.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
