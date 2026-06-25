"use client";
import { useQuery } from "@tanstack/react-query";
import { symbolsApi } from "@/lib/api";
import { fmt, fmtPct } from "@/lib/utils";
import { cn } from "@/lib/utils";

function Ticker({ symbol }: { symbol: string }) {
  const { data } = useQuery({
    queryKey: ["symbol", symbol],
    queryFn: () => symbolsApi.get(symbol),
  });
  if (!data) return null;
  const up = data.change_pct >= 0;
  return (
    <span className="flex items-center gap-2 px-4 shrink-0">
      <span className="font-mono text-xs font-bold text-gray-300">{data.symbol}</span>
      <span className="text-xs text-white">{fmt(data.price)}</span>
      <span className={cn("text-xs font-semibold", up ? "text-emerald-400" : "text-red-400")}>
        {fmtPct(data.change_pct)}
      </span>
      <span className="text-gray-700 ml-1">·</span>
    </span>
  );
}

export function MarketBanner({ symbols }: { symbols: string[] }) {
  return (
    <div className="relative overflow-hidden border border-gray-800 rounded-xl bg-gray-900/50 h-10 flex items-center">
      <div className="absolute left-0 z-10 h-full w-10 bg-gradient-to-r from-gray-900/80 to-transparent pointer-events-none" />
      <div className="absolute right-0 z-10 h-full w-10 bg-gradient-to-l from-gray-900/80 to-transparent pointer-events-none" />
      <div
        className="flex whitespace-nowrap"
        style={{ animation: "marquee 30s linear infinite" }}
      >
        {[...symbols, ...symbols].map((sym, i) => (
          <Ticker key={`${sym}-${i}`} symbol={sym} />
        ))}
      </div>
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
