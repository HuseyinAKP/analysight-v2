"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import axios from "axios";
import { API_BASE } from "@/lib/api";
import { History, TrendingUp, TrendingDown, Minus, Zap, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface SimilarEvent {
  event_id: number;
  symbol: string;
  date: string;
  change_pct: number;
  direction: "up" | "down";
  similarity: number;
  volume_anomaly: number | null;
  news: { title: string; sentiment: number; themes: string[]; source: string }[];
}

interface ForecastResult {
  similar_events: SimilarEvent[];
  forecast_direction: "up" | "down" | "uncertain";
  forecast_magnitude: number;
  up_probability: number;
  down_probability: number;
  confidence: number;
  reasoning: string;
  news_used?: string[];
}

function DirectionBadge({ dir, pct }: { dir: string; pct: number }) {
  if (dir === "up")
    return (
      <span className="flex items-center gap-1 text-emerald-400 font-semibold text-sm">
        <TrendingUp className="w-3.5 h-3.5" />+{Math.abs(pct).toFixed(1)}%
      </span>
    );
  if (dir === "down")
    return (
      <span className="flex items-center gap-1 text-red-400 font-semibold text-sm">
        <TrendingDown className="w-3.5 h-3.5" />-{Math.abs(pct).toFixed(1)}%
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-zinc-400 text-sm">
      <Minus className="w-3.5 h-3.5" />Belirsiz
    </span>
  );
}

export default function EventForecast({ symbol }: { symbol: string }) {
  const [expanded, setExpanded] = useState<number | null>(null);

  const forecast = useQuery<ForecastResult>({
    queryKey: ["event-forecast", symbol],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/api/events/forecast/${symbol}`);
      return data;
    },
    retry: false,
    staleTime: 1000 * 60 * 15,
  });

  const build = useMutation({
    mutationFn: async () => {
      await axios.post(`${API_BASE}/api/events/build/${symbol}`);
    },
    onSuccess: () => {
      setTimeout(() => forecast.refetch(), 3000);
    },
  });

  if (forecast.isLoading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-zinc-300">Tarihsel Analoji</h3>
        </div>
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-zinc-800 rounded w-3/4" />
          <div className="h-4 bg-zinc-800 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (forecast.isError || !forecast.data?.similar_events?.length) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-zinc-300">Tarihsel Analoji</h3>
          </div>
          <button
            onClick={() => build.mutate()}
            disabled={build.isPending}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", build.isPending && "animate-spin")} />
            {build.isPending ? "Oluşturuluyor..." : "Veri Tabanı Oluştur"}
          </button>
        </div>
        <p className="text-xs text-zinc-500">
          Bu sembol için henüz tarihsel olay veri tabanı oluşturulmamış.
          Butona tıklayarak arka planda oluşturulmasını başlatabilirsin (~5-10 dk).
        </p>
      </div>
    );
  }

  const f = forecast.data;
  const dirColor =
    f.forecast_direction === "up"
      ? "text-emerald-400"
      : f.forecast_direction === "down"
      ? "text-red-400"
      : "text-zinc-400";

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-zinc-300">Tarihsel Analoji</h3>
          <span className="text-xs text-zinc-600">{f.similar_events.length} benzer olay</span>
        </div>
        <button
          onClick={() => forecast.refetch()}
          className="text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tahmin özeti */}
      <div className={cn(
        "rounded-xl p-4 border",
        f.forecast_direction === "up"
          ? "bg-emerald-500/5 border-emerald-500/20"
          : f.forecast_direction === "down"
          ? "bg-red-500/5 border-red-500/20"
          : "bg-zinc-800/50 border-zinc-700",
      )}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-zinc-500 mb-1">Tarihsel Analoji Tahmini</p>
            <div className={cn("text-2xl font-bold", dirColor)}>
              {f.forecast_direction === "up" && "↑ Yükseliş"}
              {f.forecast_direction === "down" && "↓ Düşüş"}
              {f.forecast_direction === "uncertain" && "→ Belirsiz"}
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              ±{f.forecast_magnitude}% tahmini hareket
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold text-zinc-100">{f.confidence}%</div>
            <p className="text-xs text-zinc-500">güven</p>
          </div>
        </div>

        {/* Up/Down bar */}
        <div className="mt-3 space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-emerald-400 w-12">↑ {f.up_probability}%</span>
            <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all"
                style={{ width: `${f.up_probability}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-red-400 w-12">↓ {f.down_probability}%</span>
            <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
              <div
                className="bg-red-500 h-1.5 rounded-full transition-all"
                style={{ width: `${f.down_probability}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Gerekçe */}
      <p className="text-xs text-zinc-500 leading-relaxed">{f.reasoning}</p>

      {/* Kullanılan haberler */}
      {f.news_used && f.news_used.length > 0 && (
        <div>
          <p className="text-xs text-zinc-600 mb-1.5">Analiz edilen güncel haberler:</p>
          <ul className="space-y-1">
            {f.news_used.map((title, i) => (
              <li key={i} className="text-xs text-zinc-400 flex items-start gap-1.5">
                <span className="text-zinc-600 mt-0.5 shrink-0">•</span>
                {title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Benzer geçmiş olaylar */}
      <div>
        <p className="text-xs font-medium text-zinc-400 mb-2">Benzer Geçmiş Olaylar</p>
        <div className="space-y-2">
          {f.similar_events.map((ev, i) => (
            <div key={ev.event_id} className="bg-zinc-800/50 rounded-lg border border-zinc-800">
              <button
                className="w-full flex items-center justify-between p-3 text-left"
                onClick={() => setExpanded(expanded === i ? null : i)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500 w-20 shrink-0">{ev.date}</span>
                  <DirectionBadge dir={ev.direction} pct={ev.change_pct} />
                  {ev.volume_anomaly && ev.volume_anomaly > 2 && (
                    <span className="text-xs text-amber-400 flex items-center gap-0.5">
                      <Zap className="w-3 h-3" />Hacim
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">
                    {(ev.similarity * 100).toFixed(0)}% benzer
                  </span>
                  {expanded === i
                    ? <ChevronUp className="w-3.5 h-3.5 text-zinc-600" />
                    : <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />}
                </div>
              </button>

              {expanded === i && ev.news.length > 0 && (
                <div className="px-3 pb-3 space-y-1.5 border-t border-zinc-800/50">
                  {ev.news.map((n, j) => (
                    <div key={j} className="text-xs text-zinc-400 flex items-start gap-1.5 pt-1.5">
                      <span className={cn(
                        "shrink-0 mt-0.5 font-bold",
                        n.sentiment > 0 ? "text-emerald-600" : n.sentiment < 0 ? "text-red-600" : "text-zinc-600",
                      )}>
                        {n.sentiment > 0 ? "+" : ""}{n.sentiment?.toFixed(1)}
                      </span>
                      <span>{n.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
