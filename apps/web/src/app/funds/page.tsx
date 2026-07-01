"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Layers, Filter } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Fund {
  code: string;
  title: string;
  price: number;
  last_date: string;
  return_1d: number;
  return_7d: number;
  return_30d: number;
  category: string;
  category_tr: string;
  category_rank: number;
  category_total: number;
}

const CATEGORIES = [
  { key: "",                label: "Tümü" },
  { key: "hisse",           label: "Hisse Senedi" },
  { key: "yabanci_hisse",   label: "Yabancı Hisse" },
  { key: "altin",           label: "Altın / Emtia" },
  { key: "tahvil",          label: "Tahvil / Bono" },
  { key: "para_piyasasi",   label: "Para Piyasası" },
];

function ReturnBadge({ value }: { value: number }) {
  const pos = value >= 0;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-lg",
      pos ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"
    )}>
      {pos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {pos ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

function RankBar({ rank, total }: { rank: number; total: number }) {
  const pct = Math.round((1 - rank / total) * 100);
  const color = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 bg-zinc-800 rounded-full h-1.5">
        <div className={cn("h-1.5 rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-zinc-500">{rank}/{total}</span>
    </div>
  );
}

export default function FundsPage() {
  const [activeCategory, setActiveCategory] = useState("");
  const [sortBy, setSortBy] = useState<"return_30d" | "return_7d" | "return_1d">("return_30d");

  const { data, isLoading } = useQuery({
    queryKey: ["funds-list", activeCategory],
    queryFn: () => {
      const url = activeCategory
        ? `${API}/api/funds/list?category=${activeCategory}`
        : `${API}/api/funds/list`;
      return fetch(url).then(r => r.json()) as Promise<{ funds: Fund[]; count: number }>;
    },
    staleTime: 300_000,
  });

  const sorted = data?.funds
    ? [...data.funds].sort((a, b) => b[sortBy] - a[sortBy])
    : [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      {/* Başlık */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
          <Layers className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Yatırım Fonları</h1>
          <p className="text-xs text-zinc-500">TEFAS — Türkiye Elektronik Fon Alım Satım Platformu</p>
        </div>
      </div>

      {/* Filtre + sıralama */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          <Filter className="w-3 h-3" /> Kategori:
        </div>
        {CATEGORIES.map(c => (
          <button key={c.key}
            onClick={() => setActiveCategory(c.key)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-lg border transition-colors",
              activeCategory === c.key
                ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500"
            )}
          >{c.label}</button>
        ))}

        <div className="ml-auto flex items-center gap-1">
          <span className="text-xs text-zinc-600">Sırala:</span>
          {[
            { key: "return_1d",  label: "1G" },
            { key: "return_7d",  label: "7G" },
            { key: "return_30d", label: "30G" },
          ].map(s => (
            <button key={s.key}
              onClick={() => setSortBy(s.key as typeof sortBy)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-lg border transition-colors",
                sortBy === s.key
                  ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                  : "bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-500"
              )}
            >{s.label}</button>
          ))}
        </div>
      </div>

      {/* Yükleniyor */}
      {isLoading && (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-20 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Liste */}
      {!isLoading && sorted.length > 0 && (
        <div className="space-y-2">
          {sorted.map((fund, idx) => (
            <div key={fund.code} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5">
              <div className="flex items-center justify-between gap-3">
                {/* Sol: sıra + fon bilgisi */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-bold text-zinc-600 w-5 shrink-0">{idx + 1}</span>
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-zinc-300">{fund.code}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{fund.code}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                        {fund.category_tr}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 truncate max-w-xs">{fund.title}</div>
                    <RankBar rank={fund.category_rank} total={fund.category_total} />
                  </div>
                </div>

                {/* Sağ: fiyat + getiriler */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="hidden sm:flex flex-col items-end gap-1">
                    <span className="text-xs text-zinc-500">1G</span>
                    <ReturnBadge value={fund.return_1d} />
                  </div>
                  <div className="hidden md:flex flex-col items-end gap-1">
                    <span className="text-xs text-zinc-500">7G</span>
                    <ReturnBadge value={fund.return_7d} />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs text-zinc-500">30G</span>
                    <ReturnBadge value={fund.return_30d} />
                  </div>
                  <div className="text-right ml-2">
                    <div className="text-sm font-bold text-white">{fund.price.toFixed(4)}</div>
                    <div className="text-[10px] text-zinc-600">{fund.last_date}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && sorted.length === 0 && (
        <div className="text-center py-12 text-zinc-500 text-sm">
          Fon verisi yüklenemedi. TEFAS bağlantısı kontrol ediliyor...
        </div>
      )}

      <p className="text-xs text-zinc-700 text-center">
        Veriler TEFAS üzerinden alınmaktadır. Sıralama seçilen döneme göre yapılır.
      </p>
    </div>
  );
}
