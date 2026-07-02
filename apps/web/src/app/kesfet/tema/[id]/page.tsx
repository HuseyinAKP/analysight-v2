"use client";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface ThemeDetail {
  id: string; title: string; emoji: string;
  description: string; color: string; symbols: string[];
}

export default function TemaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: theme, isLoading } = useQuery({
    queryKey: ["theme", id],
    queryFn: () => fetch(`${API}/api/themes/${id}`).then(r => r.json()) as Promise<ThemeDetail>,
    staleTime: 3_600_000,
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <Link href="/kesfet" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Keşfet'e Dön
      </Link>

      {isLoading && (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-zinc-900 rounded-xl animate-pulse" />)}
        </div>
      )}

      {theme && (
        <>
          <div className="flex items-center gap-3">
            <span className="text-4xl">{theme.emoji}</span>
            <div>
              <h1 className="text-xl font-bold text-white">{theme.title}</h1>
              <p className="text-xs text-zinc-500">{theme.description}</p>
            </div>
          </div>

          <div className="space-y-2">
            {theme.symbols.map(sym => (
              <SymbolRow key={sym} symbol={sym} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SymbolRow({ symbol }: { symbol: string }) {
  const { data } = useQuery({
    queryKey: ["symbol-price", symbol],
    queryFn: () =>
      fetch(`${API}/api/symbols/${symbol}`).then(r => r.json()),
    staleTime: 60_000,
  });

  return (
    <Link href={`/symbol/${symbol}`}
      className="flex items-center justify-between bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl px-4 py-3 transition-colors"
    >
      <div>
        <div className="text-sm font-bold text-white">{symbol}</div>
        {data?.name && <div className="text-xs text-zinc-500">{data.name}</div>}
      </div>
      <div className="text-right">
        {data?.price ? (
          <>
            <div className="text-sm font-semibold text-white">
              {data.price.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
            </div>
            {data.change_pct != null && (
              <div className={cn("text-xs flex items-center gap-0.5 justify-end",
                data.change_pct >= 0 ? "text-emerald-400" : "text-red-400"
              )}>
                {data.change_pct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {data.change_pct >= 0 ? "+" : ""}{data.change_pct?.toFixed(2)}%
              </div>
            )}
          </>
        ) : (
          <div className="text-xs text-zinc-600">Yükleniyor...</div>
        )}
      </div>
    </Link>
  );
}
