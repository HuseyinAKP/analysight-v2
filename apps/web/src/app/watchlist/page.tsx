"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useWatchlist } from "@/hooks/useWatchlist";
import {
  Star, Plus, X, RefreshCw, Sparkles, TrendingUp, TrendingDown,
  Newspaper, Zap, Activity, AlertTriangle, BarChart3, Search,
  ChevronRight, Bell,
} from "lucide-react";

import { API_BASE } from "@/lib/api";
const API = API_BASE;

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeedItem {
  id: string;
  type: "price_move" | "signal" | "news" | "ai_summary";
  symbol: string;
  name: string;
  title: string;
  body: string;
  badge?: string;
  badge_color?: string;
  icon?: string;
  urgent?: boolean;
  source?: string;
  minutes_ago: number;
}

interface SymbolMetric {
  symbol: string;
  name: string;
  market: string;
  price: number;
  change_pct: number;
  rsi: number;
  score: number;
  signal: string;
  signal_color: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(min: number): string {
  if (min < 1)  return "şimdi";
  if (min < 60) return `${Math.round(min)}dk`;
  const h = Math.floor(min / 60);
  if (h < 24)   return `${h}s`;
  return `${Math.floor(h / 24)}g`;
}

const BADGE_STYLES: Record<string, string> = {
  green:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  red:    "bg-red-500/15 text-red-400 border-red-500/30",
  yellow: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  gray:   "bg-zinc-800 text-zinc-400 border-zinc-700",
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  price_move: <TrendingUp className="w-3.5 h-3.5" />,
  signal:     <Zap className="w-3.5 h-3.5" />,
  news:       <Newspaper className="w-3.5 h-3.5" />,
  ai_summary: <Sparkles className="w-3.5 h-3.5" />,
};
const TYPE_COLORS: Record<string, string> = {
  price_move: "bg-blue-500/10 text-blue-400",
  signal:     "bg-violet-500/10 text-violet-400",
  news:       "bg-zinc-700 text-zinc-400",
  ai_summary: "bg-violet-500/10 text-violet-400",
};

// ── Feed Card ─────────────────────────────────────────────────────────────────

function FeedCard({ item }: { item: FeedItem }) {
  return (
    <div className={cn(
      "bg-zinc-900 border rounded-2xl p-4 transition-all hover:border-zinc-600",
      item.urgent ? "border-zinc-600" : "border-zinc-800"
    )}>
      <div className="flex items-start gap-3">
        {/* Symbol avatar */}
        <Link href={`/symbol/${item.symbol}`}
          className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 hover:border-zinc-500 transition-colors">
          <span className="text-xs font-bold text-white">{item.symbol.slice(0, 3)}</span>
        </Link>

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Link href={`/symbol/${item.symbol}`}
              className="text-sm font-bold text-white hover:text-blue-400 transition-colors">
              {item.symbol}
            </Link>
            <span className="text-xs text-zinc-600">{item.name}</span>
            <span className="ml-auto text-[10px] text-zinc-600 shrink-0">{timeAgo(item.minutes_ago)}</span>
          </div>

          {/* Type badge */}
          <div className="flex items-center gap-2 mb-2">
            <span className={cn("flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md", TYPE_COLORS[item.type])}>
              {TYPE_ICONS[item.type]}
              {item.type === "price_move" ? "Fiyat Hareketi" :
               item.type === "signal"     ? "Teknik Sinyal" :
               item.type === "news"       ? "Haber" : "AI Özet"}
            </span>
            {item.urgent && (
              <span className="flex items-center gap-0.5 text-[10px] font-bold text-orange-400">
                <AlertTriangle className="w-3 h-3" /> Dikkat
              </span>
            )}
          </div>

          {/* Content */}
          <p className="text-sm font-semibold text-zinc-200 leading-snug mb-1">{item.title}</p>
          <p className="text-xs text-zinc-500 leading-relaxed">{item.body}</p>

          {/* Footer */}
          <div className="flex items-center gap-2 mt-2.5">
            {item.badge && (
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", BADGE_STYLES[item.badge_color ?? "gray"])}>
                {item.badge}
              </span>
            )}
            {item.source && <span className="text-[10px] text-zinc-600">{item.source}</span>}
            <Link href={`/symbol/${item.symbol}`}
              className="ml-auto flex items-center gap-1 text-[10px] text-zinc-600 hover:text-blue-400 transition-colors">
              Detaylı analiz <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Symbol Row (sidebar) ──────────────────────────────────────────────────────

function SymbolRow({ metric, onRemove, active, onClick }: {
  metric: SymbolMetric;
  onRemove: (s: string) => void;
  active: boolean;
  onClick: () => void;
}) {
  const up = metric.change_pct >= 0;
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all group",
        active ? "bg-zinc-800 border border-zinc-700" : "hover:bg-zinc-800/50"
      )}>
      <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-white">{metric.symbol.slice(0, 3)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-white truncate">{metric.symbol}</span>
          <span className={cn("text-xs font-bold tabular-nums", up ? "text-emerald-400" : "text-red-400")}>
            {up ? "+" : ""}{metric.change_pct.toFixed(2)}%
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn(
            "text-[9px] font-bold px-1.5 py-0.5 rounded-full border",
            metric.signal_color === "green"  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
            metric.signal_color === "yellow" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" :
            "bg-red-500/10 text-red-400 border-red-500/30"
          )}>{metric.signal}</span>
          <span className="text-[10px] text-zinc-600">RSI {metric.rsi}</span>
        </div>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onRemove(metric.symbol); }}
        className="opacity-0 group-hover:opacity-100 text-zinc-700 hover:text-red-400 transition-all shrink-0">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WatchlistPage() {
  const { symbols, add, remove, mounted } = useWatchlist();
  const [addInput, setAddInput] = useState("");
  const [addError, setAddError] = useState("");
  const [filterSymbol, setFilterSymbol] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [searchFeed, setSearchFeed] = useState("");

  // Metrics query
  const { data: metrics = [], isLoading: metricsLoading, refetch: refetchMetrics } = useQuery<SymbolMetric[]>({
    queryKey: ["watchlist-metrics", symbols.join(",")],
    queryFn: () => symbols.length
      ? fetch(`${API}/api/watchlist/metrics?symbols=${symbols.join(",")}`).then(r => r.json())
      : Promise.resolve([]),
    enabled: mounted && symbols.length > 0,
    refetchInterval: 30_000,
  });

  // Feed query
  const { data: feedData, isLoading: feedLoading, refetch: refetchFeed, dataUpdatedAt } = useQuery({
    queryKey: ["watchlist-feed", symbols.join(",")],
    queryFn: () => symbols.length
      ? fetch(`${API}/api/watchlist/feed?symbols=${symbols.join(",")}`).then(r => r.json())
      : Promise.resolve({ items: [], daily_brief: "", is_claude: false }),
    enabled: mounted && symbols.length > 0,
    refetchInterval: 60_000,
  });

  const feedItems: FeedItem[] = feedData?.items ?? [];
  const dailyBrief: string   = feedData?.daily_brief ?? "";

  const handleAdd = () => {
    const sym = addInput.trim().toUpperCase();
    if (!sym) return;
    if (symbols.includes(sym)) { setAddError("Zaten takiptesin"); return; }
    add(sym);
    setAddInput("");
    setAddError("");
  };

  // Filtered feed
  const displayedItems = feedItems.filter(item => {
    if (filterSymbol && item.symbol !== filterSymbol) return false;
    if (filterType !== "all" && item.type !== filterType) return false;
    if (searchFeed && !item.title.toLowerCase().includes(searchFeed.toLowerCase()) &&
        !item.symbol.toLowerCase().includes(searchFeed.toLowerCase())) return false;
    return true;
  });

  // Stats
  const up   = metrics.filter(m => m.change_pct >= 0).length;
  const down = metrics.filter(m => m.change_pct < 0).length;
  const urgent = feedItems.filter(f => f.urgent).length;

  if (!mounted) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 pb-24">

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
            <h1 className="text-xl font-bold text-white">Takip Listesi</h1>
            {urgent > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30">
                <AlertTriangle className="w-3 h-3" /> {urgent} uyarı
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500">Takip ettiğin hisseler için kişisel akış</p>
        </div>
        <button onClick={() => { refetchFeed(); refetchMetrics(); }}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
          Güncelle
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">

        {/* ── Sol: Takip Listesi ─────────────────────────────────────── */}
        <div className="space-y-3">

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-center">
              <p className="text-base font-bold text-white">{symbols.length}</p>
              <p className="text-[10px] text-zinc-600">Hisse</p>
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-2.5 text-center">
              <p className="text-base font-bold text-emerald-400">{up}</p>
              <p className="text-[10px] text-zinc-600">Yükseliş</p>
            </div>
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-2.5 text-center">
              <p className="text-base font-bold text-red-400">{down}</p>
              <p className="text-[10px] text-zinc-600">Düşüş</p>
            </div>
          </div>

          {/* Add symbol */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <div className="flex gap-2">
              <input
                value={addInput}
                onChange={e => { setAddInput(e.target.value.toUpperCase()); setAddError(""); }}
                onKeyDown={e => e.key === "Enter" && handleAdd()}
                placeholder="THYAO, AAPL…"
                maxLength={12}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-zinc-700 focus:outline-none focus:border-yellow-500 transition-colors"
              />
              <button onClick={handleAdd}
                className="px-3 py-2 bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/25 rounded-lg text-xs font-bold transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {addError && <p className="text-[10px] text-red-400 mt-1.5">{addError}</p>}
          </div>

          {/* Symbol list */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold">Hisseler</span>
              {filterSymbol && (
                <button onClick={() => setFilterSymbol(null)}
                  className="text-[10px] text-blue-400 hover:text-white transition-colors">
                  Tümünü göster
                </button>
              )}
            </div>
            <div className="p-2 space-y-0.5">
              {metricsLoading && symbols.length > 0 ? (
                <div className="space-y-2 p-2">
                  {symbols.map(s => (
                    <div key={s} className="h-12 bg-zinc-800 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : metrics.length > 0 ? (
                metrics.map(m => (
                  <SymbolRow
                    key={m.symbol}
                    metric={m}
                    onRemove={remove}
                    active={filterSymbol === m.symbol}
                    onClick={() => setFilterSymbol(prev => prev === m.symbol ? null : m.symbol)}
                  />
                ))
              ) : (
                <div className="py-6 text-center text-zinc-700">
                  <Star className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">Henüz hisse eklenmedi</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick links */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-1">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-2">Hızlı Erişim</p>
            {[
              { href: "/portfolio-ai", label: "AI Portföy Analizi", icon: <BarChart3 className="w-3.5 h-3.5" /> },
              { href: "/scanner",      label: "Hisse Tarayıcı",     icon: <Activity className="w-3.5 h-3.5" /> },
              { href: "/news",         label: "Piyasa Haberleri",    icon: <Newspaper className="w-3.5 h-3.5" /> },
            ].map(l => (
              <Link key={l.href} href={l.href}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors text-xs text-zinc-400 hover:text-white">
                <span className="text-zinc-600">{l.icon}</span>
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        {/* ── Sağ: Akış ─────────────────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-4">

          {/* AI Daily Brief */}
          {dailyBrief && (
            <div className="bg-gradient-to-r from-violet-950/40 to-blue-950/40 border border-violet-500/20 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-violet-400" />
                <span className="text-xs font-bold text-violet-300">Bugünkü Özet</span>
                {feedData?.is_claude && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30 font-bold">Claude AI</span>
                )}
                <span className="ml-auto text-[10px] text-zinc-600">
                  {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : ""}
                </span>
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed">{dailyBrief}</p>
            </div>
          )}

          {/* Filter bar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-40">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
              <input
                value={searchFeed}
                onChange={e => setSearchFeed(e.target.value)}
                placeholder="Akışta ara…"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
              />
            </div>

            {/* Type filter */}
            {[
              { id: "all",        label: "Tümü" },
              { id: "signal",     label: "⚡ Sinyal" },
              { id: "price_move", label: "📈 Fiyat" },
              { id: "news",       label: "📰 Haber" },
            ].map(f => (
              <button key={f.id} onClick={() => setFilterType(f.id)}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-xl border font-medium transition-all",
                  filterType === f.id
                    ? "bg-zinc-700 border-zinc-600 text-white"
                    : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                )}>
                {f.label}
              </button>
            ))}

            <span className="text-[10px] text-zinc-700 ml-auto">{displayedItems.length} olay</span>
          </div>

          {/* Feed */}
          {feedLoading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-28 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : displayedItems.length > 0 ? (
            <div className="space-y-3">
              {displayedItems.map(item => <FeedCard key={item.id} item={item} />)}
            </div>
          ) : symbols.length === 0 ? (
            <div className="text-center py-20 text-zinc-700">
              <Star className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="text-base font-semibold text-zinc-600 mb-2">Takip listesi boş</p>
              <p className="text-sm mb-6">Herhangi bir sembol sayfasında "Takip Et" butonuna tıkla<br />veya soldaki alandan sembol ekle.</p>
              <Link href="/scanner"
                className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 rounded-xl text-sm font-bold hover:bg-yellow-500/25 transition-colors">
                <Activity className="w-4 h-4" />
                Tarayıcı ile Hisse Bul
              </Link>
            </div>
          ) : (
            <div className="text-center py-16 text-zinc-700">
              <p className="text-sm">Bu filtre için olay bulunamadı.</p>
              <button onClick={() => { setFilterType("all"); setFilterSymbol(null); setSearchFeed(""); }}
                className="text-xs text-blue-400 mt-2 hover:text-blue-300 transition-colors">
                Filtreleri temizle
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
