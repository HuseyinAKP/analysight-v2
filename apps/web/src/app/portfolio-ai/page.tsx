"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  Brain, Plus, Trash2, Sparkles, AlertTriangle, TrendingUp, TrendingDown,
  ShieldAlert, RefreshCw, MessageSquare, Send, BarChart3, ChevronDown,
  ChevronUp, Zap, Target, Activity,
} from "lucide-react";

import { API_BASE } from "@/lib/api";
const API = API_BASE;

// ── Types ─────────────────────────────────────────────────────────────────────

interface Holding {
  id: string;
  symbol: string;
  shares: number;
  avgCost: number;
}

interface EnrichedPosition {
  symbol: string;
  name: string;
  sector: string;
  shares: number;
  avg_cost: number;
  current_price: number;
  cost_basis: number;
  market_value: number;
  pnl: number;
  pnl_pct: number;
  rsi: number;
  score: number;
  macd_bull: boolean;
  bull_prob: number;
  signal: string;
  signal_color: string;
  beta: number;
  rebalance_hint: string;
  rebalance_action: string;
  allocation_pct: number;
}

interface PortfolioMetrics {
  total_value: number;
  total_cost: number;
  total_pnl: number;
  pnl_pct: number;
  health_score: number;
  weighted_beta: number;
  concentration_risk: string;
  sector_allocation: Record<string, number>;
  bull_count: number;
  bear_count: number;
  neutral_count: number;
  avg_score: number;
}

interface RebalanceSuggestion {
  symbol: string;
  action: string;
  hint: string;
  current_weight_pct: number;
  suggested_weight_pct: number;
  value_change: number;
}

interface AnalysisResult {
  positions: EnrichedPosition[];
  metrics: PortfolioMetrics;
  analysis: string;
  is_claude: boolean;
  rebalance_suggestions: RebalanceSuggestion[];
}

interface ScenarioResult {
  market_drop_pct: number;
  portfolio_drop_pct: number;
  portfolio_value_loss: number;
  positions: {
    symbol: string; sector: string; beta: number;
    current_value: number; scenario_value: number;
    scenario_pnl: number; scenario_pnl_pct: number;
    adjusted_drop_pct: number;
  }[];
}

interface ChatMessage {
  role: "user" | "ai";
  text: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SIGNAL_COLORS: Record<string, string> = {
  green: "text-emerald-400",
  yellow: "text-yellow-400",
  red: "text-red-400",
};
const SIGNAL_BG: Record<string, string> = {
  green: "bg-emerald-500/10 border-emerald-500/30",
  yellow: "bg-yellow-500/10 border-yellow-500/30",
  red: "bg-red-500/10 border-red-500/30",
};

const SECTOR_COLORS: Record<string, string> = {
  "Bankacılık": "#3b82f6", "Teknoloji": "#8b5cf6", "Kripto": "#f59e0b",
  "Havacılık": "#10b981", "Enerji": "#ef4444", "Savunma": "#6366f1",
  "Demir-Çelik": "#64748b", "Holding": "#0ea5e9", "Perakende": "#d946ef",
  "Otomotiv": "#84cc16", "Otomotiv/EV": "#22c55e", "Sağlık": "#ec4899",
  "Diğer": "#71717a",
};

function fmt(n: number, dec = 2) { return n.toLocaleString("tr-TR", { maximumFractionDigits: dec }); }
function fmtPct(n: number) { return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`; }

// ── Health Gauge ──────────────────────────────────────────────────────────────

function HealthGauge({ score }: { score: number }) {
  const color = score >= 65 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";
  const label = score >= 65 ? "Sağlıklı" : score >= 40 ? "Orta" : "Riskli";
  const r = 40; const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  return (
    <div className="flex flex-col items-center">
      <svg width={96} height={96} viewBox="0 0 96 96">
        <circle cx={48} cy={48} r={r} fill="none" stroke="#27272a" strokeWidth={8} />
        <circle cx={48} cy={48} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 48 48)" />
        <text x={48} y={52} textAnchor="middle" fontSize={20} fontWeight={800} fill="white">{score}</text>
      </svg>
      <span className="text-xs font-bold mt-1" style={{ color }}>{label}</span>
    </div>
  );
}

// ── Sector Donut ──────────────────────────────────────────────────────────────

function SectorDonut({ allocation }: { allocation: Record<string, number> }) {
  const entries = Object.entries(allocation).sort((a, b) => b[1] - a[1]);
  const size = 120; const r = 45; const cx = 60; const cy = 60;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const slices = entries.map(([sector, pct]) => {
    const len = (pct / 100) * circ;
    const slice = { sector, pct, offset, len, color: SECTOR_COLORS[sector] ?? "#52525b" };
    offset += len;
    return slice;
  });

  return (
    <div className="flex items-center gap-4">
      <svg width={size + 20} height={size + 20} viewBox={`0 0 ${size + 20} ${size + 20}`}>
        {slices.map(s => (
          <circle key={s.sector} cx={cx + 10} cy={cy + 10} r={r} fill="none"
            stroke={s.color} strokeWidth={18}
            strokeDasharray={`${s.len - 2} ${circ - s.len + 2}`}
            strokeDashoffset={circ - s.offset}
            transform={`rotate(-90 ${cx + 10} ${cy + 10})`} />
        ))}
        <circle cx={cx + 10} cy={cy + 10} r={r - 14} fill="#09090b" />
        <text x={cx + 10} y={cy + 7} textAnchor="middle" fontSize={10} fill="#71717a">Sektör</text>
        <text x={cx + 10} y={cy + 20} textAnchor="middle" fontSize={10} fill="#71717a">Dağılımı</text>
      </svg>
      <div className="space-y-1.5 flex-1 min-w-0">
        {slices.map(s => (
          <div key={s.sector} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-xs text-zinc-400 truncate">{s.sector}</span>
            <span className="text-xs font-bold text-zinc-300 ml-auto">%{s.pct}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Analysis Text ─────────────────────────────────────────────────────────────

function AnalysisText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1.5" />;
        if (line.startsWith("**") && line.includes("**", 2)) {
          return <p key={i} className="text-xs font-bold text-zinc-200 mt-3 first:mt-0">{line.replace(/\*\*/g, "")}</p>;
        }
        if (line.startsWith("- ")) {
          return (
            <div key={i} className="flex items-start gap-2">
              <span className="text-blue-400 mt-0.5 shrink-0 text-xs">·</span>
              <p className="text-xs text-zinc-400 leading-relaxed">{line.slice(2)}</p>
            </div>
          );
        }
        return <p key={i} className="text-xs text-zinc-400 leading-relaxed">{line}</p>;
      })}
    </div>
  );
}

// ── Scenario Bar ─────────────────────────────────────────────────────────────

function ScenarioBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(Math.abs(value) / max * 100, 100);
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-zinc-500 w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn("text-xs font-bold font-mono w-16 text-right", color.includes("red") ? "text-red-400" : "text-emerald-400")}>
        {fmtPct(value)}
      </span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PortfolioAIPage() {
  const [holdings, setHoldings] = useState<Holding[]>([
    { id: "1", symbol: "THYAO", shares: 100, avgCost: 280 },
    { id: "2", symbol: "GARAN", shares: 200, avgCost: 110 },
    { id: "3", symbol: "AAPL",  shares: 10,  avgCost: 195 },
    { id: "4", symbol: "BTC-USD", shares: 0.05, avgCost: 60000 },
  ]);
  const [newSym, setNewSym] = useState("");
  const [newShares, setNewShares] = useState("");
  const [newCost, setNewCost] = useState("");
  const [showAddRow, setShowAddRow] = useState(false);

  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const [scenarioDrop, setScenarioDrop] = useState(10);
  const [scenarioResult, setScenarioResult] = useState<ScenarioResult | null>(null);
  const [runningScenario, setRunningScenario] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [expandAnalysis, setExpandAnalysis] = useState(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const addHolding = () => {
    if (!newSym || !newShares || !newCost) return;
    setHoldings(prev => [...prev, {
      id: Date.now().toString(),
      symbol: newSym.toUpperCase(),
      shares: parseFloat(newShares),
      avgCost: parseFloat(newCost),
    }]);
    setNewSym(""); setNewShares(""); setNewCost("");
    setShowAddRow(false);
    setResult(null);
  };

  const removeHolding = (id: string) => {
    setHoldings(prev => prev.filter(h => h.id !== id));
    setResult(null);
  };

  const analyze = useCallback(async () => {
    if (!holdings.length) return;
    setAnalyzing(true);
    setResult(null);
    try {
      const res = await fetch(`${API}/api/portfolio-ai/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdings: holdings.map(h => ({ symbol: h.symbol, shares: h.shares, avg_cost: h.avgCost })) }),
      });
      if (res.ok) setResult(await res.json());
    } catch {/* silent */}
    setAnalyzing(false);
  }, [holdings]);

  const runScenario = useCallback(async () => {
    if (!holdings.length) return;
    setRunningScenario(true);
    try {
      const res = await fetch(`${API}/api/portfolio-ai/scenario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdings: holdings.map(h => ({ symbol: h.symbol, shares: h.shares, avg_cost: h.avgCost })), drop_pct: scenarioDrop }),
      });
      if (res.ok) setScenarioResult(await res.json());
    } catch {/* silent */}
    setRunningScenario(false);
  }, [holdings, scenarioDrop]);

  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setChatLoading(true);
    try {
      const res = await fetch(`${API}/api/portfolio-ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holdings: holdings.map(h => ({ symbol: h.symbol, shares: h.shares, avg_cost: h.avgCost })),
          question: userMsg,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setChatMessages(prev => [...prev, { role: "ai", text: d.answer }]);
      }
    } catch {/* silent */}
    setChatLoading(false);
  }, [chatInput, chatLoading, holdings]);

  const metrics = result?.metrics;

  const QUICK_QUESTIONS = [
    "Portföyümün en büyük riski nedir?",
    "Hangi pozisyondan çıkmalıyım?",
    "Portföyüm piyasaya göre nasıl?",
    "Diversifikasyon yeterli mi?",
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6 pb-24">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="w-5 h-5 text-violet-400" />
            <h1 className="text-xl font-bold text-white">AI Portföy Yöneticisi</h1>
          </div>
          <p className="text-sm text-zinc-500">Pozisyonlarını gir, AI tüm sağlık metriklerini, riskleri ve önerileri hesaplasın</p>
        </div>
        <Link href="/portfolio" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
          Klasik Portföy →
        </Link>
      </div>

      {/* Holdings input */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <span className="text-sm font-semibold text-zinc-200">Portföy Pozisyonları</span>
          <button onClick={() => setShowAddRow(v => !v)}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors">
            <Plus className="w-3.5 h-3.5" /> Ekle
          </button>
        </div>

        <div className="divide-y divide-zinc-800/50">
          {holdings.map(h => (
            <div key={h.id} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-800/20 transition-colors">
              <Link href={`/symbol/${h.symbol}`} className="font-bold text-white text-sm hover:text-blue-400 transition-colors w-20 shrink-0">
                {h.symbol}
              </Link>
              <span className="text-xs text-zinc-500 flex-1">
                {h.shares.toLocaleString()} adet · Ort. {fmt(h.avgCost)}
              </span>
              {result && (() => {
                const pos = result.positions.find(p => p.symbol === h.symbol);
                if (!pos) return null;
                return (
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-zinc-300">{fmt(pos.market_value, 0)}</span>
                    <span className={cn("text-xs font-bold", pos.pnl_pct >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {fmtPct(pos.pnl_pct)}
                    </span>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", SIGNAL_BG[pos.signal_color], SIGNAL_COLORS[pos.signal_color])}>
                      {pos.signal}
                    </span>
                  </div>
                );
              })()}
              <button onClick={() => removeHolding(h.id)} className="text-zinc-700 hover:text-red-400 transition-colors ml-1">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {showAddRow && (
          <div className="px-5 py-4 border-t border-zinc-800 bg-zinc-950/40">
            <div className="flex gap-2">
              <input value={newSym} onChange={e => setNewSym(e.target.value.toUpperCase())}
                placeholder="THYAO" maxLength={10}
                className="w-28 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-zinc-700 focus:outline-none focus:border-blue-500" />
              <input value={newShares} onChange={e => setNewShares(e.target.value)} placeholder="Adet" type="number" step="any"
                className="w-28 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-zinc-700 focus:outline-none focus:border-blue-500" />
              <input value={newCost} onChange={e => setNewCost(e.target.value)} placeholder="Ort. maliyet" type="number" step="any"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-zinc-700 focus:outline-none focus:border-blue-500" />
              <button onClick={addHolding} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors">Ekle</button>
              <button onClick={() => setShowAddRow(false)} className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg text-xs transition-colors">İptal</button>
            </div>
          </div>
        )}

        {/* Analyze button */}
        <div className="px-5 py-4 border-t border-zinc-800">
          <button onClick={analyze} disabled={analyzing || !holdings.length}
            className={cn(
              "w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2",
              analyzing
                ? "bg-violet-700/50 text-violet-300 cursor-wait"
                : !holdings.length
                ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                : "bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white shadow-lg shadow-violet-900/20"
            )}>
            {analyzing ? (
              <>
                <span className="w-4 h-4 border-2 border-violet-300/40 border-t-violet-300 rounded-full animate-spin" />
                AI Portföyü Analiz Ediyor…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                AI ile Analiz Et
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Results ───────────────────────────────────────────────────── */}
      {result && metrics && (
        <>
          {/* Health Dashboard */}
          <div className={cn(
            "rounded-2xl border p-5",
            metrics.health_score >= 65 ? "bg-emerald-500/5 border-emerald-500/20"
            : metrics.health_score >= 40 ? "bg-yellow-500/5 border-yellow-500/20"
            : "bg-red-500/5 border-red-500/20"
          )}>
            <div className="flex items-start gap-6">
              <HealthGauge score={metrics.health_score} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-base font-bold text-white">Portföy Sağlık Raporu</h2>
                  {result.is_claude && (
                    <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                      <Sparkles className="w-2.5 h-2.5" /> Claude AI
                    </span>
                  )}
                </div>

                {/* KPI grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "Toplam Değer", value: `${fmt(metrics.total_value, 0)}`, sub: "TRY/USD karışık", icon: <BarChart3 className="w-3.5 h-3.5 text-blue-400" /> },
                    {
                      label: "Toplam P&L",
                      value: fmtPct(metrics.pnl_pct),
                      sub: `${metrics.total_pnl >= 0 ? "+" : ""}${fmt(metrics.total_pnl, 0)}`,
                      color: metrics.pnl_pct >= 0 ? "text-emerald-400" : "text-red-400",
                      icon: metrics.pnl_pct >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> : <TrendingDown className="w-3.5 h-3.5 text-red-400" />,
                    },
                    {
                      label: "Konsantrasyon",
                      value: metrics.concentration_risk,
                      sub: `Beta ${metrics.weighted_beta.toFixed(2)}`,
                      color: metrics.concentration_risk === "Yüksek" ? "text-red-400" : metrics.concentration_risk === "Orta" ? "text-yellow-400" : "text-emerald-400",
                      icon: <ShieldAlert className="w-3.5 h-3.5 text-yellow-400" />,
                    },
                    {
                      label: "Sinyal Dağılımı",
                      value: `${metrics.bull_count}▲ ${metrics.bear_count}▼`,
                      sub: `${metrics.neutral_count} nötr`,
                      icon: <Activity className="w-3.5 h-3.5 text-violet-400" />,
                    },
                  ].map(k => (
                    <div key={k.label} className="bg-zinc-900/60 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-1.5">{k.icon}<p className="text-[10px] text-zinc-500">{k.label}</p></div>
                      <p className={cn("text-sm font-bold", k.color ?? "text-white")}>{k.value}</p>
                      {k.sub && <p className="text-[10px] text-zinc-600 mt-0.5">{k.sub}</p>}
                    </div>
                  ))}
                </div>

                {/* AI Analysis text */}
                <div className={cn("transition-all overflow-hidden", expandAnalysis ? "max-h-none" : "max-h-24")}>
                  <AnalysisText text={result.analysis} />
                </div>
                <button onClick={() => setExpandAnalysis(v => !v)}
                  className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 mt-2 transition-colors">
                  {expandAnalysis ? <><ChevronUp className="w-3 h-3" /> Daha az göster</> : <><ChevronDown className="w-3 h-3" /> Tüm analizi göster</>}
                </button>
              </div>
            </div>
          </div>

          {/* 2-col: positions + sector */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Position table */}
            <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-zinc-200">Pozisyon Analizi</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-600 uppercase tracking-wide">
                      <th className="text-left py-3 px-4">Sembol</th>
                      <th className="text-right py-3 px-3">Değer</th>
                      <th className="text-right py-3 px-3">P&L</th>
                      <th className="text-center py-3 px-3">Skor</th>
                      <th className="text-center py-3 px-3">RSI</th>
                      <th className="text-left py-3 px-3">Öneri</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.positions.map(p => (
                      <tr key={p.symbol} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                        <td className="py-3 px-4">
                          <Link href={`/symbol/${p.symbol}`} className="font-bold text-white hover:text-blue-400 transition-colors">{p.symbol}</Link>
                          <div className="text-[10px] text-zinc-600">{p.sector} · %{p.allocation_pct}</div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-zinc-300">{fmt(p.market_value, 0)}</td>
                        <td className="py-3 px-3 text-right">
                          <span className={cn("font-bold", p.pnl_pct >= 0 ? "text-emerald-400" : "text-red-400")}>{fmtPct(p.pnl_pct)}</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={cn("font-bold", p.score >= 65 ? "text-emerald-400" : p.score >= 40 ? "text-yellow-400" : "text-red-400")}>{p.score}</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={cn("font-mono", p.rsi > 70 ? "text-red-400" : p.rsi < 30 ? "text-emerald-400" : "text-zinc-400")}>{p.rsi}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-full",
                            p.rebalance_action === "reduce" ? "bg-orange-500/10 text-orange-400" :
                            p.rebalance_action === "add"    ? "bg-emerald-500/10 text-emerald-400" :
                            p.rebalance_action === "watch"  ? "bg-red-500/10 text-red-400" :
                            "bg-zinc-800 text-zinc-500")}>
                            {p.rebalance_hint}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sector donut + concentration */}
            <div className="space-y-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                <h3 className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Sektör Dağılımı</h3>
                <SectorDonut allocation={metrics.sector_allocation} />
              </div>

              {/* Rebalance suggestions */}
              {result.rebalance_suggestions.length > 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                  <div className="flex items-center gap-1.5 mb-3">
                    <Zap className="w-3.5 h-3.5 text-yellow-400" />
                    <h3 className="text-xs font-semibold text-zinc-300">Dengeleme Önerileri</h3>
                  </div>
                  {result.rebalance_suggestions.map(s => (
                    <div key={s.symbol} className={cn("border rounded-xl p-3 mb-2 last:mb-0",
                      s.action === "reduce" ? "border-orange-500/20 bg-orange-500/5" : "border-emerald-500/20 bg-emerald-500/5")}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-white">{s.symbol}</span>
                        <span className={cn("text-[10px] font-bold", s.action === "reduce" ? "text-orange-400" : "text-emerald-400")}>
                          {s.action === "reduce" ? "Azalt" : "Artır"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500 mb-1.5">
                        <span>Mevcut: %{s.current_weight_pct}</span>
                        <span>→</span>
                        <span className={s.action === "reduce" ? "text-orange-400" : "text-emerald-400"}>%{s.suggested_weight_pct}</span>
                      </div>
                      <p className="text-[10px] text-zinc-500">{s.hint}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Scenario Stress Test */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <h3 className="text-sm font-semibold text-zinc-200">Senaryo Analizi — Stres Testi</h3>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-4 mb-5">
                <p className="text-xs text-zinc-500">Piyasa</p>
                {[5, 10, 20, 30].map(d => (
                  <button key={d} onClick={() => setScenarioDrop(d)}
                    className={cn("text-xs font-bold px-3 py-1.5 rounded-lg border transition-all",
                      scenarioDrop === d
                        ? "bg-red-500/20 border-red-500/30 text-red-400"
                        : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300")}>
                    -%{d}
                  </button>
                ))}
                <span className="text-xs text-zinc-600">düşerse portföy nasıl etkilenir?</span>
                <button onClick={runScenario} disabled={runningScenario}
                  className="ml-auto flex items-center gap-1.5 text-xs font-bold px-4 py-1.5 rounded-lg bg-red-900/30 border border-red-500/30 text-red-400 hover:bg-red-900/50 transition-colors">
                  {runningScenario ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Hesapla
                </button>
              </div>

              {scenarioResult && (
                <div>
                  <div className="flex items-center gap-6 mb-4 p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                    <div>
                      <p className="text-[10px] text-zinc-500">Piyasa Düşüşü</p>
                      <p className="text-xl font-bold text-red-400">-%{scenarioResult.market_drop_pct}</p>
                    </div>
                    <div className="w-px h-10 bg-zinc-800" />
                    <div>
                      <p className="text-[10px] text-zinc-500">Portföy Kayıp (Beta Ağırlıklı)</p>
                      <p className="text-xl font-bold text-red-400">{fmtPct(scenarioResult.portfolio_drop_pct)}</p>
                    </div>
                    <div className="w-px h-10 bg-zinc-800" />
                    <div>
                      <p className="text-[10px] text-zinc-500">Tahmini Değer Kaybı</p>
                      <p className="text-xl font-bold text-red-400">{fmt(scenarioResult.portfolio_value_loss, 0)}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {scenarioResult.positions.sort((a, b) => a.scenario_pnl_pct - b.scenario_pnl_pct).map(p => (
                      <ScenarioBar key={p.symbol} label={p.symbol} value={p.scenario_pnl_pct} max={60} color="bg-red-500/60" />
                    ))}
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-3">Beta değerleri sektörel ortalamalar kullanılarak hesaplanmıştır. Kripto pozisyonlar yüksek volatilite nedeniyle daha fazla etkilenir.</p>
                </div>
              )}
            </div>
          </div>

          {/* AI Chat */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-zinc-800">
              <MessageSquare className="w-4 h-4 text-violet-400" />
              <h3 className="text-sm font-semibold text-zinc-200">Portföy AI Asistanı</h3>
              <span className="ml-auto text-[10px] text-zinc-600">Portföyün hakkında her şeyi sor</span>
            </div>

            {/* Quick questions */}
            {chatMessages.length === 0 && (
              <div className="px-5 pt-4 flex flex-wrap gap-2">
                {QUICK_QUESTIONS.map(q => (
                  <button key={q} onClick={() => { setChatInput(q); }}
                    className="text-[10px] px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-zinc-700 transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Messages */}
            {chatMessages.length > 0 && (
              <div className="px-5 py-4 space-y-3 max-h-64 overflow-y-auto"
                style={{ scrollbarWidth: "thin", scrollbarColor: "#3f3f46 transparent" }}>
                {chatMessages.map((m, i) => (
                  <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed",
                      m.role === "user"
                        ? "bg-violet-600 text-white"
                        : "bg-zinc-800 text-zinc-300 border border-zinc-700")}>
                      {m.role === "ai" ? <AnalysisText text={m.text} /> : m.text}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2">
                      <div className="flex gap-1">
                        {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}

            {/* Input */}
            <div className="px-5 py-3 border-t border-zinc-800 flex gap-2">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendChat()}
                placeholder="Portföyüm hakkında bir şey sor…"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
              />
              <button onClick={sendChat} disabled={!chatInput.trim() || chatLoading}
                className={cn("p-2.5 rounded-xl transition-all",
                  chatInput.trim() && !chatLoading
                    ? "bg-violet-600 hover:bg-violet-500 text-white"
                    : "bg-zinc-800 text-zinc-600 cursor-not-allowed")}>
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!result && !analyzing && (
        <div className="text-center py-16 text-zinc-700">
          <Brain className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-sm">Pozisyonlarını gir ve "AI ile Analiz Et" butonuna tıkla.</p>
          <p className="text-xs mt-1 text-zinc-800">Portföy sağlığı, risk metrikleri, dengeleme önerileri ve stres testi hazır olacak.</p>
        </div>
      )}
    </div>
  );
}
