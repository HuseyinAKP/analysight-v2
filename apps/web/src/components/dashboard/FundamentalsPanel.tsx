"use client";
import { FundamentalsData } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CheckCircle, XCircle } from "lucide-react";

interface Props { data: FundamentalsData }

function Metric({ label, value, sub, color }: { label: string; value: string | number | null; sub?: string; color?: string }) {
  return (
    <div className="bg-zinc-800/50 rounded-lg p-3">
      <div className="text-[10px] text-zinc-500 mb-1">{label}</div>
      <div className={cn("text-lg font-bold tabular-nums", color ?? "text-white")}>
        {value ?? "—"}
      </div>
      {sub && <div className="text-[10px] text-zinc-600 mt-0.5">{sub}</div>}
    </div>
  );
}

export function FundamentalsPanel({ data }: Props) {
  if (!data.available) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-zinc-300 mb-2">Temel Analiz</h2>
        <p className="text-sm text-zinc-500">{data.reason}</p>
      </div>
    );
  }

  const { valuation, annual, quarters, insights, sector } = data;
  if (!valuation || !annual || !quarters) return null;

  const peColor = valuation.pe_vs_sector === "ucuz" ? "text-emerald-400" : valuation.pe_vs_sector === "pahalı" ? "text-red-400" : "text-yellow-400";

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-300">Temel Analiz</h2>
          <p className="text-xs text-zinc-500 mt-0.5">{sector} sektörü</p>
        </div>
        <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full",
          valuation.pe_vs_sector === "ucuz" ? "bg-emerald-400/10 text-emerald-400" : valuation.pe_vs_sector === "pahalı" ? "bg-red-400/10 text-red-400" : "bg-yellow-400/10 text-yellow-400")}>
          {valuation.pe_vs_sector === "ucuz" ? "Değer Stoğu" : valuation.pe_vs_sector === "pahalı" ? "Primli Fiyat" : "Uygun Değer"}
        </span>
      </div>

      {/* Valuation metrics */}
      <div className="grid grid-cols-3 gap-2">
        <Metric label="F/K (P/E)" value={valuation.pe?.toFixed(1) ?? "—"} sub={`Sektör: ${valuation.sector_avg_pe?.toFixed(1)}`} color={peColor} />
        <Metric label="F/DD (P/B)" value={valuation.pb?.toFixed(1) ?? "—"} />
        <Metric label="F/S (P/S)" value={valuation.ps?.toFixed(1) ?? "—"} />
        <Metric label="ROE" value={`%${valuation.roe_pct?.toFixed(1)}`} color={valuation.roe_pct > 20 ? "text-emerald-400" : "text-white"} />
        <Metric label="Borç/Öz Kaynak" value={valuation.debt_equity?.toFixed(2)} color={valuation.debt_equity < 1 ? "text-emerald-400" : valuation.debt_equity > 2 ? "text-red-400" : "text-white"} />
        <Metric label="Net Marj" value={`%${annual.net_margin_pct.toFixed(1)}`} color={annual.net_margin_pct > 15 ? "text-emerald-400" : "text-white"} />
      </div>

      {/* Annual highlight */}
      <div className="bg-zinc-800/40 rounded-lg p-3 flex items-center justify-between">
        <div>
          <div className="text-[10px] text-zinc-500 mb-1">Yıllık Gelir</div>
          <div className="text-xl font-bold text-white">${annual.revenue_b.toFixed(1)}B</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-zinc-500 mb-1">Net Kâr</div>
          <div className="text-xl font-bold text-emerald-400">${annual.net_income_b.toFixed(1)}B</div>
        </div>
      </div>

      {/* Quarterly table */}
      <div>
        <div className="text-xs text-zinc-500 font-semibold mb-2 uppercase tracking-wide">Son 4 Çeyrek</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-600 border-b border-zinc-800">
                <th className="pb-1.5 text-left font-medium">Dönem</th>
                <th className="pb-1.5 text-right font-medium">Gelir</th>
                <th className="pb-1.5 text-right font-medium">Büyüme</th>
                <th className="pb-1.5 text-right font-medium">EPS</th>
                <th className="pb-1.5 text-right font-medium">Beklenti</th>
                <th className="pb-1.5 text-right font-medium">Sonuç</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {quarters.map((q) => (
                <tr key={q.quarter} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="py-2 font-semibold text-zinc-300">{q.quarter}</td>
                  <td className="py-2 text-right text-zinc-400">${q.revenue_b.toFixed(2)}B</td>
                  <td className={cn("py-2 text-right font-semibold", q.revenue_growth_yoy >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {q.revenue_growth_yoy >= 0 ? "+" : ""}{q.revenue_growth_yoy.toFixed(1)}%
                  </td>
                  <td className="py-2 text-right font-mono text-white">{q.eps_actual.toFixed(2)}</td>
                  <td className="py-2 text-right font-mono text-zinc-500">{q.eps_estimate.toFixed(2)}</td>
                  <td className="py-2 text-right">
                    {q.beat
                      ? <span className="flex items-center justify-end gap-1 text-emerald-400 font-semibold"><CheckCircle className="w-3 h-3" />Aştı</span>
                      : <span className="flex items-center justify-end gap-1 text-red-400 font-semibold"><XCircle className="w-3 h-3" />Kaldı</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI-generated insights */}
      <div className="space-y-1.5 pt-1 border-t border-zinc-800">
        <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide mb-2">Temel Bulgular</div>
        {(insights ?? []).map((ins, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-zinc-400">
            <span className="text-blue-400 shrink-0 mt-0.5">•</span>
            {ins}
          </div>
        ))}
      </div>

      <p className="text-[10px] text-zinc-600 border-t border-zinc-800 pt-2">
        Temel veriler tahmin niteliğindedir ve yatırım tavsiyesi oluşturmaz.
      </p>
    </div>
  );
}
