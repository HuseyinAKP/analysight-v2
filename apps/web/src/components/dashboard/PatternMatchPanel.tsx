"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { GitCompare, TrendingUp, TrendingDown, AlertTriangle, Info, ChevronDown, ChevronUp } from "lucide-react";
import { MacroSnapshot, type MacroData } from "@/components/dashboard/MacroSnapshot";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Match = {
  date: string;
  similarity: number;
  day_return: number;
  post_5d: number | null;
  post_30d: number | null;
  post_90d: number | null;
  macro?: MacroData | null;
};

type Aggregate = {
  median_30d: number;
  mean_30d: number;
  bull_30d: number;
  bear_30d: number;
  positive_pct: number;
  avg_similarity: number;
  sample_size: number;
  median_90d: number | null;
};

type PatternResult = {
  symbol: string;
  current_state: {
    rsi: number;
    macd_direction: string;
    price_vs_ema200_pct: number;
    momentum_20d: number;
  };
  matches: Match[];
  aggregate: Aggregate | null;
  note: string | null;
};

const fmtPct = (v: number | null) =>
  v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

const pctColor = (v: number | null) =>
  v == null ? "text-zinc-600" : v >= 0 ? "text-emerald-400" : "text-red-400";

const simColor = (s: number) =>
  s >= 0.97 ? "text-emerald-400" : s >= 0.93 ? "text-blue-400" : "text-amber-400";

const simLabel = (s: number) =>
  s >= 0.97 ? "Çok Yüksek" : s >= 0.93 ? "Yüksek" : "Orta";

// ── Eşleşme satırı ────────────────────────────────────────────────────────────
function MatchRow({ m, rank }: { m: Match; rank: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-zinc-800/60 last:border-0">
      <div
        className="grid grid-cols-[32px_100px_1fr_1fr_1fr_1fr_20px] gap-2 items-center
                   py-2.5 text-xs cursor-pointer hover:bg-zinc-800/20 rounded-lg px-1 -mx-1"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-zinc-700 font-mono text-center">#{rank}</span>
        <span className="text-zinc-300 font-mono">{m.date}</span>
        <span className={cn("font-semibold text-center", simColor(m.similarity))}>
          %{(m.similarity * 100).toFixed(1)}
          <span className="block text-[10px] font-normal opacity-60">{simLabel(m.similarity)}</span>
        </span>
        <span className={cn("font-mono text-center font-semibold", pctColor(m.post_5d))}>
          {fmtPct(m.post_5d)}
        </span>
        <span className={cn("font-mono text-center font-semibold", pctColor(m.post_30d))}>
          {fmtPct(m.post_30d)}
        </span>
        <span className={cn("font-mono text-center font-semibold", pctColor(m.post_90d))}>
          {fmtPct(m.post_90d)}
        </span>
        {open
          ? <ChevronUp className="w-3.5 h-3.5 text-zinc-600" />
          : <ChevronDown className="w-3.5 h-3.5 text-zinc-700" />
        }
      </div>
      {open && m.macro && (
        <div className="pb-3 px-1">
          <MacroSnapshot macro={m.macro} compact />
        </div>
      )}
    </div>
  );
}

// ── Outcome bar ───────────────────────────────────────────────────────────────
function OutcomeBar({ agg }: { agg: Aggregate }) {
  const range = agg.bull_30d - agg.bear_30d;
  const medPct = range > 0
    ? ((agg.median_30d - agg.bear_30d) / range * 100)
    : 50;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
        <span className="text-red-400">{fmtPct(agg.bear_30d)} (kötü)</span>
        <span className="text-zinc-400">Ortanca: {fmtPct(agg.median_30d)}</span>
        <span className="text-emerald-400">{fmtPct(agg.bull_30d)} (iyi)</span>
      </div>
      <div className="relative h-3 bg-zinc-800 rounded-full overflow-hidden">
        {/* Kırmızı → yeşil gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/40 via-zinc-700 to-emerald-500/40 rounded-full" />
        {/* Ortanca işareti */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/80 rounded-full"
          style={{ left: `${Math.max(2, Math.min(98, medPct))}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-1">
        <span>Pozitif kapanış: <strong className="text-white">{agg.positive_pct}%</strong></span>
        <span>{agg.sample_size} dönem baz alındı</span>
      </div>
    </div>
  );
}

// ── Ana bileşen ───────────────────────────────────────────────────────────────
export function PatternMatchPanel({ symbol }: { symbol: string }) {
  const { data, isLoading, isError } = useQuery<PatternResult>({
    queryKey: ["hei-pattern", symbol],
    queryFn: () =>
      fetch(`${API}/api/hei/${symbol}/pattern-match`).then(r => r.json()),
    staleTime: 1800_000,
  });

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">

      {/* Başlık */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-purple-400" />
          <div>
            <h3 className="text-sm font-semibold text-white">Tarihsel Örüntü Eşleştirme</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Bugünkü teknik durum, geçmişin en benzer dönemleriyle karşılaştırılıyor
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold bg-purple-500/15 border border-purple-500/25
                         text-purple-400 px-2 py-1 rounded-full shrink-0">
          HEI · Beta
        </span>
      </div>

      {/* Yükleniyor */}
      {isLoading && (
        <div className="space-y-3">
          <div className="h-16 bg-zinc-800 rounded-xl animate-pulse" />
          {[1,2,3].map(i => <div key={i} className="h-8 bg-zinc-800/60 rounded-lg animate-pulse" />)}
        </div>
      )}

      {/* Hata */}
      {isError && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 text-center">
          <p className="text-sm text-red-400">Örüntü analizi yapılamadı.</p>
        </div>
      )}

      {data && !isLoading && (
        <>
          {/* Mevcut durum özeti */}
          {data.current_state && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "RSI", value: `${data.current_state.rsi}`, color: data.current_state.rsi > 70 ? "text-red-400" : data.current_state.rsi < 30 ? "text-emerald-400" : "text-zinc-300" },
                { label: "MACD", value: data.current_state.macd_direction, color: data.current_state.macd_direction === "pozitif" ? "text-emerald-400" : "text-red-400" },
                { label: "EMA200'e göre", value: `${data.current_state.price_vs_ema200_pct >= 0 ? "+" : ""}${data.current_state.price_vs_ema200_pct}%`, color: data.current_state.price_vs_ema200_pct >= 0 ? "text-emerald-400" : "text-red-400" },
                { label: "20g Momentum", value: `${data.current_state.momentum_20d >= 0 ? "+" : ""}${data.current_state.momentum_20d}%`, color: data.current_state.momentum_20d >= 0 ? "text-emerald-400" : "text-red-400" },
              ].map(s => (
                <div key={s.label} className="bg-zinc-800/50 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-zinc-500 mb-1">{s.label}</p>
                  <p className={cn("text-sm font-bold", s.color)}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Veri yok mesajı */}
          {data.note && !data.matches.length && (
            <div className="bg-zinc-800/40 border border-zinc-700 rounded-xl p-4 flex items-center gap-3">
              <Info className="w-4 h-4 text-zinc-500 shrink-0" />
              <p className="text-xs text-zinc-400">{data.note}</p>
            </div>
          )}

          {/* Aggregate sonuç kutusu */}
          {data.aggregate && (
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-purple-300">
                  Benzer {data.aggregate.sample_size} dönemin 30 günlük sonucu
                </p>
                <span className="text-[10px] text-zinc-500">
                  Ort. benzerlik %{(data.aggregate.avg_similarity * 100).toFixed(1)}
                </span>
              </div>
              <OutcomeBar agg={data.aggregate} />
              {data.aggregate.median_90d != null && (
                <p className="text-[11px] text-zinc-500">
                  90 günlük ortanca: <span className={cn("font-semibold", pctColor(data.aggregate.median_90d))}>
                    {fmtPct(data.aggregate.median_90d)}
                  </span>
                </p>
              )}
            </div>
          )}

          {/* Eşleşme tablosu */}
          {data.matches.length > 0 && (
            <div>
              {/* Tablo başlığı */}
              <div className="grid grid-cols-[32px_100px_1fr_1fr_1fr_1fr] gap-2
                              text-[10px] text-zinc-600 font-semibold uppercase tracking-wider
                              pb-2 border-b border-zinc-800">
                <span className="text-center">#</span>
                <span>Tarih</span>
                <span className="text-center">Benzerlik</span>
                <span className="text-center">5 Gün</span>
                <span className="text-center">30 Gün</span>
                <span className="text-center">90 Gün</span>
              </div>
              {data.matches.map((m, i) => (
                <MatchRow key={m.date} m={m} rank={i + 1} />
              ))}
            </div>
          )}

          {/* Uyarı */}
          <div className="flex items-start gap-2 pt-1">
            <AlertTriangle className="w-3.5 h-3.5 text-zinc-700 shrink-0 mt-0.5" />
            <p className="text-[10px] text-zinc-700 leading-relaxed">
              Teknik örüntü benzerliğine dayalıdır. Geçmiş performans gelecek sonuçların garantisi değildir.
              Makroekonomik bağlam ve haberleri dikkate alarak değerlendirin.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
