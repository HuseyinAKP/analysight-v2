"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createChart, LineSeries, IChartApi, ISeriesApi, LineData, UTCTimestamp } from "lightweight-charts";
import { Plus, X, TrendingUp, TrendingDown, Minus, BarChart2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface OHLCVBar { date: string; close: number; volume: number }
interface Indicators {
  rsi: number; macd: number; macd_signal: number;
  ema20: number; ema50: number; ema200: number;
  atr: number; confluence: { score: number; bull_count: number; bear_count: number };
}
interface SymbolData {
  symbol: string;
  color: string;
  ohlcv: OHLCVBar[];
  indicators: Indicators | null;
  price: number;
  changePct: number;
  loading: boolean;
  error: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const COLORS = ["#60a5fa", "#34d399", "#f97316", "#f472b6", "#a78bfa", "#facc15"];
const PERIODS: { label: string; days: number }[] = [
  { label: "1H",  days: 5   },
  { label: "1A",  days: 30  },
  { label: "3A",  days: 90  },
  { label: "1Y",  days: 365 },
  { label: "5Y",  days: 1825},
];

import { API_BASE } from "@/lib/api";
const API = API_BASE;

// ── Helpers ───────────────────────────────────────────────────────────────────
function toTime(dateStr: string): UTCTimestamp {
  return (new Date(dateStr).getTime() / 1000) as UTCTimestamp;
}

function normalize(ohlcv: OHLCVBar[]): LineData[] {
  if (!ohlcv.length) return [];
  const base = ohlcv[0].close;
  return ohlcv.map(b => ({
    time: toTime(b.date),
    value: parseFloat(((b.close / base - 1) * 100).toFixed(3)),
  }));
}

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCell({ value, format = "num", good, bad }: {
  value: number | null; format?: "num" | "pct" | "score"; good?: number; bad?: number;
}) {
  if (value === null) return <span className="text-zinc-600">—</span>;
  const isGood = good !== undefined && value >= good;
  const isBad  = bad  !== undefined && value <= bad;
  const color  = isGood ? "text-emerald-400" : isBad ? "text-red-400" : "text-zinc-300";
  const text   = format === "pct" ? `${value > 0 ? "+" : ""}${value.toFixed(2)}%`
               : format === "score" ? `${value.toFixed(0)}/100`
               : value.toFixed(2);
  return <span className={cn("font-mono tabular-nums text-xs", color)}>{text}</span>;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ComparePage() {
  const [symbols, setSymbols] = useState<SymbolData[]>([]);
  const [input, setInput]     = useState("");
  const [period, setPeriod]   = useState(90);
  const [mode, setMode]       = useState<"normalized" | "absolute">("normalized");

  const chartRef    = useRef<HTMLDivElement>(null);
  const chartApi    = useRef<IChartApi | null>(null);
  const seriesMap   = useRef<Map<string, ISeriesApi<"Line">>>(new Map());

  // ── Chart init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current) return;
    const c = createChart(chartRef.current, {
      layout: { background: { color: "#09090b" }, textColor: "#71717a" },
      grid:   { vertLines: { color: "#18181b" }, horzLines: { color: "#18181b" } },
      crosshair: { mode: 1 },
      timeScale: { borderColor: "#27272a", timeVisible: true },
      rightPriceScale: { borderColor: "#27272a" },
      handleScroll: true,
      handleScale:  true,
    });
    chartApi.current = c;

    const ro = new ResizeObserver(() => {
      c.applyOptions({ width: chartRef.current!.clientWidth });
    });
    ro.observe(chartRef.current);

    return () => { ro.disconnect(); c.remove(); chartApi.current = null; };
  }, []);

  // ── Fetch one symbol ────────────────────────────────────────────────────────
  const fetchSymbol = useCallback(async (sym: string, color: string) => {
    setSymbols(prev => {
      if (prev.find(s => s.symbol === sym)) return prev;
      return [...prev, { symbol: sym, color, ohlcv: [], indicators: null, price: 0, changePct: 0, loading: true, error: null }];
    });

    try {
      const [ohlcvRes, indRes] = await Promise.all([
        fetch(`${API}/api/analysis/${sym}/ohlcv?days=${period}`),
        fetch(`${API}/api/analysis/${sym}/indicators`),
      ]);
      if (!ohlcvRes.ok) throw new Error(`${sym} bulunamadı`);
      const ohlcv: OHLCVBar[]  = await ohlcvRes.json();
      const ind: Indicators    = indRes.ok ? await indRes.json() : null;
      const price    = ohlcv.at(-1)?.close ?? 0;
      const first    = ohlcv[0]?.close ?? price;
      const changePct = first ? (price / first - 1) * 100 : 0;

      setSymbols(prev => prev.map(s =>
        s.symbol === sym ? { ...s, ohlcv, indicators: ind, price, changePct, loading: false } : s
      ));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Hata";
      setSymbols(prev => prev.map(s =>
        s.symbol === sym ? { ...s, loading: false, error: msg } : s
      ));
    }
  }, [period]);

  // ── Redraw chart when data/mode/period changes ──────────────────────────────
  useEffect(() => {
    const chart = chartApi.current;
    if (!chart) return;

    // Remove old series
    seriesMap.current.forEach(s => { try { chart.removeSeries(s); } catch {} });
    seriesMap.current.clear();

    symbols.forEach(sym => {
      if (!sym.ohlcv.length) return;
      const data = mode === "normalized"
        ? normalize(sym.ohlcv)
        : sym.ohlcv.map(b => ({ time: toTime(b.date), value: b.close }));

      const series = chart.addSeries(LineSeries, {
        color:            sym.color,
        lineWidth:        2,
        lastValueVisible: true,
        priceLineVisible: false,
        title:            sym.symbol,
      });
      series.setData(data);
      seriesMap.current.set(sym.symbol, series);
    });

    if (symbols.some(s => s.ohlcv.length)) {
      chart.timeScale().fitContent();
    }
  }, [symbols, mode]);

  // ── Refetch when period changes ─────────────────────────────────────────────
  useEffect(() => {
    const existing = symbols.map(s => ({ symbol: s.symbol, color: s.color }));
    setSymbols([]);
    seriesMap.current.forEach(s => { try { chartApi.current?.removeSeries(s); } catch {} });
    seriesMap.current.clear();
    existing.forEach(({ symbol, color }) => fetchSymbol(symbol, color));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  // ── Add symbol ──────────────────────────────────────────────────────────────
  const addSymbol = () => {
    const sym = input.trim().toUpperCase();
    if (!sym || symbols.find(s => s.symbol === sym)) { setInput(""); return; }
    if (symbols.length >= 6) return;
    const color = COLORS[symbols.length % COLORS.length];
    fetchSymbol(sym, color);
    setInput("");
  };

  // ── Remove symbol ───────────────────────────────────────────────────────────
  const removeSymbol = (sym: string) => {
    const series = seriesMap.current.get(sym);
    if (series && chartApi.current) {
      try { chartApi.current.removeSeries(series); } catch {}
      seriesMap.current.delete(sym);
    }
    setSymbols(prev => prev.filter(s => s.symbol !== sym));
  };

  // ── Presets ─────────────────────────────────────────────────────────────────
  const presets = [
    { label: "Bankalar",  syms: ["GARAN", "AKBNK", "YKBNK", "ISCTR"] },
    { label: "Havacılık", syms: ["THYAO", "PGSUS"] },
    { label: "Holding",   syms: ["KCHOL", "SAHOL", "TKFEN"] },
  ];

  const loadPreset = (syms: string[]) => {
    setSymbols([]);
    seriesMap.current.forEach(s => { try { chartApi.current?.removeSeries(s); } catch {} });
    seriesMap.current.clear();
    syms.forEach((sym, i) => fetchSymbol(sym, COLORS[i % COLORS.length]));
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-6">
      <div className="max-w-screen-xl mx-auto space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-blue-400" />
            Hisse Karşılaştırma
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Birden fazla hisseyi normalize edilmiş grafik üzerinde karşılaştır</p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Symbol input */}
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && addSymbol()}
              placeholder="Sembol ekle (örn. THYAO)"
              className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 w-48"
            />
            <button onClick={addSymbol} disabled={symbols.length >= 6}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-xl transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Presets */}
          <div className="flex gap-1.5">
            {presets.map(p => (
              <button key={p.label} onClick={() => loadPreset(p.syms)}
                className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors text-zinc-300">
                {p.label}
              </button>
            ))}
          </div>

          {/* Period */}
          <div className="flex gap-1 ml-auto">
            {PERIODS.map(p => (
              <button key={p.label} onClick={() => setPeriod(p.days)}
                className={cn("text-xs px-2.5 py-1.5 rounded-lg transition-colors",
                  period === p.days ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white")}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Mode toggle */}
          <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
            {(["normalized", "absolute"] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={cn("text-xs px-3 py-1 rounded-md transition-colors",
                  mode === m ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300")}>
                {m === "normalized" ? "%" : "₺"}
              </button>
            ))}
          </div>
        </div>

        {/* Symbol chips */}
        {symbols.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {symbols.map(s => (
              <div key={s.symbol} className="flex items-center gap-2 px-3 py-1.5 rounded-xl border"
                style={{ borderColor: s.color + "40", backgroundColor: s.color + "10" }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-sm font-bold" style={{ color: s.color }}>{s.symbol}</span>
                {s.loading && <RefreshCw className="w-3 h-3 animate-spin text-zinc-500" />}
                {s.error && <span className="text-[10px] text-red-400">{s.error}</span>}
                {!s.loading && !s.error && (
                  <span className={cn("text-xs font-mono", s.changePct >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {s.changePct >= 0 ? "+" : ""}{s.changePct.toFixed(2)}%
                  </span>
                )}
                <button onClick={() => removeSymbol(s.symbol)}
                  className="text-zinc-600 hover:text-white transition-colors ml-1">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {symbols.length === 0 && (
          <div className="border border-dashed border-zinc-800 rounded-2xl p-12 text-center">
            <BarChart2 className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm">Karşılaştırmak istediğin hisseleri ekle</p>
            <p className="text-zinc-700 text-xs mt-1">En fazla 6 hisse ekleyebilirsin</p>
            <div className="flex gap-2 justify-center mt-4">
              {presets.map(p => (
                <button key={p.label} onClick={() => loadPreset(p.syms)}
                  className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors text-zinc-400">
                  {p.label} →
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chart */}
        {symbols.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-4 pt-3 pb-1 flex items-center justify-between">
              <span className="text-xs text-zinc-500">
                {mode === "normalized" ? "Normalize edilmiş performans (%)" : "Kapanış fiyatı (₺)"}
              </span>
              {mode === "normalized" && (
                <span className="text-[10px] text-zinc-600">Başlangıç = 0%</span>
              )}
            </div>
            <div ref={chartRef} className="w-full h-[420px]" />
          </div>
        )}

        {/* Metrics table */}
        {symbols.some(s => s.indicators) && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-200">Teknik Metrikler Karşılaştırması</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left px-5 py-3 text-zinc-500 font-medium w-36">Metrik</th>
                    {symbols.map(s => (
                      <th key={s.symbol} className="px-4 py-3 text-center font-semibold"
                        style={{ color: s.color }}>
                        {s.symbol}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: "Fiyat", fmt: "num" as const, fn: (s: SymbolData) => s.price },
                    { key: "Dönem Değişim", fmt: "pct" as const, fn: (s: SymbolData) => s.changePct, good: 5, bad: -5 },
                    { key: "RSI", fmt: "num" as const, fn: (s: SymbolData) => s.indicators?.rsi ?? null, good: 55, bad: 40 },
                    { key: "Uyum Skoru", fmt: "score" as const, fn: (s: SymbolData) => s.indicators?.confluence.score ?? null, good: 60, bad: 35 },
                    { key: "EMA20", fmt: "num" as const, fn: (s: SymbolData) => s.indicators?.ema20 ?? null },
                    { key: "EMA200", fmt: "num" as const, fn: (s: SymbolData) => s.indicators?.ema200 ?? null },
                    { key: "ATR (Volatilite)", fmt: "num" as const, fn: (s: SymbolData) => s.indicators?.atr ?? null },
                    { key: "Boğa Sinyali", fmt: "num" as const, fn: (s: SymbolData) => s.indicators?.confluence.bull_count ?? null, good: 4 },
                    { key: "Ayı Sinyali",  fmt: "num" as const, fn: (s: SymbolData) => s.indicators?.confluence.bear_count ?? null, bad: 3 },
                  ].map((row, i) => (
                    <tr key={row.key}
                      className={cn("border-b border-zinc-800/50", i % 2 === 0 ? "bg-zinc-900" : "bg-zinc-950/40")}>
                      <td className="px-5 py-3 text-zinc-400 font-medium">{row.key}</td>
                      {symbols.map(s => {
                        const val = row.fn(s);
                        return (
                          <td key={s.symbol} className="px-4 py-3 text-center">
                            {s.loading ? (
                              <span className="text-zinc-700">…</span>
                            ) : (
                              <MetricCell value={val} format={row.fmt} good={row.good} bad={row.bad} />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {/* EMA trend row */}
                  <tr className="border-b border-zinc-800/50 bg-zinc-900">
                    <td className="px-5 py-3 text-zinc-400 font-medium">EMA Trendi</td>
                    {symbols.map(s => {
                      if (s.loading) return <td key={s.symbol} className="px-4 py-3 text-center text-zinc-700">…</td>;
                      const ind = s.indicators;
                      const aboveAll = ind && s.price > ind.ema20 && s.price > ind.ema50 && s.price > ind.ema200;
                      const aboveSome = ind && (s.price > ind.ema20 || s.price > ind.ema50);
                      return (
                        <td key={s.symbol} className="px-4 py-3 text-center">
                          {!ind ? <span className="text-zinc-600">—</span>
                            : aboveAll
                              ? <span className="flex items-center justify-center gap-1 text-emerald-400"><TrendingUp className="w-3 h-3" />Tüm EMA üstü</span>
                              : aboveSome
                                ? <span className="flex items-center justify-center gap-1 text-yellow-400"><Minus className="w-3 h-3" />Kısmen üstü</span>
                                : <span className="flex items-center justify-center gap-1 text-red-400"><TrendingDown className="w-3 h-3" />EMA altı</span>
                          }
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Winner banner */}
        {symbols.filter(s => !s.loading && !s.error && s.ohlcv.length > 0).length >= 2 && (() => {
          const valid = symbols.filter(s => !s.loading && !s.error);
          const best  = valid.reduce((a, b) => a.changePct > b.changePct ? a : b);
          const worst = valid.reduce((a, b) => a.changePct < b.changePct ? a : b);
          return (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-950/30 border border-emerald-900/30 rounded-2xl px-5 py-4">
                <p className="text-[10px] text-emerald-600 uppercase font-bold mb-1">🏆 En İyi Performans</p>
                <p className="text-xl font-bold" style={{ color: best.color }}>{best.symbol}</p>
                <p className="text-emerald-400 font-mono text-sm">+{best.changePct.toFixed(2)}%</p>
              </div>
              <div className="bg-red-950/20 border border-red-900/20 rounded-2xl px-5 py-4">
                <p className="text-[10px] text-red-600 uppercase font-bold mb-1">📉 En Düşük Performans</p>
                <p className="text-xl font-bold" style={{ color: worst.color }}>{worst.symbol}</p>
                <p className="text-red-400 font-mono text-sm">{worst.changePct.toFixed(2)}%</p>
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}
