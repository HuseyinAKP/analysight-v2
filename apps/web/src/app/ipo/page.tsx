"use client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Rocket, Calendar, Building2 } from "lucide-react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface IpoItem {
  symbol: string;
  name: string;
  ipo_date: string;
  sector: string;
  price: number | null;
  prev_close: number | null;
  pct_change: number | null;
  market_cap: number | null;
  days_since_ipo: number;
}

function fmtMktCap(v: number | null): string {
  if (!v) return "—";
  if (v >= 1e12) return (v / 1e12).toFixed(1) + "T ₺";
  if (v >= 1e9)  return (v / 1e9).toFixed(1) + "B ₺";
  if (v >= 1e6)  return (v / 1e6).toFixed(0) + "M ₺";
  return v.toLocaleString("tr-TR") + " ₺";
}

function NewBadge({ days }: { days: number }) {
  if (days > 180) return null;
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
      YENİ
    </span>
  );
}

export default function IpoPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["ipo-list"],
    queryFn: () =>
      fetch(`${API}/api/ipo/list?limit=30`)
        .then(r => r.json()) as Promise<{ ipos: IpoItem[]; count: number }>,
    staleTime: 300_000,
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Başlık */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <Rocket className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Halka Arz Takibi</h1>
          <p className="text-xs text-zinc-500">BIST'e yakın dönemde kote olan şirketler</p>
        </div>
      </div>

      {/* Liste */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-20 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && data && (
        <div className="space-y-2">
          {data.ipos.map(ipo => (
            <Link key={ipo.symbol} href={`/symbol/${ipo.symbol}`}
              className="block bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 hover:border-zinc-600 transition-colors"
            >
              <div className="flex items-center justify-between gap-4">
                {/* Sol: sembol + isim */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">
                    <span className="text-xs font-bold text-zinc-300">{ipo.symbol.slice(0, 3)}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{ipo.symbol}</span>
                      <NewBadge days={ipo.days_since_ipo} />
                    </div>
                    <div className="text-xs text-zinc-500 truncate">{ipo.name}</div>
                  </div>
                </div>

                {/* Orta: sektör + tarih */}
                <div className="hidden sm:flex flex-col items-center gap-0.5">
                  <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                    <Building2 className="w-3 h-3" />
                    {ipo.sector}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-zinc-600">
                    <Calendar className="w-3 h-3" />
                    {ipo.ipo_date}
                  </div>
                </div>

                {/* Sağ: fiyat + değişim */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-bold text-white">
                      {ipo.price ? ipo.price.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " ₺" : "—"}
                    </div>
                    <div className="text-[10px] text-zinc-600">Piy. Değ.: {fmtMktCap(ipo.market_cap)}</div>
                  </div>
                  {ipo.pct_change !== null ? (
                    <div className={cn(
                      "flex items-center gap-0.5 text-sm font-bold w-16 justify-end",
                      ipo.pct_change >= 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      {ipo.pct_change >= 0
                        ? <TrendingUp className="w-3.5 h-3.5" />
                        : <TrendingDown className="w-3.5 h-3.5" />}
                      {ipo.pct_change >= 0 ? "+" : ""}{ipo.pct_change.toFixed(2)}%
                    </div>
                  ) : (
                    <div className="w-16 text-right text-zinc-600 text-xs">—</div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs text-zinc-700 text-center pt-2">
        Fiyat verisi yfinance üzerinden alınmaktadır. Gerçek zamanlı değildir.
      </p>
    </div>
  );
}
