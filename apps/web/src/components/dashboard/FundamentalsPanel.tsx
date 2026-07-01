"use client";
import { cn, fmt } from "@/lib/utils";
import { TrendingUp, TrendingDown, CheckCircle, XCircle, Target } from "lucide-react";

interface Fundamentals {
  symbol: string;
  available: boolean;
  reason?: string;
  company?: string;
  sector?: string;
  industry?: string;
  currency?: string;
  valuation?: {
    pe: number | null; forward_pe: number | null; pb: number | null;
    ps: number | null; ev_ebitda: number | null; ev_revenue: number | null;
    sector_avg_pe: number | null; pe_vs_sector: string | null;
    beta: number | null; short_pct: number | null;
  };
  profitability?: {
    gross_margin: number | null; operating_margin: number | null;
    net_margin: number | null; roe: number | null; roa: number | null;
  };
  growth?: { revenue_growth_yoy: number | null; earnings_growth_yoy: number | null };
  balance_sheet?: {
    market_cap: number | null; revenue_ttm: number | null; net_income_ttm: number | null;
    total_debt: number | null; total_cash: number | null; free_cashflow: number | null;
    debt_to_equity: number | null; current_ratio: number | null; quick_ratio: number | null;
  };
  per_share?: {
    eps_ttm: number | null; eps_forward: number | null;
    week52_high: number | null; week52_low: number | null;
  };
  analyst?: {
    recommendation: string | null; target_mean: number | null;
    target_high: number | null; target_low: number | null; num_analysts: number | null;
  };
  quarters?: {
    period: string; revenue: number | null; net_income: number | null;
    gross_profit: number | null; net_margin: number | null;
  }[];
  insights?: string[];
}

interface Props { data: Fundamentals }

function MetricCard({ label, value, sub, color }: {
  label: string; value: string | null; sub?: string; color?: string
}) {
  return (
    <div className="bg-zinc-800/50 rounded-lg p-3">
      <div className="text-[10px] text-zinc-500 mb-1">{label}</div>
      <div className={cn("text-base font-bold tabular-nums", color ?? "text-white")}>{value ?? "—"}</div>
      {sub && <div className="text-[10px] text-zinc-600 mt-0.5">{sub}</div>}
    </div>
  );
}

function fmtB(v: number | null, currency = "USD"): string {
  if (v == null) return "—";
  const sym = currency === "TRY" ? "₺" : "$";
  if (Math.abs(v) >= 1e12) return `${sym}${(v / 1e12).toFixed(2)}T`;
  if (Math.abs(v) >= 1e9)  return `${sym}${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6)  return `${sym}${(v / 1e6).toFixed(1)}M`;
  return `${sym}${v.toFixed(0)}`;
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `%${v > 0 ? "+" : ""}${v.toFixed(1)}`;
}

function pctColor(v: number | null, good = "high"): string {
  if (v == null) return "text-zinc-400";
  if (good === "high") return v > 15 ? "text-emerald-400" : v > 5 ? "text-yellow-400" : "text-red-400";
  return v < 1 ? "text-emerald-400" : v < 2 ? "text-yellow-400" : "text-red-400";
}

export function FundamentalsPanel({ data }: Props) {
  if (!data.available) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-zinc-300 mb-2">Temel Analiz</h2>
        <p className="text-sm text-zinc-500">{data.reason ?? "Veri mevcut değil."}</p>
      </div>
    );
  }

  const { valuation, profitability, growth, balance_sheet, per_share, analyst, quarters, insights, sector, industry, currency = "USD" } = data;
  const peVs = valuation?.pe_vs_sector;
  const peVsColor = peVs === "ucuz" ? "text-emerald-400" : peVs === "pahalı" ? "text-red-400" : "text-yellow-400";
  const peVsBg   = peVs === "ucuz" ? "bg-emerald-400/10" : peVs === "pahalı" ? "bg-red-400/10" : "bg-yellow-400/10";
  const peVsLabel = peVs === "ucuz" ? "Değer Stoğu" : peVs === "pahalı" ? "Primli Fiyat" : "Uygun Değer";

  const recColor = (r: string | null | undefined) => {
    if (!r) return "text-zinc-400";
    if (r.includes("Güçlü Al") || r === "Al") return "text-emerald-400";
    if (r.includes("Güçlü Sat") || r === "Sat") return "text-red-400";
    return "text-yellow-400";
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">

      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-zinc-800">
        <div>
          <h2 className="text-sm font-semibold text-zinc-300">Temel Analiz</h2>
          <p className="text-xs text-zinc-500 mt-0.5">{sector}{industry ? ` · ${industry}` : ""}</p>
        </div>
        {peVs && (
          <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full", peVsBg, peVsColor)}>
            {peVsLabel}
          </span>
        )}
      </div>

      <div className="p-4 space-y-5">

        {/* Analist konsensüs */}
        {analyst?.recommendation && (
          <div className="bg-zinc-800/40 rounded-xl p-3 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-zinc-400">Analist Konsensüs</span>
            </div>
            <span className={cn("text-sm font-bold", recColor(analyst.recommendation))}>
              {analyst.recommendation}
            </span>
            {analyst.num_analysts && (
              <span className="text-[10px] text-zinc-500 ml-auto">{analyst.num_analysts} analist</span>
            )}
            {analyst.target_mean && (
              <div className="text-right">
                <div className="text-[10px] text-zinc-500">Hedef Fiyat</div>
                <div className="text-sm font-bold text-white">{fmtB(analyst.target_mean, currency)}</div>
                {analyst.target_low && analyst.target_high && (
                  <div className="text-[10px] text-zinc-600">
                    {fmtB(analyst.target_low, currency)} – {fmtB(analyst.target_high, currency)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Piyasa özeti */}
        {balance_sheet && (
          <div className="grid grid-cols-3 gap-2">
            <MetricCard label="Piyasa Değeri" value={fmtB(balance_sheet.market_cap, currency)} />
            <MetricCard label="Yıllık Gelir" value={fmtB(balance_sheet.revenue_ttm, currency)} />
            <MetricCard label="Net Kâr" value={fmtB(balance_sheet.net_income_ttm, currency)}
              color={balance_sheet.net_income_ttm != null && balance_sheet.net_income_ttm > 0 ? "text-emerald-400" : "text-red-400"} />
            <MetricCard label="Nakit & Eşd." value={fmtB(balance_sheet.total_cash, currency)} color="text-emerald-400" />
            <MetricCard label="Toplam Borç" value={fmtB(balance_sheet.total_debt, currency)} color="text-red-400" />
            <MetricCard label="Serbest Nakit Akışı" value={fmtB(balance_sheet.free_cashflow, currency)}
              color={balance_sheet.free_cashflow != null && balance_sheet.free_cashflow > 0 ? "text-emerald-400" : "text-red-400"} />
          </div>
        )}

        {/* Değerleme çarpanları */}
        {valuation && (
          <div>
            <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide mb-2">Değerleme Çarpanları</div>
            <div className="grid grid-cols-3 gap-2">
              <MetricCard label="F/K (P/E)"
                value={valuation.pe?.toFixed(1) ?? "—"}
                sub={`Sektör: ${valuation.sector_avg_pe?.toFixed(1) ?? "—"}`}
                color={peVsColor} />
              <MetricCard label="İleriye Dönük F/K"
                value={valuation.forward_pe?.toFixed(1) ?? "—"} />
              <MetricCard label="F/DD (P/B)"
                value={valuation.pb?.toFixed(1) ?? "—"} />
              <MetricCard label="F/S (P/S)"
                value={valuation.ps?.toFixed(1) ?? "—"} />
              <MetricCard label="EV/EBITDA"
                value={valuation.ev_ebitda?.toFixed(1) ?? "—"} />
              <MetricCard label="Beta"
                value={valuation.beta?.toFixed(2) ?? "—"}
                color={valuation.beta != null ? (valuation.beta > 1.3 ? "text-red-400" : valuation.beta < 0.7 ? "text-emerald-400" : "text-yellow-400") : undefined} />
            </div>
          </div>
        )}

        {/* Karlılık */}
        {profitability && (
          <div>
            <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide mb-2">Karlılık Oranları</div>
            <div className="grid grid-cols-3 gap-2">
              <MetricCard label="Brüt Marj" value={fmtPct(profitability.gross_margin)}
                color={pctColor(profitability.gross_margin)} />
              <MetricCard label="Faaliyet Marjı" value={fmtPct(profitability.operating_margin)}
                color={pctColor(profitability.operating_margin)} />
              <MetricCard label="Net Marj" value={fmtPct(profitability.net_margin)}
                color={pctColor(profitability.net_margin)} />
              <MetricCard label="ROE" value={fmtPct(profitability.roe)}
                color={pctColor(profitability.roe)} />
              <MetricCard label="ROA" value={fmtPct(profitability.roa)}
                color={pctColor(profitability.roa)} />
              {balance_sheet?.debt_to_equity != null && (
                <MetricCard label="Borç/Özkaynak"
                  value={balance_sheet.debt_to_equity.toFixed(2) + "x"}
                  color={pctColor(balance_sheet.debt_to_equity, "low")} />
              )}
            </div>
          </div>
        )}

        {/* Büyüme + Hisse başı */}
        <div className="grid grid-cols-2 gap-3">
          {growth && (
            <div className="bg-zinc-800/40 rounded-lg p-3">
              <div className="text-[10px] text-zinc-500 mb-2 uppercase tracking-wide">Büyüme (YoY)</div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Gelir Büyümesi</span>
                  <span className={cn("font-bold", growth.revenue_growth_yoy != null && growth.revenue_growth_yoy >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {fmtPct(growth.revenue_growth_yoy)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Kâr Büyümesi</span>
                  <span className={cn("font-bold", growth.earnings_growth_yoy != null && growth.earnings_growth_yoy >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {fmtPct(growth.earnings_growth_yoy)}
                  </span>
                </div>
              </div>
            </div>
          )}
          {per_share && (
            <div className="bg-zinc-800/40 rounded-lg p-3">
              <div className="text-[10px] text-zinc-500 mb-2 uppercase tracking-wide">Hisse Başı</div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">EPS (TTM)</span>
                  <span className="font-bold text-white">{per_share.eps_ttm?.toFixed(2) ?? "—"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">EPS (İleriye)</span>
                  <span className="font-bold text-blue-400">{per_share.eps_forward?.toFixed(2) ?? "—"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">52H Yüksek</span>
                  <span className="text-emerald-400">{per_share.week52_high?.toFixed(2) ?? "—"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">52H Düşük</span>
                  <span className="text-red-400">{per_share.week52_low?.toFixed(2) ?? "—"}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Çeyreklik tablo */}
        {quarters && quarters.length > 0 && (
          <div>
            <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide mb-2">Son 4 Çeyrek — Gelir Tablosu</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-600 border-b border-zinc-800">
                    <th className="pb-1.5 text-left font-medium">Dönem</th>
                    <th className="pb-1.5 text-right font-medium">Gelir</th>
                    <th className="pb-1.5 text-right font-medium">Brüt Kâr</th>
                    <th className="pb-1.5 text-right font-medium">Net Kâr</th>
                    <th className="pb-1.5 text-right font-medium">Net Marj</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {quarters.map((q) => (
                    <tr key={q.period} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-2 font-mono text-zinc-300 text-[11px]">{q.period}</td>
                      <td className="py-2 text-right text-zinc-400">{fmtB(q.revenue, currency)}</td>
                      <td className="py-2 text-right text-zinc-400">{fmtB(q.gross_profit, currency)}</td>
                      <td className={cn("py-2 text-right font-semibold", q.net_income != null && q.net_income >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {fmtB(q.net_income, currency)}
                      </td>
                      <td className={cn("py-2 text-right", pctColor(q.net_margin))}>
                        {q.net_margin != null ? `%${q.net_margin.toFixed(1)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Temel bulgular */}
        {insights && insights.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-zinc-800">
            <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide mb-2">Temel Bulgular</div>
            {insights.map((ins, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                <span className="text-blue-400 shrink-0 mt-0.5">•</span>
                {ins}
              </div>
            ))}
          </div>
        )}

        <p className="text-[10px] text-zinc-600 border-t border-zinc-800 pt-2">
          Veriler yfinance üzerinden çekilmektedir · Yatırım tavsiyesi değildir
        </p>
      </div>
    </div>
  );
}
