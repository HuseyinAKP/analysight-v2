"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileText, TrendingUp, AlertCircle, RefreshCw, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface KapItem {
  id:             string;
  title:          string;
  summary:        string;
  date:           string;
  time:           string;
  timestamp:      number;
  provider:       string;
  url:            string;
  category:       string;
  category_label: string;
  category_color: string;
  category_emoji: string;
  source:         "yfinance" | "mock";
}

interface KapResponse {
  symbol:   string;
  kap_urls: {
    found:        boolean;
    search:       string;
    ozet?:        string;
    bildirimleri?: string;
    finansal?:    string;
    ortaklar?:    string;
  };
  items:    KapItem[];
  total:    number;
  has_kap:  boolean;
  note:     string;
}

import { API_BASE } from "@/lib/api";
const API = API_BASE;

// ── Helpers ───────────────────────────────────────────────────────────────────
const CATEGORY_STYLES: Record<string, string> = {
  red:    "bg-red-500/10    text-red-400    border-red-500/20",
  blue:   "bg-blue-500/10   text-blue-400   border-blue-500/20",
  green:  "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  purple: "bg-purple-500/10 text-purple-400  border-purple-500/20",
  orange: "bg-orange-500/10 text-orange-400  border-orange-500/20",
  gray:   "bg-zinc-800      text-zinc-400   border-zinc-700",
};

function timeAgo(dateStr: string): string {
  const now  = new Date();
  const then = new Date(dateStr);
  const diff = (now.getTime() - then.getTime()) / 1000;
  if (diff < 3600)   return `${Math.round(diff / 60)} dk önce`;
  if (diff < 86400)  return `${Math.round(diff / 3600)} saat önce`;
  if (diff < 604800) return `${Math.round(diff / 86400)} gün önce`;
  return then.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}

// ── KAP Quick Link Buttons ─────────────────────────────────────────────────────
function KapLinks({ urls }: { urls: KapResponse["kap_urls"] }) {
  if (!urls.found) {
    return (
      <a href={urls.search} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-zinc-800 border border-zinc-700 hover:border-blue-500 text-zinc-400 hover:text-blue-400 rounded-xl transition-all">
        <ExternalLink className="w-3 h-3" />
        KAP'ta Ara
      </a>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {[
        { href: urls.bildirimleri!, label: "Bildirimler" },
        { href: urls.ozet!,        label: "Şirket Özeti" },
        { href: urls.finansal!,    label: "Finansallar"  },
      ].map(link => (
        <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] px-2.5 py-1 bg-zinc-800 border border-zinc-700 hover:border-blue-500/50 hover:bg-blue-500/5 text-zinc-400 hover:text-blue-400 rounded-lg transition-all">
          <ExternalLink className="w-2.5 h-2.5" />
          {link.label}
        </a>
      ))}
    </div>
  );
}

// ── Single Item Card ──────────────────────────────────────────────────────────
function ItemCard({ item }: { item: KapItem }) {
  const catStyle = CATEGORY_STYLES[item.category_color] ?? CATEGORY_STYLES.gray;
  const isNews   = item.source === "yfinance";

  return (
    <div className={cn(
      "group px-4 py-3.5 border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors",
      "flex gap-3 items-start",
    )}>
      {/* Category emoji */}
      <div className="text-lg leading-none mt-0.5 shrink-0">{item.category_emoji}</div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 mb-1">
          <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 mt-0.5", catStyle)}>
            {item.category_label}
          </span>
          {isNews && (
            <span className="text-[9px] text-zinc-600 mt-0.5">📡 {item.provider}</span>
          )}
        </div>

        {item.url ? (
          <a href={item.url} target="_blank" rel="noopener noreferrer"
            className="text-xs font-medium text-zinc-200 hover:text-blue-400 transition-colors line-clamp-2 leading-snug group-hover:underline">
            {item.title}
          </a>
        ) : (
          <p className="text-xs font-medium text-zinc-300 line-clamp-2 leading-snug">{item.title}</p>
        )}

        {item.summary && (
          <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">{item.summary}</p>
        )}
      </div>

      {/* Date + external link */}
      <div className="text-right shrink-0">
        <p className="text-[10px] text-zinc-500">{timeAgo(item.date || new Date().toISOString())}</p>
        <p className="text-[9px] text-zinc-700">{item.date}</p>
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer"
            className="mt-1 inline-flex text-zinc-700 hover:text-blue-400 transition-colors">
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function KapPanel({ symbol }: { symbol: string }) {
  const { data, isLoading, error, refetch } = useQuery<KapResponse>({
    queryKey: ["kap", symbol],
    queryFn:  () => fetch(`${API}/api/kap/${symbol}/disclosures?limit=12`).then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">

      {/* Header */}
      <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-white text-sm">KAP Bildirimleri</span>
          {data?.has_kap && (
            <span className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full font-semibold">
              BIST
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => refetch()}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-zinc-300 transition-colors">
            <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
          </button>
          {data?.kap_urls && (
            <a href={data.kap_urls.bildirimleri ?? data.kap_urls.search}
              target="_blank" rel="noopener noreferrer"
              className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
              Tümü <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </div>

      {/* KAP Quick Links */}
      {data?.kap_urls && (
        <div className="px-5 py-3 border-b border-zinc-800/50 bg-zinc-950/30">
          <KapLinks urls={data.kap_urls} />
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="py-10 text-center">
          <RefreshCw className="w-5 h-5 animate-spin text-zinc-600 mx-auto mb-2" />
          <p className="text-xs text-zinc-600">Yükleniyor…</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-5 py-4 flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="w-4 h-4" />
          Veriler yüklenemedi
        </div>
      )}

      {/* Items */}
      {data?.items && data.items.length > 0 && (
        <div className="divide-y divide-zinc-800/30">
          {data.items.map(item => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Empty */}
      {data?.items && data.items.length === 0 && (
        <div className="py-10 text-center">
          <FileText className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
          <p className="text-sm text-zinc-500">Bildirim bulunamadı</p>
        </div>
      )}

      {/* Footer note */}
      {data && (
        <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-950/30">
          <p className="text-[9px] text-zinc-600">
            {data.has_kap
              ? "Gerçek zamanlı KAP bildirimleri için yukarıdaki KAP bağlantılarını kullanın."
              : "Bu hisse KAP veritabanında bulunamadı. Haberleri yFinance'den gösteriyoruz."}
          </p>
        </div>
      )}
    </div>
  );
}
