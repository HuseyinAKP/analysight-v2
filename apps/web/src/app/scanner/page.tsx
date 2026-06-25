"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { scannerApi, ScanResult } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Search, Zap } from "lucide-react";
import Link from "next/link";

import { API_BASE } from "@/lib/api";
const API = API_BASE;

interface PresetInfo { id: string; label: string; emoji: string; description: string; }
interface PresetGroup { group: string; presets: PresetInfo[]; }

// ── Score ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const color = score >= 65 ? "#34d399" : score >= 50 ? "#facc15" : score >= 35 ? "#fb923c" : "#f87171";
  return (
    <div className="relative w-11 h-11 shrink-0">
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#27272a" strokeWidth="3" />
        <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${score} ${100 - score}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-bold text-white">{score}</span>
      </div>
    </div>
  );
}

// ── Result Card ───────────────────────────────────────────────────────────────
type ExtendedResult = ScanResult & {
  confluence_score?: number;
  ema_trend?: string;
  ml_prob_5d?: number | null;
  ml_prob_10d?: number | null;
  ml_prob_20d?: number | null;
};

function MLBadge({ prob }: { prob: number }) {
  const color = prob >= 65 ? "text-emerald-400 bg-emerald-500/15 border-emerald-500/30"
              : prob >= 55 ? "text-blue-400 bg-blue-500/15 border-blue-500/30"
              : "text-amber-400 bg-amber-500/15 border-amber-500/30";
  return (
    <span className={cn("flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border", color)}>
      <Zap className="w-2.5 h-2.5" />ML %{prob.toFixed(0)}
    </span>
  );
}

function ResultCard({ r }: { r: ExtendedResult }) {
  const up = r.change_pct >= 0;
  const hasML = r.ml_prob_5d != null;
  return (
    <Link href={`/symbol/${r.symbol}`}
      className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 hover:border-zinc-600 transition-all group">

      <ScoreRing score={r.score} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-bold text-white text-sm group-hover:text-blue-400 transition-colors">{r.symbol}</span>
          <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-bold",
            r.market === "BIST" ? "bg-red-500/20 text-red-400" :
            r.market === "NASDAQ" || r.market === "NYSE" ? "bg-blue-500/20 text-blue-400" :
            "bg-purple-500/20 text-purple-400")}>
            {r.market}
          </span>
          {r.ema_trend === "above" && (
            <span className="text-[9px] text-emerald-600">EMA↑</span>
          )}
        </div>
        <p className="text-[10px] text-zinc-600 truncate">{r.name}</p>

        {/* Indicator pills */}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {hasML && <MLBadge prob={r.ml_prob_5d!} />}
          <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-medium",
            r.rsi < 30 ? "bg-emerald-500/20 text-emerald-400" :
            r.rsi > 70 ? "bg-red-500/20 text-red-400" :
            "bg-zinc-800 text-zinc-500")}>
            RSI {r.rsi.toFixed(0)}
          </span>
          <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-medium",
            r.macd_bullish ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400")}>
            MACD {r.macd_bullish ? "▲" : "▼"}
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-500 font-medium">
            ADX {r.adx?.toFixed(0)}
          </span>
          {r.stoch_signal === "Al" && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
              Stoch Al
            </span>
          )}
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className="font-mono font-bold text-white text-sm">
          {r.price.toLocaleString("tr-TR", { maximumFractionDigits: 4 })}
        </p>
        <p className={cn("text-[11px] font-mono font-semibold", up ? "text-emerald-400" : "text-red-400")}>
          {up ? "▲" : "▼"}{Math.abs(r.change_pct).toFixed(2)}%
        </p>
        <p className="text-[9px] text-zinc-600 mt-0.5">Boğa %{r.bull_prob}</p>
      </div>
    </Link>
  );
}

// ── Model Seçici (BistScaN tarzı) ────────────────────────────────────────────
function ModelSelector({
  groups, selected, onToggle,
}: {
  groups: PresetGroup[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      {groups.map(g => (
        <div key={g.group}>
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">{g.group}</p>
          <div className="grid grid-cols-2 gap-2">
            {g.presets.map(p => {
              const active = selected.includes(p.id);
              return (
                <button key={p.id} onClick={() => onToggle(p.id)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition-all",
                    active
                      ? "border-blue-500/60 bg-blue-500/10 shadow-sm shadow-blue-500/10"
                      : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                  )}>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("text-xs font-semibold", active ? "text-blue-300" : "text-zinc-300")}>
                      {p.label}
                    </span>
                    {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />}
                  </div>
                  <p className="text-[10px] text-zinc-600 leading-relaxed">{p.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Market filter ─────────────────────────────────────────────────────────────
const MARKETS = [
  { id: "all", label: "Tümü" },
  { id: "BIST", label: "🇹🇷 BIST" },
  { id: "NASDAQ", label: "🇺🇸 ABD" },
  { id: "CRYPTO", label: "₿ Kripto" },
];

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ScannerPage() {
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [activeMarket, setActiveMarket] = useState("all");
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<(ScanResult & { confluence_score?: number; ema_trend?: string })[] | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"score" | "rsi" | "change_pct" | "ml">("score");

  // Preset groups from API
  const { data: groups = [] } = useQuery<PresetGroup[]>({
    queryKey: ["preset-groups"],
    queryFn: () => fetch(`${API}/api/scan/preset-groups`).then(r => r.json()),
    staleTime: 300_000,
  });

  const toggleModel = (id: string) => {
    setSelectedModels(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 3) return prev; // max 3
      return [...prev, id];
    });
  };

  const runScan = async () => {
    if (selectedModels.length === 0) return;
    setScanning(true);
    setResults(null);

    try {
      // Run all selected models and merge/intersect results
      const allResults = await Promise.all(
        selectedModels.map(id =>
          fetch(`${API}/api/scan/preset/${id}`).then(r => r.json())
        )
      );

      let merged: typeof results;
      if (allResults.length === 1) {
        merged = allResults[0];
      } else {
        // Intersection: only symbols appearing in ALL selected models
        const symbolSets = allResults.map(r => new Set((r as ScanResult[]).map((x: ScanResult) => x.symbol)));
        const intersect = [...symbolSets[0]].filter(s => symbolSets.every(set => set.has(s)));
        // Use the first result's data, boost score for intersection
        merged = (allResults[0] as ScanResult[])
          .filter(r => intersect.includes(r.symbol))
          .map(r => ({ ...r, score: Math.min(100, r.score + (selectedModels.length - 1) * 5) }));
      }

      // Market filter
      if (activeMarket !== "all") {
        merged = (merged ?? []).filter((r) => r.market === activeMarket);
      }

      setResults(merged ?? []);
    } finally {
      setScanning(false);
    }
  };

  const runPreset = async (id: string) => {
    setActivePreset(id);
    setScanning(true);
    setResults(null);
    try {
      const data = await fetch(`${API}/api/scan/preset/${id}`).then(r => r.json());
      let filtered = data;
      if (activeMarket !== "all") filtered = data.filter((r: ScanResult) => r.market === activeMarket);
      setResults(filtered);
    } finally {
      setScanning(false);
    }
  };

  const sorted = results ? [...results].sort((a, b) => {
    if (sortBy === "score") return b.score - a.score;
    if (sortBy === "rsi") return a.rsi - b.rsi;
    if (sortBy === "change_pct") return b.change_pct - a.change_pct;
    if (sortBy === "ml") {
      const aML = (a as ExtendedResult).ml_prob_5d ?? 0;
      const bML = (b as ExtendedResult).ml_prob_5d ?? 0;
      return bML - aML;
    }
    return 0;
  }) : [];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Akıllı Tarayıcı</h1>
          <p className="text-zinc-500 text-sm">
            Max 3 model seç, kombinasyonda geçen hisseleri bul
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left: Model seçici ── */}
          <div className="lg:col-span-1 space-y-5">

            {/* Market tabs */}
            <div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Piyasa</p>
              <div className="flex gap-1.5 flex-wrap">
                {MARKETS.map(m => (
                  <button key={m.id} onClick={() => setActiveMarket(m.id)}
                    className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      activeMarket === m.id
                        ? "bg-white text-zinc-950"
                        : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-zinc-700")}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Model seçici */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Model Seç</p>
                  <p className="text-[10px] text-zinc-700 mt-0.5">Maksimum 3 model</p>
                </div>
                {selectedModels.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {[1, 2, 3].map(i => (
                        <div key={i}
                          className={cn("w-2 h-2 rounded-full", i <= selectedModels.length ? "bg-blue-400" : "bg-zinc-800")} />
                      ))}
                    </div>
                    <button onClick={() => setSelectedModels([])}
                      className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">
                      Temizle
                    </button>
                  </div>
                )}
              </div>
              <ModelSelector groups={groups} selected={selectedModels} onToggle={toggleModel} />
            </div>

            {/* Scan button */}
            <button
              onClick={runScan}
              disabled={selectedModels.length === 0 || scanning}
              className={cn(
                "w-full py-3.5 rounded-xl font-bold text-sm transition-all",
                selectedModels.length === 0
                  ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                  : scanning
                    ? "bg-blue-700 text-blue-200 cursor-wait animate-pulse"
                    : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 active:scale-95"
              )}>
              {scanning ? "Taranıyor…" : selectedModels.length === 0 ? "Model seç" :
                `${selectedModels.length} Model ile Tara`}
            </button>

            {/* Hızlı preset listesi */}
            <div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Hızlı Tara</p>
              <div className="space-y-1">
                {groups.flatMap(g => g.presets).slice(0, 8).map(p => (
                  <button key={p.id} onClick={() => runPreset(p.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all text-left",
                      activePreset === p.id && !scanning
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
                    )}>
                    <span className="font-medium truncate">{p.label}</span>
                    <span className="ml-auto text-zinc-700">→</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right: Results ── */}
          <div className="lg:col-span-2">

            {/* Empty state */}
            {!results && !scanning && (
              <div className="flex flex-col items-center justify-center h-80 bg-zinc-900 border border-zinc-800 rounded-2xl">
                <div className="w-12 h-12 mb-4 rounded-xl bg-zinc-800 flex items-center justify-center">
                  <Search className="w-5 h-5 text-zinc-600" />
                </div>
                <p className="text-zinc-400 text-sm mb-1">Model seç ve tara</p>
                <p className="text-zinc-600 text-xs">Birden fazla model seçerek kesişim analizi yap</p>
                <div className="flex gap-2 mt-6">
                  {["Ucuz Kalmış", "Momentum", "Akıllı Para"].map(t => (
                    <span key={t} className="text-[10px] bg-zinc-800 text-zinc-500 px-2.5 py-1 rounded-lg">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Scanning */}
            {scanning && (
              <div className="flex flex-col items-center justify-center h-80 bg-zinc-900 border border-zinc-800 rounded-2xl">
                <div className="text-4xl animate-spin mb-4">⚙</div>
                <p className="text-zinc-400 text-sm">Taranıyor…</p>
                <p className="text-zinc-600 text-xs mt-1">{selectedModels.length} model çalıştırılıyor</p>
              </div>
            )}

            {/* Results */}
            {results && !scanning && (
              <>
                {/* Result header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-white font-semibold">{sorted.length} sembol</span>
                    <span className="text-zinc-600 text-sm ml-2">bulundu</span>
                    {selectedModels.length > 1 && (
                      <span className="ml-2 text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                        {selectedModels.length} model kesişimi
                      </span>
                    )}
                  </div>
                  {/* Sort */}
                  <div className="flex gap-1">
                    {(["score", "ml", "rsi", "change_pct"] as const).map(s => (
                      <button key={s} onClick={() => setSortBy(s)}
                        className={cn("text-[10px] px-2 py-1 rounded-lg transition-colors flex items-center gap-0.5",
                          sortBy === s ? "bg-zinc-700 text-white" : "text-zinc-600 hover:text-zinc-400")}>
                        {s === "score" ? "Skor" : s === "ml" ? <><Zap className="w-2.5 h-2.5" />ML</> : s === "rsi" ? "RSI" : "Değişim"}
                      </button>
                    ))}
                  </div>
                </div>

                {sorted.length === 0 ? (
                  <div className="text-center py-16 bg-zinc-900 border border-zinc-800 rounded-2xl">
                    <div className="text-4xl mb-3">😶</div>
                    <p className="text-zinc-400 text-sm">Kombinasyon için eşleşen sembol yok</p>
                    <p className="text-zinc-600 text-xs mt-1">Daha az model seçin veya tek modelle tarayın</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sorted.map((r) => <ResultCard key={r.symbol} r={r} />)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
