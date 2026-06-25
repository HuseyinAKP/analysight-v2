"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { marketApi, toolsApi, scannerApi, WatchlistScanResult, WatchlistScanItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChartVision } from "@/components/tools/ChartVision";

// ── Live Clock ────────────────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const istTime = new Date(time.toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
  const nyTime  = new Date(time.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const fmt = (d: Date) => d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <div className="flex items-center gap-4 text-xs font-mono">
      <span className="text-red-400">İST {fmt(istTime)}</span>
      <span className="text-blue-400">NY {fmt(nyTime)}</span>
    </div>
  );
}

// ── Ticker Tape ───────────────────────────────────────────────────────────────
function TickerTape({ indices }: { indices: { name: string; value: number; change_pct: number }[] }) {
  return (
    <div className="overflow-hidden bg-zinc-900 border-b border-zinc-800 py-1.5">
      <div className="flex gap-8 animate-marquee whitespace-nowrap">
        {[...indices, ...indices].map((idx, i) => (
          <span key={i} className="inline-flex items-center gap-2 text-xs shrink-0">
            <span className="text-zinc-400">{idx.name}</span>
            <span className="font-mono text-white">{idx.value.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</span>
            <span className={cn("font-semibold", idx.change_pct >= 0 ? "text-emerald-400" : "text-red-400")}>
              {idx.change_pct >= 0 ? "▲" : "▼"}{Math.abs(idx.change_pct).toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Market Snapshot Widget ────────────────────────────────────────────────────
function SnapshotWidget({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 h-full">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
        <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">Piyasa Özeti</h3>
      </div>
      <div className="space-y-2 text-xs">
        <div>
          <p className="text-[10px] text-zinc-500 uppercase mb-1.5">Aktif Temalar</p>
          {(data.active_themes as string[]).map((t, i) => (
            <p key={i} className="text-zinc-300 mb-1 flex items-start gap-1.5">
              <span className="text-blue-400 shrink-0 mt-0.5">→</span> {t}
            </p>
          ))}
        </div>
        <div className="border-t border-zinc-800 pt-2">
          <p className="text-[10px] text-zinc-500 uppercase mb-1.5">Risk Faktörleri</p>
          {(data.risk_factors as string[]).map((r, i) => (
            <p key={i} className="text-zinc-400 mb-1 flex items-start gap-1.5">
              <span className="text-red-400 shrink-0 mt-0.5">—</span> {r}
            </p>
          ))}
        </div>
        <div className="border-t border-zinc-800 pt-2">
          <p className="text-[10px] text-zinc-500 uppercase mb-1.5">Fırsat Radarı</p>
          {(data.opportunity_flags as {symbol: string; type: string; detail: string}[]).map((o, i) => (
            <div key={i} className="flex items-center gap-2 mb-1">
              <Link href={`/symbol/${o.symbol}`}
                className="font-bold text-white hover:text-blue-400 transition-colors">{o.symbol}</Link>
              <span className="text-zinc-400 flex-1">{o.detail}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Briefing Widget ───────────────────────────────────────────────────────────
function BriefingWidget({ data }: { data: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState<number | null>(0);
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 h-full overflow-y-auto">
      <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wide mb-1">Günlük Brifing</h3>
      <p className="text-xs text-zinc-500 mb-3">{data.date as string}</p>
      <p className="text-sm font-semibold text-white mb-3 leading-snug">{data.headline as string}</p>
      <div className="space-y-2">
        {(data.sections as {title: string; content: string; tag: string; tag_color: string}[]).map((s, i) => (
          <div key={i} className="border border-zinc-800 rounded-lg overflow-hidden">
            <button className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-zinc-800/50 transition-colors"
              onClick={() => setExpanded(expanded === i ? null : i)}>
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold",
                s.tag_color === "red" ? "bg-red-500/20 text-red-400" :
                s.tag_color === "blue" ? "bg-blue-500/20 text-blue-400" :
                s.tag_color === "purple" ? "bg-purple-500/20 text-purple-400" :
                "bg-yellow-500/20 text-yellow-400")}>{s.tag}</span>
              <span className="text-xs text-zinc-300 flex-1 text-left">{s.title}</span>
              <span className="text-zinc-600">{expanded === i ? "−" : "+"}</span>
            </button>
            {expanded === i && (
              <div className="px-3 pb-3">
                <p className="text-xs text-zinc-400 leading-relaxed">{s.content}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Commentary Feed ───────────────────────────────────────────────────────────
function CommentaryWidget({ data }: { data: {id: string; time: string; author: string; avatar: string; tag: string; tag_color: string; content: string}[] }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 h-full overflow-y-auto">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
        <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">Piyasa Güncellemeleri</h3>
      </div>
      <div className="space-y-3">
        {data.map(c => (
          <div key={c.id} className="border-b border-zinc-800/60 pb-3 last:border-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-base">{c.avatar}</span>
              <span className="text-[10px] font-mono text-zinc-600">{c.time}</span>
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold ml-auto",
                c.tag_color === "red" ? "bg-red-500/20 text-red-400" :
                c.tag_color === "blue" ? "bg-blue-500/20 text-blue-400" :
                c.tag_color === "purple" ? "bg-purple-500/20 text-purple-400" :
                "bg-yellow-500/20 text-yellow-400")}>{c.tag}</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">{c.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Key Levels Widget ─────────────────────────────────────────────────────────
function KeyLevelsWidget({ levels }: { levels: Record<string, {support: number; resistance: number}> }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wide mb-3">Kritik Seviyeler</h3>
      <div className="space-y-2">
        {Object.entries(levels).map(([asset, lvl]) => (
          <div key={asset} className="flex items-center gap-3 text-xs">
            <span className="text-zinc-400 w-16 shrink-0">{asset}</span>
            <span className="text-emerald-400 font-mono">D {lvl.support.toLocaleString()}</span>
            <span className="text-zinc-700">/</span>
            <span className="text-red-400 font-mono">R {lvl.resistance.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Watch List Widget ─────────────────────────────────────────────────────────
function WatchListWidget({ items }: { items: {symbol: string; reason: string; direction: string}[] }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wide mb-3">👁 İzleme Listesi</h3>
      <div className="space-y-2.5">
        {items.map(item => (
          <div key={item.symbol} className="flex items-start gap-2.5">
            <Link href={`/symbol/${item.symbol}`}
              className={cn("font-bold text-sm shrink-0 hover:underline",
                item.direction === "bullish" ? "text-emerald-400" :
                item.direction === "bearish" ? "text-red-400" : "text-yellow-400")}>
              {item.symbol}
            </Link>
            <p className="text-xs text-zinc-500 leading-relaxed">{item.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Scanner Mini Widget ───────────────────────────────────────────────────────
function ScannerMini() {
  const { data } = useQuery({
    queryKey: ["scan-terminal"],
    queryFn: () => scannerApi.runCustom({ rsi_min: 20, rsi_max: 80 }),
    refetchInterval: 60_000,
  });
  const top = (data as Record<string, unknown>[] | undefined)?.slice(0, 5) ?? [];
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">En Yüksek Skor</h3>
        <Link href="/scanner" className="text-[10px] text-blue-400 hover:underline">Tümü →</Link>
      </div>
      <div className="space-y-1.5">
        {top.map((r) => (
          <div key={r.symbol as string} className="flex items-center gap-2 text-xs">
            <Link href={`/symbol/${r.symbol}`} className="font-bold text-white hover:text-blue-400 w-16 shrink-0">
              {r.symbol as string}
            </Link>
            <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${r.score as number}%` }} />
            </div>
            <span className="text-zinc-300 w-8 text-right">{r.score as number}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Indices Grid ──────────────────────────────────────────────────────────────
function IndicesGrid({ indices }: { indices: {name: string; value: number; change_pct: number; ytd_pct: number}[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {indices.slice(0, 9).map(idx => (
        <div key={idx.name} className="bg-zinc-800/50 rounded-lg p-2">
          <p className="text-[10px] text-zinc-500 truncate">{idx.name}</p>
          <p className="text-sm font-bold text-white font-mono">{idx.value.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</p>
          <p className={cn("text-[10px] font-semibold", idx.change_pct >= 0 ? "text-emerald-400" : "text-red-400")}>
            {idx.change_pct >= 0 ? "▲" : "▼"} {Math.abs(idx.change_pct).toFixed(2)}%
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Watchlist Scan Panel ──────────────────────────────────────────────────────
function WatchlistScanPanel({ onClose }: { onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["watchlist-scan"],
    queryFn: scannerApi.watchlist,
    staleTime: 60_000,
  });

  const colorMap: Record<string, string> = {
    green: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    yellow: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
    orange: "text-orange-400 bg-orange-500/10 border-orange-500/30",
    red: "text-red-400 bg-red-500/10 border-red-500/30",
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-4xl bg-zinc-950 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <span className="text-base font-bold text-white font-mono">WATCHLIST TARAMA</span>
            {data && (
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border",
                data.market_mood === "yükseliş" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                data.market_mood === "düşüş" ? "bg-red-500/20 text-red-400 border-red-500/30" :
                "bg-yellow-500/20 text-yellow-400 border-yellow-500/30")}>
                {data.market_mood.toUpperCase()}
              </span>
            )}
            {isLoading && <span className="text-[10px] text-zinc-500 font-mono animate-pulse">taranıyor…</span>}
          </div>
          <div className="flex items-center gap-4">
            {data && (
              <div className="flex items-center gap-4 text-[10px] text-zinc-500 font-mono">
                <span>{data.total_scanned} sembol</span>
                <span className="text-emerald-400">▲ {data.bullish_count} yükseliş</span>
                <span className="text-red-400">▼ {data.bearish_count} düşüş</span>
                <span>ort. skor {data.avg_score}</span>
              </div>
            )}
            <button onClick={onClose}
              className="text-zinc-500 hover:text-white text-lg font-mono transition-colors">✕</button>
          </div>
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="text-4xl mb-3 animate-spin inline-block">⚙</div>
              <p className="text-zinc-400 text-sm">İzleme listesi taranıyor…</p>
              <p className="text-zinc-600 text-xs mt-1">10 sembol analiz ediliyor</p>
            </div>
          ) : data ? (
            <div className="divide-y divide-zinc-800/60">
              {data.results.map((item: WatchlistScanItem, idx: number) => (
                <div key={item.symbol} className="px-5 py-4 hover:bg-zinc-900/50 transition-colors">
                  <div className="flex items-start gap-4">
                    {/* Rank */}
                    <span className="text-zinc-700 font-mono text-sm w-5 shrink-0 pt-0.5">
                      {idx + 1}
                    </span>

                    {/* Symbol + price */}
                    <div className="w-28 shrink-0">
                      <Link href={`/symbol/${item.symbol}`} onClick={onClose}
                        className="font-bold text-white hover:text-blue-400 transition-colors text-sm">
                        {item.symbol}
                      </Link>
                      <p className="text-[10px] text-zinc-500 truncate">{item.name}</p>
                      <p className="text-xs font-mono text-white mt-0.5">
                        {item.price.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}
                        <span className="text-zinc-500 text-[10px] ml-1">{item.currency}</span>
                      </p>
                      <span className={cn("text-[10px] font-mono", item.change_pct >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {item.change_pct >= 0 ? "▲" : "▼"}{Math.abs(item.change_pct).toFixed(2)}%
                      </span>
                    </div>

                    {/* Score + signal */}
                    <div className="w-36 shrink-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xl font-bold font-mono text-white">{item.score}</span>
                        <span className="text-zinc-600 text-xs">/100</span>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-1.5">
                        <div className={cn("h-full rounded-full transition-all",
                          item.score >= 65 ? "bg-emerald-400" :
                          item.score >= 50 ? "bg-yellow-400" :
                          item.score >= 35 ? "bg-orange-400" : "bg-red-400"
                        )} style={{ width: `${item.score}%` }} />
                      </div>
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border",
                        colorMap[item.signal_color] ?? "text-zinc-400")}>
                        {item.signal}
                      </span>
                    </div>

                    {/* Indicators */}
                    <div className="w-40 shrink-0 space-y-1">
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className="text-zinc-600 w-8">RSI</span>
                        <span className={cn("font-mono font-bold",
                          item.rsi < 30 ? "text-emerald-400" :
                          item.rsi > 70 ? "text-red-400" : "text-zinc-300")}>
                          {item.rsi}
                        </span>
                        <span className="text-zinc-600 truncate">{item.rsi_comment}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className="text-zinc-600 w-8">MACD</span>
                        <span className={cn("font-bold", item.macd_bull ? "text-emerald-400" : "text-red-400")}>
                          {item.macd_bull ? "▲ Yükseliş" : "▼ Düşüş"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className="text-zinc-600 w-8">EMA</span>
                        <span className={cn("font-bold", item.ema_trend === "above" ? "text-emerald-400" : "text-red-400")}>
                          {item.ema_trend === "above" ? "Üstünde" : "Altında"}
                        </span>
                      </div>
                      {/* Bull/Bear bar */}
                      <div className="flex items-center gap-1 mt-1">
                        <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden flex">
                          <div className="bg-emerald-500 h-full transition-all"
                            style={{ width: `${(item.bull_count / (item.bull_count + item.bear_count + item.neutral_count)) * 100}%` }} />
                          <div className="bg-zinc-600 h-full transition-all"
                            style={{ width: `${(item.neutral_count / (item.bull_count + item.bear_count + item.neutral_count)) * 100}%` }} />
                        </div>
                        <span className="text-[9px] text-zinc-600 w-10 text-right">
                          {item.bull_count}B/{item.bear_count}S
                        </span>
                      </div>
                    </div>

                    {/* AI Commentary */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-zinc-400 leading-relaxed">{item.commentary}</p>
                      <div className="mt-2">
                        <Link href={`/symbol/${item.symbol}`} onClick={onClose}
                          className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors">
                          Tam analiz →
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 px-5 py-3 flex items-center justify-between">
          <p className="text-[10px] text-zinc-600 font-mono">
            {data?.scanned_at ? `Tarandı: ${new Date(data.scanned_at).toLocaleTimeString("tr-TR")}` : ""}
          </p>
          <div className="flex items-center gap-3">
            <Link href="/scanner" onClick={onClose}
              className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors">
              Gelişmiş Tarayıcı →
            </Link>
            <button onClick={onClose}
              className="text-[10px] px-3 py-1 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 transition-colors">
              Kapat (ESC)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AI Research Panel ─────────────────────────────────────────────────────────
function AIResearchPanel({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    is_claude: boolean;
    market_tone: string;
    avg_change: number;
    opportunities: { symbol: string; score: number; rsi?: number; signal?: string; price?: number; change_pct?: number; commentary?: string }[];
    report: string;
    sources_used: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runResearch() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://localhost:8000/api/research/auto", { method: "POST" });
      if (!res.ok) throw new Error("API hatası");
      const d = await res.json();
      setResult(d);
    } catch {
      setError("Araştırma yapılamadı. API sunucusunun çalıştığından emin olun.");
    } finally {
      setLoading(false);
    }
  }

  // Auto-run on mount
  useEffect(() => { runResearch(); }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-3xl bg-zinc-950 border border-violet-500/30 rounded-2xl shadow-2xl shadow-violet-900/20 overflow-hidden max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-gradient-to-r from-violet-500/10 to-blue-500/5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-white font-mono">AI ARAŞTIRMA MODU</span>
            {result?.is_claude && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-violet-500/20 text-violet-300 border-violet-500/30">
                Claude AI
              </span>
            )}
            {result && !result.is_claude && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-zinc-700 text-zinc-400 border-zinc-600">
                Şablon Analiz
              </span>
            )}
            {loading && (
              <span className="text-[10px] text-violet-400 font-mono animate-pulse">araştırılıyor…</span>
            )}
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg font-mono transition-colors">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {loading && (
            <div className="text-center py-12">
              <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-zinc-400 text-sm">Piyasa taranıyor ve analiz ediliyor…</p>
              <p className="text-zinc-600 text-xs mt-1">Watchlist + Brifing + Claude AI sentezi</p>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {result && !loading && (
            <>
              {/* Market tone banner */}
              <div className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase mb-1">Piyasa Tonu</p>
                  <p className="text-sm font-bold text-white capitalize">{result.market_tone}</p>
                </div>
                <div className="h-8 w-px bg-zinc-800" />
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase mb-1">Ort. Değişim</p>
                  <p className={cn("text-sm font-bold font-mono", result.avg_change >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {result.avg_change >= 0 ? "+" : ""}{result.avg_change.toFixed(2)}%
                  </p>
                </div>
                <div className="h-8 w-px bg-zinc-800" />
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase mb-1">Kaynaklar</p>
                  <p className="text-xs text-zinc-400">{result.sources_used.join(", ")}</p>
                </div>
              </div>

              {/* Top opportunities */}
              {result.opportunities.length > 0 && (
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2 font-semibold">En İyi Fırsatlar</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {result.opportunities.slice(0, 5).map((opp, i) => (
                      <Link key={opp.symbol} href={`/symbol/${opp.symbol}`} onClick={onClose}
                        className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-3 hover:border-zinc-600 transition-colors">
                        <span className="text-zinc-700 font-mono text-xs w-4">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white text-sm">{opp.symbol}</p>
                          {opp.signal && <p className="text-[10px] text-zinc-500">{opp.signal}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold font-mono text-white">{opp.score}<span className="text-zinc-600 text-[10px]">/100</span></p>
                          {opp.rsi !== undefined && <p className="text-[10px] text-zinc-500">RSI {opp.rsi}</p>}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Report */}
              <div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2 font-semibold">
                  {result.is_claude ? "Claude AI Raporu" : "Analiz Raporu"}
                </p>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="space-y-1 text-sm leading-relaxed">
                    {result.report.split("\n").map((line, i) => {
                      if (!line.trim()) return <div key={i} className="h-1" />;
                      if (line.startsWith("**") && line.endsWith("**"))
                        return <p key={i} className="font-bold text-white text-xs mt-2">{line.replace(/\*\*/g, "")}</p>;
                      if (line.startsWith("- ") || line.startsWith("• "))
                        return <p key={i} className="text-zinc-300 text-xs pl-2">· {line.replace(/^[•\-]\s*/, "")}</p>;
                      return <p key={i} className="text-zinc-300 text-xs">{line}</p>;
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 px-5 py-3 flex items-center justify-between">
          <p className="text-[10px] text-zinc-600 font-mono">
            {result ? "Yatırım tavsiyesi değildir." : ""}
          </p>
          <div className="flex items-center gap-3">
            <button onClick={runResearch} disabled={loading}
              className="text-[10px] px-3 py-1 bg-violet-500/20 text-violet-300 border border-violet-500/30 rounded hover:bg-violet-500/30 transition-colors disabled:opacity-50">
              {loading ? "Araştırılıyor…" : "Yenile"}
            </button>
            <button onClick={onClose}
              className="text-[10px] px-3 py-1 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 transition-colors">
              Kapat (ESC)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Bloomberg Command Bar ─────────────────────────────────────────────────────
function CommandBar({ onWatchlistScan, onResearch, onChartVision }: { onWatchlistScan: () => void; onResearch: () => void; onChartVision: () => void }) {
  const [cmd, setCmd] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus on / key press
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const COMMANDS: Record<string, string> = {
    "SCAN": "/scanner", "PORTFOLIO": "/portfolio", "ETF": "/etf",
    "MACRO": "/research", "NEWS": "/news", "EARNINGS": "/earnings",
    "RESEARCH": "/research", "MODEL": "/model", "SETUP": "/setup",
    "ANALYST": "/analyst", "BRIEFING": "/briefing", "POSITION": "/position", "WEBHOOK": "/webhook",
  };

  function execute(input: string) {
    const val = input.trim().toUpperCase();
    if (!val) return;
    setHistory(h => [val, ...h.slice(0, 9)]);
    setCmd("");

    // Watchlist scan
    if (val === "WATCHLIST" || val === "WL" || val === "SCAN WATCHLIST") {
      onWatchlistScan();
      return;
    }

    // AI Research
    if (val === "ARAŞTIR" || val === "RESEARCH AI" || val === "AI") {
      onResearch();
      return;
    }

    // Check built-in commands
    if (COMMANDS[val]) { router.push(COMMANDS[val]); return; }

    // Navigate to symbol
    router.push(`/symbol/${val}`);
  }

  return (
    <div className="bg-zinc-950 border-b border-zinc-700 px-4 py-2 flex items-center gap-3">
      <span className="text-[10px] font-mono text-amber-400 font-bold shrink-0">CMD&gt;</span>
      <input
        ref={inputRef}
        value={cmd}
        onChange={e => setCmd(e.target.value.toUpperCase())}
        onKeyDown={e => e.key === "Enter" && execute(cmd)}
        placeholder="THYAO · AAPL · WATCHLIST · BRIEFING · POSITION · NEWS · / ile odaklan"
        className="flex-1 bg-transparent text-xs font-mono text-green-400 placeholder-zinc-700 focus:outline-none caret-green-400"
      />
      <button onClick={() => execute(cmd)}
        className="text-[10px] font-bold px-3 py-1 bg-amber-500/20 text-amber-400 rounded border border-amber-500/30 hover:bg-amber-500/30 transition-colors font-mono shrink-0">
        GO
      </button>
      {/* Quick command chips */}
      <button onClick={() => { setCmd(""); onWatchlistScan(); }}
        className="text-[10px] font-mono px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20 hover:bg-blue-500/20 transition-colors shrink-0">
        WATCHLIST
      </button>
      <button onClick={() => { setCmd(""); onResearch(); }}
        className="text-[10px] font-mono px-2 py-0.5 bg-violet-500/10 text-violet-400 rounded border border-violet-500/20 hover:bg-violet-500/20 transition-colors shrink-0">
        ARAŞTIR
      </button>
      <button onClick={() => { setCmd(""); onChartVision(); }}
        className="text-[10px] font-mono px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors shrink-0">
        GRAFİK AI
      </button>
      {history.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-hidden">
          {history.slice(0, 3).map((h, i) => (
            <button key={i} onClick={() => execute(h)}
              className="text-[10px] font-mono text-zinc-600 hover:text-zinc-300 transition-colors shrink-0">
              {h}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Yield Curve Panel ─────────────────────────────────────────────────────────
function YieldCurvePanel() {
  const { data } = useQuery({
    queryKey: ["yield-curve"],
    queryFn: () => fetch("http://localhost:8000/api/macro/yield-curve").then(r => r.json()),
    staleTime: 300_000,
  });

  if (!data) return <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 animate-pulse h-36" />;

  const { curve, spread_2_10, inverted, inversion_label } = data as {
    curve: { maturity: string; yield_pct: number }[];
    spread_2_10: number | null;
    inverted: boolean;
    inversion_label: string;
  };

  const max = curve.length ? Math.max(...curve.map(c => c.yield_pct)) : 5;
  const min = curve.length ? Math.min(...curve.map(c => c.yield_pct)) : 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">ABD Getiri Eğrisi</h3>
        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded",
          inverted ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400")}>
          {inversion_label}
        </span>
      </div>

      {/* Visual bar chart */}
      <div className="flex items-end gap-1.5 h-16 mb-2">
        {curve.map(c => {
          const height = max === min ? 50 : Math.max(8, ((c.yield_pct - min) / (max - min)) * 56 + 8);
          return (
            <div key={c.maturity} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={cn("w-full rounded-t-sm transition-all", inverted ? "bg-red-400/60" : "bg-blue-400/60")}
                style={{ height: `${height}px` }}
              />
              <span className="text-[9px] text-zinc-600 font-mono">{c.maturity}</span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[10px] text-zinc-500">
        <span>2Y-10Y Spread: <span className={cn("font-bold font-mono", (spread_2_10 ?? 0) >= 0 ? "text-emerald-400" : "text-red-400")}>
          {spread_2_10 !== null ? `${spread_2_10 > 0 ? "+" : ""}${spread_2_10.toFixed(2)}%` : "—"}
        </span></span>
        <span>Kaynak: FRED</span>
      </div>
    </div>
  );
}

// ── TR Macro Panel ────────────────────────────────────────────────────────────
function TRMacroPanel() {
  const { data } = useQuery({
    queryKey: ["tr-macro"],
    queryFn: () => fetch("http://localhost:8000/api/macro/tr").then(r => r.json()),
    staleTime: 300_000,
  });

  if (!data) return <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 animate-pulse h-36" />;

  const indicators = (data as Record<string, unknown>).indicators as Record<string, {
    label: string; value: number; unit: string; change: number;
  }>;

  const KEY_ITEMS = ["policy_rate", "cpi_tr", "usd_try", "eur_try", "bist100", "reserves"];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">🇹🇷 TR Makro</h3>
        <span className="text-[10px] text-zinc-600">TCMB</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {KEY_ITEMS.map(key => {
          const ind = indicators[key];
          if (!ind) return null;
          const positive = ind.change > 0;
          return (
            <div key={key} className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-600 truncate">{ind.label}</span>
              <div className="text-right">
                <span className="text-xs font-bold font-mono text-white">
                  {typeof ind.value === "number"
                    ? ind.value >= 1000 ? ind.value.toLocaleString("tr-TR") : ind.value.toFixed(2)
                    : ind.value}
                </span>
                {ind.change !== 0 && (
                  <span className={cn("text-[9px] font-mono ml-1", positive ? "text-emerald-400" : "text-red-400")}>
                    {positive ? "▲" : "▼"}{Math.abs(ind.change).toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── TradingView Alert Feed ────────────────────────────────────────────────────
interface TVAlert {
  id: string; symbol: string; name: string; received_at: string;
  tv_condition: string; tv_timeframe: string;
  signal_quality: string; signal_quality_color: string;
  current_price: number; change_pct: number;
  confluence_score: number; rsi: number; macd_bullish: boolean;
  stop_loss: number; target1: number; rr_ratio: number;
  ai_powered?: boolean; ai_narrative?: string;
}

function TVAlertFeed() {
  const { data, isLoading } = useQuery({
    queryKey: ["tv-alert-feed"],
    queryFn: () => fetch("http://localhost:8000/api/webhook/tradingview/feed").then(r => r.json()),
    refetchInterval: 10_000,
  });

  const { data: apiStatus } = useQuery({
    queryKey: ["api-status"],
    queryFn: () => fetch("http://localhost:8000/api/status").then(r => r.json()),
    refetchInterval: 60_000,
  });

  const alerts = (data as { alerts: TVAlert[] } | undefined)?.alerts ?? [];
  const claudeActive = (apiStatus as any)?.integrations?.claude_ai === true;

  const colorMap: Record<string, string> = {
    green: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    yellow: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
    red: "text-red-400 bg-red-500/10 border-red-500/30",
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
          <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">TV Alertler</h3>
          {claudeActive ? (
            <span className="text-[9px] bg-violet-500/20 text-violet-300 border border-violet-500/30 px-1.5 py-0.5 rounded font-bold">Claude AI</span>
          ) : (
            <span className="text-[9px] bg-zinc-800 text-zinc-600 border border-zinc-700 px-1.5 py-0.5 rounded">AI kapalı</span>
          )}
        </div>
        <button
          onClick={() => fetch("http://localhost:8000/api/webhook/tradingview/test/THYAO")}
          className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors font-mono">
          test
        </button>
      </div>

      {isLoading && <div className="text-zinc-600 text-xs text-center py-4">Yükleniyor…</div>}

      {alerts.length === 0 && !isLoading ? (
        <div className="text-center py-6">
          <p className="text-zinc-600 text-xs">Henüz alert yok</p>
          <p className="text-zinc-700 text-[10px] mt-1">TradingView webhookunu /api/webhook/tradingview adresine yönlendir</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {alerts.map((alert, i) => (
            <div key={alert.id ?? i}
              className="border border-zinc-800 rounded-lg p-3 hover:border-zinc-700 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Link href={`/symbol/${alert.symbol}`}
                    className="font-bold text-white hover:text-blue-400 text-xs transition-colors">
                    {alert.symbol}
                  </Link>
                  <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border",
                    colorMap[alert.signal_quality_color] ?? "text-zinc-400 bg-zinc-800")}>
                    {alert.signal_quality.replace(/^[^\s]+ /, "")}
                  </span>
                </div>
                <span className="text-[9px] text-zinc-700 font-mono">
                  {new Date(alert.received_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 mb-1.5 truncate">{alert.tv_condition}</p>
              {alert.ai_narrative && (
                <div className="bg-violet-950/30 border border-violet-800/30 rounded-lg px-2.5 py-2 mb-2">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-[9px] text-violet-400 font-bold">Claude AI</span>
                  </div>
                  <p className="text-[10px] text-zinc-300 leading-relaxed whitespace-pre-wrap">{alert.ai_narrative}</p>
                </div>
              )}
              <div className="flex items-center gap-3 text-[10px] text-zinc-600">
                <span className="font-mono text-zinc-400">{alert.current_price?.toLocaleString("tr-TR", { maximumFractionDigits: 4 })}</span>
                <span className={alert.change_pct >= 0 ? "text-emerald-400" : "text-red-400"}>
                  {alert.change_pct >= 0 ? "▲" : "▼"}{Math.abs(alert.change_pct ?? 0).toFixed(2)}%
                </span>
                <span>RSI {alert.rsi}</span>
                <span className={cn("font-bold", alert.macd_bullish ? "text-emerald-400" : "text-red-400")}>
                  {alert.macd_bullish ? "▲MACD" : "▼MACD"}
                </span>
                <span className="ml-auto">Skor: {alert.confluence_score}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Terminal ─────────────────────────────────────────────────────────────
export default function TerminalPage() {
  const [showWatchlist, setShowWatchlist] = useState(false);
  const [showResearch, setShowResearch] = useState(false);
  const [showChartVision, setShowChartVision] = useState(false);
  const { data: overview } = useQuery({ queryKey: ["market-overview"], queryFn: toolsApi.marketOverview, refetchInterval: 60_000 });
  const { data: briefing }   = useQuery({ queryKey: ["briefing"],  queryFn: marketApi.briefing });
  const { data: commentary } = useQuery({ queryKey: ["commentary"], queryFn: marketApi.commentary, refetchInterval: 30_000 });
  const { data: snapshot }   = useQuery({ queryKey: ["snapshot"],   queryFn: marketApi.snapshot, refetchInterval: 60_000 });

  // ESC to close panels
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setShowWatchlist(false); setShowResearch(false); setShowChartVision(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {showWatchlist && <WatchlistScanPanel onClose={() => setShowWatchlist(false)} />}
      {showResearch && <AIResearchPanel onClose={() => setShowResearch(false)} />}
      {showChartVision && (
        <>
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={() => setShowChartVision(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="max-w-lg w-full">
              <ChartVision mode="inline" />
            </div>
          </div>
        </>
      )}

      {/* Terminal header bar */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-white font-mono">ANALYSIGHT TERMINAL</span>
          <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded font-bold">LIVE</span>
        </div>
        <LiveClock />
      </div>

      {/* Bloomberg command bar */}
      <CommandBar onWatchlistScan={() => setShowWatchlist(true)} onResearch={() => setShowResearch(true)} onChartVision={() => setShowChartVision(true)} />

      {/* Ticker tape */}
      {overview?.indices && <TickerTape indices={overview.indices} />}

      {/* Main grid */}
      <div className="flex-1 p-3 grid grid-cols-12 grid-rows-[auto_1fr_1fr] gap-3">

        {/* Row 1: Indices (full width) */}
        <div className="col-span-12">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            {overview?.indices && <IndicesGrid indices={overview.indices} />}
          </div>
        </div>

        {/* Row 2-3 col 1-4: Briefing */}
        <div className="col-span-12 md:col-span-4 row-span-2 min-h-[400px]">
          {briefing && <BriefingWidget data={briefing} />}
        </div>

        {/* Row 2 col 5-8: Snapshot */}
        <div className="col-span-12 md:col-span-4">
          {snapshot && <SnapshotWidget data={snapshot} />}
        </div>

        {/* Row 2 col 9-12: Scanner mini */}
        <div className="col-span-12 md:col-span-4">
          <ScannerMini />
        </div>

        {/* Row 3 col 5-8: Commentary */}
        <div className="col-span-12 md:col-span-4 overflow-hidden">
          {commentary && <CommentaryWidget data={commentary} />}
        </div>

        {/* Row 3 col 9-12: Yield curve + TR macro + TV alerts */}
        <div className="col-span-12 md:col-span-4 space-y-3">
          <YieldCurvePanel />
          <TRMacroPanel />
          <TVAlertFeed />
          {briefing?.watch_list && <WatchListWidget items={briefing.watch_list} />}
        </div>
      </div>

      {/* Bottom nav bar */}
      <div className="bg-zinc-900 border-t border-zinc-800 px-4 py-2 flex items-center gap-4">
        {[
          ["/", "Dashboard"],
          ["/scanner", "Tarayıcı"],
          ["/position", "Pozisyon"],
          ["/briefing", "Brifing"],
          ["/portfolio", "Portföy"],
          ["/etf", "ETF"],
          ["/research", "Araştırma"],
          ["/earnings", "Kazançlar"],
          ["/model", "Model"],
        ].map(([href, label]) => (
          <Link key={href} href={href} className="text-xs text-zinc-500 hover:text-white transition-colors">
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
