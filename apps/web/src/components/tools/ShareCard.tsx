"use client";

import { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Share2, Download, Copy, Check, X } from "lucide-react";

interface Props {
  symbol: string;
  price?: number;
  changePct?: number;
  score?: number;         // 0-100 fırsat skoru
  rsi?: number;
  signal?: string;        // "Güçlü Al" | "Al" | "Nötr" | "Sat"
  signalColor?: "green" | "yellow" | "red";
  target?: number;
  stopLoss?: number;
  aiSummary?: string;     // Kısa AI yorumu (1-2 cümle)
}

// ── Card design (rendered div, screenshotted) ─────────────────────────────────
function CardFace({ symbol, price, changePct, score, rsi, signal, signalColor, target, stopLoss, aiSummary }: Props) {
  const isUp = (changePct ?? 0) >= 0;
  const scoreColor = (score ?? 50) >= 65 ? "#10b981" : (score ?? 50) >= 40 ? "#f59e0b" : "#ef4444";

  const SIGNAL_COLORS: Record<string, string> = {
    green:  "#10b981",
    yellow: "#f59e0b",
    red:    "#ef4444",
  };
  const sigColor = SIGNAL_COLORS[signalColor ?? "yellow"] ?? "#71717a";

  return (
    <div
      style={{
        width: 400,
        background: "linear-gradient(135deg, #09090b 0%, #18181b 60%, #1c1917 100%)",
        border: "1px solid #27272a",
        borderRadius: 20,
        padding: 28,
        fontFamily: "'Inter', sans-serif",
        color: "#ffffff",
        position: "relative",
        overflow: "hidden",
      }}>

      {/* Glow bg */}
      <div style={{
        position: "absolute", top: -60, right: -60,
        width: 200, height: 200, borderRadius: "50%",
        background: `radial-gradient(circle, ${sigColor}20 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>{symbol}</div>
          <div style={{ fontSize: 11, color: "#71717a", marginTop: 2 }}>Analysight AI Analiz</div>
        </div>
        {/* Score ring */}
        <div style={{ textAlign: "center" }}>
          <svg width={56} height={56} viewBox="0 0 56 56">
            <circle cx={28} cy={28} r={22} fill="none" stroke="#27272a" strokeWidth={5} />
            <circle cx={28} cy={28} r={22} fill="none" stroke={scoreColor} strokeWidth={5}
              strokeDasharray={`${((score ?? 50) / 100) * 138} 138`}
              strokeLinecap="round" transform="rotate(-90 28 28)" />
            <text x={28} y={33} textAnchor="middle" fontSize={14} fontWeight={800} fill="white">{score ?? "—"}</text>
          </svg>
          <div style={{ fontSize: 9, color: "#71717a", marginTop: 2 }}>/ 100</div>
        </div>
      </div>

      {/* Price row */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
        {price !== undefined && (
          <span style={{ fontSize: 28, fontWeight: 800, fontFamily: "monospace" }}>
            {price.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}
          </span>
        )}
        {changePct !== undefined && (
          <span style={{ fontSize: 14, fontWeight: 700, color: isUp ? "#10b981" : "#ef4444" }}>
            {isUp ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%
          </span>
        )}
      </div>

      {/* Signal badge */}
      {signal && (
        <div style={{
          display: "inline-block", padding: "4px 12px", borderRadius: 8,
          background: `${sigColor}20`, border: `1px solid ${sigColor}50`,
          color: sigColor, fontSize: 12, fontWeight: 800, marginBottom: 16,
        }}>
          {signal}
        </div>
      )}

      {/* Metrics grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[
          { label: "RSI", value: rsi !== undefined ? rsi.toFixed(1) : "—", color: rsi !== undefined ? (rsi < 30 ? "#10b981" : rsi > 70 ? "#ef4444" : "#a1a1aa") : "#a1a1aa" },
          { label: "Hedef", value: target !== undefined ? target.toFixed(2) : "—", color: "#10b981" },
          { label: "Stop", value: stopLoss !== undefined ? stopLoss.toFixed(2) : "—", color: "#ef4444" },
        ].map(m => (
          <div key={m.label} style={{
            background: "#18181b", border: "1px solid #27272a", borderRadius: 10,
            padding: "10px 8px", textAlign: "center",
          }}>
            <div style={{ fontSize: 9, color: "#71717a", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{m.label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* AI Summary */}
      {aiSummary && (
        <div style={{
          background: "#18181b", border: "1px solid #27272a", borderRadius: 12,
          padding: 12, marginBottom: 16,
        }}>
          <div style={{ fontSize: 9, color: "#a78bfa", fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
            AI Görüşü
          </div>
          <div style={{ fontSize: 11, color: "#d4d4d8", lineHeight: 1.5 }}>
            {aiSummary.length > 140 ? aiSummary.slice(0, 140) + "…" : aiSummary}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 10, color: "#52525b" }}>
          {new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#3b82f6", letterSpacing: -0.3 }}>
          analysight.app
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{ fontSize: 8, color: "#3f3f46", marginTop: 8, textAlign: "center" }}>
        Bu kart bilgi amaçlıdır, yatırım tavsiyesi değildir.
      </div>
    </div>
  );
}

// ── Share modal ───────────────────────────────────────────────────────────────
interface ModalProps extends Props {
  onClose: () => void;
}

function ShareModal({ onClose, ...props }: ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const downloadCard = useCallback(async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = `${props.symbol}-analysight.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      // silent fail
    } finally {
      setDownloading(false);
    }
  }, [props.symbol]);

  const copyAsText = useCallback(() => {
    const lines = [
      `${props.symbol} — Analysight AI Analiz`,
      props.price !== undefined ? `Fiyat: ${props.price.toLocaleString("tr-TR")}` : "",
      props.changePct !== undefined ? `Değişim: ${props.changePct >= 0 ? "+" : ""}${props.changePct.toFixed(2)}%` : "",
      props.signal ? `Sinyal: ${props.signal}` : "",
      props.score !== undefined ? `Skor: ${props.score}/100` : "",
      props.rsi !== undefined ? `RSI: ${props.rsi.toFixed(1)}` : "",
      props.target !== undefined ? `Hedef: ${props.target.toFixed(2)}` : "",
      props.stopLoss !== undefined ? `Stop: ${props.stopLoss.toFixed(2)}` : "",
      props.aiSummary ? `\n${props.aiSummary}` : "",
      "\nanalysight.app | Yatırım tavsiyesi değildir.",
    ].filter(Boolean).join("\n");

    navigator.clipboard.writeText(lines);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [props]);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden max-w-lg w-full">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <span className="text-sm font-semibold text-white">Analiz Kartı</span>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Card preview */}
          <div className="p-5 flex justify-center">
            <div ref={cardRef}>
              <CardFace {...props} />
            </div>
          </div>

          {/* Actions */}
          <div className="px-5 pb-5 flex gap-3">
            <button onClick={downloadCard} disabled={downloading}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all",
                downloading
                  ? "bg-zinc-800 text-zinc-500"
                  : "bg-blue-600 hover:bg-blue-500 text-white"
              )}>
              <Download className="w-4 h-4" />
              {downloading ? "İndiriliyor…" : "PNG İndir"}
            </button>
            <button onClick={copyAsText}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-all border border-zinc-700">
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? "Kopyalandı!" : "Metin Kopyala"}
            </button>
          </div>
          <p className="text-[10px] text-zinc-700 text-center pb-4">Instagram, Twitter veya Telegram'da paylaşabilirsiniz</p>
        </div>
      </div>
    </>
  );
}

// ── Trigger button (used in symbol page) ─────────────────────────────────────
export function ShareCardButton(props: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500 hover:text-white transition-all">
        <Share2 className="w-3 h-3" />
        Paylaş
      </button>
      {open && <ShareModal {...props} onClose={() => setOpen(false)} />}
    </>
  );
}
