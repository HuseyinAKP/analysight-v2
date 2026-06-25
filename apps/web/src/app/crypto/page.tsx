"use client";

import { useQuery } from "@tanstack/react-query";
import { symbolsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { TrendingUp, TrendingDown, Bitcoin, Zap, ExternalLink } from "lucide-react";

const CRYPTO_SYMBOLS = [
  { symbol: "BTC-USD",  name: "Bitcoin",   icon: "₿", color: "text-orange-400", bg: "bg-orange-500/10" },
  { symbol: "ETH-USD",  name: "Ethereum",  icon: "Ξ", color: "text-purple-400", bg: "bg-purple-500/10" },
  { symbol: "BNB-USD",  name: "BNB",       icon: "◈", color: "text-yellow-400", bg: "bg-yellow-500/10" },
  { symbol: "SOL-USD",  name: "Solana",    icon: "◎", color: "text-green-400",  bg: "bg-green-500/10"  },
  { symbol: "XRP-USD",  name: "XRP",       icon: "✕", color: "text-blue-400",   bg: "bg-blue-500/10"   },
  { symbol: "DOGE-USD", name: "Dogecoin",  icon: "Ð", color: "text-yellow-300", bg: "bg-yellow-500/10" },
  { symbol: "ADA-USD",  name: "Cardano",   icon: "₳", color: "text-teal-400",   bg: "bg-teal-500/10"   },
  { symbol: "AVAX-USD", name: "Avalanche", icon: "△", color: "text-red-400",    bg: "bg-red-500/10"    },
];

const DEFI_SYMBOLS = [
  { symbol: "UNI-USD",  name: "Uniswap",  icon: "🦄" },
  { symbol: "LINK-USD", name: "Chainlink",icon: "⬡"  },
  { symbol: "AAVE-USD", name: "Aave",     icon: "👻" },
  { symbol: "MKR-USD",  name: "Maker",    icon: "⬡"  },
];

function CryptoCard({ meta }: { meta: typeof CRYPTO_SYMBOLS[0] }) {
  const { data, isLoading } = useQuery({
    queryKey: ["symbol", meta.symbol],
    queryFn: () => symbolsApi.get(meta.symbol),
    refetchInterval: 30_000,
  });

  const up = (data?.change_pct ?? 0) >= 0;

  return (
    <Link href={`/symbol/${meta.symbol}`}
      className="group bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-2xl p-4 transition-all hover:shadow-lg hover:shadow-black/30 block">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold", meta.bg, meta.color)}>
          {meta.icon}
        </div>
        <div>
          <p className="text-sm font-bold text-white">{meta.name}</p>
          <p className="text-xs text-zinc-500">{meta.symbol.replace("-USD", "")}</p>
        </div>
        <ExternalLink className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-400 ml-auto transition-colors" />
      </div>

      {isLoading ? (
        <div className="h-8 bg-zinc-800 rounded animate-pulse" />
      ) : data ? (
        <>
          <p className="text-xl font-bold font-mono text-white">
            ${data.price.toLocaleString("en-US", { maximumFractionDigits: data.price > 100 ? 0 : 4 })}
          </p>
          <div className={cn("flex items-center gap-1 mt-1 text-sm font-semibold", up ? "text-emerald-400" : "text-red-400")}>
            {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {up ? "+" : ""}{data.change_pct.toFixed(2)}%
            <span className="text-xs text-zinc-600 font-normal ml-1">24s</span>
          </div>
        </>
      ) : (
        <p className="text-xs text-zinc-600">Veri alınamadı</p>
      )}
    </Link>
  );
}

function SmallCryptoRow({ symbol, name }: { symbol: string; name: string }) {
  const { data } = useQuery({
    queryKey: ["symbol", symbol],
    queryFn: () => symbolsApi.get(symbol),
    refetchInterval: 60_000,
  });
  const up = (data?.change_pct ?? 0) >= 0;

  return (
    <Link href={`/symbol/${symbol}`}
      className="flex items-center justify-between py-2.5 px-3 hover:bg-zinc-800/50 rounded-xl transition-colors">
      <div>
        <p className="text-sm font-semibold text-white">{name}</p>
        <p className="text-xs text-zinc-500">{symbol.replace("-USD", "")}</p>
      </div>
      {data ? (
        <div className="text-right">
          <p className="text-sm font-mono text-white">
            ${data.price.toLocaleString("en-US", { maximumFractionDigits: data.price > 1 ? 4 : 6 })}
          </p>
          <p className={cn("text-xs font-semibold", up ? "text-emerald-400" : "text-red-400")}>
            {up ? "+" : ""}{data.change_pct.toFixed(2)}%
          </p>
        </div>
      ) : (
        <div className="w-16 h-4 bg-zinc-800 rounded animate-pulse" />
      )}
    </Link>
  );
}

export default function CryptoPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-orange-500/15 rounded-2xl flex items-center justify-center">
          <Bitcoin className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Kripto Para</h1>
          <p className="text-sm text-zinc-500">Canlı fiyatlar · AI analiz · Teknik göstergeler</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1.5">
          <Zap className="w-3 h-3 text-yellow-400" />
          30sn yenileme
        </div>
      </div>

      {/* Kripto bilgi notu */}
      <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3 text-xs text-yellow-400/80">
        Kripto piyasaları 7/24 açık olup yüksek volatilite içerir. Her sembol için tam teknik analiz, senaryo tahmini ve AI asistanına erişmek için karta tıklayın.
      </div>

      {/* Ana kripto grid */}
      <div>
        <h2 className="text-xs text-zinc-500 uppercase tracking-widest font-semibold mb-4">Büyük Kripto Paralar</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CRYPTO_SYMBOLS.map(m => <CryptoCard key={m.symbol} meta={m} />)}
        </div>
      </div>

      {/* DeFi bölümü */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <h2 className="text-xs text-zinc-500 uppercase tracking-widest font-semibold mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-purple-400 rounded-full" />
          DeFi Tokenlar
        </h2>
        <div className="divide-y divide-zinc-800/50">
          {DEFI_SYMBOLS.map(d => <SmallCryptoRow key={d.symbol} symbol={d.symbol} name={d.name} />)}
        </div>
      </div>

      {/* Analiz CTA */}
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/50 border border-zinc-800 rounded-2xl p-6 text-center">
        <h3 className="text-lg font-bold text-white mb-2">Derin Kripto Analizi</h3>
        <p className="text-sm text-zinc-400 mb-4">
          Herhangi bir kripto para için RSI, MACD, Bollinger Band analizi,
          senaryo tahmini ve AI analist yorumu alın.
        </p>
        <Link href="/kesfet"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
          Tüm Varlıkları Keşfet
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
