"use client";
import { EventStudy } from "@/lib/api";
import { cn } from "@/lib/utils";
import { History } from "lucide-react";

export function EventStudyPanel({ data }: { data: EventStudy }) {
  const { stats, direction, current_move_pct } = data;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <History className="w-4 h-4 text-yellow-400" />
        <h2 className="text-sm font-semibold text-gray-300">Geçmiş Olay Analizi</h2>
      </div>

      {/* Current move */}
      <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3">
        <p className="text-xs text-gray-500 mb-1">Mevcut Hareket (5 gün)</p>
        <p className={cn("text-lg font-bold font-mono", current_move_pct >= 0 ? "text-emerald-400" : "text-red-400")}>
          {current_move_pct >= 0 ? "+" : ""}{current_move_pct}%
          <span className="text-sm text-gray-500 ml-2 font-normal">{direction} hareketi</span>
        </p>
      </div>

      {!stats ? (
        <p className="text-xs text-gray-600 italic">Yeterli geçmiş veri bulunamadı.</p>
      ) : (
        <>
          <p className="text-xs text-gray-400">
            Geçmişte <span className="text-white font-semibold">{stats.count}</span> benzer{" "}
            <span className={direction === "yükseliş" ? "text-emerald-400" : "text-red-400"}>{direction}</span>{" "}
            hareketi tespit edildi. Sonraki günlerin istatistikleri:
          </p>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "5 Gün Sonrası", avg: stats.avg_ret5, pos: stats.positive_5d },
              { label: "10 Gün Sonrası", avg: stats.avg_ret10, pos: stats.positive_10d },
              { label: "20 Gün Sonrası", avg: stats.avg_ret20, pos: stats.positive_20d },
            ].map(d => (
              <div key={d.label} className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3 text-center">
                <p className="text-[10px] text-gray-500 mb-2">{d.label}</p>
                <p className={cn("text-sm font-bold font-mono mb-1", d.avg >= 0 ? "text-emerald-400" : "text-red-400")}>
                  {d.avg >= 0 ? "+" : ""}{d.avg}%
                </p>
                <p className="text-[10px] text-gray-500 mb-1.5">ort. getiri</p>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mb-1">
                  <div
                    className={cn("h-full rounded-full", d.pos >= 50 ? "bg-emerald-500" : "bg-red-500")}
                    style={{ width: `${d.pos}%` }}
                  />
                </div>
                <p className="text-[10px] font-mono font-semibold text-gray-300">%{d.pos}</p>
                <p className="text-[9px] text-gray-600">olumlu kapanış</p>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-gray-600 bg-gray-800/50 rounded-lg px-3 py-2 border border-gray-700/50">
            Bu analiz kesin bir tahmin değildir; tarihsel bağlam sağlar.
            Geçmiş performans gelecek sonuçların garantisi değildir.
          </p>
        </>
      )}
    </div>
  );
}
