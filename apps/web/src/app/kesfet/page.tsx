"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Compass, Flame, TrendingUp, TrendingDown, Zap, Target,
  RefreshCw, ChevronRight, Loader2
} from "lucide-react";
import { scannerApi, marketApi, ScanResult } from "@/lib/api";
import { useWatchlist } from "@/hooks/useWatchlist";
import { cn } from "@/lib/utils";

// ── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 65) return "text-emerald-400";
  if (score >= 45) return "text-yellow-400";
  return "text-red-400";
}

function scoreBg(score: number): string {
  if (score >= 65) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  if (score >= 45) return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
  return "bg-red-500/10 text-red-400 border-red-500/20";
}

function changePctColor(v: number) {
  return v >= 0 ? "text-emerald-400" : "text-red-400";
}

// ── Sector data ──────────────────────────────────────────────────────────────

interface Sector {
  label: string;
  avgScore: number;
  change: number;
  keywords: string[];
}

const SECTORS: Sector[] = [
  { label: "Bankacılık",  avgScore: 72, change: +1.8,  keywords: ["GARAN","AKBNK","ISCTR","YKBNK"] },
  { label: "Teknoloji",   avgScore: 58, change: -0.4,  keywords: ["LOGO","AEFES","NETAS"] },
  { label: "Enerji",      avgScore: 61, change: +0.9,  keywords: ["TUPRS","AKSEN","ZOREN"] },
  { label: "Savunma",     avgScore: 78, change: +2.4,  keywords: ["ASELS","ROKET","SAVKK"] },
  { label: "Kripto",      avgScore: 45, change: -1.2,  keywords: [] },
  { label: "Holding",     avgScore: 55, change: +0.3,  keywords: ["KCHOL","SAHOL","DOHOL"] },
  { label: "Havacılık",   avgScore: 70, change: +1.5,  keywords: ["THYAO","PGSUS"] },
  { label: "Perakende",   avgScore: 49, change: -0.7,  keywords: ["BIMAS","MGROS","SOKM"] },
];

function sectorCardBg(score: number): string {
  if (score >= 65) return "bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/40";
  if (score >= 50) return "bg-yellow-500/10 border-yellow-500/20 hover:border-yellow-500/40";
  return "bg-red-500/10 border-red-500/20 hover:border-red-500/30";
}

// ── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 65 ? "#10b981" : score >= 45 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative w-20 h-20 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#27272a" strokeWidth="6" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

// ── Compact stock card ────────────────────────────────────────────────────────

function StockCard({ item }: { item: ScanResult }) {
  const { has, toggle } = useWatchlist();
  const watching = has(item.symbol);

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors">
      <Link href={`/symbol/${item.symbol}`} className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-white text-sm">{item.symbol}</span>
          <span className={cn("text-xs font-semibold", scoreBg(item.score), "px-1.5 py-0.5 rounded border text-[10px]")}>
            {item.score}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-zinc-300">{item.price.toFixed(2)}</span>
          <span className={cn("text-xs", changePctColor(item.change_pct))}>
            {item.change_pct >= 0 ? "+" : ""}{item.change_pct.toFixed(2)}%
          </span>
          <span className="text-[10px] text-zinc-500 ml-auto">RSI {item.rsi.toFixed(0)}</span>
        </div>
      </Link>
      <button
        onClick={() => toggle(item.symbol)}
        className={cn(
          "text-[10px] px-2 py-1 rounded-lg border transition-colors shrink-0 font-medium",
          watching
            ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-400"
            : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600"
        )}
      >
        {watching ? "Takipte" : "Takip Et"}
      </button>
    </div>
  );
}

// ── Column ────────────────────────────────────────────────────────────────────

function OpportunityColumn({
  title, icon: Icon, color, items, emptyText
}: {
  title: string;
  icon: React.ElementType;
  color: string;
  items: ScanResult[];
  emptyText: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className={cn("flex items-center gap-2 pb-2 border-b border-zinc-800")}>
        <Icon className={cn("w-4 h-4", color)} />
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span className="ml-auto text-xs text-zinc-600">{items.length} hisse</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-zinc-600 py-4 text-center">{emptyText}</p>
      ) : (
        items.slice(0, 5).map(item => <StockCard key={item.symbol} item={item} />)
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function KesfetPage() {
  const [activeSector, setActiveSector] = useState<string | null>(null);

  // Primary scan: golden_cross, fallback: oversold
  const { data: scanData, isLoading: scanLoading, refetch } = useQuery({
    queryKey: ["kesfet-scan"],
    queryFn: async () => {
      try {
        return await scannerApi.runPreset("golden_cross");
      } catch {
        return scannerApi.runPreset("oversold");
      }
    },
    staleTime: 60_000,
  });

  // All signals scan for columns; fallback to oversold
  const { data: allData, isLoading: allLoading } = useQuery({
    queryKey: ["kesfet-all"],
    queryFn: async () => {
      try {
        return await scannerApi.runPreset("all_signals");
      } catch {
        return scannerApi.runPreset("oversold");
      }
    },
    staleTime: 60_000,
  });

  // Market briefing
  const { data: briefing, isLoading: briefingLoading } = useQuery({
    queryKey: ["kesfet-briefing"],
    queryFn: () => marketApi.briefing(),
    staleTime: 120_000,
  });

  const heroPick = scanData
    ? [...scanData].sort((a, b) => b.score - a.score)[0]
    : null;

  const baseData: ScanResult[] = allData ?? scanData ?? [];

  // Filter by active sector keywords
  const filtered = activeSector
    ? baseData.filter(r => {
        const s = SECTORS.find(sec => sec.label === activeSector);
        return s ? s.keywords.some(k => r.symbol.startsWith(k) || r.symbol === k) : true;
      })
    : baseData;

  const yükselenler = [...filtered].filter(r => r.score >= 65).sort((a, b) => b.score - a.score);
  const asiriSatilmis = [...filtered].filter(r => r.rsi < 35).sort((a, b) => a.rsi - b.rsi);
  const momentum = [...filtered].filter(r => r.macd_bullish && r.score >= 55).sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-screen-xl mx-auto px-4 py-8 space-y-10">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Compass className="w-6 h-6 text-amber-400" />
            <div>
              <h1 className="text-2xl font-bold">Keşfet</h1>
              <p className="text-xs text-zinc-500">Bugünün fırsatlarını AI ile keşfet</p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Yenile
          </button>
        </div>

        {/* ── Hero — Bugünün Seçimi ─────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Bugünün Seçimi</h2>
          </div>

          {scanLoading ? (
            <div className="h-40 rounded-2xl bg-zinc-900 border border-zinc-800 animate-pulse" />
          ) : heroPick ? (
            <div className="relative overflow-hidden rounded-2xl border border-zinc-700 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 p-6">
              {/* Background glow */}
              <div className={cn(
                "absolute inset-0 opacity-10",
                heroPick.score >= 65 ? "bg-emerald-500" : heroPick.score >= 45 ? "bg-yellow-500" : "bg-red-500"
              )} style={{ filter: "blur(60px)" }} />

              <div className="relative flex items-center gap-6">
                <ScoreRing score={heroPick.score} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl font-black text-white">{heroPick.symbol}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full border", scoreBg(heroPick.score))}>
                      {heroPick.macd_bullish ? "Al Sinyali" : "Takip Et"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xl font-bold text-white">{heroPick.price.toFixed(2)}</span>
                    <span className={cn("text-sm font-semibold", changePctColor(heroPick.change_pct))}>
                      {heroPick.change_pct >= 0 ? "+" : ""}{heroPick.change_pct.toFixed(2)}%
                    </span>
                  </div>
                  <p className="text-sm text-zinc-400 mb-4">
                    RSI {heroPick.rsi.toFixed(0)} • ADX {heroPick.adx.toFixed(0)} ({heroPick.adx_label}) •
                    {heroPick.macd_bullish ? " MACD yükseliş sinyali veriyor." : " Momentum izleniyor."}
                    {" "}Güçlü teknik konjonktür ve yüksek puan fırsatı işaret ediyor.
                  </p>
                  <Link
                    href={`/symbol/${heroPick.symbol}`}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl transition-colors"
                  >
                    Analiz Et
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-40 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 text-sm">
              Veri yüklenemedi
            </div>
          )}
        </section>

        {/* ── Sektör Isı Haritası ───────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Piyasa Nabzı — Sektör Isı Haritası</h2>
            {activeSector && (
              <button
                onClick={() => setActiveSector(null)}
                className="ml-auto text-[10px] text-zinc-500 hover:text-white border border-zinc-700 px-2 py-0.5 rounded-lg transition-colors"
              >
                Filtreyi Kaldır
              </button>
            )}
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {SECTORS.map(sector => (
              <button
                key={sector.label}
                onClick={() => setActiveSector(v => v === sector.label ? null : sector.label)}
                className={cn(
                  "p-3 rounded-xl border transition-all text-left",
                  sectorCardBg(sector.avgScore),
                  activeSector === sector.label && "ring-2 ring-blue-500"
                )}
              >
                <div className={cn("text-xs font-bold mb-1", scoreColor(sector.avgScore))}>
                  {sector.avgScore}
                </div>
                <div className="text-[10px] text-white font-medium leading-tight">{sector.label}</div>
                <div className={cn("text-[10px] mt-1", changePctColor(sector.change))}>
                  {sector.change >= 0 ? "+" : ""}{sector.change.toFixed(1)}%
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ── 3-column opportunity list ─────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-yellow-400" />
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Fırsatlar</h2>
            {allLoading && <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin ml-1" />}
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <OpportunityColumn
              title="Yükselenler"
              icon={TrendingUp}
              color="text-emerald-400"
              items={yükselenler}
              emptyText="Yüksek skorlu hisse bulunamadı"
            />
            <OpportunityColumn
              title="Aşırı Satılmış"
              icon={TrendingDown}
              color="text-orange-400"
              items={asiriSatilmis}
              emptyText="Aşırı satım bölgesinde hisse yok"
            />
            <OpportunityColumn
              title="Momentum"
              icon={Zap}
              color="text-yellow-400"
              items={momentum}
              emptyText="Aktif momentum sinyali yok"
            />
          </div>
        </section>

        {/* ── AI Piyasa Yorumu ──────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Compass className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">AI Piyasa Yorumu</h2>
          </div>

          {briefingLoading ? (
            <div className="space-y-2">
              <div className="h-4 bg-zinc-800 rounded animate-pulse w-3/4" />
              <div className="h-4 bg-zinc-800 rounded animate-pulse w-full" />
              <div className="h-4 bg-zinc-800 rounded animate-pulse w-5/6" />
            </div>
          ) : briefing?.market_summary ? (
            <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800">
              <p className="text-sm text-zinc-300 leading-relaxed">{briefing.market_summary}</p>
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800">
              <p className="text-sm text-zinc-500">
                AI piyasa yorumu şu anda hazırlanıyor. Sabah brifingini görüntülemek için{" "}
                <Link href="/briefing" className="text-blue-400 hover:underline">Sabah Brifing</Link>
                {" "}sayfasını ziyaret edin.
              </p>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
