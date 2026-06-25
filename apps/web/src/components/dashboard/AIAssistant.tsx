"use client";
import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Sparkles, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import axios from "axios";

interface Message { role: "user" | "assistant"; content: string }

const QUICK_QUESTIONS = [
  "RSI bu seviyede ne anlama geliyor?",
  "Bear senaryosu neden yüksek olasılıklı?",
  "Şu anki risk seviyesiyle pozisyon açmalı mıyım?",
  "Teknik tablo ne söylüyor?",
];

interface Props { symbol: string; context?: Record<string, unknown> }

export function AIAssistant({ symbol, context }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text?: string) {
    const msg = text ?? input.trim();
    if (!msg || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setLoading(true);

    try {
      const res = await axios.post("/api/assistant", {
        symbol,
        message: msg,
        context,
        history: messages.slice(-6),
      });
      setMessages(prev => [...prev, { role: "assistant", content: res.data.reply }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Üzgünüm, şu anda yanıt üretemiyorum. Lütfen API anahtarınızı kontrol edin.",
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-13 h-13 rounded-full shadow-2xl",
          "flex items-center justify-center transition-all duration-200",
          "bg-blue-600 hover:bg-blue-500 text-white",
          open ? "rotate-0" : "hover:scale-110"
        )}
        style={{ width: 52, height: 52 }}
        aria-label="AI Asistan"
      >
        {open ? <X className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-80 sm:w-96 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col"
          style={{ height: 480, maxHeight: "calc(100vh - 120px)" }}>

          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 shrink-0">
            <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Analysight Asistanı</p>
              <p className="text-[10px] text-gray-500 truncate">{symbol} analizi bağlamında</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-gray-600 hover:text-gray-400">
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500 text-center pt-2">
                  Merhaba! {symbol} için soru sorabilirsin.
                </p>
                <div className="space-y-1.5">
                  {QUICK_QUESTIONS.map(q => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="w-full text-left text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl px-3 py-2 text-gray-300 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-gray-800 text-gray-200 rounded-bl-sm border border-gray-700"
                )}>
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-bl-sm px-4 py-2.5">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-2.5 border-t border-gray-800 shrink-0">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Sor..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl px-3 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
