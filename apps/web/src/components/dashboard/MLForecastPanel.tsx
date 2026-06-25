"use client";
import { MLForecast } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Brain, Zap, BarChart2 } from "lucide-react";

const confidenceColor = (c: string) =>
  c === "Yüksek" ? "text-emerald-400" : c === "Orta" ? "text-yellow-400" : "text-gray-400";

const probColor = (p: number) =>
  p >= 60 ? "bg-emerald-500" : p >= 50 ? "bg-blue-500" : p >= 40 ? "bg-yellow-500" : "bg-red-500";

const probTextColor = (p: number) =>
  p >= 60 ? "text-emerald-400" : p >= 50 ? "text-blue-400" : p >= 40 ? "text-yellow-400" : "text-red-400";

// Özellik adlarını Türkçeleştir
const FEAT_LABELS: Record<string, string> = {
  rsi14:          "RSI-14",
  rsi7:           "RSI-7",
  rsi_diff:       "RSI Farkı (7-14)",
  macd_hist:      "MACD Histogram",
  macd_hist_sign: "MACD Yönü",
  price_ema20:    "Fiyat / EMA20",
  price_ema50:    "Fiyat / EMA50",
  price_ema200:   "Fiyat / EMA200",
  ema20_50:       "EMA20 / EMA50",
  bb_pos:         "Bollinger Band Pozisyon",
  atr_ratio:      "ATR / Fiyat",
  ret1:           "1G Getiri",
  ret5:           "5G Getiri",
  ret20:          "20G Getiri",
  vol20:          "20G Volatilite",
  vol20_rel:      "Volatilite / Momentum",
  volume_z:       "Hacim Z-Score",
  high_low_ratio: "Gün İçi Aralık",
};

export function MLForecastPanel({ data }: { data: MLForecast }) {
  const isML = data.ml_version === true;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">

      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-gray-300">İstatistiksel Sinyal</h2>
        </div>
        {isML ? (
          <span className="flex items-center gap-1 text-[10px] font-bold
                           text-purple-300 bg-purple-500/15 border border-purple-500/25
                           px-2 py-0.5 rounded-full">
            <Zap className="w-2.5 h-2.5" /> XGBoost
          </span>
        ) : (
          <span className="text-[10px] text-zinc-600 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">
            Heuristik Model
          </span>
        )}
      </div>

      {/* Model açıklaması */}
      <p className="text-[11px] text-zinc-600 leading-relaxed -mt-1">
        {isML
          ? `XGBoost · 25 sembol · 5 yıl geçmiş · 18 özellik${data.trained_at ? ` · Eğitim: ${data.trained_at}` : ""}`
          : "RSI, EMA ve tarihsel volatilite tabanlı sigmoid modeli."}
        {" "}Yatırım tavsiyesi değildir.
      </p>

      {/* Tahmin kartları */}
      <div className="space-y-3">
        {data.forecasts.map(f => (
          <div key={f.horizon_days} className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-300">{f.horizon_days} Gün Tahmini</span>
              <span className={cn("text-xs font-medium", confidenceColor(f.confidence))}>
                {f.confidence} Güven
              </span>
            </div>

            {/* Olasılık barı */}
            <div className="mb-2">
              <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                <span>Yükselme Olasılığı</span>
                <span className={cn("font-mono font-bold", probTextColor(f.up_probability))}>
                  %{f.up_probability}
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-700", probColor(f.up_probability))}
                  style={{ width: `${f.up_probability}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
                <span>Düşüş</span>
                <span>50%</span>
                <span>Yükseliş</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="text-center bg-gray-900/50 rounded-lg p-1.5">
                <p className="text-[10px] text-gray-600 mb-0.5">Beklenen Getiri</p>
                <p className={cn("text-sm font-mono font-bold",
                  f.expected_return_pct >= 0 ? "text-emerald-400" : "text-red-400")}>
                  {f.expected_return_pct >= 0 ? "+" : ""}{f.expected_return_pct}%
                </p>
              </div>
              <div className="text-center bg-gray-900/50 rounded-lg p-1.5">
                <p className="text-[10px] text-gray-600 mb-0.5">Volatilite</p>
                <p className="text-sm font-mono font-bold text-orange-400">±{f.volatility_pct}%</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Top özellikler — sadece XGBoost'ta */}
      {isML && data.top_features && data.top_features.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 space-y-2">
          <div className="flex items-center gap-1.5 mb-1">
            <BarChart2 className="w-3 h-3 text-zinc-500" />
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Modelin En Etkili 5 Özelliği
            </p>
          </div>
          {data.top_features.map((f, i) => {
            const label = FEAT_LABELS[f.feature] ?? f.feature;
            const maxImp = data.top_features![0].importance;
            const barW = Math.round((f.importance / maxImp) * 100);
            return (
              <div key={f.feature} className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-700 w-3 text-right">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[10px] text-zinc-400 truncate">{label}</span>
                    <span className="text-[10px] font-mono text-zinc-600 ml-1 shrink-0">
                      {(f.importance * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500/60 rounded-full"
                      style={{ width: `${barW}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-gray-600 bg-gray-800/50 rounded-lg px-3 py-2 border border-gray-700/50">
        ⚠️ {data.disclaimer} Teknik analiz, haber ve risk verileriyle birlikte yorumlanmalıdır.
      </p>
    </div>
  );
}
