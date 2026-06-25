"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toolsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  FileText, TrendingUp, TrendingDown, BarChart2,
  DollarSign, Calendar, Target, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Minus
} from "lucide-react";

// ─────────────────────────────────────────────
// Kazanç Raporu
// ─────────────────────────────────────────────
function EarningsReport({ symbol }: { symbol: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["earnings", symbol],
    queryFn: () => toolsApi.earnings(symbol),
    enabled: !!symbol,
  });

  if (isLoading) return <div className="h-48 bg-zinc-800 rounded-xl animate-pulse" />;
  if (!data) return <p className="text-xs text-zinc-600">Kazanç verisi bulunamadı.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">{data.company}</h3>
          <p className="text-xs text-zinc-500">{data.sector} · Yıl sonu: {data.fiscal_year_end}</p>
        </div>
        {data.next_earnings_date && (
          <div className="flex items-center gap-1.5 text-xs bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-1.5 rounded-full">
            <Calendar className="w-3 h-3" />
            Sonraki: {new Date(data.next_earnings_date).toLocaleDateString("tr-TR")}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500">
              <th className="text-left py-2 px-2">Çeyrek</th>
              <th className="text-right py-2 px-2">EPS Gerçek</th>
              <th className="text-right py-2 px-2">EPS Tahmin</th>
              <th className="text-right py-2 px-2">Sürpriz</th>
              <th className="text-right py-2 px-2">Gelir (M$)</th>
              <th className="text-right py-2 px-2">YoY Büyüme</th>
              <th className="text-center py-2 px-2">Beat</th>
            </tr>
          </thead>
          <tbody>
            {(data.quarters ?? []).slice(0, 6).map((q: Record<string, unknown>, i: number) => (
              <tr key={i} className="border-b border-zinc-800/40 hover:bg-zinc-800/20 transition-colors">
                <td className="py-2 px-2 font-medium text-zinc-300">{q.period as string}</td>
                <td className="py-2 px-2 text-right font-mono text-white">${(q.eps_actual as number).toFixed(2)}</td>
                <td className="py-2 px-2 text-right font-mono text-zinc-500">${(q.eps_estimate as number).toFixed(2)}</td>
                <td className={cn("py-2 px-2 text-right font-mono font-semibold",
                  (q.eps_surprise_pct as number) > 0 ? "text-emerald-400" : "text-red-400")}>
                  {(q.eps_surprise_pct as number) > 0 ? "+" : ""}{(q.eps_surprise_pct as number).toFixed(1)}%
                </td>
                <td className="py-2 px-2 text-right font-mono text-zinc-300">
                  {(q.revenue_actual as number).toLocaleString("tr-TR")}
                </td>
                <td className={cn("py-2 px-2 text-right font-mono",
                  (q.yoy_revenue_growth as number) > 0 ? "text-emerald-400" : "text-red-400")}>
                  {(q.yoy_revenue_growth as number) > 0 ? "+" : ""}{(q.yoy_revenue_growth as number).toFixed(1)}%
                </td>
                <td className="py-2 px-2 text-center">
                  {q.beat
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mx-auto" />
                    : <XCircle className="w-3.5 h-3.5 text-red-400 mx-auto" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// DCF Değerleme
// ─────────────────────────────────────────────
function DCFReport({ symbol }: { symbol: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data: tmpl, isLoading } = useQuery({
    queryKey: ["dcf-template", symbol],
    queryFn: () => toolsApi.dcfTemplate(symbol),
    enabled: !!symbol,
  });

  const { data: result, isLoading: running, refetch } = useQuery({
    queryKey: ["dcf-result", symbol],
    queryFn: () => toolsApi.runDcf({
      symbol,
      revenue_growth_rate: tmpl?.revenue_growth ?? 0.12,
      ebit_margin: tmpl?.ebit_margin ?? 0.25,
      tax_rate: tmpl?.tax_rate ?? 0.22,
      capex_pct: tmpl?.capex_pct ?? 0.08,
      wacc: tmpl?.wacc ?? 0.10,
      terminal_growth: 0.03,
      projection_years: 5,
      shares_outstanding: tmpl?.shares_outstanding ?? 15_000_000_000,
      net_debt: tmpl?.net_debt ?? 0,
      base_revenue: tmpl?.base_revenue ?? 100_000,
      base_dcf_value: tmpl?.base_dcf_value ?? 0,
    }),
    enabled: !!tmpl && expanded,
  });

  if (isLoading) return <div className="h-32 bg-zinc-800 rounded-xl animate-pulse" />;
  if (!tmpl) return (
    <div className="text-center py-8 text-zinc-600">
      <p className="text-sm">DCF şablonu yalnızca belirli semboller için mevcut.</p>
      <p className="text-xs mt-1 text-zinc-700">Desteklenen: THYAO, GARAN, AAPL, MSFT, NVDA</p>
    </div>
  );

  const upside = result ? ((result.fair_value - result.current_price) / result.current_price) * 100 : 0;

  return (
    <div className="space-y-4">
      <button onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between text-sm text-zinc-300 hover:text-white transition-colors">
        <span className="font-medium">DCF Varsayımlar & Parametreler</span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && tmpl && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {[
            { label: "Gelir Büyümesi", value: `%${((tmpl.revenue_growth ?? 0) * 100).toFixed(1)}` },
            { label: "EBIT Marjı", value: `%${((tmpl.ebit_margin ?? 0) * 100).toFixed(1)}` },
            { label: "Vergi Oranı", value: `%${((tmpl.tax_rate ?? 0) * 100).toFixed(0)}` },
            { label: "WACC", value: `%${((tmpl.wacc ?? 0) * 100).toFixed(1)}` },
            { label: "CapEx/Gelir", value: `%${((tmpl.capex_pct ?? 0) * 100).toFixed(1)}` },
            { label: "Terminal Büyüme", value: "%3.0" },
          ].map(item => (
            <div key={item.label} className="bg-zinc-800/60 rounded-xl p-2.5">
              <p className="text-[10px] text-zinc-500">{item.label}</p>
              <p className="text-sm font-semibold text-white font-mono">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {!result && !running && (
        <button onClick={() => refetch()}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors">
          DCF Hesapla
        </button>
      )}
      {running && (
        <div className="flex items-center justify-center gap-2 py-3 text-zinc-500 text-sm">
          <div className="w-4 h-4 border-2 border-zinc-600 border-t-blue-400 rounded-full animate-spin" />
          Hesaplanıyor…
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Mevcut Fiyat", value: `$${result.current_price?.toFixed(2) ?? "—"}`, sub: "piyasa fiyatı" },
              { label: "Adil Değer", value: `$${result.fair_value?.toFixed(2) ?? "—"}`, sub: "DCF tahmini", highlight: true },
              { label: "Potansiyel", value: `${upside >= 0 ? "+" : ""}${upside.toFixed(1)}%`, sub: upside > 0 ? "değer altında" : "değer üstünde",
                color: upside > 0 ? "text-emerald-400" : "text-red-400" },
            ].map(c => (
              <div key={c.label} className={cn("rounded-xl p-3 text-center", c.highlight ? "bg-blue-500/10 border border-blue-500/20" : "bg-zinc-800/60")}>
                <p className="text-[10px] text-zinc-500">{c.label}</p>
                <p className={cn("text-lg font-bold font-mono", c.color ?? "text-white")}>{c.value}</p>
                <p className="text-[9px] text-zinc-600">{c.sub}</p>
              </div>
            ))}
          </div>

          {result.sensitivity && (
            <div>
              <p className="text-xs text-zinc-500 mb-2">Senaryo Analizi</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Boğa", val: result.sensitivity?.bull_value, color: "text-emerald-400" },
                  { label: "Baz", val: result.sensitivity?.base_value, color: "text-blue-400" },
                  { label: "Ayı", val: result.sensitivity?.bear_value, color: "text-red-400" },
                ].map(s => (
                  <div key={s.label} className="bg-zinc-800/40 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-zinc-600">{s.label}</p>
                    <p className={cn("text-sm font-bold font-mono", s.color)}>${(s.val ?? 0).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Quant Raporu
// ─────────────────────────────────────────────
function QuantReport({ symbol }: { symbol: string }) {
  const { data } = useQuery({
    queryKey: ["indicators", symbol],
    queryFn: async () => {
      const r = await fetch(`http://localhost:8000/api/analysis/${symbol}/indicators`);
      return r.json();
    },
    enabled: !!symbol,
  });
  const { data: risk } = useQuery({
    queryKey: ["risk", symbol],
    queryFn: async () => {
      const r = await fetch(`http://localhost:8000/api/risk/${symbol}`);
      return r.json();
    },
    enabled: !!symbol,
  });
  const { data: scenarios } = useQuery({
    queryKey: ["scenarios", symbol],
    queryFn: async () => {
      const r = await fetch(`http://localhost:8000/api/analysis/${symbol}/scenarios`);
      return r.json();
    },
    enabled: !!symbol,
  });

  if (!data || !risk || !scenarios) return <div className="h-40 bg-zinc-800 rounded-xl animate-pulse" />;

  const metrics: { label: string; value: string; note: string; color?: string }[] = [
    { label: "RSI (14)", value: data.rsi?.toFixed(1) ?? "—",
      note: data.rsi > 70 ? "Aşırı alım" : data.rsi < 30 ? "Aşırı satım" : "Nötr bölge",
      color: data.rsi > 70 ? "text-red-400" : data.rsi < 30 ? "text-emerald-400" : "text-zinc-300" },
    { label: "ATR (14)", value: data.atr?.toFixed(4) ?? "—", note: "Ortalama gerçek aralık (volatilite)" },
    { label: "Boğa Olasılığı", value: `%${(scenarios.scenarios?.bull?.probability ?? 0).toFixed(0)}`,
      note: "Teknik sinyallere dayalı", color: "text-emerald-400" },
    { label: "Belirsizlik Endeksi", value: `${scenarios.uncertainty_index ?? "—"}/100`,
      note: scenarios.uncertainty_index > 65 ? "Yüksek — dikkatli ol" : "Orta/düşük",
      color: scenarios.uncertainty_index > 65 ? "text-red-400" : "text-yellow-400" },
    { label: "Stop Loss", value: risk.stop_loss?.toFixed(4) ?? "—", note: "Önerilen çıkış seviyesi" },
    { label: "Risk/Ödül (T1)", value: risk.rr_ratio_t1?.toFixed(2) ?? "—",
      note: risk.rr_ratio_t1 >= 2 ? "İyi — 2:1 üzeri" : "Zayıf",
      color: risk.rr_ratio_t1 >= 2 ? "text-emerald-400" : "text-zinc-400" },
    { label: "Confluence Skoru", value: `${data.confluence?.total_score ?? "—"}/100`, note: "Sinyal uyumu" },
    { label: "Trend (ADX)", value: data.adx?.toFixed(1) ?? "—",
      note: (data.adx ?? 0) > 25 ? "Güçlü trend" : "Yatay / zayıf trend" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {metrics.map(m => (
        <div key={m.label} className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-3">
          <p className="text-[10px] text-zinc-500 mb-1">{m.label}</p>
          <p className={cn("text-base font-bold font-mono", m.color ?? "text-white")}>{m.value}</p>
          <p className="text-[9px] text-zinc-600 mt-0.5 leading-tight">{m.note}</p>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Ana sayfa
// ─────────────────────────────────────────────
const SYMBOLS = ["THYAO", "GARAN", "EREGL", "ASELS", "SISE", "AAPL", "MSFT", "NVDA"];
const TABS = [
  { id: "earnings", label: "Kazanç Özeti", icon: DollarSign },
  { id: "dcf",      label: "DCF Değerleme", icon: Target },
  { id: "quant",    label: "Quant Raporu",  icon: BarChart2 },
] as const;
type Tab = typeof TABS[number]["id"];

export default function ReportsPage() {
  const [symbol, setSymbol] = useState("AAPL");
  const [tab, setTab] = useState<Tab>("earnings");

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-500/10 rounded-2xl flex items-center justify-center">
          <FileText className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Raporlar</h1>
          <p className="text-sm text-zinc-500">Kazanç özeti · DCF değerleme · Quant analiz</p>
        </div>
        <Link href={`/symbol/${symbol}`}
          className="ml-auto text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
          {symbol} tam analiz →
        </Link>
      </div>

      {/* Symbol picker */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-zinc-500 shrink-0">Sembol:</span>
        {SYMBOLS.map(s => (
          <button key={s} onClick={() => setSymbol(s)}
            className={cn("text-xs px-3 py-1.5 rounded-full border transition-colors font-medium",
              symbol === s
                ? "bg-blue-600 border-blue-600 text-white"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200")}>
            {s}
          </button>
        ))}
        <input
          type="text"
          placeholder="Diğer…"
          className="text-xs bg-zinc-800 border border-zinc-700 rounded-full px-3 py-1.5 text-zinc-300 w-24 focus:outline-none focus:border-blue-500"
          onKeyDown={e => { if (e.key === "Enter") setSymbol((e.target as HTMLInputElement).value.toUpperCase()); }}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg transition-all",
              tab === t.id
                ? "bg-zinc-700 text-white shadow"
                : "text-zinc-500 hover:text-zinc-300"
            )}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        {tab === "earnings" && <EarningsReport symbol={symbol} />}
        {tab === "dcf"      && <DCFReport symbol={symbol} />}
        {tab === "quant"    && <QuantReport symbol={symbol} />}
      </div>

      <p className="text-[10px] text-zinc-700 text-center">
        Veriler simüle/tahmin amaçlıdır. Yatırım tavsiyesi değildir.
      </p>
    </div>
  );
}
