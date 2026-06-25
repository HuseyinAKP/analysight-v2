"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { symbolsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import Link from "next/link";

const API_BASE = "http://localhost:8000";

interface AdvancedRiskResult {
  entry_price: number;
  current_price: number;
  atr: number;
  stop_loss: number;
  stop_pct: number;
  stop_method: string;
  stop_method_label: string;
  target1: number;
  target1_pct: number;
  target2: number;
  target2_pct: number;
  target3: number;
  target3_pct: number;
  rr_ratio: number;
  rr_rating: string;
  rr_color: string;
  risk_per_share: number;
  position_sizing: {
    account_size: number;
    risk_pct: number;
    max_risk_amount: number;
    shares: number;
    shares_capped: number;
    position_capped: boolean;
    cap_reason: string | null;
    position_value: number;
    position_pct_of_portfolio: number;
    kelly_pct: number;
    kelly_shares: number;
  };
  breakeven: number;
  scenarios: { rr: number; target: number; target_pct: number; profit: number; net_profit: number }[];
  rules: { type: "ok" | "warning"; text: string }[];
}

const SYMBOLS = ["THYAO", "GARAN", "EREGL", "SISE", "ASELS", "AAPL", "MSFT", "NVDA", "BTC-USD", "ETH-USD"];

const STOP_METHODS = [
  { value: "atr", label: "ATR Tabanlı", desc: "Ortalama True Range × çarpan" },
  { value: "swing_low", label: "Salınım Dibi", desc: "Son 20 bar minimum" },
  { value: "pct", label: "Sabit %", desc: "Giriş fiyatından % uzaklık" },
  { value: "manual", label: "Manuel", desc: "Kendi stop seviyeni gir" },
];

// ── Risk/Reward Visual ────────────────────────────────────────────────────────
function RRDiagram({ result }: { result: AdvancedRiskResult }) {
  const { entry_price, stop_loss, target1, target2, target3 } = result;
  const range = target3 - stop_loss;
  const pct = (v: number) => ((v - stop_loss) / range) * 100;

  const levels = [
    { label: "Stop", price: stop_loss, color: "bg-red-500", textColor: "text-red-400", pct: pct(stop_loss) },
    { label: "Giriş", price: entry_price, color: "bg-zinc-400", textColor: "text-zinc-300", pct: pct(entry_price) },
    { label: "H1", price: target1, color: "bg-blue-400", textColor: "text-blue-400", pct: pct(target1) },
    { label: "H2", price: target2, color: "bg-emerald-400", textColor: "text-emerald-400", pct: pct(target2) },
    { label: "H3", price: target3, color: "bg-emerald-300", textColor: "text-emerald-300", pct: pct(target3) },
  ];

  return ( <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"> <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-4">Risk / Ödül Diyagramı</h3> {/* Vertical bar */} <div className="relative h-64 flex items-center"> {/* Background zones */} <div className="absolute left-8 right-8 h-full flex flex-col"> {/* Loss zone */} <div className="bg-red-500/5 border-r border-red-500/20"
            style={{ height: `${pct(entry_price)}%`, position: "absolute", bottom: 0, left: 0, right: 0 }}
          /> {/* Gain zone */} <div className="bg-emerald-500/5 border-r border-emerald-500/20"
            style={{
              height: `${100 - pct(entry_price)}%`,
              position: "absolute", top: 0, left: 0, right: 0
            }}
          /> </div> {/* Price bar */} <div className="absolute left-1/2 -translate-x-1/2 w-3 h-full bg-zinc-800 rounded-full overflow-hidden"> {/* Gain section */} <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-emerald-500/30 to-emerald-400/60 rounded-full"
            style={{ height: `${100 - pct(entry_price)}%` }} /> {/* Loss section */} <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-red-500/40 to-red-400/20 rounded-full"
            style={{ height: `${pct(entry_price)}%` }} /> </div> {/* Level markers */}
        {levels.map(lvl => ( <div key={lvl.label}
            className="absolute left-0 right-0 flex items-center gap-2"
            style={{ bottom: `${lvl.pct}%` }}> {/* Left: label */} <div className="flex-1 text-right pr-2"> <span className={cn("text-[10px] font-bold", lvl.textColor)}>{lvl.label}</span> </div> {/* Dot on bar */} <div className={cn("w-4 h-4 rounded-full border-2 border-zinc-950 z-10 shrink-0", lvl.color)} /> {/* Right: price */} <div className="flex-1 pl-2"> <span className={cn("text-[10px] font-mono", lvl.textColor)}> {lvl.price.toLocaleString("tr-TR", { maximumFractionDigits: 4 })} </span> </div> </div> ))} </div> </div> );
}

// ── Scenario Table ─────────────────────────────────────────────────────────────
function ScenarioTable({ result }: { result: AdvancedRiskResult }) {
  return ( <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"> <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-4">R/R Senaryo Tablosu</h3> <div className="overflow-x-auto"> <table className="w-full text-xs"> <thead> <tr className="border-b border-zinc-800"> <th className="text-left text-zinc-600 pb-2 font-normal">R/R</th> <th className="text-right text-zinc-600 pb-2 font-normal">Hedef</th> <th className="text-right text-zinc-600 pb-2 font-normal">%</th> <th className="text-right text-zinc-600 pb-2 font-normal">Kâr</th> </tr> </thead> <tbody> {result.scenarios.map(s => ( <tr key={s.rr} className={cn("border-b border-zinc-800/50",
                s.rr === result.rr_ratio ? "bg-blue-500/5" : "")}> <td className="py-2"> <span className={cn("font-bold font-mono",
                    s.rr >= 2 ? "text-emerald-400" :
                    s.rr >= 1.5 ? "text-yellow-400" : "text-zinc-400")}> {s.rr}R </span> {s.rr === result.rr_ratio && ( <span className="ml-1.5 text-[9px] bg-blue-500/20 text-blue-400 px-1 rounded">seçili</span> )} </td> <td className="py-2 text-right font-mono text-white"> {s.target.toLocaleString("tr-TR", { maximumFractionDigits: 4 })} </td> <td className="py-2 text-right text-emerald-400 font-mono">+{s.target_pct.toFixed(2)}%</td> <td className="py-2 text-right font-mono text-emerald-400"> +{s.net_profit.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} </td> </tr> ))} </tbody> </table> </div> </div> );
}

// ── Rules Panel ───────────────────────────────────────────────────────────────
function RulesPanel({ rules }: { rules: AdvancedRiskResult["rules"] }) {
  return ( <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"> <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Risk Kuralları</h3> <div className="space-y-2"> {rules.map((r, i) => ( <div key={i} className="flex items-start gap-2.5"> <span className={cn("text-base shrink-0 mt-0.5", r.type === "ok" ? "text-emerald-400" : "text-amber-400")}> {r.type === "ok" ? "" : ""} </span> <p className={cn("text-xs leading-relaxed",
              r.type === "ok" ? "text-zinc-400" : "text-amber-300")}> {r.text} </p> </div> ))} </div> </div> );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function PositionPage() {
  const [symbol, setSymbol] = useState("THYAO");
  const [accountSize, setAccountSize] = useState(100000);
  const [riskPct, setRiskPct] = useState(1.0);
  const [entryPrice, setEntryPrice] = useState<string>("");
  const [stopMethod, setStopMethod] = useState("atr");
  const [manualStop, setManualStop] = useState<string>("");
  const [stopPctManual, setStopPctManual] = useState(3);
  const [atrMultiplier, setAtrMultiplier] = useState(1.5);
  const [targetRR, setTargetRR] = useState(2.0);
  const [submitted, setSubmitted] = useState(false);

  // Fetch current price to pre-fill entry
  const { data: symbolInfo } = useQuery({
    queryKey: ["position-symbol-info", symbol],
    queryFn: () => symbolsApi.get(symbol),
    staleTime: 30_000,
  });

  const effectiveEntry = entryPrice ? parseFloat(entryPrice) : symbolInfo?.price;

  const { data: result, isLoading, refetch } = useQuery<AdvancedRiskResult>({
    queryKey: ["advanced-risk", symbol, accountSize, riskPct, entryPrice, stopMethod, manualStop, stopPctManual, atrMultiplier, targetRR],
    queryFn: async () => {
      const body: Record<string, unknown> = {
        account_size: accountSize,
        risk_pct: riskPct,
        stop_method: stopMethod,
        atr_multiplier: atrMultiplier,
        target_rr: targetRR,
      };
      if (entryPrice) body.entry_price = parseFloat(entryPrice);
      if (stopMethod === "manual" && manualStop) body.manual_stop = parseFloat(manualStop);
      if (stopMethod === "pct") body.stop_pct_manual = stopPctManual;

      const res = await fetch(`${API_BASE}/api/risk/${symbol}/advanced`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("API error");
      return res.json();
    },
    enabled: submitted,
    staleTime: 30_000,
  });

  const handleCalculate = () => {
    setSubmitted(true);
    if (submitted) refetch();
  };

  const rr_color_map: Record<string, string> = {
    green: "text-emerald-400 bg-emerald-500/10",
    blue: "text-blue-400 bg-blue-500/10",
    yellow: "text-yellow-400 bg-yellow-500/10",
    red: "text-red-400 bg-red-500/10",
  };

  return ( <div className="min-h-screen bg-zinc-950 text-white"> <div className="max-w-7xl mx-auto px-4 py-8"> {/* Header */} <div className="mb-8"> <div className="flex items-center gap-3 mb-2"> <Link href="/terminal" className="text-zinc-600 hover:text-zinc-400 text-sm transition-colors">← Terminal</Link> </div> <h1 className="text-2xl font-bold text-white">Gelişmiş Pozisyon Boyutlandırma</h1> <p className="text-zinc-500 text-sm mt-1"> Risk kurallarına göre optimal pozisyon büyüklüğü, stop-loss ve hedef seviyeleri hesapla </p> </div> <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"> {/* ── Left: Calculator form ── */} <div className="lg:col-span-1 space-y-4"> {/* Symbol */} <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"> <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Sembol</h3> <div className="grid grid-cols-2 gap-2 mb-3"> {SYMBOLS.map(s => ( <button key={s} onClick={() => { setSymbol(s); setEntryPrice(""); setSubmitted(false); }}
                    className={cn("px-2 py-1.5 rounded-lg text-xs font-bold transition-all",
                      symbol === s
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700")}> {s} </button> ))} </div> {symbolInfo && ( <div className="flex items-center justify-between text-xs bg-zinc-800/50 rounded-lg px-3 py-2"> <span className="text-zinc-500">{symbolInfo.name}</span> <span className="font-mono font-bold text-white"> {symbolInfo.price.toLocaleString("tr-TR", { maximumFractionDigits: 4 })} <span className={cn("ml-1.5 text-[10px]", symbolInfo.change_pct >= 0 ? "text-emerald-400" : "text-red-400")}> {symbolInfo.change_pct >= 0 ? "▲" : "▼"}{Math.abs(symbolInfo.change_pct).toFixed(2)}% </span> </span> </div> )} </div> {/* Account & Risk */} <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"> <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-4">Hesap & Risk</h3> <div className="space-y-4"> <div> <label className="text-[10px] text-zinc-500 uppercase block mb-1.5">Hesap Büyüklüğü</label> <div className="relative"> <input
                      type="number"
                      value={accountSize}
                      onChange={e => setAccountSize(Number(e.target.value))}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-blue-500 transition-colors"
                    /> </div> <div className="flex gap-2 mt-2"> {[50000, 100000, 250000, 500000].map(v => ( <button key={v} onClick={() => setAccountSize(v)}
                        className={cn("text-[10px] px-2 py-1 rounded transition-colors",
                          accountSize === v ? "bg-blue-600/30 text-blue-400" : "bg-zinc-800 text-zinc-500 hover:text-zinc-300")}> {v >= 1000 ? `${v / 1000}K` : v} </button> ))} </div> </div> <div> <div className="flex items-center justify-between mb-1.5"> <label className="text-[10px] text-zinc-500 uppercase">Risk Yüzdesi</label> <span className={cn("text-sm font-bold font-mono",
                      riskPct > 2 ? "text-red-400" : riskPct > 1 ? "text-yellow-400" : "text-emerald-400")}> %{riskPct.toFixed(1)} </span> </div> <input type="range" min={0.25} max={5} step={0.25} value={riskPct}
                    onChange={e => setRiskPct(Number(e.target.value))}
                    className="w-full accent-blue-500" /> <div className="flex justify-between text-[9px] text-zinc-700 mt-1"> <span>%0.25</span><span className="text-emerald-700">%1 önerilen</span><span>%5</span> </div> <p className="text-[10px] text-zinc-600 mt-1"> Max kayıp: <span className="font-mono text-zinc-400"> {(accountSize * riskPct / 100).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} </span> </p> </div> </div> </div> {/* Entry & Stop */} <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"> <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-4">Giriş & Stop</h3> <div className="space-y-4"> <div> <label className="text-[10px] text-zinc-500 uppercase block mb-1.5">Giriş Fiyatı</label> <input
                    type="number"
                    step="any"
                    placeholder={symbolInfo ? String(symbolInfo.price) : "Güncel fiyat kullanılır"}
                    value={entryPrice}
                    onChange={e => setEntryPrice(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-zinc-700 focus:outline-none focus:border-blue-500 transition-colors"
                  /> </div> <div> <label className="text-[10px] text-zinc-500 uppercase block mb-2">Stop Yöntemi</label> <div className="space-y-1.5"> {STOP_METHODS.map(m => ( <button key={m.value} onClick={() => setStopMethod(m.value)}
                        className={cn("w-full text-left px-3 py-2 rounded-lg border text-xs transition-all",
                          stopMethod === m.value
                            ? "border-blue-500/50 bg-blue-500/10 text-blue-300"
                            : "border-zinc-800 bg-zinc-800/50 text-zinc-400 hover:border-zinc-700")}> <span className="font-semibold">{m.label}</span> <span className="text-zinc-600 ml-2">{m.desc}</span> </button> ))} </div> </div> {stopMethod === "atr" && ( <div> <div className="flex items-center justify-between mb-1.5"> <label className="text-[10px] text-zinc-500 uppercase">ATR Çarpanı</label> <span className="text-sm font-bold font-mono text-white">{atrMultiplier.toFixed(1)}x</span> </div> <input type="range" min={0.5} max={4} step={0.25} value={atrMultiplier}
                      onChange={e => setAtrMultiplier(Number(e.target.value))}
                      className="w-full accent-blue-500" /> <div className="flex justify-between text-[9px] text-zinc-700 mt-1"> <span>0.5x (dar)</span><span>4x (geniş)</span> </div> </div> )}

                {stopMethod === "pct" && ( <div> <div className="flex items-center justify-between mb-1.5"> <label className="text-[10px] text-zinc-500 uppercase">Stop Uzaklığı</label> <span className="text-sm font-bold font-mono text-red-400">%{stopPctManual}</span> </div> <input type="range" min={0.5} max={15} step={0.5} value={stopPctManual}
                      onChange={e => setStopPctManual(Number(e.target.value))}
                      className="w-full accent-red-500" /> </div> )}

                {stopMethod === "manual" && ( <div> <label className="text-[10px] text-zinc-500 uppercase block mb-1.5">Manuel Stop Fiyatı</label> <input
                      type="number"
                      step="any"
                      value={manualStop}
                      onChange={e => setManualStop(e.target.value)}
                      placeholder="Stop seviyeni gir"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono text-red-400 placeholder-zinc-700 focus:outline-none focus:border-red-500 transition-colors"
                    /> </div> )} </div> </div> {/* Target R/R */} <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"> <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Hedef R/R</h3> <div className="flex items-center justify-between mb-1.5"> <span className="text-[10px] text-zinc-500 uppercase">Risk/Ödül Oranı</span> <span className={cn("text-lg font-bold font-mono",
                  targetRR >= 2 ? "text-emerald-400" : targetRR >= 1.5 ? "text-yellow-400" : "text-red-400")}> {targetRR}R </span> </div> <input type="range" min={1} max={5} step={0.25} value={targetRR}
                onChange={e => setTargetRR(Number(e.target.value))}
                className="w-full accent-emerald-500" /> <div className="flex justify-between text-[9px] text-zinc-700 mt-1"> <span>1R</span><span className="text-emerald-700">2R minimum</span><span>5R</span> </div> </div> {/* Calculate button */} <button onClick={handleCalculate}
              disabled={isLoading}
              className={cn("w-full py-3 rounded-xl font-bold text-sm transition-all",
                isLoading
                  ? "bg-zinc-800 text-zinc-500 cursor-wait"
                  : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20")}> {isLoading ? "Hesaplanıyor…" : "Hesapla"} </button> </div> {/* ── Right: Results ── */} <div className="lg:col-span-2 space-y-4"> {!result && !isLoading && ( <div className="flex flex-col items-center justify-center h-96 bg-zinc-900 border border-zinc-800 rounded-xl"> <div className="text-5xl mb-4"></div> <p className="text-zinc-400 text-sm mb-1">Parametreleri ayarlayıp Hesapla'ya bas</p> <p className="text-zinc-600 text-xs">Pozisyon büyüklüğü, stop-loss ve hedef seviyeleri otomatik hesaplanacak</p> </div> )}

            {isLoading && ( <div className="flex flex-col items-center justify-center h-96 bg-zinc-900 border border-zinc-800 rounded-xl"> <div className="text-4xl animate-spin mb-4"></div> <p className="text-zinc-400 text-sm">Hesaplanıyor…</p> </div> )}

            {result && ( <> {/* Summary cards */} <div className="grid grid-cols-2 md:grid-cols-4 gap-3"> <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"> <p className="text-[10px] text-zinc-500 uppercase mb-1">Lot / Adet</p> <p className="text-2xl font-bold text-white font-mono"> {result.position_sizing.shares_capped.toLocaleString("tr-TR")} </p> {result.position_sizing.position_capped && ( <p className="text-[9px] text-amber-400 mt-1">Sınırlandırıldı</p> )} </div> <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"> <p className="text-[10px] text-zinc-500 uppercase mb-1">Pozisyon Değeri</p> <p className="text-xl font-bold text-white font-mono"> {result.position_sizing.position_value.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} </p> <p className="text-[10px] text-zinc-600 mt-1"> Port. %{result.position_sizing.position_pct_of_portfolio} </p> </div> <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4"> <p className="text-[10px] text-red-400 uppercase mb-1">Max Kayıp</p> <p className="text-xl font-bold text-red-400 font-mono"> -{result.position_sizing.max_risk_amount.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} </p> <p className="text-[10px] text-red-600 mt-1">%{result.position_sizing.risk_pct} risk</p> </div> <div className={cn("border rounded-xl p-4",
                    result.rr_color === "green" ? "bg-emerald-500/10 border-emerald-500/20" :
                    result.rr_color === "blue" ? "bg-blue-500/10 border-blue-500/20" :
                    result.rr_color === "yellow" ? "bg-yellow-500/10 border-yellow-500/20" :
                    "bg-red-500/10 border-red-500/20")}> <p className="text-[10px] text-zinc-500 uppercase mb-1">R/R Oranı</p> <p className={cn("text-2xl font-bold font-mono",
                      result.rr_color === "green" ? "text-emerald-400" :
                      result.rr_color === "blue" ? "text-blue-400" :
                      result.rr_color === "yellow" ? "text-yellow-400" : "text-red-400")}> {result.rr_ratio}R </p> <p className={cn("text-[10px] mt-1",
                      rr_color_map[result.rr_color]?.split(" ")[0] ?? "text-zinc-400")}> {result.rr_rating} </p> </div> </div> {/* Levels */} <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"> <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-4">Seviyeler</h3> <div className="grid grid-cols-5 gap-3 text-center"> {[
                      { label: "Stop Loss", price: result.stop_loss, pct: result.stop_pct, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
                      { label: "Giriş", price: result.entry_price, pct: 0, color: "text-zinc-300", bg: "bg-zinc-800 border-zinc-700" },
                      { label: "Hedef 1", price: result.target1, pct: result.target1_pct, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
                      { label: "Hedef 2", price: result.target2, pct: result.target2_pct, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
                      { label: "Hedef 3", price: result.target3, pct: result.target3_pct, color: "text-emerald-300", bg: "bg-emerald-500/5 border-emerald-500/10" },
                    ].map(lvl => ( <div key={lvl.label} className={cn("border rounded-xl p-3", lvl.bg)}> <p className="text-[9px] text-zinc-600 uppercase mb-1">{lvl.label}</p> <p className={cn("text-sm font-bold font-mono", lvl.color)}> {lvl.price.toLocaleString("tr-TR", { maximumFractionDigits: 4 })} </p> {lvl.pct !== 0 && ( <p className={cn("text-[10px] font-mono mt-0.5", lvl.color)}> {lvl.pct > 0 ? "+" : ""}{lvl.pct.toFixed(2)}% </p> )} </div> ))} </div> <p className="text-[10px] text-zinc-600 mt-3"> Stop yöntemi: <span className="text-zinc-400">{result.stop_method_label}</span> {" · "}ATR: <span className="text-zinc-400 font-mono">{result.atr.toFixed(4)}</span> </p> </div> {/* Kelly + sizing details */} <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"> <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-4">Pozisyon Detayları</h3> <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs"> {[
                      { label: "Risk Başına Zarar", value: result.risk_per_share.toLocaleString("tr-TR", { maximumFractionDigits: 4 }) },
                      { label: "Kelly Kriteri", value: `%${result.position_sizing.kelly_pct} → ${result.position_sizing.kelly_shares} adet` },
                      { label: "Başabaş Noktası", value: result.breakeven.toLocaleString("tr-TR", { maximumFractionDigits: 4 }) },
                      { label: "Hesap Büyüklüğü", value: result.position_sizing.account_size.toLocaleString("tr-TR") },
                      { label: "Max Risk Tutarı", value: result.position_sizing.max_risk_amount.toLocaleString("tr-TR", { maximumFractionDigits: 0 }) },
                      { label: "Port. Ağırlık", value: `%${result.position_sizing.position_pct_of_portfolio}` },
                    ].map(item => ( <div key={item.label}> <p className="text-zinc-600 text-[10px] uppercase mb-0.5">{item.label}</p> <p className="text-zinc-200 font-mono">{item.value}</p> </div> ))} </div> {result.position_sizing.position_capped && ( <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-amber-300"> {result.position_sizing.cap_reason} </div> )} </div> <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> <RRDiagram result={result} /> <ScenarioTable result={result} /> </div> <RulesPanel rules={result.rules} /> </> )} </div> </div> </div> </div> );
}
