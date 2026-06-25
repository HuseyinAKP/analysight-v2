"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RiskData, riskApi } from "@/lib/api";
import { fmt, fmtPct } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ShieldAlert, RefreshCw } from "lucide-react";
import { TooltipInfo, TIPS } from "@/components/ui/TooltipInfo";

interface Props { risk: RiskData; symbol?: string }

export function RiskPanel({ risk: initialRisk, symbol }: Props) {
  const [entry, setEntry]   = useState(initialRisk.entry_price.toString());
  const [account, setAccount] = useState(initialRisk.position_sizing.account_size.toString());
  const [riskPct, setRiskPct] = useState(initialRisk.position_sizing.risk_pct.toString());
  const [submitted, setSubmitted] = useState<{ entry?: number; account?: number; risk_pct?: number } | null>(null);

  const { data: risk = initialRisk, isFetching } = useQuery({
    queryKey: ["risk", symbol, submitted],
    queryFn: () => riskApi.calc(symbol!, {
      entry_price: submitted?.entry,
      account_size: submitted?.account,
      risk_pct: submitted?.risk_pct,
    }),
    enabled: !!submitted && !!symbol,
    placeholderData: initialRisk,
  });

  function handleRecalc() {
    setSubmitted({
      entry:    parseFloat(entry)   || undefined,
      account:  parseFloat(account) || 100_000,
      risk_pct: parseFloat(riskPct) || 1,
    });
  }

  const ps = risk.position_sizing;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-orange-400" />
        <h2 className="text-sm font-semibold text-gray-300">Risk Motoru</h2>
        {isFetching && <RefreshCw className="w-3 h-3 text-gray-500 animate-spin ml-auto" />}
      </div>

      {/* Inputs */}
      <div className="space-y-2">
        <p className="text-xs text-gray-500 font-medium">Parametreler</p>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] text-gray-600 block mb-1">Giriş Fiyatı</label>
            <input
              type="number"
              value={entry}
              onChange={e => setEntry(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-600 block mb-1">Hesap (₺)</label>
            <input
              type="number"
              value={account}
              onChange={e => setAccount(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-600 block mb-1">Risk %</label>
            <input
              type="number"
              step="0.5"
              min="0.1"
              max="10"
              value={riskPct}
              onChange={e => setRiskPct(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <button
          onClick={handleRecalc}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
        >
          Hesapla
        </button>
      </div>

      {/* Risk/Reward visual */}
      <div>
        <p className="text-xs text-gray-500 mb-2">Risk / Ödül Görünümü</p>
        <div className="relative h-8 bg-gray-800 rounded-lg overflow-hidden flex">
          {/* Stop zone (red) */}
          <div
            className="h-full bg-red-500/30 border-r border-red-500/50 flex items-center justify-center"
            style={{ width: `${Math.abs(risk.stop_pct) / (Math.abs(risk.stop_pct) + risk.target2_pct) * 100}%` }}
          >
            <span className="text-[9px] text-red-400 font-mono">SL {fmtPct(risk.stop_pct)}</span>
          </div>
          {/* Entry pin */}
          <div className="w-px bg-yellow-400 h-full" />
          {/* Target 1 zone */}
          <div
            className="h-full bg-emerald-500/20 border-r border-emerald-500/30 flex items-center justify-center"
            style={{ width: `${(risk.target1_pct / (Math.abs(risk.stop_pct) + risk.target2_pct)) * 100}%` }}
          >
            <span className="text-[9px] text-emerald-400 font-mono">T1</span>
          </div>
          {/* Target 2 zone */}
          <div className="flex-1 h-full bg-emerald-500/10 flex items-center justify-center">
            <span className="text-[9px] text-emerald-400 font-mono">T2</span>
          </div>
        </div>
      </div>

      {/* Detail rows */}
      <div className="space-y-1.5 text-sm">
        <Row label="Giriş Fiyatı"  value={fmt(risk.entry_price)} />
        <Row label="Stop-Loss"      value={`${fmt(risk.stop_loss)} (${fmtPct(risk.stop_pct)})`}   valueClass="text-red-400"     tip={TIPS.stopLoss} />
        <Row label="Hedef 1"        value={`${fmt(risk.target1)} (${fmtPct(risk.target1_pct)})`}  valueClass="text-emerald-400" tip={TIPS.target} />
        <Row label="Hedef 2"        value={`${fmt(risk.target2)} (${fmtPct(risk.target2_pct)})`}  valueClass="text-emerald-400" />
        <Row label="ATR"            value={fmt(risk.atr, 4)} valueClass="text-gray-400"           tip={TIPS.atr} />
      </div>

      {/* R/R badges */}
      <div className="grid grid-cols-2 gap-2">
        <RRBadge label="R/R — Hedef 1" value={risk.rr_ratio_t1} tip={TIPS.rr} />
        <RRBadge label="R/R — Hedef 2" value={risk.rr_ratio_t2} />
      </div>

      {/* Position sizing */}
      <div className="border-t border-gray-800 pt-3 space-y-1.5 text-sm">
        <p className="text-xs text-gray-500 font-medium mb-2">Pozisyon Büyüklüğü</p>
        <Row label="Max Risk Tutarı"    value={fmt(ps.max_risk_amount)} valueClass="text-orange-400" />
        <Row label="Lot / Adet"         value={ps.shares.toLocaleString("tr-TR")} valueClass="text-white" />
        <Row label="Pozisyon Değeri"    value={fmt(ps.position_value)} />
        <Row label="Hesabın Yüzdesi"    value={`%${((ps.position_value / ps.account_size) * 100).toFixed(1)}`} />
      </div>
    </div>
  );
}

function Row({ label, value, valueClass, tip }: { label: string; value: string; valueClass?: string; tip?: { title: string; content: string } }) {
  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-1">
        <span className="text-gray-500 text-xs">{label}</span>
        {tip && <TooltipInfo title={tip.title} content={tip.content} side="right" />}
      </div>
      <span className={cn("font-mono font-semibold text-white text-xs", valueClass)}>{value}</span>
    </div>
  );
}

function RRBadge({ label, value, tip }: { label: string; value: number; tip?: { title: string; content: string } }) {
  const good = value >= 2;
  const great = value >= 3;
  return (
    <div className={cn(
      "rounded-xl p-3 text-center border",
      great ? "bg-emerald-500/15 border-emerald-400/30"
             : good ? "bg-emerald-500/10 border-emerald-500/20"
             : "bg-gray-800 border-gray-700"
    )}>
      <div className="flex items-center justify-center gap-1 mb-1">
        <p className="text-[10px] text-gray-500">{label}</p>
        {tip && <TooltipInfo title={tip.title} content={tip.content} side="top" />}
      </div>
      <p className={cn("font-bold text-xl", great ? "text-emerald-300" : good ? "text-emerald-400" : "text-gray-400")}>
        {value}x
      </p>
      <p className="text-[10px] mt-0.5 text-gray-600">
        {great ? "Mükemmel" : good ? "İyi" : "Zayıf"}
      </p>
    </div>
  );
}
