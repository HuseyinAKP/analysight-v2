"use client";
import { SocialSignal } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Users, TrendingUp, AlertTriangle, Hash } from "lucide-react";

function Meter({ label, value, max = 100, color }: { label: string; value: number; max?: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] text-gray-500 mb-1">
        <span>{label}</span>
        <span className="font-mono">{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(value / max * 100, 100)}%` }} />
      </div>
    </div>
  );
}

export function SocialPanel({ data }: { data: SocialSignal }) {
  const highCoord = data.coordination_score > 0.25;
  const sentClr =
    data.sentiment.color === "green" ? "text-emerald-400" :
    data.sentiment.color === "light-green" ? "text-emerald-300" :
    data.sentiment.color === "red" ? "text-red-400" : "text-gray-400";

  const isMock = !data.data_source || data.data_source.includes("simüle") || data.data_source.includes("mock") || data.data_source.includes("Mock");

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-gray-300">Sosyal Sinyal</h2>
        </div>
        <div className="flex items-center gap-2">
          {isMock && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
              ⚠ Simüle Veri
            </span>
          )}
          {highCoord && (
            <span className="flex items-center gap-1 text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" /> Bot Riski
            </span>
          )}
        </div>
      </div>

      {isMock && (
        <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2">
          <p className="text-[11px] text-amber-400/80 leading-relaxed">
            Sosyal veriler şu an simüle edilmiş değerler gösteriyor. X/Twitter API entegrasyonu aktif edildiğinde gerçek zamanlı sosyal sinyal akışı sağlanacak.
          </p>
        </div>
      )}

      {/* Mentions */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: "15dk", val: data.mentions.last_15min },
          { label: "1 saat", val: data.mentions.last_1h },
          { label: "Günlük ort.", val: data.mentions.daily_avg },
        ].map(m => (
          <div key={m.label} className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-2.5">
            <p className="text-[10px] text-gray-500 mb-1">{m.label}</p>
            <p className="text-base font-bold font-mono text-white">{m.val.toLocaleString("tr-TR")}</p>
            <p className="text-[9px] text-gray-600">bahsedilme</p>
          </div>
        ))}
      </div>

      {/* Sentiment */}
      <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3">
        <div className="flex justify-between items-center mb-2">
          <p className="text-xs text-gray-400 font-medium">Duygu Analizi</p>
          <span className={cn("text-sm font-semibold", sentClr)}>{data.sentiment.label}</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              data.sentiment.score > 0 ? "bg-emerald-500" : "bg-red-500"
            )}
            style={{ width: `${Math.abs(data.sentiment.score) * 100}%`, marginLeft: data.sentiment.score < 0 ? "auto" : "0" }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-600 mt-1">
          <span>Negatif</span>
          <span>Nötr</span>
          <span>Pozitif</span>
        </div>
      </div>

      {/* Meters */}
      <div className="space-y-2">
        <Meter
          label={`Aktivite Sapması · ${data.deviation_label}`}
          value={Math.min(data.deviation_score, 100)}
          color={data.deviation_score > 60 ? "bg-orange-500" : "bg-blue-500"}
        />
        <Meter
          label={`Koordinasyon / Bot Skoru · ${data.coordination_label}`}
          value={data.coordination_score * 100}
          color={highCoord ? "bg-red-500" : "bg-gray-500"}
        />
        <Meter
          label={`Etkili Hesap Duygusu · ${data.influencer_sentiment.label}`}
          value={Math.abs(data.influencer_sentiment.score) * 100}
          color={data.influencer_sentiment.score > 0 ? "bg-emerald-500" : "bg-red-500"}
        />
      </div>

      {/* Keywords */}
      <div>
        <p className="text-[10px] text-gray-500 mb-2 flex items-center gap-1">
          <Hash className="w-3 h-3" /> Öne Çıkan Kelimeler
        </p>
        <div className="flex flex-wrap gap-1.5">
          {data.top_keywords.map(kw => (
            <span key={kw} className="text-xs bg-gray-800 border border-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
              #{kw}
            </span>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-gray-700">{data.data_source}</p>
    </div>
  );
}
