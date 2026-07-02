"use client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Moon } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Props { symbol: string; compact?: boolean }

export function KatilimBadge({ symbol, compact = false }: Props) {
  const { data } = useQuery({
    queryKey: ["katilim", symbol],
    queryFn: () =>
      fetch(`${API}/api/analysis/${symbol}/katilim`).then(r => r.json()),
    staleTime: 86_400_000, // 24 saat — liste nadiren değişir
  });

  if (!data || !data.label) return null;

  const is30 = data.in_katilim_30;

  if (compact) {
    return (
      <span className={cn(
        "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border",
        is30
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
          : "bg-blue-500/10 text-blue-400 border-blue-500/30"
      )}>
        <Moon className="w-2.5 h-2.5" />
        {data.label}
      </span>
    );
  }

  return (
    <div className={cn(
      "flex items-center gap-2 rounded-xl px-3 py-2 border",
      is30
        ? "bg-emerald-500/5 border-emerald-500/20"
        : "bg-blue-500/5 border-blue-500/20"
    )}>
      <Moon className={cn("w-4 h-4 shrink-0", is30 ? "text-emerald-400" : "text-blue-400")} />
      <div>
        <div className={cn("text-xs font-bold", is30 ? "text-emerald-400" : "text-blue-400")}>
          {data.label} Endeksinde
        </div>
        <div className="text-[10px] text-zinc-500">{data.description}</div>
      </div>
    </div>
  );
}
