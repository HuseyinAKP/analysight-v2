"use client";

import { useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { ScanLine, Upload, X, Sparkles, AlertCircle, ImagePlus } from "lucide-react";

interface Props {
  symbol?: string;
  /** If true renders as a floating button + modal, else inline panel */
  mode?: "inline" | "modal";
}

interface AnalysisResult {
  symbol: string | null;
  is_claude: boolean;
  analysis: string;
}

function AnalysisText({ text }: { text: string }) {
  // Render **bold** and bullet lists nicely
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;
        const isBold = line.startsWith("**") && line.includes("**", 2);
        if (isBold) {
          const clean = line.replace(/\*\*/g, "");
          return <p key={i} className="text-xs font-bold text-zinc-200 mt-3 first:mt-0">{clean}</p>;
        }
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return (
            <div key={i} className="flex items-start gap-2">
              <span className="text-blue-400 mt-0.5 shrink-0">·</span>
              <p className="text-xs text-zinc-300 leading-relaxed">{line.slice(2)}</p>
            </div>
          );
        }
        return <p key={i} className="text-xs text-zinc-300 leading-relaxed">{line}</p>;
      })}
    </div>
  );
}

export function ChartVision({ symbol, mode = "inline" }: Props) {
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith("image/")) {
      setError("Lütfen bir görüntü dosyası yükleyin (PNG, JPG, WebP).");
      return;
    }
    setFile(f);
    setResult(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const analyze = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("image", file);
      if (symbol) form.append("symbol", symbol);

      const res = await fetch("http://localhost:8000/api/analysis/chart-vision", {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch {
      setError("Analiz sırasında bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }, [file, symbol]);

  const reset = useCallback(() => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  }, []);

  const Panel = (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
        <ScanLine className="w-4 h-4 text-violet-400" />
        <h2 className="text-sm font-semibold text-zinc-200">Grafik Görüntü Analizi</h2>
        {symbol && <span className="text-[10px] text-zinc-600">· {symbol}</span>}
        <span className="ml-auto flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
          <Sparkles className="w-2.5 h-2.5" /> Claude Vision
        </span>
        {mode === "modal" && (
          <button onClick={() => setOpen(false)} className="ml-2 text-zinc-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Drop zone */}
        {!preview ? (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all",
              dragging
                ? "border-violet-500 bg-violet-500/10"
                : "border-zinc-700 hover:border-zinc-500 bg-zinc-800/30 hover:bg-zinc-800/60"
            )}>
            <ImagePlus className={cn("w-10 h-10", dragging ? "text-violet-400" : "text-zinc-600")} />
            <div className="text-center">
              <p className="text-sm font-semibold text-zinc-300">Grafik Ekran Görüntüsü Yükle</p>
              <p className="text-xs text-zinc-500 mt-1">Sürükle bırak veya tıkla · PNG, JPG, WebP · Maks 10 MB</p>
            </div>
            <p className="text-[10px] text-zinc-600">TradingView, Yahoo Finance veya herhangi bir grafik ekran görüntüsü</p>
          </div>
        ) : (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Chart preview" className="w-full rounded-xl border border-zinc-700 max-h-64 object-contain bg-zinc-950" />
            <button
              onClick={reset}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />

        {/* Analyze button */}
        {preview && !result && (
          <button
            onClick={analyze}
            disabled={loading}
            className={cn(
              "w-full py-2.5 rounded-xl font-bold text-sm transition-all",
              loading
                ? "bg-zinc-800 text-zinc-500 cursor-wait"
                : "bg-violet-600 hover:bg-violet-500 text-white hover:shadow-lg hover:shadow-violet-900/30"
            )}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />
                Grafik analiz ediliyor…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4" />
                AI ile Analiz Et
              </span>
            )}
          </button>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-xs">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300">AI Grafik Analizi</span>
              {result.is_claude ? (
                <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  <Sparkles className="w-2.5 h-2.5" /> Claude AI
                </span>
              ) : (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400 border border-zinc-600">
                  Şablon
                </span>
              )}
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 max-h-80 overflow-y-auto"
              style={{ scrollbarWidth: "thin", scrollbarColor: "#3f3f46 transparent" }}>
              <AnalysisText text={result.analysis} />
            </div>
            <button onClick={reset}
              className="w-full py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all border border-zinc-700">
              Yeni Görüntü Yükle
            </button>
            <p className="text-[10px] text-zinc-700 text-center">Bu analiz bilgi amaçlıdır, yatırım tavsiyesi değildir.</p>
          </div>
        )}
      </div>
    </div>
  );

  if (mode === "inline") return Panel;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-violet-700/50 bg-violet-900/20 text-violet-300 hover:border-violet-500 hover:text-white transition-all">
        <ScanLine className="w-3 h-3" />
        Grafik Analiz
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="max-w-lg w-full">
              {Panel}
            </div>
          </div>
        </>
      )}
    </>
  );
}
