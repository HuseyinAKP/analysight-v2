"use client";

import { API_BASE } from "@/lib/api";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { symbolsApi, analysisApi, riskApi, newsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { fmt, fmtPct } from "@/lib/utils";
import {
  Send, Bot, User, TrendingUp, TrendingDown, Minus,
  Sparkles, ChevronDown, ChevronRight, Layers,
} from "lucide-react";

// ── Quick symbol selector ─────────────────────────────────────────────────────
const QUICK_SYMBOLS = ["THYAO", "GARAN", "EREGL", "SISE", "ASELS", "AAPL", "MSFT", "NVDA", "BTC-USD", "ETH-USD"];

// ── Wall Street Prompt Templates ──────────────────────────────────────────────
const PROMPT_TEMPLATES = [
  {
    category: "Temel Analiz",
    templates: [
      {
        id: "wall_street",
        label: "Wall Street Raporu",
        desc: "Buy / Hold / Sell + fiyat hedefi",
        userMsg: (sym: string) => `${sym} için Wall Street analist raporu`,
      },
      {
        id: "kazanc",
        label: "Kazanç & Değerleme",
        desc: "EPS trendi, marjlar, katalizörler",
        userMsg: (sym: string) => `${sym} kazanç ve değerleme analizi`,
      },
    ],
  },
  {
    category: "Teknik Analiz",
    templates: [
      {
        id: "teknik",
        label: "Kapsamlı Teknik",
        desc: "EMA, RSI, MACD, kritik seviyeler",
        userMsg: (sym: string) => `${sym} kapsamlı teknik analiz`,
      },
      {
        id: "giris",
        label: "Giriş Zamanlaması",
        desc: "Ideal entry point ve onay kriterleri",
        userMsg: (sym: string) => `${sym} için giriş zamanlaması analizi`,
      },
    ],
  },
  {
    category: "Risk & Senaryo",
    templates: [
      {
        id: "risk_harita",
        label: "Risk Haritası",
        desc: "Tüm aşağı yönlü riskler",
        userMsg: (sym: string) => `${sym} risk haritası`,
      },
      {
        id: "bear_bull",
        label: "Bear vs Bull Case",
        desc: "En iyi / en kötü senaryo karşılaştırması",
        userMsg: (sym: string) => `${sym} bear ve bull case analizi`,
      },
    ],
  },
  {
    category: "Karşılaştırma",
    templates: [
      {
        id: "sektor",
        label: "Sektör Karşılaştırması",
        desc: "Sektör içi göreceli güç analizi",
        userMsg: (sym: string) => `${sym} sektör karşılaştırması`,
      },
    ],
  },
];

// ── AI Insight builder (hızlı tam analiz için) ────────────────────────────────
function buildAnalystReport(sym: string, info: Record<string,unknown>, indicators: Record<string,unknown>, scenarios: Record<string,unknown>, risk: Record<string,unknown>, news: Record<string,unknown>[]) {
  const price   = info.price as number;
  const rsi     = indicators.rsi as number;
  const macd    = indicators.macd as number;
  const macdSig = indicators.macd_signal as number;
  const ema20   = indicators.ema20 as number;
  const ema200  = indicators.ema200 as number;
  const confluence = (indicators as Record<string,unknown>).confluence as Record<string,unknown>;
  const confScore  = confluence?.score as number ?? 50;
  const sc = (scenarios as Record<string,unknown>).scenarios as Record<string,unknown>;
  const bull = (sc?.bull as Record<string,unknown>);
  const base = (sc?.base as Record<string,unknown>);
  const bear = (sc?.bear as Record<string,unknown>);
  const direction = confScore >= 60 ? "yükseliş" : confScore >= 40 ? "nötr" : "düşüş";
  const dirColor  = direction === "yükseliş" ? "text-emerald-400" : direction === "düşüş" ? "text-red-400" : "text-yellow-400";
  const posNews = news.filter((n:Record<string,unknown>) => n.sentiment === "positive").length;
  const negNews = news.filter((n:Record<string,unknown>) => n.sentiment === "negative").length;
  const newsVerdict = posNews > negNews ? "haber akışı destekleyici" : posNews < negNews ? "haber akışı baskı altında" : "haber akışı karışık";

  return {
    direction, dirColor, confScore,
    summary: `${sym} için sinyal uyumu skoru ${confScore}/100 ile ${direction} eğilimli. ${newsVerdict.charAt(0).toUpperCase() + newsVerdict.slice(1)}.`,
    sections: [
      {
        title: "Teknik Durum", color: "blue",
        bullets: [
          `RSI ${rsi.toFixed(1)} — ${rsi < 30 ? "aşırı satım" : rsi > 70 ? "aşırı alım" : "normal bölge"}`,
          `MACD ${macd > macdSig ? "yükseliş sinyali" : "düşüş sinyali"}`,
          `EMA200 (${fmt(ema200)}) ${price > ema200 ? "altında — boğa trendi" : "üstünde — ayı trendi"}`,
          `EMA20 (${fmt(ema20)}) kısa vadeli referans`,
        ],
      },
      {
        title: "Senaryo Analizi (28 Gün)", color: "purple",
        bullets: [
          `Boğa: ${fmt(bull?.target as number)} — %${((bull?.probability as number) * 100).toFixed(0)} olasılık`,
          `Baz: ${fmt(base?.target as number)} — %${((base?.probability as number) * 100).toFixed(0)} olasılık`,
          `Ayı: ${fmt(bear?.target as number)} — %${((bear?.probability as number) * 100).toFixed(0)} olasılık`,
          `Belirsizlik: ${(((scenarios as Record<string,unknown>).uncertainty_index as number) * 100).toFixed(0)}/100`,
        ],
      },
      {
        title: "Risk Yönetimi", color: "orange",
        bullets: [
          `Stop-loss: ${fmt((risk as Record<string,unknown>).stop_loss as number)} (-%${((risk as Record<string,unknown>).stop_pct as number).toFixed(1)})`,
          `H1: ${fmt((risk as Record<string,unknown>).target1 as number)} — R/R ${((risk as Record<string,unknown>).rr_ratio_t1 as number).toFixed(1)}:1`,
          `H2: ${fmt((risk as Record<string,unknown>).target2 as number)} — R/R ${((risk as Record<string,unknown>).rr_ratio_t2 as number).toFixed(1)}:1`,
          `ATR ${((risk as Record<string,unknown>).atr as number).toFixed(2)} — günlük ortalama hareket`,
        ],
      },
      {
        title: "Haber & Duygu", color: "yellow",
        bullets: [
          `${news.length} haber: ${posNews} olumlu, ${negNews} olumsuz`,
          newsVerdict.charAt(0).toUpperCase() + newsVerdict.slice(1),
          news[0] ? `Son haber: "${(news[0] as Record<string,unknown>).headline}"` : "Haber yükleniyor...",
        ],
      },
    ],
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  role: "user" | "assistant";
  content: string;
  reportData?: ReturnType<typeof buildAnalystReport>;
  isClaudeResponse?: boolean;
  promptLabel?: string;
  timestamp: Date;
}

// ── Markdown-lite renderer ────────────────────────────────────────────────────
function MarkdownContent({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        // Bold heading **...**
        if (line.startsWith("**") && line.includes("**")) {
          const cleaned = line.replace(/\*\*/g, "");
          return <p key={i} className="font-bold text-white mt-2">{cleaned}</p>;
        }
        // Bullet •
        if (line.startsWith("•") || line.startsWith("-")) {
          return (
            <p key={i} className="flex items-start gap-2 text-zinc-300 pl-1">
              <span className="text-zinc-600 shrink-0 mt-0.5">·</span>
              <span>{line.replace(/^[•\-]\s*/, "")}</span>
            </p>
          );
        }
        // Numbered
        if (/^\d+\./.test(line)) {
          return <p key={i} className="text-zinc-300 pl-1">{line}</p>;
        }
        // Italic *...*
        if (line.startsWith("*") && line.endsWith("*")) {
          return <p key={i} className="text-zinc-500 text-xs italic">{line.replace(/^\*|\*$/g, "")}</p>;
        }
        return <p key={i} className="text-zinc-300">{line}</p>;
      })}
    </div>
  );
}

// ── Report Card ───────────────────────────────────────────────────────────────
function ReportCard({ data }: { data: ReturnType<typeof buildAnalystReport> }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const sectionColors: Record<string, string> = {
    blue:   "border-blue-900/40 bg-blue-950/20",
    purple: "border-purple-900/40 bg-purple-950/20",
    orange: "border-orange-900/40 bg-orange-950/20",
    yellow: "border-yellow-900/40 bg-yellow-950/20",
  };

  return (
    <div className="space-y-3 mt-3">
      <div className={cn("flex items-center gap-2 text-sm font-bold", data.dirColor)}>
        {data.direction === "yükseliş" ? <TrendingUp className="w-4 h-4" />
         : data.direction === "düşüş" ? <TrendingDown className="w-4 h-4" />
         : <Minus className="w-4 h-4" />}
        Uyum: {data.confScore}/100 · {data.direction.charAt(0).toUpperCase() + data.direction.slice(1)}
      </div>
      <p className="text-sm text-zinc-400 leading-relaxed">{data.summary}</p>
      {data.sections.map(sec => (
        <div key={sec.title}
          className={cn("rounded-xl border p-3", sectionColors[sec.color] ?? "border-zinc-800 bg-zinc-900")}>
          <button className="w-full flex items-center justify-between text-left"
            onClick={() => setExpanded(e => ({ ...e, [sec.title]: !e[sec.title] }))}>
            <span className="text-sm font-semibold text-zinc-200">{sec.title}</span>
            <ChevronDown className={cn("w-4 h-4 text-zinc-500 transition-transform", expanded[sec.title] && "rotate-180")} />
          </button>
          {(expanded[sec.title] !== false) && (
            <ul className="mt-2 space-y-1.5">
              {sec.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                  <span className="text-zinc-600 shrink-0 mt-0.5">•</span>{b}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Chat Message ──────────────────────────────────────────────────────────────
function ChatMessage({ msg }: { msg: Message }) {
  if (msg.role === "user") {
    return (
      <div className="flex items-start gap-2.5 justify-end">
        <div className="max-w-md bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm">
          {msg.content}
        </div>
        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-0.5">
          <User className="w-3.5 h-3.5 text-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shrink-0 mt-0.5">
        <Sparkles className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="flex-1 max-w-2xl bg-zinc-800 border border-zinc-700 rounded-2xl rounded-tl-sm px-4 py-3">
        {/* Claude / Template badge */}
        {msg.promptLabel && (
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-700">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">{msg.promptLabel}</span>
            {msg.isClaudeResponse && (
              <span className="text-[9px] bg-violet-500/20 text-violet-300 border border-violet-500/30 px-1.5 py-0.5 rounded font-bold">Claude AI</span>
            )}
          </div>
        )}

        {/* Content: markdown or plain */}
        {msg.content.includes("**") || msg.content.includes("•") ? (
          <MarkdownContent text={msg.content} />
        ) : (
          <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        )}

        {msg.reportData && <ReportCard data={msg.reportData} />}
        <p className="text-[10px] text-zinc-600 mt-2">
          {msg.timestamp.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

// ── Quick Action Chip ─────────────────────────────────────────────────────────
function QuickChip({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="text-xs px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 hover:border-zinc-600 transition-colors whitespace-nowrap disabled:opacity-40">
      {label}
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AnalystPage() {
  const [symbol, setSymbol]   = useState("THYAO");
  const [input, setInput]     = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Merhaba! Analysight AI Analistinizim.\n\nSol taraftan bir hisse seçin, ardından istediğiniz analiz türünü seçin. Wall Street Raporu, Risk Haritası, Bear/Bull Case ve daha fazlası için şablonları kullanabilirsiniz.\n\nYa da direkt soru sorabilirsiniz.",
      timestamp: new Date(),
    },
  ]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>("Temel Analiz");
  const chatRef = useRef<HTMLDivElement>(null);

  const { data: info }       = useQuery({ queryKey: ["symbol", symbol],     queryFn: () => symbolsApi.get(symbol) });
  const { data: indicators } = useQuery({ queryKey: ["indicators", symbol], queryFn: () => analysisApi.indicators(symbol), enabled: !!info });
  const { data: scenarios }  = useQuery({ queryKey: ["scenarios", symbol],  queryFn: () => analysisApi.scenarios(symbol), enabled: !!info });
  const { data: risk }       = useQuery({ queryKey: ["risk", symbol],       queryFn: () => riskApi.get(symbol), enabled: !!info });
  const { data: newsData }   = useQuery({ queryKey: ["newsSymbol", symbol], queryFn: () => newsApi.symbol(symbol), enabled: !!info });

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const dataReady = !!(info && indicators && scenarios && risk);

  function runFullAnalysis() {
    if (!info || !indicators || !scenarios || !risk) return;
    const report = buildAnalystReport(
      symbol,
      info as unknown as Record<string,unknown>,
      indicators as unknown as Record<string,unknown>,
      scenarios as unknown as Record<string,unknown>,
      risk as unknown as Record<string,unknown>,
      (newsData?.items ?? []) as unknown as Record<string,unknown>[]
    );
    setMessages(prev => [
      ...prev,
      { role: "user", content: `${symbol} tam analiz`, timestamp: new Date() },
      { role: "assistant", content: `${symbol} analizi tamamlandı:`, reportData: report, timestamp: new Date() },
    ]);
  }

  async function runPromptTemplate(templateId: string, label: string, userMsg: string) {
    if (!dataReady) return;
    setIsAnalyzing(true);
    setMessages(prev => [...prev, { role: "user", content: userMsg, timestamp: new Date() }]);

    try {
      const res = await fetch(`${API_BASE}/api/analysis/${symbol}/claude-analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt_type: templateId }),
      });
      const data = await res.json();
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: data.content,
          isClaudeResponse: data.is_claude,
          promptLabel: data.prompt_label,
          timestamp: new Date(),
        },
      ]);
    } catch {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Analiz alınırken bir hata oluştu. API bağlantısını kontrol edin.", timestamp: new Date() },
      ]);
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleQuickAction(action: string) {
    if (!dataReady) return;
    let content = "";
    let userLabel = "";

    if (action === "risk") {
      content = `${symbol} için stop-loss seviyesi ${fmt(risk!.stop_loss)} olarak hesaplandı.\n\n• Giriş fiyatı: ${fmt(risk!.entry_price)}\n• Stop-loss: ${fmt(risk!.stop_loss)} (-%${risk!.stop_pct.toFixed(1)})\n• H1: ${fmt(risk!.target1)} (R/R: ${risk!.rr_ratio_t1.toFixed(1)}:1)\n• H2: ${fmt(risk!.target2)} (R/R: ${risk!.rr_ratio_t2.toFixed(1)}:1)\n\nATR ${risk!.atr.toFixed(2)} baz alınarak stop-loss olası günlük dalgalanmanın dışına yerleştirilmiştir.`;
      userLabel = `${symbol} risk parametreleri`;
    } else if (action === "rsi") {
      const rsi = indicators!.rsi;
      const comment = rsi < 30 ? "Aşırı satım bölgesinde. Potansiyel dip sinyali olabilir ancak tek başına yeterli değil." : rsi > 70 ? "Aşırı alım bölgesinde. Kâr satışı riski artıyor." : `Normal bölgede (${rsi.toFixed(1)}). Belirgin bir aşırı alım/satım yok.`;
      content = `${symbol} RSI: ${rsi.toFixed(1)}\n\n${comment}`;
      userLabel = `${symbol} RSI analizi`;
    } else if (action === "senaryo") {
      const sc = scenarios!.scenarios;
      content = `${symbol} 28 günlük senaryo:\n\n• Boğa: ${fmt(sc.bull.target)} — %${(sc.bull.probability * 100).toFixed(0)} olasılık (+%${sc.bull.upside_pct.toFixed(1)})\n• Baz: ${fmt(sc.base.target)} — %${(sc.base.probability * 100).toFixed(0)} olasılık\n• Ayı: ${fmt(sc.bear.target)} — %${(sc.bear.probability * 100).toFixed(0)} olasılık (-%${sc.bear.downside_pct.toFixed(1)})\n\nBelirsizlik: ${(scenarios!.uncertainty_index * 100).toFixed(0)}/100`;
      userLabel = `${symbol} senaryo analizi`;
    } else if (action === "haber") {
      const news = newsData?.items ?? [];
      const pos = news.filter(n => n.sentiment === "positive").length;
      const neg = news.filter(n => n.sentiment === "negative").length;
      content = `${symbol} haberleri:\n\n${news.slice(0, 3).map((n, i) => `${i + 1}. ${n.headline} (${n.source.name})`).join("\n")}\n\n${news.length} haber: ${pos} olumlu, ${neg} olumsuz. Genel duygu: ${pos > neg ? "destekleyici" : "baskı altında"}.`;
      userLabel = `${symbol} haber özeti`;
    }

    setMessages(prev => [
      ...prev,
      { role: "user", content: userLabel, timestamp: new Date() },
      { role: "assistant", content, timestamp: new Date() },
    ]);
  }

  async function sendMessage() {
    if (!input.trim()) return;
    const userText = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userText, timestamp: new Date() }]);
    setIsAnalyzing(true);
    await new Promise(r => setTimeout(r, 600));

    const lower = userText.toLowerCase();
    if (lower.includes("analiz") || lower.includes("incele")) {
      if (dataReady) { runFullAnalysis(); setIsAnalyzing(false); return; }
    } else if (lower.includes("rsi")) { handleQuickAction("rsi"); setIsAnalyzing(false); return; }
    else if (lower.includes("senaryo") || lower.includes("hedef")) { handleQuickAction("senaryo"); setIsAnalyzing(false); return; }
    else if (lower.includes("risk") || lower.includes("stop")) { handleQuickAction("risk"); setIsAnalyzing(false); return; }
    else if (lower.includes("haber")) { handleQuickAction("haber"); setIsAnalyzing(false); return; }
    else if (lower.includes("wall street") || lower.includes("rapor")) { runPromptTemplate("wall_street", "Wall Street Raporu", userText); return; }
    else if (lower.includes("giriş") || lower.includes("entry")) { runPromptTemplate("giris", "Giriş Zamanlaması", userText); return; }
    else if (lower.includes("bear") || lower.includes("bull") || lower.includes("senaryo")) { runPromptTemplate("bear_bull", "Bear vs Bull Case", userText); return; }

    const response = lower.includes("yapmalıyım") || lower.includes("almalı") || lower.includes("satmalı")
      ? "Yatırım tavsiyesi veremem — Analysight yalnızca analitik bir araçtır.\n\nYapabileceğim: teknik gösterge yorumu, risk/kazanç hesaplama, senaryo analizi, haber özeti.\n\nKarar her zaman sizin."
      : `"${userText}" için sol menüdeki şablonlardan birini seçin ya da şunları yazabilirsiniz:\n• "analiz yap" — tam rapor\n• "rsi" — RSI yorumu\n• "risk" — stop hesaplama\n• "wall street raporu" — analist değerlendirmesi`;

    setMessages(prev => [...prev, { role: "assistant", content: response, timestamp: new Date() }]);
    setIsAnalyzing(false);
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">

      {/* ── Left sidebar ─────────────────────────────────────────────────────── */}
      <div className="w-64 shrink-0 border-r border-zinc-800 overflow-y-auto py-4 px-3 space-y-4">

        {/* Symbol selector */}
        <div>
          <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-2 px-1">Hisse Seç</p>
          <div className="space-y-0.5">
            {QUICK_SYMBOLS.map(sym => (
              <button key={sym}
                onClick={() => setSymbol(sym)}
                className={cn(
                  "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all text-sm",
                  symbol === sym
                    ? "bg-blue-600/20 border border-blue-500/30 text-blue-300"
                    : "hover:bg-zinc-800/70 text-zinc-400 border border-transparent"
                )}>
                <span className="font-mono font-bold text-xs">{sym}</span>
                {symbol === sym && indicators && (
                  <span className={cn("ml-auto text-[10px] font-bold",
                    (indicators.confluence as unknown as Record<string,unknown>).score as number >= 60 ? "text-emerald-400" : "text-zinc-500")}>
                    {(indicators.confluence as unknown as Record<string,unknown>).score as number}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Price ticker */}
        {info && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <div className="text-[10px] text-zinc-600 mb-0.5">{symbol} · Güncel</div>
            <div className="text-xl font-bold text-white tabular-nums">{fmt(info.price)}</div>
            <div className={cn("text-sm font-semibold",
              info.change_pct > 0 ? "text-emerald-400" : info.change_pct < 0 ? "text-red-400" : "text-zinc-400")}>
              {fmtPct(info.change_pct)}
            </div>
            {indicators && (
              <div className="mt-2.5 pt-2.5 border-t border-zinc-800 grid grid-cols-2 gap-1.5">
                {[
                  { l: "Uyum", v: `${(indicators.confluence as unknown as Record<string,unknown>).score as number}/100`, color: (indicators.confluence as unknown as Record<string,unknown>).score as number >= 60 ? "text-emerald-400" : (indicators.confluence as unknown as Record<string,unknown>).score as number >= 40 ? "text-yellow-400" : "text-red-400" },
                  { l: "RSI", v: (indicators.rsi as number).toFixed(1), color: indicators.rsi > 70 ? "text-red-400" : indicators.rsi < 30 ? "text-emerald-400" : "text-white" },
                  { l: "MACD", v: indicators.macd > indicators.macd_signal ? "Yükseliş" : "Düşüş", color: indicators.macd > indicators.macd_signal ? "text-emerald-400" : "text-red-400" },
                  { l: "ATR", v: risk ? (risk as unknown as Record<string,unknown>).atr ? ((risk as unknown as Record<string,unknown>).atr as number).toFixed(2) : "—" : "—", color: "text-white" },
                ].map(m => (
                  <div key={m.l}>
                    <div className="text-[9px] text-zinc-600">{m.l}</div>
                    <div className={cn("text-xs font-bold", m.color)}>{m.v}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Prompt Templates */}
        <div>
          <div className="flex items-center gap-1.5 mb-2 px-1">
            <Layers className="w-3 h-3 text-zinc-600" />
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Analiz Şablonları</p>
          </div>
          <div className="space-y-1">
            {PROMPT_TEMPLATES.map(group => (
              <div key={group.category}>
                <button
                  onClick={() => setExpandedCategory(expandedCategory === group.category ? null : group.category)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors">
                  <span className="text-[11px] font-semibold text-zinc-400">{group.category}</span>
                  <ChevronRight className={cn("w-3 h-3 text-zinc-600 transition-transform", expandedCategory === group.category && "rotate-90")} />
                </button>
                {expandedCategory === group.category && (
                  <div className="ml-1 mt-0.5 space-y-0.5">
                    {group.templates.map(tpl => (
                      <button
                        key={tpl.id}
                        disabled={!dataReady || isAnalyzing}
                        onClick={() => runPromptTemplate(tpl.id, tpl.label, tpl.userMsg(symbol))}
                        className="w-full text-left px-3 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-all disabled:opacity-40 group">
                        <div className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors">{tpl.label}</div>
                        <div className="text-[10px] text-zinc-600 mt-0.5">{tpl.desc}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div>
          <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-1.5 px-1">Hızlı</p>
          <div className="space-y-0.5">
            {[
              { id: "tam", label: "Tam Analiz",    action: () => dataReady && runFullAnalysis() },
              { id: "risk", label: "Risk & Stop",  action: () => handleQuickAction("risk") },
              { id: "rsi",  label: "RSI Yorumu",   action: () => handleQuickAction("rsi") },
              { id: "haber",label: "Haber Özeti",  action: () => handleQuickAction("haber") },
            ].map(a => (
              <button key={a.id} onClick={a.action} disabled={!dataReady}
                className="w-full text-left text-xs px-3 py-2 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40">
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Chat area ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <div className="shrink-0 flex items-center gap-3 px-5 py-3 border-b border-zinc-800">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">AI Analist — {symbol}</h1>
            <p className="text-[10px] text-zinc-500">Teknik · Temel · Risk · Senaryo</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {!dataReady && (
              <span className="text-[10px] text-zinc-600">Veri yükleniyor…</span>
            )}
            <div className={cn("flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border",
              dataReady ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" : "text-zinc-600 bg-zinc-800 border-zinc-700")}>
              <span className={cn("w-1.5 h-1.5 rounded-full", dataReady ? "bg-emerald-400 animate-pulse" : "bg-zinc-600")} />
              {dataReady ? "Hazır" : "Bekliyor"}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div ref={chatRef}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#3f3f46 transparent" }}>
          {messages.map((msg, i) => <ChatMessage key={i} msg={msg} />)}

          {isAnalyzing && (
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
              </div>
              <div className="bg-zinc-800 border border-zinc-700 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1">
                  {[0, 150, 300].map(d => (
                    <span key={d} className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick chips */}
        <div className="shrink-0 px-5 pt-2 pb-1 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          <QuickChip label="Tam analiz"       onClick={runFullAnalysis}                          disabled={!dataReady} />
          <QuickChip label="Wall Street"      onClick={() => runPromptTemplate("wall_street", "Wall Street Raporu", `${symbol} Wall Street raporu`)} disabled={!dataReady} />
          <QuickChip label="Giriş zamanı"     onClick={() => runPromptTemplate("giris", "Giriş Zamanlaması", `${symbol} giriş zamanlaması`)} disabled={!dataReady} />
          <QuickChip label="Bear / Bull"      onClick={() => runPromptTemplate("bear_bull", "Bear vs Bull", `${symbol} bear bull analizi`)} disabled={!dataReady} />
          <QuickChip label="Risk haritası"    onClick={() => runPromptTemplate("risk_harita", "Risk Haritası", `${symbol} risk haritası`)} disabled={!dataReady} />
        </div>

        {/* Input */}
        <div className="shrink-0 px-5 pb-4 pt-1.5 flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder={`${symbol} hakkında soru sor veya şablon seç…`}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button onClick={sendMessage} disabled={!input.trim() || isAnalyzing}
            className="w-10 h-10 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 text-white rounded-xl flex items-center justify-center transition-colors shrink-0">
            <Send className="w-4 h-4" />
          </button>
        </div>

        <p className="shrink-0 text-[10px] text-zinc-700 text-center pb-2">
          Analysight AI analitik amaçlıdır · Yatırım tavsiyesi değildir
        </p>
      </div>
    </div>
  );
}
