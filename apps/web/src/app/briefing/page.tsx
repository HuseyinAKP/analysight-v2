"use client";

import { useQuery } from "@tanstack/react-query";
import { cn, fmt, fmtPct } from "@/lib/utils";
import Link from "next/link";
import { TrendingUp, TrendingDown, CheckCircle, AlertTriangle, RefreshCw, Newspaper, Clock } from "lucide-react";

interface MorningBriefing {
  date: string;
  generated_at: string;
  narrative: string;
  market_tone: string;
  market_emoji: string;
  avg_change: number;
  macro: {
    headline: string;
    yield_curve: { spread_2_10: number | null; inverted: boolean; inversion_label: string };
    policy_rate_tr: number;
    cpi_tr: number;
    usd_try: number;
  };
  opportunities: {
    symbol: string; name: string; price: number; currency: string;
    change_pct: number; score: number; signal: string; rsi: number;
    rsi_comment: string; macd_bull: boolean; ema_trend: string;
  }[];
  gainers: { symbol: string; change: number; price: number; currency: string }[];
  losers:  { symbol: string; change: number; price: number; currency: string }[];
  news_mood: string;
  top_news: { headline: string; sentiment: string; source: { name: string }; hours_ago: number }[];
  key_levels: Record<string, { support: number; resistance: number }>;
  checklist: { item: string; priority: "high" | "medium" | "low" }[];
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 65 ? "#34d399" : score >= 50 ? "#facc15" : score >= 35 ? "#fb923c" : "#f87171";
  const r = 20, circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#27272a" strokeWidth="4" />
        <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold"
        style={{ color }}>{score}</span>
    </div>
  );
}

function NarrativeText({ text }: { text: string }) {
  // Bold **text** markdown
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return (
    <p className="text-sm text-zinc-300 leading-relaxed">
      {parts.map((p, i) =>
        i % 2 === 1 ? <strong key={i} className="text-white font-semibold">{p}</strong> : p
      )}
    </p>
  );
}

export default function BriefingPage() {
  const { data, isLoading, refetch, isFetching, dataUpdatedAt } = useQuery<MorningBriefing>({
    queryKey: ["morning-briefing"],
    queryFn: () => fetch("http://localhost:8000/api/briefing/morning").then(r => r.json()),
    staleTime: 300_000,
  });

  const updatedTime = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
    : null;

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto py-8 space-y-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-xl">☀️</div>
          <div>
            <h1 className="text-xl font-bold text-white">Sabah Brifing</h1>
            <p className="text-xs text-zinc-500">Veriler yükleniyor...</p>
          </div>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 bg-zinc-900 rounded-xl animate-pulse border border-zinc-800" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const toneColor = data.market_tone === "yükseliş" ? "text-emerald-400"
    : data.market_tone === "düşüş" ? "text-red-400" : "text-yellow-400";

  return (
    <div className="max-w-3xl mx-auto py-4 pb-16 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-xl">☀️</div>
          <div>
            <h1 className="text-xl font-bold text-white">Sabah Brifing</h1>
            <p className="text-xs text-zinc-500">{data.date}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {updatedTime && (
            <span className="flex items-center gap-1 text-[10px] text-zinc-600">
              <Clock className="w-3 h-3" />{updatedTime}
            </span>
          )}
          <button onClick={() => refetch()}
            className={cn("p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors border border-zinc-700", isFetching && "opacity-50")}>
            <RefreshCw className={cn("w-4 h-4 text-zinc-400", isFetching && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Tone banner */}
      <div className={cn(
        "rounded-xl border px-4 py-3 flex items-center gap-3",
        data.market_tone === "yükseliş" ? "bg-emerald-950/30 border-emerald-900/40"
        : data.market_tone === "düşüş" ? "bg-red-950/20 border-red-900/40"
        : "bg-zinc-900 border-zinc-800"
      )}>
        <span className="text-3xl">{data.market_emoji}</span>
        <div className="flex-1">
          <div className={cn("text-sm font-bold mb-0.5 capitalize", toneColor)}>
            Piyasa Tonu: {data.market_tone}
          </div>
          <NarrativeText text={data.narrative} />
        </div>
        <div className={cn("text-2xl font-bold tabular-nums shrink-0", data.avg_change >= 0 ? "text-emerald-400" : "text-red-400")}>
          {data.avg_change >= 0 ? "+" : ""}{data.avg_change.toFixed(2)}%
        </div>
      </div>

      {/* Grid: macro + gainers/losers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Macro */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Makro Görünüm</h2>
          <p className="text-sm text-zinc-300">{data.macro.headline}</p>
          <div className="grid grid-cols-3 gap-2 pt-1">
            {[
              { label: "TCMB Faiz", value: `%${data.macro.policy_rate_tr.toFixed(0)}` },
              { label: "TÜFE",      value: `%${data.macro.cpi_tr.toFixed(1)}` },
              { label: "USD/TRY",   value: data.macro.usd_try.toFixed(2) },
            ].map(m => (
              <div key={m.label} className="bg-zinc-800/60 rounded-lg p-2 text-center">
                <div className="text-[10px] text-zinc-600 mb-1">{m.label}</div>
                <div className="text-sm font-bold text-white font-mono">{m.value}</div>
              </div>
            ))}
          </div>
          {/* Yield curve mini */}
          <div className={cn("text-xs px-2 py-1.5 rounded-lg font-semibold",
            data.macro.yield_curve.inverted ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400")}>
            {data.macro.yield_curve.inversion_label}
            {data.macro.yield_curve.spread_2_10 !== null &&
              ` · Spread ${data.macro.yield_curve.spread_2_10 > 0 ? "+" : ""}${data.macro.yield_curve.spread_2_10.toFixed(2)}%`}
          </div>
        </div>

        {/* Gainers & Losers */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Öne Çıkanlar</h2>
          <div>
            <div className="text-[10px] text-emerald-400 font-semibold mb-1.5 uppercase">Yükselenler</div>
            {data.gainers.map(g => (
              <div key={g.symbol} className="flex items-center justify-between py-1">
                <Link href={`/symbol/${g.symbol}`} className="text-xs font-mono font-bold text-white hover:text-blue-400">
                  {g.symbol}
                </Link>
                <span className="text-xs text-emerald-400 font-bold">{g.change >= 0 ? "+" : ""}{g.change.toFixed(2)}%</span>
              </div>
            ))}
          </div>
          <div className="border-t border-zinc-800 pt-2">
            <div className="text-[10px] text-red-400 font-semibold mb-1.5 uppercase">Düşenler</div>
            {data.losers.map(l => (
              <div key={l.symbol} className="flex items-center justify-between py-1">
                <Link href={`/symbol/${l.symbol}`} className="text-xs font-mono font-bold text-white hover:text-blue-400">
                  {l.symbol}
                </Link>
                <span className="text-xs text-red-400 font-bold">{l.change.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Opportunities */}
      {data.opportunities.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Günün Fırsatları</h2>
          <div className="space-y-2">
            {data.opportunities.map(opp => (
              <Link href={`/symbol/${opp.symbol}`} key={opp.symbol}
                className="flex items-center gap-3 p-2.5 rounded-xl border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/40 transition-all group">
                <ScoreRing score={opp.score} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono font-bold text-white group-hover:text-blue-300">{opp.symbol}</span>
                    <span className="text-[10px] text-zinc-500 truncate">{opp.name}</span>
                    <span className={cn("text-[10px] font-bold ml-auto shrink-0", opp.change_pct >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {opp.change_pct >= 0 ? "+" : ""}{opp.change_pct.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                    <span>{opp.signal}</span>
                    <span>RSI {opp.rsi} · {opp.rsi_comment}</span>
                    <span className={cn("font-semibold", opp.macd_bull ? "text-emerald-400" : "text-red-400")}>
                      {opp.macd_bull ? "↑ MACD" : "↓ MACD"}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-white font-mono">{fmt(opp.price)}</div>
                  <div className="text-[10px] text-zinc-600">{opp.currency}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Action Checklist */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Bugün Yapılacaklar</h2>
        <div className="space-y-2">
          {data.checklist.map((item, i) => (
            <div key={i} className={cn(
              "flex items-start gap-2.5 px-3 py-2.5 rounded-lg border text-sm",
              item.priority === "high" ? "border-red-900/40 bg-red-950/20 text-red-300"
              : item.priority === "medium" ? "border-blue-900/40 bg-blue-950/20 text-blue-300"
              : "border-zinc-800 text-zinc-400"
            )}>
              {item.priority === "high"
                ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                : <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <span>{item.item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Key Levels */}
      {Object.keys(data.key_levels).length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Kritik Seviyeler</h2>
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(data.key_levels).map(([sym, lvl]) => (
              <div key={sym} className="bg-zinc-800/50 rounded-lg p-3">
                <div className="text-xs font-mono font-bold text-white mb-2">{sym}</div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-zinc-600">Destek</span>
                    <span className="text-emerald-400 font-mono">{fmt(lvl.support)}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-zinc-600">Direnç</span>
                    <span className="text-red-400 font-mono">{fmt(lvl.resistance)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* News headlines */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Günün Haberleri</h2>
          <span className={cn("text-xs font-semibold",
            data.news_mood === "Olumlu" ? "text-emerald-400" : data.news_mood === "Olumsuz" ? "text-red-400" : "text-yellow-400")}>
            {data.news_mood}
          </span>
        </div>
        <div className="space-y-2.5">
          {data.top_news.map((n, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                n.sentiment === "positive" ? "bg-emerald-400" : n.sentiment === "negative" ? "bg-red-400" : "bg-zinc-500")} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-300 leading-snug">{n.headline}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">
                  {n.source?.name} · {n.hours_ago < 1 ? `${Math.round(n.hours_ago * 60)}dk` : `${Math.floor(n.hours_ago)}s`} önce
                </p>
              </div>
            </div>
          ))}
        </div>
        <Link href="/news" className="text-xs text-blue-400 hover:underline mt-3 block">Tüm haberler →</Link>
      </div>

      <p className="text-[10px] text-zinc-700 text-center">
        Brifing analitik amaçlıdır · Yatırım tavsiyesi değildir · Veriler: yfinance, FRED, TCMB
      </p>
    </div>
  );
}
