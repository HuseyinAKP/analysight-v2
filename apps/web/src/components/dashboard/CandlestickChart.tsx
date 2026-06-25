"use client";
import { API_BASE } from "@/lib/api";

import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  HistogramSeries,
  IChartApi,
  LineStyle,
} from "lightweight-charts";
import { cn } from "@/lib/utils";
import { Indicators } from "@/lib/api";
import { CandlestickChart as CandleIcon, TrendingUp, AreaChart, Sparkles } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface OHLCVBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ClaudeAnalysisResult {
  content: string;
  is_claude: boolean;
  prompt_type: string;
}

// ── Periods ───────────────────────────────────────────────────────────────────
type Period = "1H" | "1W" | "1M" | "3M" | "1Y" | "5Y" | "MAX";
const PERIOD_CONFIG: Record<Period, { days: number; label: string }> = {
  "1H":  { days: 5,    label: "1H"  },   // no intraday → son 5 gün
  "1W":  { days: 7,    label: "1H"  },
  "1M":  { days: 30,   label: "1G"  },
  "3M":  { days: 90,   label: "1G"  },
  "1Y":  { days: 365,  label: "1G"  },
  "5Y":  { days: 1825, label: "1H"  },
  "MAX": { days: 9999, label: "1H"  },
};
const PERIODS: Period[] = ["1W", "1M", "3M", "1Y", "5Y", "MAX"];

// ── Chart types ───────────────────────────────────────────────────────────────
type ChartType = "candle" | "line" | "area";

// ── Sub-panel indicators ──────────────────────────────────────────────────────
type SubPanel = "none" | "rsi" | "macd" | "stoch";

// ── Prompt types ──────────────────────────────────────────────────────────────
type PromptType = "teknik" | "wall_street" | "giris" | "risk_harita" | "bear_bull" | "destek_direnc" | "hacim" | "beklenti" | "nakit_kalite" | "kazanc_kalite";
const PROMPT_OPTIONS: { id: PromptType; label: string; emoji: string }[] = [
  { id: "teknik",        label: "Teknik",                emoji: "📊" },
  { id: "wall_street",   label: "Wall Street",           emoji: "🏦" },
  { id: "giris",         label: "Giriş Noktası",         emoji: "🎯" },
  { id: "risk_harita",   label: "Risk Haritası",         emoji: "⚠️" },
  { id: "bear_bull",     label: "Bear/Bull",             emoji: "🐻" },
  { id: "destek_direnc", label: "Destek/Direnç",         emoji: "📐" },
  { id: "hacim",         label: "Hacim Analizi",         emoji: "📦" },
  { id: "beklenti",      label: "Piyasa Ne Fiyatlamış?", emoji: "🔮" },
  { id: "nakit_kalite",  label: "Nakit Kalitesi",        emoji: "💵" },
  { id: "kazanc_kalite", label: "Kazanç Sürekliliği",    emoji: "♻️" },
];

// ── Colors ────────────────────────────────────────────────────────────────────
const C = {
  bg:       "#09090b",
  grid:     "#27272a",
  text:     "#71717a",
  up:       "#10b981",
  down:     "#ef4444",
  ema20:    "#60a5fa",
  ema50:    "#a78bfa",
  ema200:   "#f97316",
  bb:       "#22d3ee",
  vwap:     "#f472b6",
  volume:   "#3f3f46",
  rsi:      "#facc15",
  macd:     "#60a5fa",
  macdSig:  "#f97316",
  macdHist: "#10b981",
  stochK:   "#c084fc",
  stochD:   "#fb923c",
};

// ── Markdown renderer ─────────────────────────────────────────────────────────
function MarkdownText({ text }: { text: string }) {
  return (
    <div className="space-y-1 text-xs leading-relaxed">
      {text.split("\n").map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        const bold = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        if (line.match(/^#{1,3} /))
          return <p key={i} className="font-bold text-white text-xs mt-2">{line.replace(/^#+\s/, "")}</p>;
        if (line.startsWith("- ") || line.startsWith("• "))
          return <p key={i} className="text-zinc-300 pl-2">· {line.replace(/^[•\-]\s*/, "")}</p>;
        return <p key={i} className="text-zinc-300" dangerouslySetInnerHTML={{ __html: bold }} />;
      })}
    </div>
  );
}

// ── Legend line ───────────────────────────────────────────────────────────────
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-zinc-500">
      <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-[10px]">{label}</span>
    </span>
  );
}

// ── Toggle button ─────────────────────────────────────────────────────────────
function ToggleBtn({
  active, onClick, color = "zinc", children,
}: {
  active: boolean; onClick: () => void; color?: string; children: React.ReactNode;
}) {
  const activeClass =
    color === "blue"   ? "bg-blue-500/15 border-blue-500/40 text-blue-400" :
    color === "purple" ? "bg-purple-500/15 border-purple-500/40 text-purple-400" :
    color === "orange" ? "bg-orange-500/15 border-orange-500/40 text-orange-400" :
    color === "cyan"   ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-400" :
    color === "pink"   ? "bg-pink-500/15 border-pink-500/40 text-pink-400" :
    color === "yellow" ? "bg-yellow-500/15 border-yellow-500/40 text-yellow-400" :
    "bg-zinc-700 border-zinc-600 text-zinc-200";
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-[10px] font-semibold px-2 py-1 rounded border transition-all",
        active ? activeClass : "bg-transparent border-zinc-700 text-zinc-600 hover:text-zinc-400 hover:border-zinc-600"
      )}>
      {children}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  symbol: string;
  indicators: Indicators;
}

export function CandlestickChart({ symbol, indicators }: Props) {
  const [period,     setPeriod]     = useState<Period>("3M");
  const [chartType,  setChartType]  = useState<ChartType>("candle");
  const [showEma20,  setShowEma20]  = useState(true);
  const [showEma50,  setShowEma50]  = useState(true);
  const [showEma200, setShowEma200] = useState(true);
  const [showBB,     setShowBB]     = useState(false);
  const [showVwap,   setShowVwap]   = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [subPanel,   setSubPanel]   = useState<SubPanel>("rsi");
  const [promptType, setPromptType] = useState<PromptType>("teknik");
  const [analysis,   setAnalysis]   = useState<ClaudeAnalysisResult | null>(null);
  const [analyzing,  setAnalyzing]  = useState(false);
  const [analysisErr,setAnalysisErr]= useState<string | null>(null);
  const [showPrompts,setShowPrompts]= useState(false);

  const mainRef = useRef<HTMLDivElement>(null);
  const subRef  = useRef<HTMLDivElement>(null);
  const mainChartRef = useRef<IChartApi | null>(null);
  const subChartRef  = useRef<IChartApi | null>(null);

  const days = PERIOD_CONFIG[period].days;

  const { data: ohlcv, isLoading } = useQuery<OHLCVBar[]>({
    queryKey: ["ohlcv", symbol, days],
    queryFn: () =>
      fetch(`${API_BASE}/api/analysis/${symbol}/ohlcv?days=${days}`)
        .then(r => r.json()),
    staleTime: 60_000,
  });

  // ── Build charts ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mainRef.current || !ohlcv || ohlcv.length === 0) return;

    const hasSubPanel = subPanel !== "none";
    const mainHeight  = hasSubPanel ? 300 : 400;
    const subHeight   = 110;

    // ── Main chart ────────────────────────────────────────────────────────
    const main = createChart(mainRef.current, {
      layout:           { background: { type: ColorType.Solid, color: C.bg }, textColor: C.text },
      grid:             { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
      crosshair:        { mode: CrosshairMode.Normal },
      rightPriceScale:  { borderColor: C.grid, scaleMargins: { top: 0.08, bottom: showVolume ? 0.22 : 0.04 } },
      timeScale:        { borderColor: C.grid, timeVisible: true, secondsVisible: false },
      width:  mainRef.current.clientWidth,
      height: mainHeight,
    });
    mainChartRef.current = main;

    type TimePoint = `${number}-${number}-${number}`;
    const toTime = (d: string) => d as TimePoint;

    // ── Price series ──────────────────────────────────────────────────────
    if (chartType === "candle") {
      const s = main.addSeries(CandlestickSeries, {
        upColor: C.up, downColor: C.down,
        borderUpColor: C.up, borderDownColor: C.down,
        wickUpColor: C.up, wickDownColor: C.down,
      });
      s.setData(ohlcv.map(b => ({ time: toTime(b.date), open: b.open, high: b.high, low: b.low, close: b.close })));
    } else if (chartType === "line") {
      const s = main.addSeries(LineSeries, { color: C.up, lineWidth: 2, lastValueVisible: true, priceLineVisible: false });
      s.setData(ohlcv.map(b => ({ time: toTime(b.date), value: b.close })));
    } else {
      const s = main.addSeries(AreaSeries, {
        lineColor:   C.up,
        topColor:    C.up + "40",
        bottomColor: C.up + "05",
        lineWidth:   2,
        lastValueVisible: true,
        priceLineVisible: false,
      });
      s.setData(ohlcv.map(b => ({ time: toTime(b.date), value: b.close })));
    }

    // ── EMA overlays ──────────────────────────────────────────────────────
    const addEma = (vals: number[], color: string, style: LineStyle = LineStyle.Solid) => {
      const s = main.addSeries(LineSeries, { color, lineWidth: 1, lineStyle: style, lastValueVisible: false, priceLineVisible: false });
      const n = Math.min(days, indicators.series.dates.length);
      const offset = indicators.series.dates.length - n;
      s.setData(
        indicators.series.dates.slice(-n)
          .map((d, i) => ({ time: toTime(d), value: vals[offset + i] }))
          .filter(p => p.value != null)
      );
    };

    if (indicators?.series) {
      if (showEma20  && indicators.series.ema20)  addEma(indicators.series.ema20,  C.ema20,  LineStyle.Solid);
      if (showEma50  && indicators.series.ema50)  addEma(indicators.series.ema50,  C.ema50,  LineStyle.Dashed);
      if (showEma200 && indicators.series.ema200) addEma(indicators.series.ema200, C.ema200, LineStyle.SparseDotted);

      // ── Bollinger Bands ──────────────────────────────────────────────────
      if (showBB && indicators.series.bb_upper && indicators.series.bb_lower) {
        const n = Math.min(days, indicators.series.dates.length);
        const off = indicators.series.dates.length - n;
        const dates = indicators.series.dates.slice(-n);
        const mkSeries = (vals: number[], style: LineStyle) => {
          const s = main.addSeries(LineSeries, { color: C.bb, lineWidth: 1, lineStyle: style, lastValueVisible: false, priceLineVisible: false });
          s.setData(dates.map((d, i) => ({ time: toTime(d), value: vals[off + i] })).filter(p => p.value != null));
        };
        mkSeries(indicators.series.bb_upper,  LineStyle.Dashed);
        mkSeries(indicators.series.bb_middle, LineStyle.Dotted);
        mkSeries(indicators.series.bb_lower,  LineStyle.Dashed);
      }

      // ── VWAP ─────────────────────────────────────────────────────────────
      if (showVwap && indicators.series.vwap) {
        const s = main.addSeries(LineSeries, { color: C.vwap, lineWidth: 1, lineStyle: LineStyle.Solid, lastValueVisible: false, priceLineVisible: false });
        const n = Math.min(days, indicators.series.dates.length);
        const off = indicators.series.dates.length - n;
        s.setData(
          indicators.series.dates.slice(-n)
            .map((d, i) => ({ time: toTime(d), value: indicators.series.vwap![off + i] }))
            .filter(p => p.value != null && p.value > 0)
        );
      }
    }

    // ── Volume ───────────────────────────────────────────────────────────
    if (showVolume) {
      const vs = main.addSeries(HistogramSeries, { color: C.volume, priceFormat: { type: "volume" }, priceScaleId: "vol" });
      main.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 }, borderVisible: false });
      vs.setData(ohlcv.map(b => ({
        time:  toTime(b.date),
        value: b.volume,
        color: b.close >= b.open ? C.up + "55" : C.down + "55",
      })));
    }

    // ── Sub panel ─────────────────────────────────────────────────────────
    let sub: IChartApi | null = null;
    if (hasSubPanel && subRef.current && indicators?.series) {
      sub = createChart(subRef.current, {
        layout:          { background: { type: ColorType.Solid, color: C.bg }, textColor: C.text },
        grid:            { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
        crosshair:       { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: C.grid, scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale:       { borderColor: C.grid, timeVisible: true, visible: false },
        width:  subRef.current.clientWidth,
        height: subHeight,
      });
      subChartRef.current = sub;

      const n   = Math.min(days, indicators.series.dates.length);
      const off = indicators.series.dates.length - n;
      const dates = indicators.series.dates.slice(-n);
      const mkLine = (vals: number[], color: string, lw: 1 | 2 | 3 | 4 = 1) => {
        const s = sub!.addSeries(LineSeries, { color, lineWidth: lw, lastValueVisible: true, priceLineVisible: false });
        s.setData(dates.map((d, i) => ({ time: toTime(d), value: vals[off + i] })).filter(p => p.value != null));
        return s;
      };

      if (subPanel === "rsi" && indicators.series.rsi) {
        mkLine(indicators.series.rsi, C.rsi);
        // OB/OS reference lines
        const fd = toTime(dates[0]), ld = toTime(dates[dates.length - 1]);
        const ob = sub.addSeries(LineSeries, { color: C.down, lineWidth: 1, lineStyle: LineStyle.Dashed, lastValueVisible: false, priceLineVisible: false });
        const os = sub.addSeries(LineSeries, { color: C.up,   lineWidth: 1, lineStyle: LineStyle.Dashed, lastValueVisible: false, priceLineVisible: false });
        ob.setData([{ time: fd, value: 70 }, { time: ld, value: 70 }]);
        os.setData([{ time: fd, value: 30 }, { time: ld, value: 30 }]);
      }

      if (subPanel === "macd" && indicators.series.macd) {
        mkLine(indicators.series.macd,       C.macd,    1);
        mkLine(indicators.series.macd_signal, C.macdSig, 1);
        const hs = sub.addSeries(HistogramSeries, { priceScaleId: "right" });
        hs.setData(dates.map((d, i) => {
          const v = indicators.series.macd_histogram[off + i];
          return { time: toTime(d), value: v, color: v >= 0 ? C.up + "99" : C.down + "99" };
        }).filter(p => p.value != null));
      }

      if (subPanel === "stoch" && indicators.stoch_k != null) {
        // Use available stoch series or build flat line from current values
        const kVal = indicators.stoch_k;
        const dVal = indicators.stoch_d ?? kVal;
        const kFill = dates.map((d) => ({ time: toTime(d), value: kVal }));
        const dFill = dates.map((d) => ({ time: toTime(d), value: dVal }));
        const sk = sub.addSeries(LineSeries, { color: C.stochK, lineWidth: 1, lastValueVisible: true, priceLineVisible: false });
        const sd = sub.addSeries(LineSeries, { color: C.stochD, lineWidth: 1, lineStyle: LineStyle.Dashed, lastValueVisible: true, priceLineVisible: false });
        sk.setData(kFill);
        sd.setData(dFill);
        const fd = toTime(dates[0]), ld = toTime(dates[dates.length - 1]);
        const ob = sub.addSeries(LineSeries, { color: C.down, lineWidth: 1, lineStyle: LineStyle.Dashed, lastValueVisible: false, priceLineVisible: false });
        const os = sub.addSeries(LineSeries, { color: C.up,   lineWidth: 1, lineStyle: LineStyle.Dashed, lastValueVisible: false, priceLineVisible: false });
        ob.setData([{ time: fd, value: 80 }, { time: ld, value: 80 }]);
        os.setData([{ time: fd, value: 20 }, { time: ld, value: 20 }]);
      }

      // Sync time scales
      main.timeScale().subscribeVisibleLogicalRangeChange(r => { if (r) sub!.timeScale().setVisibleLogicalRange(r); });
      sub.timeScale().subscribeVisibleLogicalRangeChange(r => {  if (r) main.timeScale().setVisibleLogicalRange(r); });
    }

    main.timeScale().fitContent();

    // Resize
    const ro = new ResizeObserver(() => {
      if (mainRef.current) main.applyOptions({ width: mainRef.current.clientWidth });
      if (subRef.current && sub) sub.applyOptions({ width: subRef.current.clientWidth });
    });
    if (mainRef.current) ro.observe(mainRef.current);

    return () => {
      ro.disconnect();
      main.remove();
      sub?.remove();
      mainChartRef.current = null;
      subChartRef.current  = null;
    };
  }, [ohlcv, chartType, showEma20, showEma50, showEma200, showBB, showVwap, showVolume, subPanel, indicators, days]);

  // ── AI analysis ───────────────────────────────────────────────────────────
  const runAnalysis = useCallback(async () => {
    setAnalyzing(true); setAnalysisErr(null);
    try {
      const res = await fetch(`${API_BASE}/api/analysis/${symbol}/claude-analyze`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt_type: promptType }),
      });
      if (!res.ok) throw new Error();
      setAnalysis(await res.json());
    } catch { setAnalysisErr("Analiz yapılamadı."); }
    finally { setAnalyzing(false); }
  }, [symbol, promptType]);

  const lastBar   = ohlcv?.[ohlcv.length - 1];
  const changePct = lastBar ? ((lastBar.close - lastBar.open) / lastBar.open) * 100 : 0;
  const isUp      = changePct >= 0;
  const rsiVal    = indicators?.rsi;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">

      {/* ══ Toolbar row 1 — chart type + periods ══ */}
      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2 border-b border-zinc-800/60 flex-wrap">

        {/* Price info */}
        <div className="flex items-center gap-3">
          {lastBar && (
            <>
              <span className="text-base font-bold text-white font-mono">
                {lastBar.close.toLocaleString("tr-TR", { maximumFractionDigits: 4 })}
              </span>
              <span className={cn("text-sm font-bold", isUp ? "text-emerald-400" : "text-red-400")}>
                {isUp ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%
              </span>
            </>
          )}
          {rsiVal && (
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border font-mono",
              rsiVal < 30 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
              rsiVal > 70 ? "bg-red-500/20 text-red-400 border-red-500/30" :
              "bg-zinc-800 text-zinc-500 border-zinc-700")}>
              RSI {rsiVal.toFixed(1)}
            </span>
          )}
        </div>

        {/* Chart type + Periods */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Chart type */}
          <div className="flex bg-zinc-800 rounded-lg p-0.5 border border-zinc-700">
            <button onClick={() => setChartType("candle")}
              className={cn("p-1.5 rounded-md transition-colors", chartType === "candle" ? "bg-zinc-600 text-white" : "text-zinc-500 hover:text-zinc-300")}
              title="Mum Grafiği">
              <CandleIcon className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setChartType("line")}
              className={cn("p-1.5 rounded-md transition-colors", chartType === "line" ? "bg-zinc-600 text-white" : "text-zinc-500 hover:text-zinc-300")}
              title="Çizgi Grafiği">
              <TrendingUp className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setChartType("area")}
              className={cn("p-1.5 rounded-md transition-colors", chartType === "area" ? "bg-zinc-600 text-white" : "text-zinc-500 hover:text-zinc-300")}
              title="Alan Grafiği">
              <AreaChart className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Period tabs */}
          <div className="flex bg-zinc-800 rounded-lg p-0.5 border border-zinc-700">
            {PERIODS.map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={cn("text-[10px] font-bold px-2.5 py-1 rounded-md transition-colors",
                  period === p ? "bg-zinc-600 text-white" : "text-zinc-500 hover:text-zinc-300")}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ══ Toolbar row 2 — overlays + sub-panels ══ */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800/60 flex-wrap">

        {/* Overlay group */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-zinc-600 uppercase tracking-wide mr-1">Overlay</span>
          <ToggleBtn active={showEma20}  onClick={() => setShowEma20(v => !v)}  color="blue">EMA20</ToggleBtn>
          <ToggleBtn active={showEma50}  onClick={() => setShowEma50(v => !v)}  color="purple">EMA50</ToggleBtn>
          <ToggleBtn active={showEma200} onClick={() => setShowEma200(v => !v)} color="orange">EMA200</ToggleBtn>
          <ToggleBtn active={showBB}     onClick={() => setShowBB(v => !v)}     color="cyan">BB</ToggleBtn>
          <ToggleBtn active={showVwap}   onClick={() => setShowVwap(v => !v)}   color="pink">VWAP</ToggleBtn>
          <ToggleBtn active={showVolume} onClick={() => setShowVolume(v => !v)} color="zinc">Hacim</ToggleBtn>
        </div>

        <div className="h-4 w-px bg-zinc-700 mx-1" />

        {/* Sub-panel group */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-zinc-600 uppercase tracking-wide mr-1">Gösterge</span>
          {(["none", "rsi", "macd", "stoch"] as SubPanel[]).map(sp => (
            <button key={sp} onClick={() => setSubPanel(sp)}
              className={cn("text-[10px] font-semibold px-2 py-1 rounded border transition-all",
                subPanel === sp
                  ? "bg-zinc-700 border-zinc-600 text-white"
                  : "bg-transparent border-zinc-700 text-zinc-600 hover:text-zinc-400 hover:border-zinc-600")}>
              {sp === "none" ? "—" : sp.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* ══ Legend row ══ */}
      <div className="flex items-center gap-4 px-4 py-1.5 border-b border-zinc-800/40 flex-wrap">
        {showEma20  && <LegendDot color={C.ema20}  label={`EMA20 ${indicators?.ema20?.toFixed(2) ?? "—"}`}  />}
        {showEma50  && <LegendDot color={C.ema50}  label={`EMA50 ${indicators?.ema50?.toFixed(2) ?? "—"}`}  />}
        {showEma200 && <LegendDot color={C.ema200} label={`EMA200 ${indicators?.ema200?.toFixed(2) ?? "—"}`} />}
        {showBB     && <LegendDot color={C.bb}     label="Bollinger Bantları" />}
        {showVwap   && <LegendDot color={C.vwap}   label={`VWAP ${indicators?.vwap?.toFixed(2) ?? "—"}`} />}
        {subPanel === "rsi"  && <><LegendDot color={C.rsi}     label="RSI (14)" /><span className="text-[10px] text-red-400">— 70</span><span className="text-[10px] text-emerald-400">— 30</span></>}
        {subPanel === "macd" && <><LegendDot color={C.macd}    label="MACD" /><LegendDot color={C.macdSig} label="Sinyal" /></>}
        {subPanel === "stoch"&& <><LegendDot color={C.stochK}  label="%K" /><LegendDot color={C.stochD} label="%D" /></>}
      </div>

      {/* ══ Chart area ══ */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-900/80">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <div ref={mainRef} className="w-full" />
        {subPanel !== "none" && (
          <>
            <div className="h-px bg-zinc-800" />
            <div className="px-4 py-1 flex items-center gap-2 text-[10px] text-zinc-600 bg-zinc-900">
              <span className="font-semibold text-zinc-500">{subPanel.toUpperCase()}</span>
              {subPanel === "rsi"  && <><span className="text-red-400">70 Aşırı Alım</span><span>·</span><span className="text-emerald-400">30 Aşırı Satım</span></>}
              {subPanel === "macd" && <span>MACD · Sinyal · Histogram</span>}
              {subPanel === "stoch"&& <><span className="text-red-400">80 Aşırı Alım</span><span>·</span><span className="text-emerald-400">20 Aşırı Satım</span></>}
            </div>
            <div ref={subRef} className="w-full" />
          </>
        )}
      </div>

      {/* ══ AI Analysis ══ */}
      <div className="border-t border-zinc-800 p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-xs font-semibold text-zinc-300">AI Grafik Analizi</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Prompt selector toggle */}
            <button onClick={() => setShowPrompts(v => !v)}
              className="text-[10px] px-2.5 py-1 rounded border border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-white transition-colors flex items-center gap-1">
              <span>{PROMPT_OPTIONS.find(o => o.id === promptType)?.emoji}</span>
              <span>{PROMPT_OPTIONS.find(o => o.id === promptType)?.label ?? "Tür"}</span>
              <span>▾</span>
            </button>

            <button onClick={runAnalysis} disabled={analyzing}
              className={cn("text-[10px] font-bold px-4 py-1.5 rounded-lg border transition-all",
                analyzing
                  ? "bg-zinc-800 border-zinc-700 text-zinc-500 cursor-wait"
                  : "bg-blue-600 hover:bg-blue-500 border-blue-500 text-white")}>
              {analyzing ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin" />
                  Analiz ediliyor…
                </span>
              ) : "Analiz Et"}
            </button>
          </div>
        </div>

        {/* Prompt type chips */}
        {showPrompts && (
          <div className="flex flex-wrap gap-1.5">
            {PROMPT_OPTIONS.map(opt => (
              <button key={opt.id} onClick={() => { setPromptType(opt.id); setShowPrompts(false); }}
                className={cn("text-[10px] px-2.5 py-1 rounded-full border transition-all flex items-center gap-1",
                  promptType === opt.id
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200")}>
                <span>{opt.emoji}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        )}

        {analysisErr && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-red-400 text-xs">{analysisErr}</p>
          </div>
        )}

        {analysis && !analyzing && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              {analysis.is_claude
                ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">Claude AI</span>
                : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400 border border-zinc-600">Şablon</span>
              }
              <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                <span>{PROMPT_OPTIONS.find(o => o.id === analysis.prompt_type)?.emoji}</span>
                <span>{PROMPT_OPTIONS.find(o => o.id === analysis.prompt_type)?.label}</span>
              </span>
            </div>
            <MarkdownText text={analysis.content} />
          </div>
        )}

        {!analysis && !analyzing && (
          <p className="text-[11px] text-zinc-600">
            Analiz türünü seç ve "Analiz Et" butonuna bas — AI grafik verilerini yorumlar.
          </p>
        )}
      </div>
    </div>
  );
}
