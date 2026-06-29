"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  GitCompare, TrendingUp, TrendingDown, AlertTriangle, Info,
  ChevronDown, ChevronUp, Newspaper, BarChart2, Tag,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Kategori → renk
const CAT_COLORS: Record<string, string> = {
  "Kur Krizi":               "bg-orange-500/15 text-orange-300 border-orange-500/25",
  "Merkez Bankası":          "bg-blue-500/15 text-blue-300 border-blue-500/25",
  "Jeopolitik / Çatışma":   "bg-red-500/15 text-red-300 border-red-500/25",
  "Enerji Şoku":             "bg-yellow-500/15 text-yellow-300 border-yellow-500/25",
  "Salgın / Sağlık":        "bg-purple-500/15 text-purple-300 border-purple-500/25",
  "Seçim / Siyaset":        "bg-indigo-500/15 text-indigo-300 border-indigo-500/25",
  "Bilanço Sürprizi":       "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  "Temettü / Bedelsiz":     "bg-teal-500/15 text-teal-300 border-teal-500/25",
  "Yönetim Değişikliği":    "bg-zinc-500/15 text-zinc-300 border-zinc-500/25",
  "Endeks Girişi / Çıkışı": "bg-sky-500/15 text-sky-300 border-sky-500/25",
  "Kredi Notu":             "bg-amber-500/15 text-amber-300 border-amber-500/25",
  "Manipülasyon / SPK":     "bg-rose-500/15 text-rose-300 border-rose-500/25",
  "Genel Piyasa":           "bg-zinc-700/30 text-zinc-400 border-zinc-700/30",
};

function CatBadge({ cat }: { cat: string }) {
  const cls = CAT_COLORS[cat] ?? "bg-zinc-700/30 text-zinc-400 border-zinc-700/30";
  return (
    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border", cls)}>
      {cat}
    </span>
  );
}

type Match = {
  date: string;
  similarity: number;
  day_return: number;
  post_5d: number | null;
  post_30d: number | null;
  post_90d: number | null;
  event_categories: string[];
  headlines: string[];
  macro_data: { title: string; source: string; date: string }[];
  data_sources: string[];
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
    active_event_categories: string[];
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
  const hasDetail = (m.headlines?.length > 0) || (m.macro_data?.length > 0);

  return (
    <div className="border-b border-zinc-800/60 last:border-0">
      {/* Ana satır */}
      <div
        className={cn(
          "grid gap-2 items-start py-3 px-1 -mx-1 rounded-lg",
          "grid-cols-[28px_90px_1fr_52px_52px_52px_16px]",
          hasDetail && "cursor-pointer hover:bg-zinc-800/20",
        )}
        onClick={() => hasDetail && setOpen(o => !o)}
      >
        <span className="text-zinc-700 font-mono text-[11px] text-center pt-0.5">#{rank}</span>

        <div>
          <span className="text-zinc-300 font-mono text-xs">{m.date}</span>
          <span className={cn("block text-[10px] font-semibold mt-0.5",
            m.day_return >= 0 ? "text-emerald-400" : "text-red-400")}>
            {m.day_return >= 0 ? "+" : ""}{m.day_return.toFixed(1)}%
          </span>
        </div>

        <div className="space-y-1">
          {/* Benzerlik */}
          <span className={cn("text-xs font-bold", simColor(m.similarity))}>
            %{(m.similarity * 100).toFixed(1)}
            <span className="ml-1 text-[10px] font-normal opacity-60">{simLabel(m.similarity)}</span>
          </span>
          {/* Kategori etiketleri */}
          {m.event_categories?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {m.event_categories.slice(0, 3).map(cat => (
                <CatBadge key={cat} cat={cat} />
              ))}
              {m.event_categories.length > 3 && (
                <span className="text-[10px] text-zinc-600">+{m.event_categories.length - 3}</span>
              )}
            </div>
          )}
        </div>

        <span className={cn("font-mono text-xs text-center font-semibold pt-0.5", pctColor(m.post_5d))}>
          {fmtPct(m.post_5d)}
        </span>
        <span className={cn("font-mono text-xs text-center font-semibold pt-0.5", pctColor(m.post_30d))}>
          {fmtPct(m.post_30d)}
        </span>
        <span className={cn("font-mono text-xs text-center font-semibold pt-0.5", pctColor(m.post_90d))}>
          {fmtPct(m.post_90d)}
        </span>

        {hasDetail ? (
          open
            ? <ChevronUp className="w-3.5 h-3.5 text-zinc-600 mt-0.5" />
            : <ChevronDown className="w-3.5 h-3.5 text-zinc-700 mt-0.5" />
        ) : <span />}
      </div>

      {/* Genişletilmiş detay */}
      {open && (
        <div className="pb-4 px-1 space-y-3">
          {/* Haber başlıkları */}
          {m.headlines?.length > 0 && (
            <div className="bg-zinc-800/30 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-2">
                <Newspaper className="w-3 h-3" />O Günün Haberleri
                {m.data_sources?.length > 0 && (
                  <span className="text-zinc-700 font-normal normal-case tracking-normal ml-1">
                    ({m.data_sources.join(", ")})
                  </span>
                )}
              </div>
              {m.headlines.map((h, i) => (
                <p key={i} className="text-xs text-zinc-300 flex items-start gap-1.5">
                  <span className="text-zinc-600 shrink-0 mt-0.5">•</span>
                  {h}
                </p>
              ))}
            </div>
          )}

          {/* FRED makro verisi */}
          {m.macro_data?.length > 0 && (
            <div className="bg-zinc-800/20 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-2">
                <BarChart2 className="w-3 h-3" />Makro Göstergeler (FRED)
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {m.macro_data.map((d, i) => (
                  <p key={i} className="text-[11px] text-zinc-400">{d.title}</p>
                ))}
              </div>
            </div>
          )}

          {/* Tüm kategoriler */}
          {m.event_categories?.length > 3 && (
            <div className="flex flex-wrap gap-1 pt-1">
              <Tag className="w-3 h-3 text-zinc-600 mt-0.5" />
              {m.event_categories.map(cat => (
                <CatBadge key={cat} cat={cat} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sonuç dağılım barı ────────────────────────────────────────────────────────
function OutcomeBar({ agg }: { agg: Aggregate }) {
  const range = agg.bull_30d - agg.bear_30d;
  const medPct = range > 0 ? ((agg.median_30d - agg.bear_30d) / range * 100) : 50;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
        <span className="text-red-400">{fmtPct(agg.bear_30d)} (kötü)</span>
        <span className="text-zinc-400">Ortanca: {fmtPct(agg.median_30d)}</span>
        <span className="text-emerald-400">{fmtPct(agg.bull_30d)} (iyi)</span>
      </div>
      <div className="relative h-3 bg-zinc-800 rounded-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/40 via-zinc-700 to-emerald-500/40 rounded-full" />
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
              Teknik durum + olay kategorisi birlikte karşılaştırılıyor
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold bg-purple-500/15 border border-purple-500/25
                         text-purple-400 px-2 py-1 rounded-full shrink-0">
          HEI · Beta
        </span>
      </div>

      {isLoading && (
        <div className="space-y-3">
          <div className="h-16 bg-zinc-800 rounded-xl animate-pulse" />
          {[1, 2, 3].map(i => <div key={i} className="h-10 bg-zinc-800/60 rounded-lg animate-pulse" />)}
        </div>
      )}

      {isError && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 text-center">
          <p className="text-sm text-red-400">Örüntü analizi yapılamadı.</p>
        </div>
      )}

      {data && !isLoading && (
        <>
          {/* Mevcut durum */}
          {data.current_state && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  {
                    label: "RSI",
                    value: `${data.current_state.rsi}`,
                    color: data.current_state.rsi > 70 ? "text-red-400"
                         : data.current_state.rsi < 30 ? "text-emerald-400" : "text-zinc-300",
                  },
                  {
                    label: "MACD",
                    value: data.current_state.macd_direction,
                    color: data.current_state.macd_direction === "pozitif" ? "text-emerald-400" : "text-red-400",
                  },
                  {
                    label: "EMA200'e göre",
                    value: `${data.current_state.price_vs_ema200_pct >= 0 ? "+" : ""}${data.current_state.price_vs_ema200_pct}%`,
                    color: data.current_state.price_vs_ema200_pct >= 0 ? "text-emerald-400" : "text-red-400",
                  },
                  {
                    label: "20g Momentum",
                    value: `${data.current_state.momentum_20d >= 0 ? "+" : ""}${data.current_state.momentum_20d}%`,
                    color: data.current_state.momentum_20d >= 0 ? "text-emerald-400" : "text-red-400",
                  },
                ].map(s => (
                  <div key={s.label} className="bg-zinc-800/50 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-zinc-500 mb-1">{s.label}</p>
                    <p className={cn("text-sm font-bold", s.color)}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Bugünkü aktif olay kategorileri */}
              {data.current_state.active_event_categories?.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap bg-zinc-800/30 rounded-xl px-3 py-2">
                  <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide shrink-0">
                    Bugün aktif:
                  </span>
                  {data.current_state.active_event_categories.map(cat => (
                    <CatBadge key={cat} cat={cat} />
                  ))}
                </div>
              )}
            </div>
          )}

          {data.note && !data.matches.length && (
            <div className="bg-zinc-800/40 border border-zinc-700 rounded-xl p-4 flex items-center gap-3">
              <Info className="w-4 h-4 text-zinc-500 shrink-0" />
              <p className="text-xs text-zinc-400">{data.note}</p>
            </div>
          )}

          {/* Aggregate sonuç */}
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
                  90 günlük ortanca:{" "}
                  <span className={cn("font-semibold", pctColor(data.aggregate.median_90d))}>
                    {fmtPct(data.aggregate.median_90d)}
                  </span>
                </p>
              )}
            </div>
          )}

          {/* Eşleşme tablosu */}
          {data.matches.length > 0 && (
            <div>
              <div className="grid gap-2 text-[10px] text-zinc-600 font-semibold uppercase tracking-wider
                              pb-2 border-b border-zinc-800
                              grid-cols-[28px_90px_1fr_52px_52px_52px_16px]">
                <span className="text-center">#</span>
                <span>Tarih</span>
                <span>Benzerlik / Olay</span>
                <span className="text-center">5G</span>
                <span className="text-center">30G</span>
                <span className="text-center">90G</span>
                <span />
              </div>
              {data.matches.map((m, i) => (
                <MatchRow key={m.date} m={m} rank={i + 1} />
              ))}
            </div>
          )}

          <div className="flex items-start gap-2 pt-1">
            <AlertTriangle className="w-3.5 h-3.5 text-zinc-700 shrink-0 mt-0.5" />
            <p className="text-[10px] text-zinc-700 leading-relaxed">
              Teknik örüntü ve olay kategorisi benzerliğine dayalıdır.
              Geçmiş performans gelecek sonuçların garantisi değildir.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
