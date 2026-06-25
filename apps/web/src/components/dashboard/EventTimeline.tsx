"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { AlertTriangle, TrendingUp, TrendingDown, BarChart2, ExternalLink, Calendar, Newspaper, ChevronDown, ChevronUp } from "lucide-react";
import { MacroSnapshot, type MacroData } from "@/components/dashboard/MacroSnapshot";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Tipler ────────────────────────────────────────────────────────────────────
type Anomaly = {
  date: string;
  magnitude: number;
  anomaly_type: string;
  label: string;
  z_score: number;
  volume_confirmed: boolean;
  recovery_days: number | null;
  post_5d: number | null;
  post_30d: number | null;
  post_90d: number | null;
};

type Headline = { title: string; url: string; source: string; date: string };

type Context = {
  headlines: Headline[];
  categories: string[];
  period_summary: string | null;
  data_source: string;
  context_note: string | null;
};

type AnomalyDetail = Anomaly & { context: Context; macro?: MacroData };

// ── Yardımcılar ───────────────────────────────────────────────────────────────
const typeColor = (type: string, mag: number) => {
  if (type === "flash_crash") return "border-red-500/40 bg-red-500/5";
  if (type === "surge")       return "border-emerald-500/40 bg-emerald-500/5";
  return mag > 0 ? "border-blue-500/30 bg-blue-500/5" : "border-amber-500/30 bg-amber-500/5";
};

const typeIcon = (type: string, mag: number) => {
  if (type === "flash_crash") return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
  if (type === "surge")       return <TrendingUp   className="w-3.5 h-3.5 text-emerald-400" />;
  return <BarChart2 className="w-3.5 h-3.5 text-blue-400" />;
};

const magColor = (v: number) => v >= 0 ? "text-emerald-400" : "text-red-400";
const fmtPct   = (v: number | null) => v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

const SOURCE_LABEL: Record<string, string> = {
  newsapi:        "NewsAPI",
  gdelt:          "GDELT",
  "newsapi+gdelt":"NewsAPI + GDELT",
  wikipedia:      "Wikipedia (dönem özeti)",
  none:           "Haber bulunamadı",
};

// ── Bağlam paneli (lazy yüklenir) ─────────────────────────────────────────────
function ContextPanel({ symbol, anomaly }: { symbol: string; anomaly: Anomaly }) {
  const { data, isLoading } = useQuery<AnomalyDetail>({
    queryKey: ["hei-detail", symbol, anomaly.date],
    queryFn: () =>
      fetch(`${API}/api/hei/${symbol}/anomalies/${anomaly.date}`)
        .then(r => r.json()),
    staleTime: 86400_000,
  });

  if (isLoading) return (
    <div className="space-y-2 p-4">
      {[1,2,3].map(i => <div key={i} className="h-3 bg-zinc-800 rounded animate-pulse" />)}
    </div>
  );

  const ctx   = data?.context;
  const macro = data?.macro;
  if (!ctx) return <p className="text-xs text-zinc-600 p-4">Bağlam verisi alınamadı.</p>;

  return (
    <div className="p-4 space-y-4 border-t border-zinc-800">

      {/* Kategoriler */}
      {ctx.categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {ctx.categories.map(c => (
            <span key={c} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400">
              {c}
            </span>
          ))}
        </div>
      )}

      {/* Dönem özeti (2013 öncesi) */}
      {ctx.period_summary && (
        <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg p-3">
          <p className="text-[10px] font-semibold text-amber-400 mb-1">Dönem Bağlamı</p>
          <p className="text-xs text-zinc-400 leading-relaxed">{ctx.period_summary}</p>
          {ctx.context_note && (
            <p className="text-[10px] text-zinc-600 mt-2">{ctx.context_note}</p>
          )}
        </div>
      )}

      {/* Haberler */}
      {ctx.headlines.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
            <Newspaper className="w-3 h-3" /> O Dönemde
            <span className="font-normal normal-case text-zinc-700 ml-1">
              Kaynak: {SOURCE_LABEL[ctx.data_source] ?? ctx.data_source}
            </span>
          </p>
          {ctx.headlines.map((h, i) => (
            <a key={i} href={h.url} target="_blank" rel="noopener noreferrer"
              className="flex items-start justify-between gap-2 group hover:bg-zinc-800/60 rounded-lg p-2 -mx-2 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-300 leading-snug group-hover:text-white transition-colors line-clamp-2">
                  {h.title}
                </p>
                <p className="text-[10px] text-zinc-600 mt-0.5">{h.source} · {h.date}</p>
              </div>
              <ExternalLink className="w-3 h-3 text-zinc-700 group-hover:text-zinc-400 shrink-0 mt-0.5 transition-colors" />
            </a>
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-600">Bu tarihe ait haber bulunamadı.</p>
      )}

      {/* Makro anlık görüntü */}
      {macro && (
        <div className="pt-2 border-t border-zinc-800/60">
          <MacroSnapshot macro={macro} />
        </div>
      )}

      {/* Sonraki dönem getirisi */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-800/60">
        {[
          { label: "5 Gün Sonra",  val: anomaly.post_5d },
          { label: "30 Gün Sonra", val: anomaly.post_30d },
          { label: "90 Gün Sonra", val: anomaly.post_90d },
        ].map(({ label, val }) => (
          <div key={label} className="bg-zinc-800/50 rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-zinc-600 mb-1">{label}</p>
            <p className={cn("text-sm font-bold font-mono", val == null ? "text-zinc-700" : magColor(val))}>
              {fmtPct(val)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tek anomali kartı ─────────────────────────────────────────────────────────
function AnomalyCard({ anomaly, symbol }: { anomaly: Anomaly; symbol: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn("rounded-xl border transition-all", typeColor(anomaly.anomaly_type, anomaly.magnitude))}>
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full text-left p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 shrink-0">
              {typeIcon(anomaly.anomaly_type, anomaly.magnitude)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-semibold text-white">{anomaly.label}</span>
                {anomaly.volume_confirmed && (
                  <span className="text-[10px] bg-zinc-800 border border-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded-full">
                    Hacim onaylı
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                  <Calendar className="w-3 h-3" /> {anomaly.date}
                </span>
                {anomaly.recovery_days && (
                  <span className="text-[11px] text-zinc-600">
                    {anomaly.recovery_days}g'de toparlandı
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className={cn("text-lg font-bold font-mono", magColor(anomaly.magnitude))}>
              {anomaly.magnitude >= 0 ? "+" : ""}{anomaly.magnitude.toFixed(1)}%
            </span>
            {expanded
              ? <ChevronUp className="w-4 h-4 text-zinc-600" />
              : <ChevronDown className="w-4 h-4 text-zinc-600" />
            }
          </div>
        </div>
      </button>

      {expanded && <ContextPanel symbol={symbol} anomaly={anomaly} />}
    </div>
  );
}

// ── Ana bileşen ───────────────────────────────────────────────────────────────
export function EventTimeline({ symbol }: { symbol: string }) {
  const [years, setYears] = useState(5);
  const [typeFilter, setTypeFilter] = useState("");

  const { data, isLoading, isError } = useQuery<{ anomalies: Anomaly[]; total: number }>({
    queryKey: ["hei-anomalies", symbol, years, typeFilter],
    queryFn: () =>
      fetch(`${API}/api/hei/${symbol}/anomalies?years=${years}&type_filter=${typeFilter}&min_magnitude=3`)
        .then(r => r.json()),
    staleTime: 3600_000,
  });

  const anomalies = data?.anomalies ?? [];

  return (
    <div className="space-y-4">

      {/* Başlık + filtreler */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Tarihsel Kırılım Noktaları</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            {isLoading ? "Yükleniyor…" : `${data?.total ?? 0} anomali tespit edildi`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Yıl filtresi */}
          {[1, 3, 5].map(y => (
            <button key={y} onClick={() => setYears(y)}
              className={cn("text-xs px-3 py-1.5 rounded-lg border transition-all",
                years === y
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300")}>
              {y} Yıl
            </button>
          ))}
          {/* Tür filtresi */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="text-xs bg-zinc-900 border border-zinc-700 text-zinc-400 rounded-lg px-2.5 py-1.5 cursor-pointer">
            <option value="">Tüm Türler</option>
            <option value="flash_crash">Ani Düşüş</option>
            <option value="surge">Ani Yükseliş</option>
            <option value="slow_trend">Kümülatif Trend</option>
          </select>
        </div>
      </div>

      {/* Uyarı */}
      <div className="flex items-start gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5">
        <AlertTriangle className="w-3.5 h-3.5 text-zinc-600 shrink-0 mt-0.5" />
        <p className="text-[11px] text-zinc-600 leading-relaxed">
          Geçmiş fiyat hareketleri bilgi amaçlıdır. Haber bağlamı GDELT ve NewsAPI'dan otomatik çekilir.
          Geçmiş performans gelecek sonuçların garantisi değildir.
        </p>
      </div>

      {/* Yükleniyor */}
      {isLoading && (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-16 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Hata */}
      {isError && (
        <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-4 text-center">
          <p className="text-sm text-red-400">Tarihsel veri alınamadı.</p>
        </div>
      )}

      {/* Anomali listesi */}
      {!isLoading && !isError && anomalies.length === 0 && (
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6 text-center">
          <p className="text-sm text-zinc-500">Bu dönemde kayda değer anomali bulunamadı.</p>
        </div>
      )}

      {!isLoading && anomalies.map(a => (
        <AnomalyCard key={a.date} anomaly={a} symbol={symbol} />
      ))}

    </div>
  );
}
