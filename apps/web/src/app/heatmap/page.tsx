"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { RefreshCw, Globe2, BarChart2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────
interface StockTile {
  symbol:     string;
  change_pct: number;
  mktcap:     number;
}
interface SectorData {
  sector:     string;
  avg_change: number;
  stocks:     StockTile[];
  total_cap:  number;
  count:      number;
}
interface HeatmapResponse {
  market:     string;
  sectors:    SectorData[];
  updated_at: string;
}

import { API_BASE } from "@/lib/api";
const API = API_BASE;

// ── Color helpers ──────────────────────────────────────────────────────────────
function heatColor(chg: number): string {
  // Strong green → weak green → neutral → weak red → strong red
  if (chg >  4)  return "#065f46"; // emerald-900
  if (chg >  2)  return "#047857"; // emerald-700
  if (chg >  0.5)return "#059669"; // emerald-600
  if (chg > -0.5)return "#3f3f46"; // zinc-700
  if (chg > -2)  return "#b91c1c"; // red-700
  if (chg > -4)  return "#991b1b"; // red-800
  return "#7f1d1d";                // red-900
}

function heatBorder(chg: number): string {
  if (chg >  1)  return "#10b981";
  if (chg > -1)  return "#52525b";
  return "#ef4444";
}

function heatText(chg: number): string {
  if (Math.abs(chg) < 0.5) return "#a1a1aa";
  return "#ffffff";
}

function changeLabel(chg: number): string {
  return `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`;
}

// ── Treemap layout (squarified algorithm) ─────────────────────────────────────
interface Rect { x: number; y: number; w: number; h: number; }

function squarify(items: { value: number }[], rect: Rect): Rect[] {
  if (items.length === 0) return [];
  const total = items.reduce((s, i) => s + i.value, 0);
  const area = rect.w * rect.h;
  const rects: Rect[] = [];

  let remaining = [...items];
  let { x, y, w, h } = rect;

  while (remaining.length > 0) {
    const isWide = w > h;
    const rowItems: typeof items = [];
    let rowSum = 0;
    let worst = Infinity;

    for (const item of remaining) {
      rowItems.push(item);
      rowSum += item.value;
      const rowArea = (rowSum / total) * area;
      const side = isWide ? h : w;
      const rowDim = isWide ? rowArea / h : rowArea / w;
      let newWorst = 0;
      for (const ri of rowItems) {
        const riArea = (ri.value / total) * area;
        const dim = riArea / rowDim;
        const ratio = Math.max(side / dim, dim / side) * Math.max(rowDim / dim, dim / rowDim);
        newWorst = Math.max(newWorst, Math.max(rowDim / (riArea / rowDim), (riArea / rowDim) / rowDim));
      }
      if (newWorst > worst && rowItems.length > 1) {
        rowItems.pop();
        break;
      }
      worst = newWorst;
    }

    // Layout row
    const rowSum2 = rowItems.reduce((s, i) => s + i.value, 0);
    const rowFrac = rowSum2 / total;
    const rowDim = isWide ? w * rowFrac : h * rowFrac;
    let pos = isWide ? y : x;

    for (const ri of rowItems) {
      const frac = ri.value / rowSum2;
      const len = (isWide ? h : w) * frac;
      if (isWide) {
        rects.push({ x, y: pos, w: rowDim, h: len });
      } else {
        rects.push({ x: pos, y, w: len, h: rowDim });
      }
      pos += len;
    }

    if (isWide) { x += rowDim; w -= rowDim; }
    else        { y += rowDim; h -= rowDim; }

    remaining = remaining.slice(rowItems.length);
  }

  return rects;
}

// ── Sector block ───────────────────────────────────────────────────────────────
function SectorBlock({
  sector, rect, onHover, hovered
}: {
  sector: SectorData;
  rect: Rect;
  onHover: (s: SectorData | null) => void;
  hovered: boolean;
}) {
  const bg     = heatColor(sector.avg_change);
  const border = heatBorder(sector.avg_change);
  const pad    = 4;
  const minW   = 60; const minH = 40;

  return (
    <g
      onMouseEnter={() => onHover(sector)}
      onMouseLeave={() => onHover(null)}
      style={{ cursor: "pointer" }}
    >
      <rect
        x={rect.x + pad / 2} y={rect.y + pad / 2}
        width={Math.max(0, rect.w - pad)} height={Math.max(0, rect.h - pad)}
        fill={bg}
        stroke={hovered ? "#60a5fa" : border}
        strokeWidth={hovered ? 2 : 1}
        rx="6"
        style={{ transition: "stroke 0.15s, stroke-width 0.15s" }}
      />
      {rect.w > minW && rect.h > minH && (
        <>
          <text
            x={rect.x + rect.w / 2} y={rect.y + rect.h / 2 - 8}
            textAnchor="middle" dominantBaseline="middle"
            fill={heatText(sector.avg_change)}
            fontSize={Math.min(14, rect.w / 7)}
            fontWeight="700"
            style={{ userSelect: "none", pointerEvents: "none" }}
          >
            {sector.sector}
          </text>
          <text
            x={rect.x + rect.w / 2} y={rect.y + rect.h / 2 + 10}
            textAnchor="middle" dominantBaseline="middle"
            fill={sector.avg_change >= 0 ? "#6ee7b7" : "#fca5a5"}
            fontSize={Math.min(12, rect.w / 8)}
            fontWeight="600"
            style={{ userSelect: "none", pointerEvents: "none" }}
          >
            {changeLabel(sector.avg_change)}
          </text>
        </>
      )}
      {rect.w <= minW && rect.h > 20 && (
        <text
          x={rect.x + rect.w / 2} y={rect.y + rect.h / 2}
          textAnchor="middle" dominantBaseline="middle"
          fill={heatText(sector.avg_change)}
          fontSize="9" fontWeight="700"
          style={{ userSelect: "none", pointerEvents: "none" }}
        >
          {sector.sector.slice(0, 4)}
        </text>
      )}
    </g>
  );
}

// ── Stock tile (for detail view) ───────────────────────────────────────────────
function StockTileCard({ stock }: { stock: StockTile }) {
  const bg = heatColor(stock.change_pct);
  return (
    <Link href={`/symbol/${stock.symbol}`}
      className="flex flex-col items-center justify-center p-3 rounded-xl text-center transition-transform hover:scale-105"
      style={{ backgroundColor: bg, minHeight: 72, border: `1px solid ${heatBorder(stock.change_pct)}` }}
    >
      <span className="text-[11px] font-bold text-white">{stock.symbol}</span>
      <span className="text-[10px] mt-0.5"
        style={{ color: stock.change_pct >= 0 ? "#6ee7b7" : "#fca5a5" }}>
        {changeLabel(stock.change_pct)}
      </span>
    </Link>
  );
}

// ── Legend ─────────────────────────────────────────────────────────────────────
function Legend() {
  const steps = [
    { label: ">+4%",   color: "#065f46" },
    { label: "+2–4%",  color: "#047857" },
    { label: "0–2%",   color: "#059669" },
    { label: "Nötr",   color: "#3f3f46" },
    { label: "0–2%",   color: "#b91c1c" },
    { label: "2–4%",   color: "#991b1b" },
    { label: ">-4%",   color: "#7f1d1d" },
  ];
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-zinc-500">Düşüş</span>
      {[...steps].reverse().map(s => (
        <div key={s.label} className="flex flex-col items-center gap-1">
          <div className="w-6 h-4 rounded" style={{ backgroundColor: s.color }} />
          <span className="text-[8px] text-zinc-600">{s.label}</span>
        </div>
      ))}
      <span className="text-[10px] text-zinc-500">Yükseliş</span>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function HeatmapPage() {
  const [market, setMarket]   = useState<"bist" | "global">("bist");
  const [hovered, setHovered] = useState<SectorData | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery<HeatmapResponse>({
    queryKey: ["heatmap", market],
    queryFn:  () => fetch(`${API}/api/heatmap/${market}`).then(r => r.json()),
    staleTime: 2 * 60 * 1000,
  });

  // SVG dimensions
  const svgW = 900; const svgH = 480;

  // Build treemap rects from sector data
  const sectors = data?.sectors ?? [];
  const items   = sectors.map(s => ({ value: Math.max(s.total_cap, 1) }));
  const rects   = squarify(items, { x: 0, y: 0, w: svgW, h: svgH });

  const sorted = [...sectors].sort((a, b) => b.avg_change - a.avg_change);
  const best   = sorted[0];
  const worst  = sorted[sorted.length - 1];

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            🌡️ Sektör Isı Haritası
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Piyasa hareketini tek bakışta görselleştir — büyüklük = piyasa değeri
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Market toggle */}
          <div className="flex rounded-xl border border-zinc-800 overflow-hidden">
            {(["bist", "global"] as const).map(m => (
              <button key={m} onClick={() => setMarket(m)}
                className={cn(
                  "px-4 py-1.5 text-xs font-semibold transition-colors",
                  market === m
                    ? "bg-blue-600 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                )}>
                {m === "bist" ? "🇹🇷 BIST" : "🌐 Küresel"}
              </button>
            ))}
          </div>

          <button onClick={() => refetch()}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors">
            <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
            Yenile
          </button>
        </div>
      </div>

      {/* Quick stats */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "En İyi Sektör", value: best?.sector, sub: changeLabel(best?.avg_change ?? 0), green: true },
            { label: "En Kötü Sektör", value: worst?.sector, sub: changeLabel(worst?.avg_change ?? 0), green: false },
            { label: "Toplam Sektör", value: `${sectors.length}`, sub: "aktif" },
            { label: "Son Güncelleme", value: new Date(data.updated_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }), sub: "anlık" },
          ].map(s => (
            <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
              <p className="text-[10px] text-zinc-500">{s.label}</p>
              <p className="text-sm font-bold text-white mt-0.5">{s.value ?? "—"}</p>
              <p className={cn("text-xs mt-0.5", s.green === true ? "text-emerald-400" : s.green === false ? "text-red-400" : "text-zinc-500")}>{s.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Treemap */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="h-[480px] flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-zinc-600 animate-spin" />
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="w-full"
            style={{ aspectRatio: `${svgW}/${svgH}` }}
          >
            {sectors.map((sector, i) =>
              rects[i] ? (
                <SectorBlock
                  key={sector.sector}
                  sector={sector}
                  rect={rects[i]}
                  onHover={setHovered}
                  hovered={hovered?.sector === sector.sector}
                />
              ) : null
            )}
          </svg>
        )}
      </div>

      {/* Legend */}
      <div className="flex justify-center">
        <Legend />
      </div>

      {/* Hovered sector detail */}
      {hovered && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">{hovered.sector}</h2>
              <p className="text-xs text-zinc-500">{hovered.count} hisse • Sektör ortalaması</p>
            </div>
            <span className={cn(
              "text-lg font-black px-3 py-1 rounded-xl",
              hovered.avg_change >= 0 ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"
            )}>
              {changeLabel(hovered.avg_change)}
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
            {hovered.stocks.map(s => (
              <StockTileCard key={s.symbol} stock={s} />
            ))}
          </div>
        </div>
      )}

      {/* All sectors list */}
      {!isLoading && sectors.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-white">Tüm Sektörler</h2>
          </div>
          <div className="divide-y divide-zinc-800/50">
            {sorted.map(sector => (
              <div key={sector.sector}
                className="px-5 py-3 flex items-center gap-4 hover:bg-zinc-800/30 transition-colors cursor-pointer"
                onMouseEnter={() => setHovered(sector)}
                onMouseLeave={() => setHovered(null)}>
                {/* Color bar */}
                <div className="w-2 h-10 rounded-full shrink-0" style={{ backgroundColor: heatColor(sector.avg_change) }} />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{sector.sector}</p>
                  <p className="text-[10px] text-zinc-500">
                    {sector.stocks.slice(0, 4).map(s => s.symbol).join(" · ")}
                    {sector.stocks.length > 4 && " …"}
                  </p>
                </div>

                {/* Change bar */}
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, Math.abs(sector.avg_change) * 15)}%`,
                        backgroundColor: heatColor(sector.avg_change),
                        marginLeft: sector.avg_change < 0 ? "auto" : undefined,
                      }} />
                  </div>
                  <span className={cn(
                    "text-sm font-bold w-16 text-right",
                    sector.avg_change >= 0 ? "text-emerald-400" : "text-red-400"
                  )}>
                    {changeLabel(sector.avg_change)}
                  </span>
                  <span className="text-[10px] text-zinc-600 w-12 text-right">{sector.count} hisse</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="flex items-start gap-2 text-[11px] text-zinc-600">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          Dikdörtgen büyüklüğü piyasa değerini, renk günlük değişimi temsil eder.
          Bir sektörün üzerine gel → hisseleri gör → hisseye tıkla → detaylı analiz.
          Veri yfinance API üzerinden çekilmektedir.
        </span>
      </div>
    </div>
  );
}
