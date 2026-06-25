"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toolsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import Link from "next/link";

// ── Surprise badge ────────────────────────────────────────────────────────────
function SurpriseBadge({ pct }: { pct: number }) {
  const positive = pct >= 0;
  return ( <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded",
      positive ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400")}> {positive ? "+" : ""}{pct.toFixed(1)}% </span> );
}

// ── Beat / Miss pill ──────────────────────────────────────────────────────────
function BeatPill({ beat }: { beat: boolean }) {
  return ( <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border",
      beat ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
           : "bg-red-500/10 border-red-500/30 text-red-400")}> {beat ? "BEATİ" : "MİSS"} </span> );
}

// ── Earnings Calendar Card ────────────────────────────────────────────────────
function CalendarCard({ item }: { item: { symbol: string; company: string; date: string; days_until: number; consensus: string; last_beat: boolean | null } }) {
  const urgent = item.days_until <= 7;
  const past = item.days_until < 0;
  return ( <div className={cn("p-3 rounded-xl border transition-colors hover:border-zinc-600",
      urgent && !past ? "border-yellow-500/40 bg-yellow-500/5" : "border-zinc-800 bg-zinc-900/50")}> <div className="flex items-start justify-between gap-2"> <div> <Link href={`/symbol/${item.symbol}`} className="font-bold text-white hover:text-blue-400 transition-colors"> {item.symbol} </Link> <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-[150px]">{item.company}</p> </div> <div className="text-right shrink-0"> <p className="text-xs font-mono text-zinc-300">{new Date(item.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}</p> <p className={cn("text-[10px] mt-0.5", past ? "text-zinc-600" : urgent ? "text-yellow-400 font-semibold" : "text-zinc-500")}> {past ? "Açıklandı" : item.days_until === 0 ? "BUGÜN" : `${item.days_until}g sonra`} </p> </div> </div> <div className="flex items-center gap-2 mt-2"> <span className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded">{item.consensus}</span> {item.last_beat !== null && <BeatPill beat={item.last_beat} />} </div> </div> );
}

// ── Earnings Detail ────────────────────────────────────────────────────────────
function EarningsDetail({ symbol }: { symbol: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["earnings", symbol],
    queryFn: () => toolsApi.earnings(symbol),
    enabled: !!symbol,
  });

  if (isLoading) return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (error || !data) return <div className="text-center py-10 text-zinc-500">Veri bulunamadı</div>;

  const kpi = [
    { label: "F/K", value: data.key_metrics.pe_ratio?.toFixed(1) ?? "—" },
    { label: "EV/EBITDA", value: data.key_metrics.ev_ebitda?.toFixed(1) ?? "—" },
    { label: "Brüt Marj", value: data.key_metrics.gross_margin_pct ? `${data.key_metrics.gross_margin_pct}%` : "—" },
    { label: "Faal. Marj", value: data.key_metrics.operating_margin_pct ? `${data.key_metrics.operating_margin_pct}%` : "—" },
    { label: "Borç/Özkaynak", value: data.key_metrics.debt_to_equity?.toFixed(2) ?? "—" },
  ];

  const totalBuySell = data.analyst_ratings.buy + data.analyst_ratings.hold + data.analyst_ratings.sell;
  const buyPct = (data.analyst_ratings.buy / totalBuySell) * 100;
  const holdPct = (data.analyst_ratings.hold / totalBuySell) * 100;

  return ( <div className="space-y-5"> {/* Header */} <div className="flex items-start justify-between flex-wrap gap-3"> <div> <h2 className="text-xl font-bold text-white">{data.company}</h2> <p className="text-sm text-zinc-500">{data.sector} · Bitiş: {data.fiscal_year_end}</p> </div> <div className="text-right"> <p className="text-xs text-zinc-500 mb-1">Sonraki Açıklama</p> <p className="text-sm font-semibold text-yellow-400">{new Date(data.next_earnings_date).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}</p> </div> </div> {/* Summary stats */} <div className="grid grid-cols-2 sm:grid-cols-4 gap-3"> {[
          { label: "Beat Serisi", value: `${data.summary.beat_streak} çeyrek`, color: data.summary.beat_streak >= 3 ? "text-emerald-400" : "text-zinc-300" },
          { label: "Beats / Toplam", value: `${data.summary.beats}/${data.summary.total_quarters}`, color: "text-zinc-300" },
          { label: "Ort. EPS Sürprizi", value: `+${data.summary.avg_eps_surprise_pct}%`, color: data.summary.avg_eps_surprise_pct > 0 ? "text-emerald-400" : "text-red-400" },
          { label: "Ort. Gelir Sürprizi", value: `${data.summary.avg_rev_surprise_pct > 0 ? "+" : ""}${data.summary.avg_rev_surprise_pct}%`, color: data.summary.avg_rev_surprise_pct > 0 ? "text-emerald-400" : "text-red-400" },
        ].map(s => ( <div key={s.label} className="bg-zinc-800/50 rounded-xl p-3"> <p className="text-[11px] text-zinc-500 mb-1">{s.label}</p> <p className={cn("text-lg font-bold", s.color)}>{s.value}</p> </div> ))} </div> {/* Key metrics */} <div className="bg-zinc-800/30 rounded-xl p-4"> <h3 className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Temel Çarpanlar</h3> <div className="flex flex-wrap gap-4"> {kpi.map(k => ( <div key={k.label}> <p className="text-[11px] text-zinc-500">{k.label}</p> <p className="text-base font-bold text-white">{k.value}</p> </div> ))} </div> </div> {/* Quarterly table */} <div> <h3 className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Çeyreklik Sonuçlar</h3> <div className="overflow-x-auto"> <table className="w-full text-sm"> <thead> <tr className="border-b border-zinc-800 text-zinc-500 text-xs"> <th className="text-left py-2 px-2">Dönem</th> <th className="text-right py-2 px-2">EPS Gerçek</th> <th className="text-right py-2 px-2">EPS Tahmin</th> <th className="text-right py-2 px-2">Sürpriz</th> <th className="text-right py-2 px-2">Gelir (mn)</th> <th className="text-right py-2 px-2">Y/Y Gelir</th> <th className="text-right py-2 px-2">Y/Y EPS</th> <th className="text-center py-2 px-2">Sonuç</th> </tr> </thead> <tbody> {data.quarters.map((q: Record<string, unknown>) => ( <tr key={q.period as string} className="border-b border-zinc-800/50 hover:bg-zinc-800/20"> <td className="py-2.5 px-2 text-zinc-300 font-medium">{q.period as string}</td> <td className="py-2.5 px-2 text-right font-mono text-white">{(q.eps_actual as number).toFixed(2)}</td> <td className="py-2.5 px-2 text-right font-mono text-zinc-500">{(q.eps_estimate as number).toFixed(2)}</td> <td className="py-2.5 px-2 text-right"><SurpriseBadge pct={q.eps_surprise_pct as number} /></td> <td className="py-2.5 px-2 text-right font-mono text-zinc-300">{((q.revenue_actual as number) / 1000).toFixed(0)}K</td> <td className={cn("py-2.5 px-2 text-right font-mono text-xs", (q.yoy_revenue_growth as number) >= 0 ? "text-emerald-400" : "text-red-400")}> {(q.yoy_revenue_growth as number) >= 0 ? "+" : ""}{(q.yoy_revenue_growth as number).toFixed(1)}% </td> <td className={cn("py-2.5 px-2 text-right font-mono text-xs", (q.yoy_eps_growth as number) >= 0 ? "text-emerald-400" : "text-red-400")}> {(q.yoy_eps_growth as number) >= 0 ? "+" : ""}{(q.yoy_eps_growth as number).toFixed(1)}% </td> <td className="py-2.5 px-2 text-center"><BeatPill beat={q.beat as boolean} /></td> </tr> ))} </tbody> </table> </div> </div> {/* Guidance */} <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4"> <h3 className="text-xs text-blue-400 uppercase tracking-wide mb-2">Şirket Rehberliği</h3> <p className="text-sm text-zinc-300"> Beklenen EPS: <span className="text-white font-semibold">{data.guidance.next_quarter_eps_low} – {data.guidance.next_quarter_eps_high} {data.currency}</span> </p> <p className="text-xs text-zinc-500 mt-2 leading-relaxed">{data.guidance.comment}</p> </div> {/* Analyst ratings */} <div className="bg-zinc-800/30 rounded-xl p-4"> <h3 className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Analist Görüşleri</h3> <div className="flex items-center gap-4 mb-3"> <div className="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden flex"> <div className="h-full bg-emerald-500" style={{ width: `${buyPct}%` }} /> <div className="h-full bg-yellow-500" style={{ width: `${holdPct}%` }} /> <div className="h-full bg-red-500" style={{ width: `${100 - buyPct - holdPct}%` }} /> </div> <span className="text-sm font-bold text-white shrink-0">{data.analyst_ratings.current_consensus}</span> </div> <div className="flex gap-4 text-xs"> <span className="text-emerald-400">Al: {data.analyst_ratings.buy}</span> <span className="text-yellow-400">Tut: {data.analyst_ratings.hold}</span> <span className="text-red-400">Sat: {data.analyst_ratings.sell}</span> <span className="text-zinc-500 ml-auto">Hedef: <span className="text-white font-semibold">{data.analyst_ratings.target_price} {data.currency}</span></span> </div> </div> </div> );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function EarningsPage() {
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const { data: calendar } = useQuery({ queryKey: ["earnings-calendar"], queryFn: () => toolsApi.earningsCalendar(60) });

  const symbols = ["THYAO", "GARAN", "EREGL", "SISE", "ASELS", "AAPL", "MSFT", "NVDA"];

  return ( <div className="min-h-screen bg-zinc-950"> <div className="max-w-7xl mx-auto px-4 py-8"> <div className="mb-8"> <h1 className="text-2xl font-bold text-white mb-1">Earnings Reviewer</h1> <p className="text-zinc-500 text-sm">Çeyreklik kazanç sonuçları, analist beklentileri ve rehberlik analizi</p> </div> <div className="grid grid-cols-1 xl:grid-cols-4 gap-6"> {/* Left: Calendar + Symbol List */} <div className="xl:col-span-1 space-y-4"> {/* Symbol picker */} <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"> <h3 className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Sembol Seç</h3> <div className="space-y-1"> {symbols.map(s => ( <button key={s} onClick={() => setSelectedSymbol(s)}
                    className={cn("w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                      selectedSymbol === s ? "bg-blue-600 text-white" : "text-zinc-300 hover:bg-zinc-800 hover:text-white")}> {s} </button> ))} </div> </div> {/* Earnings calendar */} <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"> <h3 className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Yaklaşan Açıklamalar</h3> <div className="space-y-2"> {(calendar as { symbol: string; company: string; date: string; days_until: number; consensus: string; last_beat: boolean | null }[])?.map((item) => ( <CalendarCard
                    key={item.symbol}
                    item={item}
                  /> ))} </div> </div> </div> {/* Right: Detail */} <div className="xl:col-span-3 bg-zinc-900 border border-zinc-800 rounded-xl p-6"> {!selectedSymbol ? ( <div className="text-center py-20 text-zinc-600"> <div className="text-5xl mb-4"></div> <p>Soldan bir sembol seçin</p> </div> ) : ( <EarningsDetail symbol={selectedSymbol} /> )} </div> </div> </div> </div> );
}
