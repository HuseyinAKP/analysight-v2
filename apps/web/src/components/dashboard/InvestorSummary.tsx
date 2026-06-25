"use client";

import { cn } from "@/lib/utils";
import type { Indicators, Scenarios, RiskData } from "@/lib/api";
import { ShareCardButton } from "@/components/tools/ShareCard";
import { TooltipInfo, TIPS } from "@/components/ui/TooltipInfo";

interface Props {
  symbol: string;
  indicators: Indicators;
  scenarios: Scenarios;
  risk: RiskData;
}

// 0-100 fırsat skoru hesapla (scanner ile aynı mantık)
function calcOpportunityScore(ind: Indicators, sc: Scenarios): number {
  let score = 50;
  const rsi = ind.rsi;
  if (rsi <= 30) score += 20;
  else if (rsi <= 40) score += 10;
  else if (rsi >= 70) score -= 20;
  else if (rsi >= 60) score -= 5;
  if (ind.macd > ind.macd_signal) score += 10; else score -= 10;
  const bullProb = sc.scenarios.bull.probability;
  score += (bullProb - 30) * 0.4;
  score -= (sc.uncertainty_index - 40) * 0.3;
  return Math.round(Math.min(Math.max(score, 0), 100));
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 65 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";
  const label = score >= 65 ? "Güçlü" : score >= 40 ? "Nötr" : "Zayıf";
  const r = 28, circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#27272a" strokeWidth="6" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 36 36)" />
        <text x="36" y="40" textAnchor="middle" fontSize="16" fontWeight="bold" fill="white">{score}</text>
      </svg>
      <span className="text-xs font-bold" style={{ color }}>{label}</span>
    </div>
  );
}

function TrafficLight({ level }: { level: "green" | "yellow" | "red" }) {
  return (
    <div className="flex gap-1.5">
      {(["red","yellow","green"] as const).map(c => (
        <div key={c} className={cn("w-3 h-3 rounded-full transition-all",
          level === c
            ? c === "green" ? "bg-emerald-400 shadow-lg shadow-emerald-500/50"
              : c === "yellow" ? "bg-yellow-400 shadow-lg shadow-yellow-500/50"
              : "bg-red-400 shadow-lg shadow-red-500/50"
            : "bg-zinc-700")} />
      ))}
    </div>
  );
}

function SimpleBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function InvestorSummary({ symbol, indicators, scenarios, risk }: Props) {
  const score = calcOpportunityScore(indicators, scenarios);
  const signalText = score >= 70 ? "Güçlü Al" : score >= 55 ? "Al" : score >= 40 ? "Nötr" : "Sat";
  const rsi = indicators.rsi;
  const macdBull = indicators.macd > indicators.macd_signal;
  const uncert = scenarios.uncertainty_index;
  const bullProb = scenarios.scenarios.bull.probability;

  // Plain language verdict
  const signalLevel: "green" | "yellow" | "red" =
    score >= 65 ? "green" : score >= 40 ? "yellow" : "red";

  const headline =
    score >= 70 ? "Teknik görünüm güçlü, dikkat çekici bir fırsat penceresi açılıyor."
    : score >= 55 ? "Genel görünüm makul, ancak net bir sinyal için daha fazla onay bekleniyor."
    : score >= 40 ? "Karışık sinyaller var. Bekle-izle modu uygun olabilir."
    : "Teknik görünüm zayıf. Acele etmemek daha iyi bir seçenek olabilir.";

  // Bullet insights — plain language
  const insights: { icon: string; text: string; color: string }[] = [];

  if (rsi < 30) insights.push({ icon: "▲", text: `RSI ${rsi.toFixed(0)} — Hisse aşırı satılmış görünüyor. Tarihsel olarak bu bölgeler toparlanma başlangıcı olabilir.`, color: "text-emerald-400" });
  else if (rsi > 70) insights.push({ icon: "▼", text: `RSI ${rsi.toFixed(0)} — Aşırı alınmış bölge. Kısa vadeli kâr satışı riski artmış.`, color: "text-red-400" });
  else insights.push({ icon: "—", text: `RSI ${rsi.toFixed(0)} — Aşırı alım ya da satım sinyali yok. Nötr bölgede.`, color: "text-zinc-400" });

  if (macdBull) insights.push({ icon: "▲", text: "Momentum yönü yukarı. Kısa vadeli alıcılar baskın.", color: "text-emerald-400" });
  else insights.push({ icon: "▼", text: "Momentum yönü aşağı. Satıcılar öne geçmiş durumda.", color: "text-red-400" });

  if (uncert < 40) insights.push({ icon: "·", text: `Belirsizlik düşük (${uncert}/100). Senaryo tahminleri daha güvenilir.`, color: "text-emerald-400" });
  else if (uncert > 65) insights.push({ icon: "!", text: `Belirsizlik yüksek (${uncert}/100). Fiyat tahminleri daha az güvenilir.`, color: "text-red-400" });
  else insights.push({ icon: "·", text: `Orta düzeyde belirsizlik (${uncert}/100). Pozisyon büyüklüğünü sınırlı tutun.`, color: "text-yellow-400" });

  if (bullProb >= 45) insights.push({ icon: "▲", text: `28 günlük boğa senaryosu olasılığı %${bullProb}. Yükseliş lehinde.`, color: "text-emerald-400" });
  else if (bullProb < 30) insights.push({ icon: "▼", text: `Boğa senaryosu olasılığı yalnızca %${bullProb}. Ayı baskısı ağır basıyor.`, color: "text-red-400" });

  // Risk summary
  const stopPct = Math.abs(risk.stop_pct);
  const t1Pct   = risk.target1_pct;

  // Mini metric cards
  const metrics = [
    { label: "Fırsat Skoru", value: `${score}/100`, color: score >= 65 ? "text-emerald-400" : score >= 40 ? "text-yellow-400" : "text-red-400", tip: TIPS.score },
    { label: "Boğa Olasılığı", value: `%${bullProb}`, color: bullProb >= 40 ? "text-emerald-400" : "text-red-400", tip: TIPS.bullProb },
    { label: "Belirsizlik", value: `${uncert}/100`, color: uncert < 40 ? "text-emerald-400" : uncert > 65 ? "text-red-400" : "text-yellow-400", tip: TIPS.uncertainty },
    { label: "R/R Oranı", value: `${risk.rr_ratio_t1}x`, color: risk.rr_ratio_t1 >= 2 ? "text-emerald-400" : "text-yellow-400", tip: TIPS.rr },
  ];

  return (
    <div className={cn("rounded-2xl border p-5 space-y-4",
      signalLevel === "green" ? "bg-emerald-500/5 border-emerald-500/20"
      : signalLevel === "red" ? "bg-red-500/5 border-red-500/20"
      : "bg-yellow-500/5 border-yellow-500/20")}>

      {/* Header row */}
      <div className="flex items-start gap-4">
        <ScoreRing score={score} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <TrafficLight level={signalLevel} />
            <span className={cn("text-sm font-bold",
              signalLevel === "green" ? "text-emerald-400" : signalLevel === "red" ? "text-red-400" : "text-yellow-400")}>
              {signalLevel === "green" ? "Teknik Görünüm: Güçlü" : signalLevel === "red" ? "Teknik Görünüm: Zayıf" : "Teknik Görünüm: Karışık"}
            </span>
            <div className="ml-auto">
              <ShareCardButton
                symbol={symbol}
                score={score}
                rsi={indicators.rsi}
                signal={signalText}
                signalColor={signalLevel}
                target={risk.target1}
                stopLoss={risk.stop_loss}
                aiSummary={headline}
              />
            </div>
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed">{headline}</p>
        </div>
      </div>

      {/* Mini metrics */}
      <div className="grid grid-cols-4 gap-2">
        {metrics.map(m => (
          <div key={m.label} className="bg-zinc-900/60 rounded-xl p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <p className="text-[10px] text-zinc-500">{m.label}</p>
              {m.tip && <TooltipInfo title={m.tip.title} content={m.tip.content} side="top" />}
            </div>
            <p className={cn("text-sm font-bold", m.color)}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Plain language insights */}
      <div className="space-y-2">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold">Sade Dilde Yorumlar</p>
        {insights.map((ins, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span className="text-base shrink-0 mt-0.5">{ins.icon}</span>
            <p className="text-xs text-zinc-300 leading-relaxed">{ins.text}</p>
          </div>
        ))}
      </div>

      {/* Risk strip */}
      <div className="bg-zinc-900/60 rounded-xl p-3">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2">Risk/Getiri Özeti</p>
        <div className="flex items-center gap-4 text-xs">
          <div>
            <p className="text-zinc-500 mb-0.5">Maksimum Risk</p>
            <p className="text-red-400 font-bold">-%{stopPct.toFixed(1)}</p>
          </div>
          <div className="flex-1">
            <SimpleBar value={stopPct} max={15} color="bg-red-500/60" />
          </div>
          <div>
            <p className="text-zinc-500 mb-0.5">Hedef Getiri</p>
            <p className="text-emerald-400 font-bold">+%{t1Pct.toFixed(1)}</p>
          </div>
          <div className="flex-1">
            <SimpleBar value={t1Pct} max={30} color="bg-emerald-500/60" />
          </div>
        </div>
        <p className="text-[10px] text-zinc-600 mt-2">
          Bu analiz bilgi amaçlıdır, yatırım tavsiyesi değildir. Kararlarınızı kendi araştırmanızla destekleyin.
        </p>
      </div>
    </div>
  );
}
