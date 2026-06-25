"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, Clock, Package } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type CommodityPrice = {
  ticker: string; name: string; unit: string; category: string;
  price: number; change_pct: number; rsi: number; trend: string;
  high_30d: number; low_30d: number; volatility_pct: number;
};

type PricesResponse = { by_category: Record<string, CommodityPrice[]>; total: number };

type TimingResponse = {
  ticker: string; name: string; price: number;
  signal: string; signal_label: string; risk_level: string;
  reasoning: string[]; volatility_pct: number; disclaimer: string;
};

const SIGNAL_STYLE: Record<string, string> = {
  acil_al: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
  al:      "bg-blue-500/15    border-blue-500/30    text-blue-400",
  izle:    "bg-amber-500/15   border-amber-500/30   text-amber-400",
  bekle:   "bg-zinc-800       border-zinc-700       text-zinc-400",
};

const RISK_COLOR: Record<string, string> = {
  düşük: "text-emerald-400",
  orta:  "text-amber-400",
  yüksek: "text-red-400",
};

// ── Fiyat kartı ───────────────────────────────────────────────────────────────
function PriceCard({ c, onSelect, selected }: {
  c: CommodityPrice; onSelect: () => void; selected: boolean
}) {
  const up = c.change_pct >= 0;
  return (
    <button onClick={onSelect}
      className={cn(
        "text-left w-full rounded-xl border p-4 transition-all hover:border-zinc-600",
        selected ? "border-blue-500/50 bg-blue-500/5" : "border-zinc-800 bg-zinc-900"
      )}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-xs font-semibold text-zinc-400 mb-0.5">{c.category}</p>
          <p className="text-sm font-bold text-white leading-tight">{c.name}</p>
        </div>
        <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded-lg",
          up ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400")}>
          {up ? "+" : ""}{c.change_pct.toFixed(2)}%
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="font-mono text-base font-bold text-white">
          {c.price.toLocaleString("tr-TR", { maximumFractionDigits: 4 })}
          <span className="text-[10px] text-zinc-600 ml-1 font-normal">{c.unit}</span>
        </span>
        <span className={cn("text-xs font-medium",
          c.trend === "yükseliş" ? "text-emerald-400" : "text-red-400")}>
          {c.trend === "yükseliş" ? <TrendingUp className="w-3.5 h-3.5 inline" /> : <TrendingDown className="w-3.5 h-3.5 inline" />}
          {" "}{c.trend}
        </span>
      </div>
      <div className="mt-2 flex gap-3 text-[10px] text-zinc-600">
        <span>RSI {c.rsi}</span>
        <span>Vol. {c.volatility_pct}%</span>
        <span>30g: {c.low_30d.toFixed(2)}–{c.high_30d.toFixed(2)}</span>
      </div>
    </button>
  );
}

// ── Alım zamanlama paneli ─────────────────────────────────────────────────────
function TimingPanel({ ticker }: { ticker: string | null }) {
  const [days, setDays] = useState(30);

  const { data, isLoading, refetch } = useQuery<TimingResponse>({
    queryKey: ["timing", ticker, days],
    queryFn: () => fetch(`${API}/api/commodity/${ticker}/timing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days_until_need: days }),
    }).then(r => r.json()),
    enabled: !!ticker,
  });

  if (!ticker) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 flex flex-col items-center justify-center min-h-[200px] text-center">
        <Package className="w-8 h-8 text-zinc-700 mb-3" />
        <p className="text-sm text-zinc-500">Soldaki listeden bir emtia seç</p>
        <p className="text-xs text-zinc-700 mt-1">Alım zamanlama analizi burada görünecek</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Alım Zamanlama Analizi</h3>
        <span className="text-xs text-zinc-600 font-mono">{ticker}</span>
      </div>

      {/* Kaç gün sonra ihtiyacın var */}
      <div>
        <label className="text-xs text-zinc-400 mb-1.5 flex items-center gap-1.5">
          <Clock className="w-3 h-3" /> Hammaddeye ihtiyaç (gün)
        </label>
        <div className="flex gap-2">
          {[7, 14, 30, 60, 90].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={cn("text-xs px-2.5 py-1 rounded-lg border transition-all",
                days === d
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300")}>
              {d}g
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-4 bg-zinc-800 rounded animate-pulse" />)}
        </div>
      )}

      {data && !isLoading && (
        <>
          {/* Sinyal */}
          <div className={cn("rounded-xl border p-4 text-center", SIGNAL_STYLE[data.signal] ?? SIGNAL_STYLE.izle)}>
            <p className="text-2xl font-bold mb-1">{data.signal_label}</p>
            <p className="text-xs opacity-70">
              Risk seviyesi: <span className={RISK_COLOR[data.risk_level]}>{data.risk_level}</span>
            </p>
          </div>

          {/* Gerekçeler */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-400">Gerekçe</p>
            {data.reasoning.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                <span className="text-zinc-600 mt-0.5 shrink-0">•</span>
                <span>{r}</span>
              </div>
            ))}
          </div>

          {/* Fiyat bilgisi */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800">
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <p className="text-[10px] text-zinc-500 mb-1">Güncel Fiyat</p>
              <p className="font-mono font-bold text-white">{data.price.toFixed(4)}</p>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <p className="text-[10px] text-zinc-500 mb-1">Volatilite</p>
              <p className="font-mono font-bold text-white">%{data.volatility_pct}</p>
            </div>
          </div>

          <p className="text-[10px] text-zinc-700 leading-relaxed">{data.disclaimer}</p>
        </>
      )}
    </div>
  );
}

// ── Ana sayfa ─────────────────────────────────────────────────────────────────
export default function EnterprisePage() {
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading } = useQuery<PricesResponse>({
    queryKey: ["commodity-prices"],
    queryFn: () => fetch(`${API}/api/commodity/prices`).then(r => r.json()),
    refetchInterval: 300_000,
  });

  const categories = data?.by_category ?? {};
  const allItems = Object.values(categories).flat();

  return (
    <div className="space-y-6 pb-20">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full">
              Kurumsal · B2B
            </span>
            <span className="text-xs text-zinc-600">Beta</span>
          </div>
          <h1 className="text-xl font-bold text-white">Emtia Takibi & Alım Zamanlama</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Hammadde fiyatları, trend analizi ve tedarik kararı desteği
          </p>
        </div>
        <Link href="/landing#b2b"
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors border border-zinc-800 px-3 py-1.5 rounded-lg">
          Kurumsal Plan →
        </Link>
      </div>

      {/* Uyarı — beta */}
      <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-400/80 leading-relaxed">
          Bu modül beta aşamasındadır. Alım zamanlama önerileri istatistiksel sinyale dayanır;
          kendi analizinizle destekleyin. Yatırım tavsiyesi değildir.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">

        {/* Sol — emtia listesi */}
        <div className="lg:col-span-2 space-y-6">
          {isLoading && (
            <div className="grid sm:grid-cols-2 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-28 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
              ))}
            </div>
          )}

          {Object.entries(categories).map(([cat, items]) => (
            <div key={cat}>
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">{cat}</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {items.map(c => (
                  <PriceCard key={c.ticker} c={c}
                    selected={selected === c.ticker}
                    onSelect={() => setSelected(prev => prev === c.ticker ? null : c.ticker)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Sağ — timing paneli */}
        <div className="space-y-4">
          <TimingPanel ticker={selected} />

          {/* Özet istatistik */}
          {allItems.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs font-medium text-zinc-400 mb-3">Piyasa Özeti</p>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Takip edilen emtia</span>
                  <span className="text-white font-mono">{allItems.length}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Yükselenler</span>
                  <span className="text-emerald-400 font-mono">
                    {allItems.filter(c => c.change_pct > 0).length}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Düşenler</span>
                  <span className="text-red-400 font-mono">
                    {allItems.filter(c => c.change_pct < 0).length}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Ort. volatilite</span>
                  <span className="text-zinc-300 font-mono">
                    %{(allItems.reduce((s, c) => s + c.volatility_pct, 0) / allItems.length).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
