"use client";

import { cn } from "@/lib/utils";
import type { Indicators, Scenarios, RiskData } from "@/lib/api";

interface Props {
  indicators: Indicators;
  scenarios: Scenarios;
  risk: RiskData;
}

function Badge({ label, color }: { label: string; color: "green" | "yellow" | "red" | "blue" | "gray" }) {
  return (
    <span className={cn(
      "inline-flex items-center text-[11px] font-medium px-2.5 py-1 rounded-lg border",
      color === "green"  && "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
      color === "yellow" && "bg-amber-500/10   border-amber-500/20   text-amber-400",
      color === "red"    && "bg-red-500/10     border-red-500/20     text-red-400",
      color === "blue"   && "bg-blue-500/10    border-blue-500/20    text-blue-400",
      color === "gray"   && "bg-zinc-800       border-zinc-700       text-zinc-400",
    )}>
      {label}
    </span>
  );
}

export function StatusBadges({ indicators, scenarios, risk }: Props) {
  const badges: { label: string; color: "green" | "yellow" | "red" | "blue" | "gray" }[] = [];

  // 1. Trend yönü — son close fiyatı series'den al
  const closes = indicators.series?.close ?? [];
  const price = closes.length > 0 ? closes[closes.length - 1] : 0;
  const ema200 = indicators.ema200 ?? 0;
  if (ema200 && price > ema200 * 1.02) badges.push({ label: "📈 Yükseliş Trendi", color: "green" });
  else if (ema200 && price < ema200 * 0.98) badges.push({ label: "📉 Düşüş Trendi", color: "red" });
  else badges.push({ label: "↔ Yatay Bant", color: "gray" });

  // 2. Momentum (MACD)
  if (indicators.macd != null && indicators.macd_signal != null) {
    const diff = indicators.macd - indicators.macd_signal;
    if (diff > 0.5) badges.push({ label: "⚡ Güçlü Momentum", color: "green" });
    else if (diff > 0) badges.push({ label: "⚡ Zayıf Momentum", color: "yellow" });
    else badges.push({ label: "⚡ Negatif Momentum", color: "red" });
  }

  // 3. RSI durumu
  const rsi = indicators.rsi ?? 50;
  if (rsi >= 70) badges.push({ label: `RSI ${rsi.toFixed(0)} Aşırı Alım`, color: "red" });
  else if (rsi <= 30) badges.push({ label: `RSI ${rsi.toFixed(0)} Aşırı Satım`, color: "green" });
  else if (rsi >= 55) badges.push({ label: `RSI ${rsi.toFixed(0)} Yükseliş`, color: "green" });
  else if (rsi <= 45) badges.push({ label: `RSI ${rsi.toFixed(0)} Düşüş`, color: "yellow" });
  else badges.push({ label: `RSI ${rsi.toFixed(0)} Nötr`, color: "gray" });

  // 4. Belirsizlik
  const unc = scenarios.uncertainty_index ?? 50;
  if (unc >= 70) badges.push({ label: `⚠ Yüksek Belirsizlik`, color: "red" });
  else if (unc >= 45) badges.push({ label: `Orta Belirsizlik`, color: "yellow" });
  else badges.push({ label: `✓ Düşük Belirsizlik`, color: "green" });

  // 5. Risk/Ödül
  const rr = risk?.rr_ratio_t1 ?? 0;
  if (rr >= 2.5) badges.push({ label: `R/R ${rr.toFixed(1)} Cazip`, color: "green" });
  else if (rr >= 1.8) badges.push({ label: `R/R ${rr.toFixed(1)} Yeterli`, color: "blue" });
  else if (rr > 0) badges.push({ label: `R/R ${rr.toFixed(1)} Düşük`, color: "yellow" });

  // 6. Boğa olasılığı
  const bull = scenarios.scenarios?.bull?.probability ?? 0;
  if (bull >= 60) badges.push({ label: `Boğa %${bull}`, color: "green" });
  else if (bull >= 40) badges.push({ label: `Boğa %${bull}`, color: "yellow" });
  else badges.push({ label: `Boğa %${bull}`, color: "red" });

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((b, i) => <Badge key={i} label={b.label} color={b.color} />)}
    </div>
  );
}
