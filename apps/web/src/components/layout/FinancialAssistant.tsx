"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Bot, X, Send, Minimize2, ChevronDown, Sparkles } from "lucide-react";
import { API_BASE } from "@/lib/api";

// ── Detect symbol from URL path ───────────────────────────────────────────────
function useCurrentSymbol() {
  const pathname = usePathname();
  // /symbol/THYAO  or  /analyst (last used)
  const match = pathname.match(/\/symbol\/([A-Z0-9\-]+)/i);
  return match ? match[1].toUpperCase() : null;
}

// ── Quick suggestion chips ────────────────────────────────────────────────────
const SUGGESTIONS = [
  { label: "Piyasa özeti",   prompt: "Bugün piyasalar nasıl?" },
  { label: "BIST gündem",    prompt: "BIST'te bugün öne çıkan gelişmeler neler?" },
  { label: "Dolar/TL",       prompt: "USD/TRY teknik görünümü nedir?" },
  { label: "Altın",          prompt: "Altın fiyatları için güncel görünüm?" },
];

// ── Markdown-lite renderer ────────────────────────────────────────────────────
function MiniMarkdown({ text }: { text: string }) {
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {text.split("\n").map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-0.5" />;
        if (line.startsWith("**") && line.includes("**"))
          return <p key={i} className="font-bold text-white text-xs">{line.replace(/\*\*/g, "")}</p>;
        if (line.startsWith("•") || line.startsWith("-"))
          return <p key={i} className="text-zinc-300 text-xs pl-1">· {line.replace(/^[•\-]\s*/, "")}</p>;
        if (line.startsWith("*") && line.endsWith("*"))
          return <p key={i} className="text-zinc-500 text-[10px] italic">{line.replace(/^\*|\*$/g, "")}</p>;
        return <p key={i} className="text-zinc-300 text-xs">{line}</p>;
      })}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface ChatMsg {
  role: "user" | "assistant";
  text: string;
  isLoading?: boolean;
  isClaude?: boolean;
}

// ── Backend call ──────────────────────────────────────────────────────────────
async function askAssistant(question: string, symbol: string | null): Promise<{ text: string; isClaude: boolean }> {
  const API = API_BASE;

  // If question mentions a ticker-like word or there's a symbol context, use claude-analyze
  const upperQ = question.toUpperCase();
  const symbolInQ = upperQ.match(/\b([A-Z]{2,6}(?:-USD)?)\b/)?.[1] ?? symbol;

  // Try the claude-analyze endpoint if we have symbol context
  if (symbolInQ) {
    // Map question to prompt_type
    const lower = question.toLowerCase();
    let promptType = "wall_street";
    if (lower.includes("risk") || lower.includes("stop") || lower.includes("zarar")) promptType = "risk_harita";
    else if (lower.includes("giriş") || lower.includes("entry") || lower.includes("al")) promptType = "giris";
    else if (lower.includes("bear") || lower.includes("bull") || lower.includes("senaryo")) promptType = "bear_bull";
    else if (lower.includes("teknik") || lower.includes("rsi") || lower.includes("macd")) promptType = "teknik";
    else if (lower.includes("sektör") || lower.includes("karşılaştır")) promptType = "sektor";
    else if (lower.includes("kazanç") || lower.includes("değerleme") || lower.includes("f/k")) promptType = "kazanc";

    try {
      const res = await fetch(`${API}/api/analysis/${symbolInQ}/claude-analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt_type: promptType }),
      });
      if (res.ok) {
        const d = await res.json();
        return { text: d.content, isClaude: d.is_claude };
      }
    } catch {}
  }

  // Fallback: pattern-based responses for general market questions
  const lower = question.toLowerCase();
  if (lower.includes("piyasa") || lower.includes("bugün") || lower.includes("nasıl")) {
    try {
      const res = await fetch(`${API}/api/briefing/morning`);
      if (res.ok) {
        const d = await res.json();
        return {
          text: `Piyasa Özeti:\n\nGenel eğilim: ${d.market_tone ?? "karışık"}\n\nOrtalama değişim: ${d.avg_change >= 0 ? "+" : ""}${d.avg_change?.toFixed(2)}%\n\n${d.opportunities?.length ? `Öne çıkan fırsat: ${d.opportunities[0].symbol} (skor ${d.opportunities[0].score}/100)` : ""}`,
          isClaude: false,
        };
      }
    } catch {}
  }

  // Generic fallback
  return {
    text: `"${question}" sorusu için ${symbolInQ ? symbolInQ + " üzerinden" : "genel"} analiz yapılabilir.\n\nBir hisse adı veya belirli bir soru yazın. Örnek:\n• "THYAO teknik görünüm"\n• "AAPL risk haritası"\n• "NVDA giriş noktası"`,
    isClaude: false,
  };
}

// ── Main Widget ───────────────────────────────────────────────────────────────
export function FinancialAssistant() {
  const [open, setOpen]       = useState(false);
  const [minimized, setMin]   = useState(false);
  const [input, setInput]     = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", text: "Merhaba! Finansal asistanınızım.\n\nHerhangi bir hisse, piyasa veya ekonomik konuda soru sorabilirsiniz." },
  ]);
  const [isTyping, setTyping]  = useState(false);
  const symbol = useCurrentSymbol();
  const chatRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, isTyping]);

  useEffect(() => {
    if (open && !minimized) inputRef.current?.focus();
  }, [open, minimized]);

  const send = useCallback(async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || isTyping) return;
    setInput("");

    setMessages(prev => [...prev, { role: "user", text: q }]);
    setTyping(true);

    try {
      const result = await askAssistant(q, symbol);
      setMessages(prev => [...prev, { role: "assistant", text: result.text, isClaude: result.isClaude }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: "Bağlantı hatası. API sunucusunun çalıştığından emin olun." }]);
    } finally {
      setTyping(false);
    }
  }, [input, isTyping, symbol]);

  // Don't render on /analyst (has its own full chat)
  const pathname = usePathname();
  if (pathname === "/analyst") return null;

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-13 h-13 w-[52px] h-[52px] bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-2xl shadow-2xl shadow-purple-900/40 flex items-center justify-center transition-all hover:scale-105 active:scale-95">
          <Bot className="w-5 h-5" />
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div className={cn(
          "fixed bottom-6 right-6 z-50 flex flex-col bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl shadow-black/60 transition-all",
          minimized ? "w-72 h-12" : "w-[360px] h-[500px]"
        )}>
          {/* Header */}
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-zinc-800 shrink-0 rounded-t-2xl bg-zinc-900">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-white">Finansal Asistan</span>
              {symbol && (
                <span className="text-[10px] text-zinc-500 ml-1.5">· {symbol}</span>
              )}
            </div>
            <button onClick={() => setMin(v => !v)} className="text-zinc-600 hover:text-zinc-400 transition-colors p-0.5">
              {minimized ? <ChevronDown className="w-3.5 h-3.5 rotate-180" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => setOpen(false)} className="text-zinc-600 hover:text-zinc-300 transition-colors p-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div ref={chatRef}
                className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 min-h-0"
                style={{ scrollbarWidth: "thin", scrollbarColor: "#3f3f46 transparent" }}>
                {messages.map((msg, i) => (
                  <div key={i} className={cn("flex gap-2", msg.role === "user" && "justify-end")}>
                    {msg.role === "assistant" && (
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                    <div className={cn(
                      "rounded-xl px-3 py-2 max-w-[85%]",
                      msg.role === "user"
                        ? "bg-blue-600 text-white text-xs"
                        : "bg-zinc-800 border border-zinc-700"
                    )}>
                      {msg.role === "user" ? (
                        <p className="text-xs">{msg.text}</p>
                      ) : (
                        <>
                          {msg.isClaude && (
                            <span className="text-[9px] bg-violet-500/20 text-violet-300 border border-violet-500/30 px-1.5 py-0.5 rounded font-bold mb-1.5 inline-block">Claude AI</span>
                          )}
                          <MiniMarkdown text={msg.text} />
                        </>
                      )}
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="flex gap-2">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shrink-0">
                      <Sparkles className="w-2.5 h-2.5 text-white animate-pulse" />
                    </div>
                    <div className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2">
                      <div className="flex gap-1">
                        {[0, 150, 300].map(d => (
                          <span key={d} className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Suggestions (only if first message) */}
              {messages.length === 1 && (
                <div className="shrink-0 px-3.5 pb-1 flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map(s => (
                    <button key={s.label}
                      onClick={() => send(s.prompt)}
                      className="text-[10px] px-2.5 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-zinc-700 transition-colors">
                      {s.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="shrink-0 flex gap-2 px-3.5 pb-3.5 pt-2 border-t border-zinc-800">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
                  placeholder={symbol ? `${symbol} hakkında sor…` : "Soru sor…"}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button onClick={() => send()} disabled={!input.trim() || isTyping}
                  className="w-8 h-8 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 text-white rounded-xl flex items-center justify-center transition-colors shrink-0">
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
