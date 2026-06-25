"use client";
import { API_BASE } from "@/lib/api";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Code2, Copy, Check, ExternalLink, Sparkles, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  symbol?: string;
}

const STRATEGY_EXAMPLES = [
  "RSI 30'un altında al, 70'in üstünde sat, EMA50 trend filtresi",
  "MACD crossover al sinyali + hacim artışı konfirmasyonu",
  "Bollinger Band alt bandına dokunuşta al, üst bandda sat",
  "EMA20 EMA50'yi yukarı kestiğinde al (Golden Cross), aşağı kestiğinde sat",
  "RSI diverjansı + destek seviyesi kırılımında giriş",
];

export function PineScriptGenerator({ symbol }: Props) {
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<{
    code: string;
    is_claude: boolean;
    instructions: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const generate = useCallback(async () => {
    if (!description.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const endpoint = symbol
        ? `${API_BASE}/api/analysis/${symbol}/pine-script`
        : "http://localhost:8000/api/analysis/pine-script";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      if (res.ok) {
        const d = await res.json();
        setResult(d);
      }
    } catch {
      setResult({
        code: "// Hata: API bağlantısı kurulamadı",
        is_claude: false,
        instructions: "",
      });
    } finally {
      setLoading(false);
    }
  }, [description, symbol]);

  const copyCode = useCallback(() => {
    if (!result?.code) return;
    navigator.clipboard.writeText(result.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
        <Code2 className="w-4 h-4 text-blue-400" />
        <h2 className="text-sm font-semibold text-zinc-200">Pine Script Üreteci</h2>
        {symbol && <span className="text-[10px] text-zinc-600">· {symbol}</span>}
        <span className="ml-auto text-[10px] text-zinc-600">TradingView v5</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Description input */}
        <div>
          <label className="block text-[10px] text-zinc-500 uppercase tracking-wide mb-2">
            Stratejiyi Türkçe Anlat
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            onKeyDown={e => e.key === "Enter" && e.ctrlKey && generate()}
            placeholder="Örnek: RSI 30 altında al, EMA200 üzerinde fiyat olduğunda, stop %5 altında..."
            rows={3}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
          />
          <p className="text-[10px] text-zinc-600 mt-1">Ctrl+Enter ile üret</p>
        </div>

        {/* Example chips */}
        <div>
          <p className="text-[10px] text-zinc-600 mb-2">Hazır örnekler:</p>
          <div className="flex flex-wrap gap-1.5">
            {STRATEGY_EXAMPLES.map((ex, i) => (
              <button key={i} onClick={() => setDescription(ex)}
                className="text-[10px] px-2.5 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-zinc-700 transition-colors text-left">
                {ex.length > 45 ? ex.slice(0, 45) + "…" : ex}
              </button>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <button
          onClick={generate}
          disabled={!description.trim() || loading}
          className={cn(
            "w-full py-2.5 rounded-xl font-bold text-sm transition-all",
            loading
              ? "bg-zinc-800 text-zinc-500 cursor-wait"
              : !description.trim()
              ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-500 text-white hover:shadow-lg hover:shadow-blue-900/30"
          )}>
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />
              Pine Script üretiliyor…
            </span>
          ) : "Pine Script Üret"}
        </button>

        {/* Result */}
        {result && (
          <div className="space-y-3">
            {/* Code header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {result.is_claude ? (
                  <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                    <Sparkles className="w-2.5 h-2.5" /> Claude AI
                  </span>
                ) : (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400 border border-zinc-600">
                    Şablon
                  </span>
                )}
                <span className="text-[10px] text-zinc-500">Pine Script v5</span>
              </div>
              <button onClick={copyCode}
                className={cn(
                  "flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all",
                  copied
                    ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
                    : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500"
                )}>
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? "Kopyalandı!" : "Kopyala"}
              </button>
            </div>

            {/* Code block */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
              <pre className="p-4 text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed whitespace-pre"
                style={{ scrollbarWidth: "thin", scrollbarColor: "#3f3f46 transparent" }}>
                {result.code}
              </pre>
            </div>

            {/* Instructions accordion */}
            {result.instructions && (
              <div className="border border-zinc-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowInstructions(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-zinc-800/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-xs font-medium text-zinc-300">TradingView'a Nasıl Eklenir?</span>
                  </div>
                  {showInstructions
                    ? <ChevronUp className="w-3.5 h-3.5 text-zinc-600" />
                    : <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />}
                </button>
                {showInstructions && (
                  <div className="px-4 pb-4 border-t border-zinc-800 pt-3">
                    {result.instructions.split("\n").map((line, i) => (
                      <p key={i} className="text-xs text-zinc-400 leading-relaxed py-0.5">{line}</p>
                    ))}
                    <a href="https://www.tradingview.com/pine-script-docs/" target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[10px] text-blue-400 hover:text-blue-300 transition-colors mt-2">
                      <ExternalLink className="w-3 h-3" />
                      Pine Script Dokümantasyonu
                    </a>
                  </div>
                )}
              </div>
            )}

            <p className="text-[10px] text-zinc-700">
              Üretilen strateji geçmiş testler için başlangıç noktasıdır. Gerçek işlemlerde kullanmadan önce optimize edin.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
