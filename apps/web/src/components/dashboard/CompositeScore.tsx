"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Zap, TrendingUp, ShieldCheck, BarChart2, Cpu } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ScoreData = {
  symbol: string;
  score: number;
  label: string;
  color: string;
  ml_available: boolean;
  components: {
    ml: number;
    technical: number;
    trend: number;
    risk: number;
    momentum: number;
  };
};

const COLORS: Record<string, { ring: string; text: string; bg: string; glow: string }> = {
  emerald: { ring: "#34d399", text: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/25", glow: "shadow-emerald-500/20" },
  blue:    { ring: "#60a5fa", text: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/25",       glow: "shadow-blue-500/20" },
  zinc:    { ring: "#71717a", text: "text-zinc-400",    bg: "bg-zinc-800/60 border-zinc-700",           glow: "" },
  amber:   { ring: "#fbbf24", text: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/25",      glow: "shadow-amber-500/20" },
  red:     { ring: "#f87171", text: "text-red-400",     bg: "bg-red-500/10 border-red-500/25",          glow: "shadow-red-500/20" },
};

const COMPONENTS = [
  { key: "ml",        label: "ML",        icon: Cpu,        tip: "XGBoost 5 günlük tahmin" },
  { key: "technical", label: "Teknik",    icon: BarChart2,  tip: "Confluence skoru" },
  { key: "trend",     label: "Trend",     icon: TrendingUp, tip: "EMA + ADX" },
  { key: "risk",      label: "Risk",      icon: ShieldCheck,tip: "Belirsizlik + Senaryo" },
  { key: "momentum",  label: "Momentum",  icon: Zap,        tip: "RSI + MACD" },
] as const;

// ── Büyük halka ───────────────────────────────────────────────────────────────
function ScoreRing({ score, color }: { score: number; color: string }) {
  const c = COLORS[color] ?? COLORS.zinc;
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-28 h-28 shrink-0">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r="54" fill="none" stroke="#27272a" strokeWidth="8" />
        <circle
          cx="60" cy="60" r="54" fill="none"
          stroke={c.ring} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-white leading-none">{score}</span>
        <span className="text-[10px] text-zinc-500 mt-0.5">/100</span>
      </div>
    </div>
  );
}

// ── Mini bileşen çubuğu ───────────────────────────────────────────────────────
function ComponentBar({
  label, icon: Icon, value, color, dim,
}: { label: string; icon: React.ElementType; value: number; color: string; dim: boolean }) {
  const c = COLORS[color] ?? COLORS.zinc;
  return (
    <div className={cn("space-y-1", dim && "opacity-40")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Icon className={cn("w-3 h-3", c.text)} />
          <span className="text-[10px] text-zinc-500">{label}</span>
        </div>
        <span className={cn("text-[10px] font-mono font-bold", c.text)}>{value}</span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, backgroundColor: c.ring + "cc" }}
        />
      </div>
    </div>
  );
}

function barColor(v: number): string {
  if (v >= 65) return "emerald";
  if (v >= 50) return "blue";
  if (v >= 35) return "zinc";
  if (v >= 20) return "amber";
  return "red";
}

// ── Ana bileşen ───────────────────────────────────────────────────────────────
export function CompositeScore({ symbol }: { symbol: string }) {
  const { data, isLoading } = useQuery<ScoreData>({
    queryKey: ["composite", symbol],
    queryFn: () =>
      fetch(`${API}/api/analysis/${symbol}/composite`).then(r => r.json()),
    staleTime: 300_000,
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 flex items-center gap-5 animate-pulse">
        <div className="w-28 h-28 rounded-full bg-zinc-800 shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="h-5 bg-zinc-800 rounded w-32" />
          <div className="h-3 bg-zinc-800 rounded w-48" />
          <div className="h-2 bg-zinc-800 rounded" />
          <div className="h-2 bg-zinc-800 rounded w-4/5" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const c = COLORS[data.color] ?? COLORS.zinc;

  return (
    <div className={cn(
      "rounded-2xl border p-5 flex flex-col sm:flex-row gap-5",
      c.bg, c.glow && `shadow-lg ${c.glow}`
    )}>

      {/* Sol: Halka + Etiket */}
      <div className="flex items-center gap-4 sm:flex-col sm:items-center sm:gap-2 shrink-0">
        <ScoreRing score={data.score} color={data.color} />
        <div className="sm:text-center">
          <p className={cn("text-sm font-bold", c.text)}>{data.label}</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">Composite Skor</p>
          {data.ml_available && (
            <div className="flex items-center gap-1 mt-1 justify-center">
              <Zap className="w-2.5 h-2.5 text-purple-400" />
              <span className="text-[9px] text-purple-400 font-semibold">XGBoost dahil</span>
            </div>
          )}
        </div>
      </div>

      {/* Sağ: Bileşen çubukları */}
      <div className="flex-1 space-y-2.5">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-3">
          Bileşen Skorları
        </p>
        {COMPONENTS.map(({ key, label, icon }) => (
          <ComponentBar
            key={key}
            label={label}
            icon={icon}
            value={data.components[key]}
            color={barColor(data.components[key])}
            dim={key === "ml" && !data.ml_available}
          />
        ))}
      </div>
    </div>
  );
}
