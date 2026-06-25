"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { etfApi } from "@/lib/api";
import { cn } from "@/lib/utils";

function PerfCell({ v }: { v: number | null }) {
  if (v === null) return <td className="py-2 px-2 text-center text-zinc-600">—</td>;
  return (
    <td className={cn("py-2 px-2 text-right font-mono text-xs font-semibold",
      v >= 0 ? "text-emerald-400" : "text-red-400")}>
      {v >= 0 ? "+" : ""}{v.toFixed(1)}%
    </td>
  );
}

function ETFDetail({ symbol }: { symbol: string }) {
  const { data, isLoading } = useQuery({ queryKey: ["etf", symbol], queryFn: () => etfApi.get(symbol) });
  if (isLoading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!data) return null;

  const totalTop10 = data.top_holdings?.reduce((s: number, h: {weight_pct: number}) => s + h.weight_pct, 0);
  const perf1y  = data["1y_pct"] as number;
  const perf3y  = data["3y_ann_pct"] as number;
  const perf5y  = data["5y_ann_pct"] as number;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">{symbol}</h2>
          <p className="text-sm text-zinc-400">{data.name}</p>
          <p className="text-xs text-zinc-600 mt-1">{data.description}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">{data.price} <span className="text-sm text-zinc-500">{data.currency}</span></p>
          <p className={cn("text-sm font-semibold", data.ytd_pct >= 0 ? "text-emerald-400" : "text-red-400")}>
            YTD {data.ytd_pct >= 0 ? "+" : ""}{data.ytd_pct}%
          </p>
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {[
          { label: "Yönetim Ücreti", value: `%${data.expense_ratio}` },
          { label: "AUM", value: `$${data.aum_bn}B` },
          { label: "1Y Getiri", value: `${perf1y >= 0 ? "+" : ""}${perf1y}%`, color: perf1y >= 0 ? "text-emerald-400" : "text-red-400" },
          { label: "3Y Yıllık", value: `${perf3y >= 0 ? "+" : ""}${perf3y}%`, color: perf3y >= 0 ? "text-emerald-400" : "text-red-400" },
          { label: "Temettü Verimi", value: data.dividend_yield > 0 ? `%${data.dividend_yield}` : "Yok" },
        ].map(s => (
          <div key={s.label} className="bg-zinc-800/50 rounded-xl p-3">
            <p className="text-[10px] text-zinc-500 mb-1">{s.label}</p>
            <p className={cn("text-sm font-bold", s.color ?? "text-white")}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Risk metrics */}
      <div className="bg-zinc-800/30 rounded-xl p-4">
        <h3 className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Risk Metrikleri</h3>
        <div className="flex flex-wrap gap-5">
          {[
            ["Beta", data.risk_metrics?.beta?.toFixed(2) ?? "—"],
            ["Yıllık Vol", data.risk_metrics?.std_dev_ann ? `%${data.risk_metrics.std_dev_ann}` : "—"],
            ["Sharpe", data.risk_metrics?.sharpe_ratio?.toFixed(2) ?? "—"],
            ["Max Drawdown", data.risk_metrics?.max_drawdown ? `${data.risk_metrics.max_drawdown}%` : "—"],
          ].map(([label, val]) => (
            <div key={label}>
              <p className="text-[10px] text-zinc-500">{label}</p>
              <p className="text-base font-bold text-white">{val}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top holdings */}
        <div className="bg-zinc-800/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs text-zinc-500 uppercase tracking-wide">En Büyük Pozisyonlar</h3>
            <span className="text-[10px] text-zinc-600">İlk 10: %{totalTop10?.toFixed(1)}</span>
          </div>
          <div className="space-y-1.5">
            {data.top_holdings?.map((h: {ticker: string; name: string; weight_pct: number}) => (
              <div key={h.ticker} className="flex items-center gap-2">
                <span className="text-xs font-mono text-zinc-300 w-14 shrink-0">{h.ticker}</span>
                <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500/70 rounded-full" style={{ width: `${(h.weight_pct / (data.top_holdings[0].weight_pct)) * 100}%` }} />
                </div>
                <span className="text-[10px] text-zinc-400 w-10 text-right">%{h.weight_pct.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sector weights */}
        <div className="bg-zinc-800/30 rounded-xl p-4">
          <h3 className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Sektör Dağılımı</h3>
          <div className="space-y-1.5">
            {data.sector_weights?.map((s: {sector: string; weight_pct: number}) => (
              <div key={s.sector} className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-400 w-28 shrink-0 truncate">{s.sector}</span>
                <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500/70 rounded-full" style={{ width: `${s.weight_pct}%` }} />
                </div>
                <span className="text-[10px] text-zinc-400 w-10 text-right">%{s.weight_pct.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ETFPage() {
  const { data: etfList } = useQuery({ queryKey: ["etf-list"], queryFn: etfApi.list });
  const [selected, setSelected] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSymbols, setCompareSymbols] = useState<string[]>([]);
  const { data: compareData } = useQuery({
    queryKey: ["etf-compare", compareSymbols],
    queryFn: () => etfApi.compare(compareSymbols),
    enabled: compareMode && compareSymbols.length >= 2,
  });

  const toggleCompare = (sym: string) => {
    setCompareSymbols(prev =>
      prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">📦 ETF Analyzer</h1>
            <p className="text-zinc-500 text-sm">ETF holdings, sektör dağılımı, risk metrikleri ve karşılaştırma</p>
          </div>
          <button onClick={() => { setCompareMode(!compareMode); setCompareSymbols([]); }}
            className={cn("px-4 py-2 text-sm font-semibold rounded-xl transition-colors",
              compareMode ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700")}>
            {compareMode ? "✓ Karşılaştırma Modu" : "Karşılaştır"}
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* ETF list */}
          <div className="xl:col-span-1 space-y-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-xs text-zinc-500 uppercase tracking-wide mb-3">
                {compareMode ? "Karşılaştırılacakları Seç" : "ETF Seç"}
              </h3>
              <div className="space-y-1.5">
                {etfList?.map((sym: string) => (
                  <button key={sym}
                    onClick={() => compareMode ? toggleCompare(sym) : setSelected(sym)}
                    className={cn("w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors",
                      (!compareMode && selected === sym) || (compareMode && compareSymbols.includes(sym))
                        ? "bg-blue-600 text-white" : "text-zinc-300 hover:bg-zinc-800 hover:text-white")}>
                    {sym}
                  </button>
                ))}
              </div>
              {compareMode && compareSymbols.length >= 2 && (
                <p className="text-[10px] text-zinc-500 mt-2 text-center">
                  {compareSymbols.length} ETF seçildi — tablo aşağıda
                </p>
              )}
            </div>
          </div>

          {/* Main content */}
          <div className="xl:col-span-3 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            {compareMode && compareData && compareSymbols.length >= 2 ? (
              <div>
                <h2 className="text-sm font-semibold text-white mb-4">ETF Karşılaştırması</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-500 text-xs">
                        <th className="text-left py-2 px-3">ETF</th>
                        <th className="text-right py-2 px-2">Gider Oranı</th>
                        <th className="text-right py-2 px-2">AUM</th>
                        <th className="text-right py-2 px-2">YTD</th>
                        <th className="text-right py-2 px-2">1Y</th>
                        <th className="text-right py-2 px-2">3Y (Yıllık)</th>
                        <th className="text-right py-2 px-2">Sharpe</th>
                        <th className="text-right py-2 px-2">Max DD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(compareData as Record<string, unknown>[]).map((e: Record<string, unknown>) => (
                        <tr key={e.symbol as string} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                          <td className="py-2.5 px-3 font-bold text-white">{e.symbol as string}
                            <div className="text-[10px] text-zinc-500 font-normal">{e.currency as string}</div>
                          </td>
                          <td className="py-2.5 px-2 text-right text-xs text-zinc-400">%{e.expense_ratio as number}</td>
                          <td className="py-2.5 px-2 text-right text-xs text-zinc-400">${e.aum_bn as number}B</td>
                          <PerfCell v={e.ytd_pct as number} />
                          <PerfCell v={(e as Record<string,unknown>)["1y_pct"] as number} />
                          <PerfCell v={(e as Record<string,unknown>)["3y_ann_pct"] as number} />
                          <td className="py-2.5 px-2 text-right text-xs text-zinc-300">{(e.risk_metrics as Record<string,unknown>)?.sharpe_ratio as number ?? "—"}</td>
                          <td className="py-2.5 px-2 text-right text-xs text-red-400">{(e.risk_metrics as Record<string,unknown>)?.max_drawdown as number ?? "—"}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : selected ? (
              <ETFDetail symbol={selected} />
            ) : (
              <div className="text-center py-20 text-zinc-600">
                <div className="text-5xl mb-4">📦</div>
                <p>{compareMode ? "En az 2 ETF seçin karşılaştırmak için" : "Soldan bir ETF seçin"}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
