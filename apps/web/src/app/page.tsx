"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { symbolsApi, newsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  Zap, Search, Bot, Ruler, FileText, Newspaper,
  TrendingUp, TrendingDown, Radio, Target, Eye,
} from "lucide-react";

// ── Greeting ──────────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 5)  return "İyi geceler";
  if (h < 12) return "Günaydın";
  if (h < 18) return "İyi günler";
  return "İyi akşamlar";
}

function formatDate() {
  return new Date().toLocaleDateString("tr-TR", {
    weekday: "long", day: "numeric", month: "long",
  });
}

// ── Watchlist symbols ─────────────────────────────────────────────────────────
const WATCHLIST_SYMBOLS = [
  { symbol: "THYAO",   market: "BIST" },
  { symbol: "GARAN",   market: "BIST" },
  { symbol: "EREGL",   market: "BIST" },
  { symbol: "AAPL",    market: "NYSE" },
  { symbol: "NVDA",    market: "NYSE" },
  { symbol: "MSFT",    market: "NYSE" },
  { symbol: "BTC-USD", market: "Crypto" },
  { symbol: "ETH-USD", market: "Crypto" },
];

// ── Symbol Card ───────────────────────────────────────────────────────────────
interface SymbolData {
  price: number; change_pct: number; name: string;
  market_state?: string;
  premarket_price?: number | null; premarket_change_pct?: number | null;
  afterhours_price?: number | null; afterhours_change_pct?: number | null;
}

function SymbolCard({ symbol, market }: { symbol: string; market: string }) {
  const { data, isLoading } = useQuery<SymbolData>({
    queryKey: ["home-symbol", symbol],
    queryFn: () => symbolsApi.get(symbol) as Promise<SymbolData>,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const up = (data?.change_pct ?? 0) >= 0;
  const extPrice  = data?.premarket_price ?? data?.afterhours_price;
  const extChange = data?.premarket_change_pct ?? data?.afterhours_change_pct;
  const extLabel  = data?.market_state === "pre_market" ? "PRE" : data?.market_state === "after_hours" ? "AH" : null;

  return (
    <Link href={`/symbol/${symbol}`}
      className={cn(
        "flex flex-col gap-1 rounded-2xl border p-4 transition-all hover:scale-[1.02] active:scale-[0.99]",
        up ? "bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40"
           : "bg-red-500/5 border-red-500/20 hover:border-red-500/40"
      )}>
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold text-zinc-600 tracking-wide">{market}</span>
        {isLoading ? (
          <span className="text-[10px] text-zinc-700 font-mono">—</span>
        ) : (
          <span className={cn("text-[11px] font-bold px-1.5 py-0.5 rounded-lg",
            up ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400")}>
            {up ? "+" : ""}{(data?.change_pct ?? 0).toFixed(2)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-sm font-bold text-white">{symbol}</p>
        {data && (
          <p className="text-xs font-mono text-zinc-400">
            {data.price.toLocaleString("tr-TR", { maximumFractionDigits: 4 })}
          </p>
        )}
        {isLoading && <div className="h-3 w-16 bg-zinc-800 rounded animate-pulse mt-0.5" />}
        {extLabel && extPrice && extChange != null && (
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[9px] font-bold bg-amber-500/20 text-amber-400 px-1 rounded">{extLabel}</span>
            <span className="text-[9px] font-mono text-zinc-500">
              {extPrice.toLocaleString("tr-TR", { maximumFractionDigits: 4 })}
            </span>
            <span className={cn("text-[9px] font-mono", extChange >= 0 ? "text-emerald-400" : "text-red-400")}>
              {extChange >= 0 ? "+" : ""}{extChange.toFixed(2)}%
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

// ── Briefing Banner ───────────────────────────────────────────────────────────
function BriefingBanner() {
  const { data, isLoading } = useQuery({
    queryKey: ["home-briefing"],
    queryFn: () => fetch("http://localhost:8000/api/briefing/morning").then(r => r.json()),
    staleTime: 300_000,
  });

  if (isLoading) {
    return <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 animate-pulse h-28" />;
  }
  if (!data) return null;

  const up = data.avg_change >= 0;

  return (
    <Link href="/briefing"
      className="block rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-950/60 to-indigo-950/40 p-5 hover:border-blue-500/40 transition-all group">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded-full">
              Sabah Brifing
            </span>
            <span className="text-[10px] text-zinc-600">{data.date}</span>
            <span className={cn("text-[10px] font-semibold", up ? "text-emerald-400" : "text-red-400")}>
              {up ? <TrendingUp className="inline w-3 h-3" /> : <TrendingDown className="inline w-3 h-3" />}
            </span>
          </div>
          <p className="text-sm text-zinc-200 leading-relaxed line-clamp-2">
            Piyasalar bugün <strong>{data.market_tone}</strong> seyrediyor.
            {data.opportunities?.[0] && (
              <> En öne çıkan fırsat: <strong>{data.opportunities[0].symbol}</strong> (skor {data.opportunities[0].score}/100).</>
            )}
          </p>
        </div>
        <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors text-lg shrink-0">→</span>
      </div>
    </Link>
  );
}

// ── Quick Opportunities ───────────────────────────────────────────────────────
function OpportunityRow() {
  const { data } = useQuery({
    queryKey: ["home-opportunities"],
    queryFn: () => fetch("http://localhost:8000/api/briefing/morning").then(r => r.json()),
    staleTime: 300_000,
  });

  const opps = data?.opportunities?.slice(0, 3) ?? [];
  if (!opps.length) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-300">Fırsat Radarı</h2>
        </div>
        <Link href="/scanner" className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors">
          Tümünü gör →
        </Link>
      </div>
      <div className="space-y-2">
        {opps.map((opp: { symbol: string; name: string; score: number; signal: string; rsi: number; change_pct: number; price: number; currency: string }) => (
          <Link key={opp.symbol} href={`/symbol/${opp.symbol}`}
            className="flex items-center gap-3 rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 hover:border-zinc-700 transition-all group">
            <div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-xs font-bold"
              style={{
                background: `conic-gradient(${opp.score >= 65 ? "#34d399" : opp.score >= 50 ? "#facc15" : "#f97316"} ${opp.score}%, #27272a ${opp.score}%)`,
              }}>
              <div className="w-7 h-7 bg-zinc-900 rounded-full flex items-center justify-center">
                <span className={cn("text-[10px] font-bold",
                  opp.score >= 65 ? "text-emerald-400" : opp.score >= 50 ? "text-yellow-400" : "text-orange-400")}>
                  {opp.score}
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">{opp.symbol}</span>
                <span className="text-[10px] text-zinc-600 truncate">{opp.name}</span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-0.5">RSI {opp.rsi} · {opp.signal}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-mono font-bold text-white">
                {opp.price.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}
              </p>
              <p className={cn("text-[11px] font-mono",
                opp.change_pct >= 0 ? "text-emerald-400" : "text-red-400")}>
                {opp.change_pct >= 0 ? "+" : ""}{opp.change_pct.toFixed(2)}%
              </p>
            </div>
            <span className="text-zinc-700 group-hover:text-zinc-500 transition-colors ml-1">›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── News Feed ─────────────────────────────────────────────────────────────────
function NewsFeed() {
  const { data } = useQuery({
    queryKey: ["home-news"],
    queryFn: () => newsApi.all({ limit: 5 }),
    staleTime: 120_000,
  });

  const items = data?.items ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Newspaper className="w-3.5 h-3.5 text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-300">Son Haberler</h2>
        </div>
        <Link href="/news" className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors">
          Tümü →
        </Link>
      </div>
      <div className="space-y-2">
        {items.length === 0 && (
          <>{[1,2,3].map(i => (
            <div key={i} className="h-14 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
          ))}</>
        )}
        {items.map(item => (
          <div key={item.id}
            className="flex items-start gap-3 rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3">
            <div className={cn("w-2 h-2 rounded-full shrink-0 mt-1.5",
              item.sentiment === "positive" ? "bg-emerald-400" :
              item.sentiment === "negative" ? "bg-red-400" : "bg-zinc-600")} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-300 leading-snug line-clamp-2">{item.headline}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-zinc-600">{item.source?.name}</span>
                <span className="text-[10px] text-zinc-700">·</span>
                <span className="text-[10px] text-zinc-700">{item.hours_ago}s önce</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Quick Action Grid ─────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { href: "/terminal", Icon: Zap,      label: "Terminal",   desc: "Canlı piyasa" },
  { href: "/scanner",  Icon: Search,   label: "Tarayıcı",   desc: "Fırsat ara" },
  { href: "/analyst",  Icon: Bot,      label: "AI Analist", desc: "Analiz yap" },
  { href: "/position", Icon: Ruler,    label: "Pozisyon",   desc: "Risk hesapla" },
  { href: "/briefing", Icon: FileText, label: "Brifing",    desc: "Günlük özet" },
  { href: "/news",     Icon: Newspaper,label: "Haberler",   desc: "Güncel akış" },
];

// ── Social Signal Strip ───────────────────────────────────────────────────────
function SocialSignalStrip() {
  const { data } = useQuery({
    queryKey: ["social-trending"],
    queryFn: () => fetch("http://localhost:8000/api/insights/social/trending?limit=4").then(r => r.json()),
    staleTime: 120_000,
  });

  const items  = data?.trending ?? [];
  const isMock = data?.is_mock ?? true;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-300">Sosyal Sinyal</h2>
          {isMock && (
            <span className="text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded-full">simüle</span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(items.length ? items : [1,2,3,4]).map((s: { symbol?: string; mentions_1h?: number; deviation?: number; sentiment?: string; sentiment_color?: string }, i: number) => (
          s.symbol ? (
            <Link key={s.symbol} href={`/symbol/${s.symbol}`}
              className="flex items-center gap-3 rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2.5 hover:border-zinc-700 transition-all">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                <span className="text-[11px] font-bold text-zinc-500">𝕏</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white">{s.symbol}</p>
                <p className="text-[10px] text-zinc-500">
                  {(s.mentions_1h ?? 0) >= 1000
                    ? `${((s.mentions_1h ?? 0) / 1000).toFixed(1)}K`
                    : s.mentions_1h} bahis/sa
                  {(s.deviation ?? 0) > 5 && <span className="text-emerald-500 ml-1">+{s.deviation}%</span>}
                  {(s.deviation ?? 0) < -5 && <span className="text-red-500 ml-1">{s.deviation}%</span>}
                </p>
              </div>
              <span className={cn("text-[10px] font-medium capitalize",
                s.sentiment_color === "green" ? "text-emerald-400" :
                s.sentiment_color === "red" ? "text-red-400" : "text-yellow-400")}>
                {s.sentiment}
              </span>
            </Link>
          ) : (
            <div key={i} className="h-14 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
          )
        ))}
      </div>
    </div>
  );
}

// ── Why Section ──────────────────────────────────────────────────────────────
const PROBLEMS = [
  {
    icon: "📊",
    title: "Veri Dağınıklığı",
    desc: "Fiyat, haber, sosyal medya, teknik gösterge — 4-5 farklı kaynak, saatler harcanan araştırma.",
    solution: "Hepsi tek ekranda, birbirine bağlı.",
  },
  {
    icon: "🎯",
    title: "Tek Fiyat Yanılgısı",
    desc: '"Biri 200 diyor, biri 180." Tek tahmin belirsizliği gizler, hedef tutmadığında ne yapacağını bilemezsin.',
    solution: "3 senaryo bandı + olasılık + belirsizlik endeksi.",
  },
  {
    icon: "❓",
    title: '"Neden?" Sorusuna Cevap Yok',
    desc: "Hisse %5 düştü, neden? Devam edecek mi? Klasik araçlar fiyatı gösterir, nedeni açıklamaz.",
    solution: "Otomatik neden zinciri: teknik + haber + sosyal birleşik.",
  },
];

const COMPARE_ROWS = [
  { feature: "Senaryo bandı (3 olasılık)",    tv: false, midas: false, matriks: false, us: true  },
  { feature: "Neden / Neden olabilir",         tv: false, midas: false, matriks: false, us: true  },
  { feature: "Sosyal sinyal entegrasyonu",     tv: false, midas: false, matriks: false, us: true  },
  { feature: "Yapay zeka asistanı",            tv: false, midas: false, matriks: false, us: true  },
  { feature: "Geçmiş olay analizi",            tv: false, midas: false, matriks: "kısmen", us: true },
  { feature: "Risk motoru (stop/hedef/R/R)",   tv: "kısmen", midas: true, matriks: "kısmen", us: true },
  { feature: "Haber + teknik birleşimi",       tv: false, midas: false, matriks: "kısmen", us: true },
  { feature: "Sade dilde Türkçe özet",         tv: false, midas: false, matriks: false, us: true  },
];

function Cell({ val }: { val: boolean | string }) {
  if (val === true)  return <span className="text-emerald-400 font-bold">✓</span>;
  if (val === false) return <span className="text-zinc-700">—</span>;
  return <span className="text-amber-500 text-[11px]">{val}</span>;
}

function WhySection() {
  return (
    <div className="space-y-8">
      {/* 3 Problems */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-300 mb-4">Neden Analysight?</h2>
        <div className="space-y-3">
          {PROBLEMS.map(p => (
            <div key={p.title} className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
              <div className="flex items-start gap-3">
                <span className="text-xl shrink-0 mt-0.5">{p.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-white mb-1">{p.title}</p>
                  <p className="text-xs text-zinc-500 leading-relaxed mb-2">{p.desc}</p>
                  <p className="text-xs text-emerald-400 font-medium">→ {p.solution}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Competitor table */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-300 mb-4">Rakiplere Göre</h2>
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-zinc-500 font-medium">Özellik</th>
                <th className="text-center px-3 py-3 text-zinc-500 font-medium whitespace-nowrap">TradingView</th>
                <th className="text-center px-3 py-3 text-zinc-500 font-medium">Midas</th>
                <th className="text-center px-3 py-3 text-zinc-500 font-medium">Matriks</th>
                <th className="text-center px-3 py-3 text-blue-400 font-bold">Analysight</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row, i) => (
                <tr key={row.feature} className={i % 2 === 0 ? "bg-zinc-900" : "bg-zinc-800/30"}>
                  <td className="px-4 py-2.5 text-zinc-300">{row.feature}</td>
                  <td className="px-3 py-2.5 text-center"><Cell val={row.tv} /></td>
                  <td className="px-3 py-2.5 text-center"><Cell val={row.midas} /></td>
                  <td className="px-3 py-2.5 text-center"><Cell val={row.matriks} /></td>
                  <td className="px-3 py-2.5 text-center"><Cell val={row.us} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-zinc-700 mt-2 text-center">
          Analysight grafik platformu değil, karar destek katmanıdır. Veri göstermez, karar üretir.
        </p>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function HomePage() {
  const greeting = getGreeting();
  const router = useRouter();

  // Giriş yapmamış kullanıcıları landing page'e yönlendir
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace("/landing");
    });
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-2xl mx-auto px-4 pt-8 pb-12">

        {/* Greeting */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">{greeting}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{formatDate()} · Piyasalar açık</p>
        </div>

        {/* Briefing banner */}
        <div className="mb-6">
          <BriefingBanner />
        </div>

        {/* Quick actions */}
        <div className="mb-8">
          <div className="grid grid-cols-3 gap-2">
            {QUICK_ACTIONS.map(a => (
              <Link key={a.href} href={a.href}
                className="flex flex-col items-center gap-2 rounded-2xl bg-zinc-900 border border-zinc-800 py-4 px-2 hover:border-zinc-700 hover:bg-zinc-800/60 transition-all active:scale-95">
                <a.Icon className="w-5 h-5 text-zinc-400" />
                <span className="text-xs font-semibold text-white">{a.label}</span>
                <span className="text-[10px] text-zinc-600">{a.desc}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Watchlist */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-zinc-500" />
              <h2 className="text-sm font-semibold text-zinc-300">İzleme Listem</h2>
            </div>
            <button className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors">
              Düzenle
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {WATCHLIST_SYMBOLS.map(({ symbol, market }) => (
              <SymbolCard key={symbol} symbol={symbol} market={market} />
            ))}
          </div>
        </div>

        {/* Opportunities */}
        <div className="mb-8">
          <OpportunityRow />
        </div>

        {/* Social signal */}
        <div className="mb-8">
          <SocialSignalStrip />
        </div>

        {/* News */}
        <div className="mb-8">
          <NewsFeed />
        </div>

        {/* Why Analysight + Competitor comparison */}
        <div className="mb-8 border-t border-zinc-800/60 pt-8">
          <WhySection />
        </div>

      </div>
    </div>
  );
}
