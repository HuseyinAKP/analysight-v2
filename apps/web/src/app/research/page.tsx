"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toolsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

// ── Index card ────────────────────────────────────────────────────────────────
function IndexCard({ idx }: { idx: { name: string; value: number; change_pct: number; ytd_pct: number } }) {
  const up = idx.change_pct >= 0;
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 hover:border-zinc-700 transition-colors">
      <p className="text-xs text-zinc-500 mb-1 truncate">{idx.name}</p>
      <p className="text-base font-bold text-white font-mono">{idx.value.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className={cn("text-xs font-semibold", up ? "text-emerald-400" : "text-red-400")}>
          {up ? "▲" : "▼"} {Math.abs(idx.change_pct).toFixed(2)}%
        </span>
        <span className={cn("text-[10px]", idx.ytd_pct >= 0 ? "text-emerald-400/70" : "text-red-400/70")}>
          YTD {idx.ytd_pct >= 0 ? "+" : ""}{idx.ytd_pct.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

// ── Fear & Greed Gauge ────────────────────────────────────────────────────────
function FearGreedGauge({ score, label, color, description }: { score: number; label: string; color: string; description: string }) {
  const angle = (score / 100) * 180 - 90;
  const zones = [
    { label: "Aşırı Korku", color: "#ef4444", from: 0, to: 20 },
    { label: "Korku", color: "#f97316", from: 20, to: 40 },
    { label: "Nötr", color: "#eab308", from: 40, to: 60 },
    { label: "Açgözlülük", color: "#84cc16", from: 60, to: 80 },
    { label: "Aşırı Açgözlülük", color: "#22c55e", from: 80, to: 100 },
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h3 className="text-xs text-zinc-500 uppercase tracking-wide mb-4">😱 Korku & Açgözlülük Endeksi</h3>
      <div className="flex items-center gap-6">
        {/* SVG semicircle gauge */}
        <div className="relative w-32 h-16 shrink-0">
          <svg viewBox="0 0 100 50" className="w-full h-full">
            {zones.map((z, i) => {
              const startAngle = (z.from / 100) * 180;
              const endAngle = (z.to / 100) * 180;
              const x1 = 50 + 45 * Math.cos((startAngle - 180) * Math.PI / 180);
              const y1 = 50 + 45 * Math.sin((startAngle - 180) * Math.PI / 180);
              const x2 = 50 + 45 * Math.cos((endAngle - 180) * Math.PI / 180);
              const y2 = 50 + 45 * Math.sin((endAngle - 180) * Math.PI / 180);
              return (
                <path key={i} d={`M 50 50 L ${x1} ${y1} A 45 45 0 0 1 ${x2} ${y2} Z`}
                  fill={z.color} opacity="0.8" />
              );
            })}
            {/* White center circle */}
            <circle cx="50" cy="50" r="28" fill="#09090b" />
            {/* Needle */}
            <line
              x1="50" y1="50"
              x2={50 + 30 * Math.cos((angle - 90) * Math.PI / 180)}
              y2={50 + 30 * Math.sin((angle - 90) * Math.PI / 180)}
              stroke="white" strokeWidth="2" strokeLinecap="round" />
            <circle cx="50" cy="50" r="3" fill="white" />
            {/* Score */}
            <text x="50" y="46" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">{score}</text>
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-lg font-bold" style={{ color }}>{label}</p>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  );
}

// ── Smart Money Flow ──────────────────────────────────────────────────────────
function SmartMoneyFlow({ items }: { items: { sector: string; flow: string; intensity: number; note: string }[] }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <h3 className="text-xs text-zinc-500 uppercase tracking-wide mb-3">💼 Akıllı Para Akışları</h3>
      <div className="space-y-3">
        {items.map(item => {
          const pct = Math.abs(item.intensity);
          const positive = item.intensity > 0;
          return (
            <div key={item.sector}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-zinc-300 font-medium">{item.sector}</span>
                <span className={cn("font-semibold", positive ? "text-emerald-400" : "text-red-400")}>
                  {positive ? "▲ Giriş" : "▼ Çıkış"}
                </span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-1">
                <div className={cn("h-full rounded-full", positive ? "bg-emerald-500" : "bg-red-500")}
                  style={{ width: `${pct}%`, marginLeft: positive ? 0 : undefined }} />
              </div>
              <p className="text-[10px] text-zinc-600">{item.note}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Macro Panel ───────────────────────────────────────────────────────────────
function MacroPanel({ macro }: { macro: Record<string, {
  country: string; inflation_pct: number; policy_rate_pct: number;
  gdp_growth_pct: number; unemployment_pct: number;
  key_events: { date: string; event: string; impact: string }[];
}> }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
      <h3 className="text-xs text-zinc-500 uppercase tracking-wide">🌍 Makroekonomik Göstergeler</h3>
      {Object.entries(macro).map(([key, m]) => (
        <div key={key}>
          <p className="text-sm font-semibold text-white mb-2">{m.country}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {[
              { label: "Enflasyon", value: `%${m.inflation_pct}`, warn: m.inflation_pct > 10 },
              { label: "Politika Faizi", value: `%${m.policy_rate_pct}`, warn: false },
              { label: "GSYİH Büyüme", value: `%${m.gdp_growth_pct}`, warn: false },
              { label: "İşsizlik", value: `%${m.unemployment_pct}`, warn: m.unemployment_pct > 10 },
            ].map(s => (
              <div key={s.label} className="bg-zinc-800/50 rounded-lg p-2">
                <p className="text-[10px] text-zinc-500">{s.label}</p>
                <p className={cn("text-sm font-bold", s.warn ? "text-red-400" : "text-white")}>{s.value}</p>
              </div>
            ))}
          </div>
          {/* Key events */}
          <div className="space-y-1.5">
            {m.key_events.map((ev) => (
              <div key={ev.event} className={cn("flex items-start gap-2 p-2 rounded-lg text-xs",
                ev.impact === "yüksek" ? "bg-red-500/5 border border-red-500/20" : "bg-zinc-800/30")}>
                <span className="text-zinc-500 font-mono shrink-0">{new Date(ev.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}</span>
                <span className="text-zinc-300">{ev.event}</span>
                {ev.impact === "yüksek" && <span className="ml-auto text-red-400 text-[10px] shrink-0">❗Yüksek Etki</span>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Sector Table ──────────────────────────────────────────────────────────────
function SectorTable({ sectors, onSelect }: { sectors: { sector: string; perf_1w: number; perf_1m: number; perf_3m: number; perf_ytd: number; pe_avg: number; outlook: string }[]; onSelect: (s: string) => void }) {
  const outColor = (o: string) =>
    o === "güçlü pozitif" ? "text-emerald-400" : o === "pozitif" ? "text-green-400" : o === "negatif" ? "text-red-400" : "text-yellow-400";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-500 text-xs">
            <th className="text-left py-2 px-3">Sektör</th>
            <th className="text-right py-2 px-2">1H</th>
            <th className="text-right py-2 px-2">1A</th>
            <th className="text-right py-2 px-2">3A</th>
            <th className="text-right py-2 px-2">YTD</th>
            <th className="text-right py-2 px-2">Ort. F/K</th>
            <th className="text-center py-2 px-2">Görünüm</th>
          </tr>
        </thead>
        <tbody>
          {sectors.map(s => (
            <tr key={s.sector} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer transition-colors"
              onClick={() => onSelect(s.sector)}>
              <td className="py-2.5 px-3 text-zinc-200 font-medium">{s.sector}</td>
              {[s.perf_1w, s.perf_1m, s.perf_3m, s.perf_ytd].map((p, i) => (
                <td key={i} className={cn("py-2.5 px-2 text-right text-xs font-mono font-semibold", p >= 0 ? "text-emerald-400" : "text-red-400")}>
                  {p >= 0 ? "+" : ""}{p.toFixed(1)}%
                </td>
              ))}
              <td className="py-2.5 px-2 text-right text-xs text-zinc-400">{s.pe_avg}x</td>
              <td className="py-2.5 px-2 text-center">
                <span className={cn("text-xs font-medium capitalize", outColor(s.outlook))}>{s.outlook}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Sector Detail Drawer ──────────────────────────────────────────────────────
function SectorDetail({ sector, onClose }: { sector: string; onClose: () => void }) {
  const { data } = useQuery({ queryKey: ["sector", sector], queryFn: () => toolsApi.sectorResearch(sector) });
  if (!data) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">{data.sector}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl">✕</button>
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-emerald-400 uppercase tracking-wide mb-2">✅ Destekleyenler</p>
            {data.drivers.map((d: string, i: number) => <p key={i} className="text-sm text-zinc-300 mb-1">• {d}</p>)}
          </div>
          <div>
            <p className="text-xs text-red-400 uppercase tracking-wide mb-2">⚠️ Riskler</p>
            {data.risks.map((r: string, i: number) => <p key={i} className="text-sm text-zinc-300 mb-1">• {r}</p>)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ResearchPage() {
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const { data: overview, isLoading } = useQuery({ queryKey: ["market-overview"], queryFn: toolsApi.marketOverview, refetchInterval: 60_000 });
  const { data: sectors } = useQuery({ queryKey: ["sectors"], queryFn: toolsApi.allSectors });

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">🌍 Market Researcher</h1>
          <p className="text-zinc-500 text-sm">Piyasa genel görünümü, sektör performansları, makro göstergeler ve akıllı para akışları</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : overview ? (
          <div className="space-y-6">
            {/* Indices grid */}
            <div>
              <h2 className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Endeksler & Varlıklar</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {overview.indices.map((idx: { name: string; value: number; change_pct: number; ytd_pct: number }) => (
                  <IndexCard key={idx.name} idx={idx} />
                ))}
              </div>
            </div>

            {/* 3 column row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FearGreedGauge
                score={overview.fear_greed.score}
                label={overview.fear_greed.label}
                color={overview.fear_greed.color}
                description={overview.fear_greed.description}
              />
              <SmartMoneyFlow items={overview.smart_money} />
              <MacroPanel macro={overview.macro} />
            </div>

            {/* Sector table */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
              <div className="p-4 border-b border-zinc-800">
                <h2 className="text-sm font-semibold text-white">Sektör Performansı</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Bir sektöre tıklayın — detaylı analiz görün</p>
              </div>
              <div className="p-2">
                {sectors && <SectorTable sectors={sectors} onSelect={setSelectedSector} />}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {selectedSector && <SectorDetail sector={selectedSector} onClose={() => setSelectedSector(null)} />}
    </div>
  );
}
