"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { NewsArticle } from "@/lib/api";
import { X, ExternalLink, Sparkles, BookOpen, TrendingUp, TrendingDown, Minus } from "lucide-react";
import Link from "next/link";

// ── Kavram Sözlüğü — Yeni başlayanlar için otomatik açıklamalar ──────────────
const TERM_GLOSSARY: Record<string, string> = {
  "RSI":          "RSI (Göreceli Güç Endeksi) — Bir hissenin ne kadar hızlı alınıp satıldığını ölçer. 30 altı aşırı satılmış, 70 üstü aşırı alınmış anlamına gelir.",
  "MACD":         "MACD (Hareketli Ortalama Yakınsama/Iraksama) — Fiyat momentumunu ölçen teknik gösterge. Sinyal çizgisini yukarı kesmesi alım sinyali sayılır.",
  "EMA":          "EMA (Üstel Hareketli Ortalama) — Son fiyatlara daha fazla ağırlık veren hareketli ortalama. Trend yönünü gösterir.",
  "temettü":      "Temettü — Şirketin kârından hissedarlarına dağıttığı pay. Düzenli gelir arayan yatırımcılar için önemlidir.",
  "kâr marjı":    "Kâr Marjı — Şirketin satışlarının ne kadarını kâra dönüştürdüğünü gösterir. Yüksek marj daha verimli bir şirket demektir.",
  "volatilite":   "Volatilite — Fiyatın ne kadar dalgalandığını ölçer. Yüksek volatilite hem fırsat hem risk anlamına gelir.",
  "likidite":     "Likidite — Bir varlığın ne kadar kolay alınıp satılabildiğini ifade eder. Yüksek hacim = yüksek likidite.",
  "P/E":          "F/K Oranı (Fiyat/Kazanç) — Hissenin kazancına göre ne kadar pahalı olduğunu gösterir. Sektör ortalamasıyla karşılaştırın.",
  "F/K":          "F/K Oranı (Fiyat/Kazanç) — Hissenin kazancına göre ne kadar pahalı olduğunu gösterir. Sektör ortalamasıyla karşılaştırın.",
  "faiz":         "Faiz oranları yükseldiğinde hisse senetleri genellikle baskı altına girer. Çünkü sabit getirili yatırımlar daha cazip hale gelir.",
  "enflasyon":    "Enflasyon şirketlerin maliyetlerini artırır, ancak güçlü markalı şirketler bu artışı fiyatlarına yansıtabilir.",
  "kazanç":       "Kazanç (EPS) — Hisse başına düşen net kâr. Analist beklentisini aşması genellikle hisseyi yükseltir.",
  "analist":      "Analistler büyük bankaların araştırma departmanlarında çalışan uzmanlardır. 'Al/Tut/Sat' tavsiyeleri verirler.",
  "hedef fiyat":  "Analistlerin 12 ay içinde ulaşmasını beklediği fiyat seviyesi. Gerçekleşmesi garanti değildir.",
  "ETF":          "ETF (Borsa Yatırım Fonu) — Birden fazla hisseyi bir arada tutan, borsada işlem gören fon. Çeşitlendirme sağlar.",
  "short":        "Short Satış — Hissenin düşeceğini bekleyen yatırımcıların başvurduğu strateji. Ödünç alıp satarak kâr etmeye çalışırlar.",
};

function findRelevantTerm(text: string): { term: string; explanation: string } | null {
  for (const [term, explanation] of Object.entries(TERM_GLOSSARY)) {
    if (text.toLowerCase().includes(term.toLowerCase())) {
      return { term, explanation };
    }
  }
  return null;
}

// ── Markdown mini renderer ────────────────────────────────────────────────────
function MarkdownBlock({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {text.split("\n").map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        const html = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
        if (line.startsWith("**") && line.endsWith("**"))
          return <p key={i} className="font-bold text-white text-sm mt-3" dangerouslySetInnerHTML={{ __html: html }} />;
        if (line.match(/^#{1,3} /))
          return <p key={i} className="font-bold text-white text-sm mt-3">{line.replace(/^#+\s/, "")}</p>;
        if (line.startsWith("- ") || line.startsWith("• "))
          return <p key={i} className="text-zinc-300 pl-3">· {line.replace(/^[•\-]\s*/, "")}</p>;
        if (line.startsWith("*") && line.endsWith("*"))
          return <p key={i} className="text-zinc-500 italic text-xs">{line.replace(/^\*|\*$/g, "")}</p>;
        return <p key={i} className="text-zinc-300" dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </div>
  );
}

// ── Source logo badge ─────────────────────────────────────────────────────────
function SourceBadge({ source }: { source: NewsArticle["source"] }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 rounded flex items-center justify-center text-[9px] font-black text-white shrink-0"
        style={{ backgroundColor: source.color || "#333" }}>
        {source.logo || source.name?.slice(0, 2)}
      </div>
      <span className="text-xs text-zinc-400">{source.name}</span>
    </div>
  );
}

// ── Sentiment icon ────────────────────────────────────────────────────────────
function SentimentIcon({ s }: { s: string }) {
  if (s === "positive") return <TrendingUp className="w-4 h-4 text-emerald-400" />;
  if (s === "negative") return <TrendingDown className="w-4 h-4 text-red-400" />;
  return <Minus className="w-4 h-4 text-zinc-400" />;
}

// ── Main Drawer ───────────────────────────────────────────────────────────────
interface Props {
  article: NewsArticle | null;
  onClose: () => void;
  /** Optional: pass current symbol's indicators for richer AI context */
  indicatorContext?: {
    rsi?: number;
    macd_bull?: boolean;
    change_pct?: number;
  };
}

export function NewsDrawer({ article, onClose, indicatorContext }: Props) {
  const [analysis, setAnalysis] = useState<{ text: string; is_claude: boolean } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Reset analysis when article changes
  useEffect(() => {
    setAnalysis(null);
    setAnalyzing(false);
  }, [article?.id]);

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const runAnalysis = useCallback(async () => {
    if (!article) return;
    setAnalyzing(true);
    try {
      const res = await fetch("http://localhost:8000/api/news/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline: article.headline,
          summary: article.summary,
          sentiment: article.sentiment,
          category: article.category,
          symbol: article.symbol,
          rsi: indicatorContext?.rsi,
          macd_bull: indicatorContext?.macd_bull,
          price_change_pct: indicatorContext?.change_pct,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setAnalysis({ text: d.analysis, is_claude: d.is_claude });
      }
    } catch {
      setAnalysis({ text: "Analiz yapılamadı. Lütfen tekrar deneyin.", is_claude: false });
    } finally {
      setAnalyzing(false);
    }
  }, [article, indicatorContext]);

  if (!article) return null;

  const sentimentCls = {
    positive: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300",
    negative:  "bg-red-500/10 border-red-500/20 text-red-300",
    neutral:   "bg-zinc-700 border-zinc-600 text-zinc-400",
  }[article.sentiment] ?? "bg-zinc-700 border-zinc-600 text-zinc-400";

  const timeLabel = article.hours_ago < 1
    ? `${Math.round(article.hours_ago * 60)} dakika önce`
    : article.hours_ago < 24
    ? `${Math.floor(article.hours_ago)} saat önce`
    : `${Math.floor(article.hours_ago / 24)} gün önce`;

  // Auto-detect terms in headline
  const relevantTerm = findRelevantTerm(article.headline + " " + (article.summary ?? ""));

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full z-50 w-full max-w-lg bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <SentimentIcon s={article.sentiment} />
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border", sentimentCls)}>
              {article.sentiment_label}
            </span>
            {article.symbol && (
              <Link href={`/symbol/${article.symbol}`} onClick={onClose}
                className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 transition-colors">
                {article.symbol}
              </Link>
            )}
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#3f3f46 transparent" }}>
          <div className="p-5 space-y-5">

            {/* Source + time */}
            <div className="flex items-center justify-between">
              {article.source && <SourceBadge source={article.source} />}
              <span className="text-[10px] text-zinc-600">{timeLabel}</span>
            </div>

            {/* Headline */}
            <h2 className="text-base font-bold text-white leading-snug">{article.headline}</h2>

            {/* Category + impact */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] px-2 py-0.5 rounded border bg-zinc-800 text-zinc-400 border-zinc-700">
                {article.category_label}
              </span>
              <span className={cn("text-[10px] font-medium",
                article.impact === "Yüksek" ? "text-orange-400" :
                article.impact === "Orta"   ? "text-yellow-400" : "text-zinc-500")}>
                {article.impact} Etki
              </span>
            </div>

            {/* Summary */}
            {article.summary && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-sm text-zinc-300 leading-relaxed">{article.summary}</p>
              </div>
            )}

            {/* Glossary tip — auto-detected term */}
            {relevantTerm && (
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
                <BookOpen className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-blue-400 font-bold mb-1">Terim Nedir?</p>
                  <p className="text-xs text-zinc-300 leading-relaxed">{relevantTerm.explanation}</p>
                </div>
              </div>
            )}

            {/* External link */}
            {article.url && (
              <a href={article.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                <ExternalLink className="w-3.5 h-3.5" />
                Kaynakta Oku ({article.source?.name ?? "Kaynak"})
              </a>
            )}

            {/* Divider */}
            <div className="border-t border-zinc-800" />

            {/* AI Analysis section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  <span className="text-sm font-semibold text-zinc-200">AI Haber Analizi</span>
                </div>
                <button onClick={runAnalysis} disabled={analyzing}
                  className={cn(
                    "text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all",
                    analyzing
                      ? "bg-zinc-800 border-zinc-700 text-zinc-500 cursor-wait"
                      : "bg-violet-600 hover:bg-violet-500 border-violet-500 text-white"
                  )}>
                  {analyzing ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin" />
                      Analiz ediliyor…
                    </span>
                  ) : analysis ? "Yenile" : "Analiz Et"}
                </button>
              </div>

              {!analysis && !analyzing && (
                <p className="text-xs text-zinc-600">
                  Bu haberin hisse/piyasa üzerindeki olası etkisini, teknik göstergelerle birlikte AI ile yorumlatın.
                  {article.symbol && (
                    <> {article.symbol} için mevcut RSI, MACD ve fiyat hareketi de değerlendirmeye katılır.</>
                  )}
                </p>
              )}

              {analyzing && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin shrink-0" />
                  <p className="text-xs text-zinc-500">Haber, teknik göstergeler ve piyasa bağlamı analiz ediliyor…</p>
                </div>
              )}

              {analysis && !analyzing && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    {analysis.is_claude ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                        Claude AI
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400 border border-zinc-600">
                        Şablon Analiz
                      </span>
                    )}
                  </div>
                  <MarkdownBlock text={analysis.text} />
                </div>
              )}
            </div>

            {/* Related symbol link */}
            {article.symbol && (
              <div className="border-t border-zinc-800 pt-4">
                <Link href={`/symbol/${article.symbol}`} onClick={onClose}
                  className="flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-600 transition-colors group">
                  <div>
                    <p className="text-xs text-zinc-500 mb-0.5">Tam Analiz</p>
                    <p className="text-sm font-bold text-white">{article.symbol}</p>
                    <p className="text-[10px] text-zinc-600">Grafik, teknik göstergeler, senaryo bandı</p>
                  </div>
                  <span className="text-zinc-500 group-hover:text-zinc-300 transition-colors text-sm">→</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
