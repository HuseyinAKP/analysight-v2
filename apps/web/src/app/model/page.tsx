"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toolsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

type Tab = "dcf" | "multiples";

// ── Number input ──────────────────────────────────────────────────────────────
function NumInput({ label, value, onChange, step = 1, hint }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; hint?: string;
}) {
  return ( <div> <label className="text-[11px] text-zinc-500 uppercase tracking-wide block mb-1">{label}</label> <input
        type="number" step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 font-mono" /> {hint && <p className="text-[10px] text-zinc-600 mt-0.5">{hint}</p>} </div> );
}

// ── DCF Result bar ────────────────────────────────────────────────────────────
function DCFResultBar({ current, intrinsic, currency }: { current: number; intrinsic: number; currency: string }) {
  const upside = ((intrinsic - current) / current) * 100;
  const positive = upside >= 0;
  const pct = Math.min(Math.abs(upside), 100);

  return ( <div className="bg-zinc-800/40 rounded-xl p-4 space-y-3"> <div className="flex items-center justify-between"> <div> <p className="text-xs text-zinc-500">İçsel Değer / Hisse</p> <p className="text-2xl font-bold text-white">{intrinsic.toFixed(2)} <span className="text-sm text-zinc-500">{currency}</span></p> </div> <div className="text-right"> <p className="text-xs text-zinc-500">Mevcut Fiyata Göre</p> <p className={cn("text-xl font-bold", positive ? "text-emerald-400" : "text-red-400")}> {positive ? "+" : ""}{upside.toFixed(1)}% </p> <p className="text-xs text-zinc-500">{positive ? "↑ İskontolu" : "↓ Primli"}</p> </div> </div> <div className="h-2 bg-zinc-700 rounded-full overflow-hidden"> <div className={cn("h-full rounded-full transition-all", positive ? "bg-emerald-500" : "bg-red-500")}
          style={{ width: `${pct}%` }} /> </div> </div> );
}

// ── Projection Table ──────────────────────────────────────────────────────────
function ProjectionTable({ projections }: { projections: { year: string; revenue: number; ebitda: number; fcf: number; pv_fcf: number; growth_rate: number }[] }) {
  return ( <div className="overflow-x-auto"> <table className="w-full text-xs"> <thead> <tr className="border-b border-zinc-800 text-zinc-500"> <th className="text-left py-2 px-2">Yıl</th> <th className="text-right py-2 px-2">Büyüme</th> <th className="text-right py-2 px-2">Gelir</th> <th className="text-right py-2 px-2">EBITDA</th> <th className="text-right py-2 px-2">FCF</th> <th className="text-right py-2 px-2">İnd. FCF</th> </tr> </thead> <tbody> {projections.map(p => ( <tr key={p.year} className="border-b border-zinc-800/40 hover:bg-zinc-800/20"> <td className="py-1.5 px-2 font-medium text-zinc-300">{p.year}</td> <td className={cn("py-1.5 px-2 text-right font-mono", p.growth_rate >= 0 ? "text-emerald-400" : "text-red-400")}> {p.growth_rate >= 0 ? "+" : ""}{p.growth_rate}% </td> <td className="py-1.5 px-2 text-right font-mono text-zinc-300">{(p.revenue / 1000).toFixed(0)}K</td> <td className="py-1.5 px-2 text-right font-mono text-zinc-300">{(p.ebitda / 1000).toFixed(0)}K</td> <td className="py-1.5 px-2 text-right font-mono text-zinc-400">{(p.fcf / 1000).toFixed(0)}K</td> <td className="py-1.5 px-2 text-right font-mono text-blue-400">{(p.pv_fcf / 1000).toFixed(0)}K</td> </tr> ))} </tbody> </table> </div> );
}

// ── DCF Model Panel ───────────────────────────────────────────────────────────
function DCFPanel() {
  const { data: templates } = useQuery({ queryKey: ["dcf-templates"], queryFn: toolsApi.dcfTemplates });
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState(200);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  // Default assumptions
  const [form, setForm] = useState({
    base_revenue: 100_000,
    ebitda_margin_pct: 25,
    tax_rate_pct: 25,
    capex_pct_revenue: 5,
    wacc_pct: 20,
    terminal_growth_pct: 6,
    net_debt: 10_000,
    shares_outstanding: 1_000,
    growth_rates: [20, 15, 12, 10, 8],
    currency: "TRY",
    symbol: "ÖZEL",
  });

  const { data: tplData } = useQuery({
    queryKey: ["tpl", selectedTemplate],
    queryFn: () => toolsApi.dcfTemplate(selectedTemplate!),
    enabled: !!selectedTemplate,
  });

  // Load template into form
  const loadTemplate = (tpl: typeof tplData) => {
    if (!tpl) return;
    setForm({
      base_revenue: tpl.base_revenue,
      ebitda_margin_pct: tpl.ebitda_margin_pct,
      tax_rate_pct: tpl.tax_rate_pct,
      capex_pct_revenue: tpl.capex_pct_revenue,
      wacc_pct: tpl.wacc_pct,
      terminal_growth_pct: tpl.terminal_growth_pct,
      net_debt: tpl.net_debt,
      shares_outstanding: tpl.shares_outstanding,
      growth_rates: tpl.revenue_growth_rates.slice(0, 5),
      currency: tpl.currency,
      symbol: tpl.symbol,
    });
  };

  const mutation = useMutation({
    mutationFn: () => toolsApi.runDcf({
      symbol: form.symbol,
      base_revenue: form.base_revenue,
      revenue_growth_rates: form.growth_rates,
      ebitda_margin_pct: form.ebitda_margin_pct,
      tax_rate_pct: form.tax_rate_pct,
      capex_pct_revenue: form.capex_pct_revenue,
      wacc_pct: form.wacc_pct,
      terminal_growth_pct: form.terminal_growth_pct,
      net_debt: form.net_debt,
      shares_outstanding: form.shares_outstanding,
      currency: form.currency,
    }),
    onSuccess: (data) => setResult(data as Record<string, unknown>),
  });

  const set = (key: string, v: number) => setForm(f => ({ ...f, [key]: v }));

  return ( <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"> {/* Inputs */} <div className="space-y-4"> {/* Template picker */} <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"> <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Hazır Şablon</p> <div className="flex flex-wrap gap-2"> {templates?.map((t: string) => ( <button key={t} onClick={() => { setSelectedTemplate(t); if (tplData) loadTemplate(tplData); }}
                className={cn("text-xs px-3 py-1.5 rounded-lg border transition-colors",
                  selectedTemplate === t ? "bg-blue-600 border-blue-600 text-white" : "border-zinc-700 text-zinc-400 hover:border-zinc-500")}> {t} </button> ))}
            {selectedTemplate && tplData && ( <button onClick={() => loadTemplate(tplData)}
                className="text-xs px-3 py-1.5 rounded-lg bg-zinc-700 text-zinc-200 hover:bg-zinc-600"> Yükle ↓ </button> )} </div> </div> <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3"> <p className="text-xs text-zinc-500 uppercase tracking-wide">Varsayımlar</p> <div className="grid grid-cols-2 gap-3"> <NumInput label="Baz Gelir (mn)" value={form.base_revenue} onChange={v => set("base_revenue", v)} step={1000} hint="Son yıl cirosu" /> <NumInput label="Mevcut Fiyat" value={currentPrice} onChange={setCurrentPrice} step={0.1} hint="Karşılaştırma için" /> <NumInput label="EBITDA Marjı %" value={form.ebitda_margin_pct} onChange={v => set("ebitda_margin_pct", v)} step={0.5} /> <NumInput label="Vergi Oranı %" value={form.tax_rate_pct} onChange={v => set("tax_rate_pct", v)} step={0.5} /> <NumInput label="CapEx / Gelir %" value={form.capex_pct_revenue} onChange={v => set("capex_pct_revenue", v)} step={0.5} /> <NumInput label="WACC %" value={form.wacc_pct} onChange={v => set("wacc_pct", v)} step={0.5} hint="Sermaye maliyeti" /> <NumInput label="Terminal Büyüme %" value={form.terminal_growth_pct} onChange={v => set("terminal_growth_pct", v)} step={0.5} /> <NumInput label="Net Borç (mn)" value={form.net_debt} onChange={v => set("net_debt", v)} step={100} hint="Negatif = nakit" /> <NumInput label="Hisse Sayısı (mn)" value={form.shares_outstanding} onChange={v => set("shares_outstanding", v)} step={10} /> </div> {/* Growth rates */} <div> <p className="text-[11px] text-zinc-500 uppercase tracking-wide mb-2">Büyüme Oranları (%) — {form.growth_rates.length} yıl</p> <div className="flex gap-1.5 flex-wrap"> {form.growth_rates.map((g, i) => ( <input key={i} type="number" value={g} step={1}
                  onChange={e => setForm(f => { const r = [...f.growth_rates]; r[i] = parseFloat(e.target.value) || 0; return { ...f, growth_rates: r }; })}
                  className="w-14 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-blue-500 text-center" /> ))} </div> </div> <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"> {mutation.isPending ? "Hesaplanıyor..." : "DCF Çalıştır"} </button> </div> </div> {/* Results */} <div className="space-y-4"> {result ? ( <> <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"> <h3 className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Değerleme Sonucu</h3> <DCFResultBar
                current={currentPrice}
                intrinsic={(result.valuation as Record<string, unknown>).intrinsic_per_share as number}
                currency={(result.currency as string)}
              /> <div className="grid grid-cols-2 gap-3 mt-4"> {[
                  { label: "Firma Değeri", value: `${(((result.valuation as Record<string, unknown>).enterprise_value as number) / 1000).toFixed(0)}K mn` },
                  { label: "Hisse Değeri", value: `${(((result.valuation as Record<string, unknown>).equity_value as number) / 1000).toFixed(0)}K mn` },
                  { label: "FCF PV Toplamı", value: `${(((result.valuation as Record<string, unknown>).pv_fcf_sum as number) / 1000).toFixed(0)}K mn` },
                  { label: "Terminal Değer Payı", value: `%${(result.valuation as Record<string, unknown>).pv_terminal_pct}` },
                ].map(s => ( <div key={s.label} className="bg-zinc-800/50 rounded-lg p-2.5"> <p className="text-[10px] text-zinc-500">{s.label}</p> <p className="text-sm font-bold text-white mt-0.5">{s.value}</p> </div> ))} </div> </div> <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"> <h3 className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Projeksiyon Tablosu</h3> <ProjectionTable projections={result.projections as { year: string; revenue: number; ebitda: number; fcf: number; pv_fcf: number; growth_rate: number }[]} /> </div> <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3"> <p className="text-[11px] text-amber-400/80"> ️ Bu model yalnızca eğitim amaçlıdır. Varsayımlar sonucu büyük ölçüde etkiler. Yatırım kararı vermeden önce profesyonel danışmanlık alın. </p> </div> </> ) : ( <div className="bg-zinc-900 border border-zinc-800 rounded-xl h-64 flex items-center justify-center text-center"> <div className="text-zinc-600"> <div className="text-4xl mb-3"></div> <p className="text-sm">Varsayımları girin ve DCF çalıştırın</p> </div> </div> )} </div> </div> );
}

// ── Multiples Panel ───────────────────────────────────────────────────────────
function MultiplesPanel() {
  const [form, setForm] = useState({ symbol: "THYAO", eps_ttm: 14.0, revenue_ttm: 480_000, ebitda_ttm: 115_000, book_value_per_share: 120.0, current_price: 240.0, sector_pe: 9.1, sector_ev_ebitda: 5.1, net_debt: 42_000, shares_outstanding: 1_380, currency: "TRY" });
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const mutation = useMutation({
    mutationFn: () => toolsApi.runMultiples(form),
    onSuccess: d => setResult(d as Record<string, unknown>),
  });

  const set = (k: string, v: number | string) => setForm(f => ({ ...f, [k]: v }));
  const inputCls = "w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-blue-500";

  return ( <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"> <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3"> <p className="text-xs text-zinc-500 uppercase tracking-wide">Çarpan Analizi Girdileri</p> <div className="grid grid-cols-2 gap-3"> {([
            ["Sembol", "symbol", 0, true],
            ["Mevcut Fiyat", "current_price", 0.01],
            ["EPS (TTM)", "eps_ttm", 0.01],
            ["Gelir TTM (mn)", "revenue_ttm", 100],
            ["EBITDA TTM (mn)", "ebitda_ttm", 100],
            ["Defter Değ. / Hisse", "book_value_per_share", 0.1],
            ["Net Borç (mn)", "net_debt", 100],
            ["Hisse Sayısı (mn)", "shares_outstanding", 10],
            ["Sektör F/K", "sector_pe", 0.1],
            ["Sektör EV/EBITDA", "sector_ev_ebitda", 0.1],
          ] as [string, string, number, boolean?][]).map(([label, key, step, isText]) => ( <div key={key}> <label className="text-[11px] text-zinc-500 uppercase tracking-wide block mb-1">{label}</label> {isText
                ? <input type="text" value={form[key as keyof typeof form] as string} onChange={e => set(key, e.target.value.toUpperCase())} className={inputCls} /> : <input type="number" step={step} value={form[key as keyof typeof form] as number} onChange={e => set(key, parseFloat(e.target.value) || 0)} className={inputCls} />} </div> ))} </div> <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"> {mutation.isPending ? "Hesaplanıyor..." : "Çarpan Analizi Yap"} </button> </div> {/* Results */} <div className="space-y-4"> {result ? ( <> <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"> <h3 className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Değerleme Özeti</h3> <div className={cn("text-center py-4 rounded-xl mb-4",
                (result.fair_values as Record<string,unknown>).upside_pct && ((result.fair_values as Record<string,unknown>).upside_pct as number) > 15
                  ? "bg-emerald-500/10" : (result.fair_values as Record<string,unknown>).upside_pct && ((result.fair_values as Record<string,unknown>).upside_pct as number) < -10
                  ? "bg-red-500/10" : "bg-zinc-800/40")}> <p className="text-3xl font-bold text-white">{((result.fair_values as Record<string,unknown>).average as number)?.toFixed(2)} {result.currency as string}</p> <p className="text-sm text-zinc-400 mt-1">Ortalama Adil Değer</p> {(result.fair_values as Record<string,unknown>).upside_pct != null && ( <p className={cn("text-lg font-bold mt-2",
                    ((result.fair_values as Record<string,unknown>).upside_pct as number) >= 0 ? "text-emerald-400" : "text-red-400")}> {((result.fair_values as Record<string,unknown>).upside_pct as number) >= 0 ? "+" : ""}{((result.fair_values as Record<string,unknown>).upside_pct as number).toFixed(1)}% Potansiyel </p> )} </div> <p className="text-center text-sm font-semibold text-zinc-300">{result.assessment as string}</p> </div> <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"> <h3 className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Çarpan Karşılaştırması</h3> <div className="space-y-2"> {[
                  ["F/K", (result.current_multiples as Record<string,unknown>).pe, (result.sector_multiples as Record<string,unknown>).pe],
                  ["EV/EBITDA", (result.current_multiples as Record<string,unknown>).ev_ebitda, (result.sector_multiples as Record<string,unknown>).ev_ebitda],
                ].map(([label, curr, sector]) => curr && sector ? ( <div key={label as string} className="flex items-center gap-3 text-sm"> <span className="text-zinc-500 w-20 shrink-0">{label as string}</span> <span className={cn("font-mono font-bold w-12",
                      (curr as number) < (sector as number) ? "text-emerald-400" : "text-red-400")}> {(curr as number).toFixed(1)}x </span> <span className="text-zinc-600 text-xs">Sektör: {(sector as number).toFixed(1)}x</span> <span className={cn("ml-auto text-xs font-semibold",
                      (curr as number) < (sector as number) ? "text-emerald-400" : "text-red-400")}> {(curr as number) < (sector as number) ? "İskontolu" : "Primli"} </span> </div> ) : null)} </div> </div> </> ) : ( <div className="bg-zinc-900 border border-zinc-800 rounded-xl h-64 flex items-center justify-center text-center"> <div className="text-zinc-600"> <div className="text-4xl mb-3"></div> <p className="text-sm">Verileri girin ve analiz başlatın</p> </div> </div> )} </div> </div> );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ModelPage() {
  const [tab, setTab] = useState<Tab>("dcf");

  return ( <div className="min-h-screen bg-zinc-950"> <div className="max-w-7xl mx-auto px-4 py-8"> <div className="mb-6"> <h1 className="text-2xl font-bold text-white mb-1">Model Builder</h1> <p className="text-zinc-500 text-sm">DCF değerlemesi ve çarpan analizi ile hisse içsel değerini hesapla</p> </div> {/* Tabs */} <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit mb-6"> {([["dcf", "DCF Analizi"], ["multiples", "Çarpan Analizi"]] as [Tab, string][]).map(([id, label]) => ( <button key={id} onClick={() => setTab(id)}
              className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                tab === id ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white")}> {label} </button> ))} </div> {tab === "dcf" && <DCFPanel />}
        {tab === "multiples" && <MultiplesPanel />} </div> </div> );
}
