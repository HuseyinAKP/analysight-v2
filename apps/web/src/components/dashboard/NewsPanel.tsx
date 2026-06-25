"use client";
import { useState } from "react";
import { NewsItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Newspaper, Clock } from "lucide-react";
import { NewsDrawer } from "@/components/news/NewsDrawer";

// NewsItem (from insights endpoint) is a lighter type — map to NewsArticle shape for drawer
function toArticle(item: NewsItem & Record<string, unknown>) {
  return {
    id: String(item.id ?? item.headline),
    headline: item.headline,
    summary: undefined,
    sentiment: item.sentiment as "positive" | "negative" | "neutral",
    sentiment_label: item.category_label ?? item.sentiment,
    sentiment_color: item.sentiment,
    category: item.category ?? "",
    category_label: item.category_label ?? item.category ?? "",
    impact: item.impact ?? "Orta",
    source: { id: String(item.source ?? ""), name: String(item.source ?? "Kaynak"), color: "#333", logo: "", country: "", language: "", category: "", url: "" },
    published_at: "",
    hours_ago: Number(item.hours_ago ?? 0),
    url: "",
    symbol: item.symbol as string | undefined,
  };
}

const SENTIMENT_CONFIG = {
  positive: { label: "Pozitif", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  negative: { label: "Negatif", cls: "text-red-400 bg-red-500/10 border-red-500/20" },
  neutral:  { label: "Nötr",    cls: "text-gray-400 bg-gray-800 border-gray-700" },
};

const IMPACT_CONFIG: Record<string, { label: string; cls: string }> = {
  high:    { label: "Yüksek Etki", cls: "text-orange-400" },
  Yüksek:  { label: "Yüksek Etki", cls: "text-orange-400" },
  medium:  { label: "Orta Etki",   cls: "text-yellow-400" },
  Orta:    { label: "Orta Etki",   cls: "text-yellow-400" },
  low:     { label: "Düşük Etki",  cls: "text-gray-500" },
  Düşük:   { label: "Düşük Etki",  cls: "text-gray-500" },
};

const CAT_COLORS: Record<string, string> = {
  blue:   "bg-blue-500/15 text-blue-300 border-blue-500/20",
  purple: "bg-purple-500/15 text-purple-300 border-purple-500/20",
  red:    "bg-red-500/15 text-red-300 border-red-500/20",
  orange: "bg-orange-500/15 text-orange-300 border-orange-500/20",
  green:  "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  yellow: "bg-yellow-500/15 text-yellow-300 border-yellow-500/20",
  gray:   "bg-gray-800 text-gray-400 border-gray-700",
};

export function NewsPanel({ items }: { items: NewsItem[] }) {
  const [selected, setSelected] = useState<ReturnType<typeof toArticle> | null>(null);

  const posCount = items.filter(i => i.sentiment === "positive").length;
  const negCount = items.filter(i => i.sentiment === "negative").length;

  return (
    <>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-gray-300">Haber Akışı</h2>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-emerald-400">{posCount} olumlu</span>
            <span className="text-gray-600">·</span>
            <span className="text-red-400">{negCount} olumsuz</span>
          </div>
        </div>

        <div className="space-y-2">
          {items.map((item, i) => {
            const sc = SENTIMENT_CONFIG[item.sentiment as keyof typeof SENTIMENT_CONFIG] ?? SENTIMENT_CONFIG.neutral;
            const ic = IMPACT_CONFIG[item.impact] ?? IMPACT_CONFIG.low;
            const catCls = CAT_COLORS[item.category_color] ?? CAT_COLORS.gray;

            return (
              <button key={i}
                onClick={() => setSelected(toArticle(item as NewsItem & Record<string, unknown>))}
                className="w-full text-left border border-gray-800 rounded-xl p-3 hover:border-blue-500/40 hover:bg-zinc-800/30 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm text-gray-200 leading-snug flex-1">{item.headline}</p>
                  <span className={cn("text-[10px] border px-1.5 py-0.5 rounded-full shrink-0 font-medium", sc.cls)}>
                    {sc.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("text-[10px] border px-1.5 py-0.5 rounded-full font-medium", catCls)}>
                    {item.category_label}
                  </span>
                  <span className={cn("text-[10px] font-medium", ic.cls)}>{ic.label}</span>
                  <span className="ml-auto flex items-center gap-1 text-[10px] text-gray-600">
                    <Clock className="w-2.5 h-2.5" />
                    {item.hours_ago}s önce
                  </span>
                </div>
                {typeof (item as NewsItem & Record<string, string>).typical_effect === "string" && (
                  <p className="text-[10px] text-gray-500 mt-1.5 italic border-t border-gray-800 pt-1.5">
                    📊 {(item as NewsItem & Record<string, string>).typical_effect}
                  </p>
                )}
                <p className="text-[10px] text-blue-400 mt-1">Haberi oku ve AI ile analiz et →</p>
              </button>
            );
          })}
        </div>

        <p className="text-[10px] text-gray-700 text-center">
          Kaynak: Mock / GDELT — Gerçek haber entegrasyonu yakında
        </p>
      </div>

      <NewsDrawer article={selected} onClose={() => setSelected(null)} />
    </>
  );
}
