"use client";
import { WhyChain } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Newspaper, Users } from "lucide-react";

const dirIcon = (d: string) =>
  d === "bullish" ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> :
  d === "bearish" ? <TrendingDown className="w-3.5 h-3.5 text-red-400" /> :
  <Minus className="w-3.5 h-3.5 text-gray-400" />;

const sentimentClass = (s: string) =>
  s === "positive" ? "text-emerald-400" : s === "negative" ? "text-red-400" : "text-gray-400";

const strengthBadge = (s: string) =>
  s === "strong" ? "bg-blue-500/20 text-blue-300 border-blue-500/30" :
  "bg-gray-800 text-gray-400 border-gray-700";

export function WhyPanel({ why }: { why: WhyChain }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-300">Neden / Neden Olabilir</h2>
        {why.conflict_detected && (
          <span className="flex items-center gap-1 text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3" />
            Sinyal Çelişkisi
          </span>
        )}
      </div>

      {/* Neden oldu */}
      <div>
        <p className="text-xs text-gray-500 font-medium mb-2 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full inline-block" />
          Son hareketi neler tetikledi?
        </p>
        <div className="space-y-1.5">
          {why.why_happened.map((item, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-gray-300 bg-gray-800/50 rounded-lg px-3 py-2">
              <span className="mt-0.5 shrink-0 text-blue-400">→</span>
              <span>{item}</span>
            </div>
          ))}
          {why.why_happened.length === 0 && (
            <p className="text-xs text-gray-600 italic">Belirgin bir tetikleyici tespit edilmedi.</p>
          )}
        </div>
      </div>

      {/* Neden olabilir */}
      <div>
        <p className="text-xs text-gray-500 font-medium mb-2 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-purple-400 rounded-full inline-block" />
          Bundan sonra ne olabilir?
        </p>
        <div className="space-y-1.5">
          {why.why_might.map((item, i) => (
            <div key={i} className={cn(
              "flex items-start gap-2 text-sm rounded-lg px-3 py-2",
              item.includes("⚠️")
                ? "bg-orange-500/10 border border-orange-500/20 text-orange-300"
                : "bg-gray-800/50 text-gray-300"
            )}>
              <span className="mt-0.5 shrink-0 text-purple-400">→</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Teknik sinyaller */}
      <div>
        <p className="text-xs text-gray-500 font-medium mb-2">Teknik Sinyaller</p>
        <div className="flex flex-wrap gap-1.5">
          {why.technical_signals.map((s, i) => (
            <div key={i} className={cn(
              "flex items-center gap-1.5 border rounded-full px-2.5 py-1 text-xs",
              strengthBadge(s.strength)
            )}>
              {dirIcon(s.direction)}
              {s.signal}
            </div>
          ))}
        </div>
      </div>

      {/* Haber + Sosyal özet */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/50">
          <p className="text-[10px] text-gray-500 flex items-center gap-1 mb-1.5">
            <Newspaper className="w-3 h-3" /> Haber Nabzı
          </p>
          {why.news_signals.slice(0, 2).map((n, i) => (
            <p key={i} className={cn("text-xs mb-1 truncate", sentimentClass(n.sentiment))}>
              · {n.headline}
            </p>
          ))}
        </div>
        <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/50">
          <p className="text-[10px] text-gray-500 flex items-center gap-1 mb-1.5">
            <Users className="w-3 h-3" /> Sosyal Sinyal
          </p>
          <p className="text-xs text-gray-300 mb-1">Aktivite: {why.social_signal.label}</p>
          <p className="text-xs text-gray-300 mb-1">Duygu: {why.social_signal.sentiment}</p>
          <p className="text-xs text-gray-400">Bot riski: {why.social_signal.coordination}</p>
        </div>
      </div>
    </div>
  );
}
