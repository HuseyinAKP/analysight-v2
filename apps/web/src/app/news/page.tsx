"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { newsApi, NewsArticle } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Newspaper, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";
import { NewsDrawer } from "@/components/news/NewsDrawer";

// ── Market tabs ───────────────────────────────────────────────────────────────
type FilterTab = "Tümü" | "ABD" | "BİST" | "Kripto" | "Makro";
const FILTER_TABS: FilterTab[] = ["Tümü", "ABD", "BİST", "Kripto", "Makro"];

const TAB_SOURCE_MAP: Record<FilterTab, string[]> = {
  "Tümü":  [],
  "ABD":   ["bloomberg", "wsj", "cnbc", "seeking_alpha", "reuters"],
  "BİST":  ["hurriyet", "dunya", "bloomberght", "haberturk"],
  "Kripto":["coindesk", "bloomberg", "reuters"],
  "Makro": ["ft", "reuters", "bloomberg", "wsj"],
};

// ── Thumbnail placeholder (colored gradient based on sentiment) ───────────────
function Thumbnail({ sentiment, category }: { sentiment: string; category: string }) {
  const gradients: Record<string, string> = {
    positive: "from-emerald-900/60 to-zinc-900",
    negative: "from-red-900/60 to-zinc-900",
    neutral:  "from-blue-900/60 to-zinc-900",
  };
  const labels: Record<string, string> = {
    earnings: "EPS", macro: "MAKRO", costs: "MALİYET", analyst: "ANALİST",
    regulation: "MEVZUAT", growth: "BÜYÜME", flow: "AKIŞ", dividend: "TEMETTÜ",
    demand: "TALEP", product: "ÜRÜN", corporate: "KURUMSAL", mining: "MADENCİLİK",
    defi: "DeFi", default: "HABER",
  };
  return (
    <div className={cn(
      "w-[72px] h-[72px] rounded-2xl shrink-0 bg-gradient-to-br flex items-center justify-center",
      gradients[sentiment] ?? gradients.neutral
    )}>
      <span className="text-[9px] font-bold text-white/60 tracking-wide">
        {labels[category] ?? labels.default}
      </span>
    </div>
  );
}

// ── Related tickers row ───────────────────────────────────────────────────────
function RelatedTickers({ symbol }: { symbol?: string }) {
  if (!symbol) return null;
  // Mock: add a couple of correlated tickers
  const related: { sym: string; change: number }[] = [
    { sym: symbol, change: Math.random() > 0.5 ? 1.24 : -0.87 },
  ];
  return (
    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
      {related.map(t => (
        <Link key={t.sym} href={`/symbol/${t.sym}`}
          className="flex items-center gap-1 text-xs hover:opacity-80 transition-opacity">
          <span className="font-mono font-bold text-zinc-400">{t.sym}</span>
          <span className={cn("font-bold", t.change >= 0 ? "text-emerald-400" : "text-red-400")}>
            {t.change >= 0 ? "%" : "%-"}{Math.abs(t.change).toFixed(2).replace(".", ",")}
          </span>
        </Link>
      ))}
    </div>
  );
}

// ── Single news item ──────────────────────────────────────────────────────────
function NewsItem({ article, onClick }: { article: NewsArticle; onClick: () => void }) {
  const timeLabel = article.hours_ago < 1
    ? `${Math.round(article.hours_ago * 60)} dakika önce`
    : article.hours_ago < 24
    ? `${Math.floor(article.hours_ago)} saat önce`
    : `${Math.floor(article.hours_ago / 24)} gün önce`;

  return (
    <button onClick={onClick}
      className="w-full text-left flex items-start gap-4 py-4 border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors px-1 rounded-lg group">
      {/* Text block */}
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-zinc-600 mb-1 font-medium">{timeLabel}</div>
        <h3 className="text-sm font-semibold text-zinc-200 leading-snug group-hover:text-white transition-colors line-clamp-3 mb-2">
          {article.headline}
        </h3>
        <RelatedTickers symbol={article.symbol} />
        <p className="text-[10px] text-blue-400 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          Haberi oku ve AI ile analiz et →
        </p>
      </div>

      {/* Thumbnail */}
      <Thumbnail sentiment={article.sentiment} category={article.category} />
    </button>
  );
}

// ── Market mood bar ───────────────────────────────────────────────────────────
function MoodBar({ pos, neg, neu, mood }: { pos: number; neg: number; neu: number; mood: string }) {
  const moodColor = mood === "Olumlu" ? "text-emerald-400" : mood === "Olumsuz" ? "text-red-400" : "text-yellow-400";
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden flex">
        <div className="bg-emerald-400 h-full transition-all" style={{ width: `${pos}%` }} />
        <div className="bg-zinc-600 h-full transition-all" style={{ width: `${neu}%` }} />
        <div className="bg-red-400 h-full transition-all" style={{ width: `${neg}%` }} />
      </div>
      <span className={cn("text-xs font-bold shrink-0", moodColor)}>{mood}</span>
    </div>
  );
}

// ── Source filter chips ───────────────────────────────────────────────────────
function SourceChips({ sources, active, onToggle }: {
  sources: { id: string; name: string; logo: string; color: string }[];
  active: string | null;
  onToggle: (id: string | null) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
      {sources.slice(0, 8).map(src => (
        <button key={src.id}
          onClick={() => onToggle(active === src.id ? null : src.id)}
          className={cn(
            "shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-semibold transition-all",
            active === src.id
              ? "border-blue-500 bg-blue-600/20 text-white"
              : "border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:text-zinc-200"
          )}>
          <span style={{ color: src.color === "#000000" ? "#d4d4d8" : src.color }}>{src.logo}</span>
          {src.name.split(" ")[0]}
        </button>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function NewsPage() {
  const [filterTab, setFilterTab] = useState<FilterTab>("Tümü");
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["news", filterTab, activeSource],
    queryFn: () => newsApi.all({ source: activeSource ?? undefined, limit: 40 }),
    staleTime: 60_000,
  });

  return (
    <div className="max-w-2xl mx-auto pb-16 space-y-0">
      <NewsDrawer article={selectedArticle} onClose={() => setSelectedArticle(null)} />

      {/* Header */}
      <div className="flex items-center justify-between py-4">
        <h1 className="text-xl font-bold text-white">Haberler</h1>
        <button onClick={() => refetch()}
          className={cn("p-2 rounded-full hover:bg-zinc-800 transition-colors", isFetching && "opacity-50")}>
          <RefreshCw className={cn("w-4 h-4 text-zinc-500", isFetching && "animate-spin")} />
        </button>
      </div>

      {/* Market tabs */}
      <div className="flex gap-1 overflow-x-auto pb-3" style={{ scrollbarWidth: "none" }}>
        {FILTER_TABS.map(tab => (
          <button key={tab} onClick={() => setFilterTab(tab)}
            className={cn(
              "shrink-0 text-sm px-4 py-1.5 rounded-full font-medium transition-all",
              filterTab === tab ? "bg-white text-black font-bold" : "text-zinc-400 hover:text-zinc-200"
            )}>
            {tab}
          </button>
        ))}
      </div>

      {/* Mood bar */}
      {data?.stats && (
        <MoodBar pos={data.stats.positive_pct} neg={data.stats.negative_pct}
          neu={data.stats.neutral_pct} mood={data.stats.market_mood} />
      )}

      {/* Source chips */}
      {data?.sources && (
        <div className="py-2">
          <SourceChips
            sources={data.sources}
            active={activeSource}
            onToggle={setActiveSource}
          />
        </div>
      )}

      {/* News feed */}
      <div className="divide-y divide-zinc-800/0">
        {isLoading && Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-4 py-4">
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-zinc-800 rounded w-24 animate-pulse" />
              <div className="h-4 bg-zinc-800 rounded w-full animate-pulse" />
              <div className="h-4 bg-zinc-800 rounded w-3/4 animate-pulse" />
            </div>
            <div className="w-[72px] h-[72px] rounded-2xl bg-zinc-800 animate-pulse shrink-0" />
          </div>
        ))}

        {!isLoading && data?.items.map(article => (
          <NewsItem key={article.id} article={article} onClick={() => setSelectedArticle(article)} />
        ))}

        {!isLoading && data?.items.length === 0 && (
          <div className="text-center py-16 text-zinc-600">
            <Newspaper className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p>Haber bulunamadı</p>
          </div>
        )}
      </div>
    </div>
  );
}
