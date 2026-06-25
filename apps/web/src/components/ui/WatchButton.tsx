"use client";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWatchlist } from "@/hooks/useWatchlist";

export function WatchButton({ symbol, size = "md" }: { symbol: string; size?: "sm" | "md" }) {
  const { has, toggle, mounted } = useWatchlist();
  if (!mounted) return null;

  const watching = has(symbol);

  return (
    <button
      onClick={() => toggle(symbol)}
      className={cn(
        "flex items-center gap-1.5 font-bold rounded-lg border transition-all",
        size === "sm" ? "text-[10px] px-2.5 py-1" : "text-xs px-3 py-1.5",
        watching
          ? "bg-yellow-500/15 border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/25"
          : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white",
      )}
      title={watching ? "Takipten çıkar" : "Takip listesine ekle"}
    >
      <Star className={cn(size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5", watching && "fill-yellow-400")} />
      {watching ? "Takipte" : "Takip Et"}
    </button>
  );
}
