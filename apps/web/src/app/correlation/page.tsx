"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { API_BASE } from "@/lib/api";
import { GitBranch, X, Plus, Play, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const PERIODS = [
  { value: "1mo", label: "1 Ay" },
  { value: "3mo", label: "3 Ay" },
  { value: "6mo", label: "6 Ay" },
  { value: "1y",  label: "1 Yıl" },
  { value: "2y",  label: "2 Yıl" },
  { value: "5y",  label: "5 Yıl" },
];

const PRESETS = [
  { label: "BIST Bankalar",  symbols: ["GARAN.IS","AKBNK.IS","YKBNK.IS","ISCTR.IS","HALKB.IS"] },
  { label: "BIST Büyük",    symbols: ["THYAO.IS","GARAN.IS","ASELS.IS","BIMAS.IS","KCHOL.IS"] },
  { label: "ABD Teknoloji", symbols: ["AAPL","MSFT","GOOGL","NVDA","META"] },
  { label: "ABD Endeksler", symbols: ["SPY","QQQ","DIA","IWM","VTI"] },
];

function corrColor(val: number): string {
  if (val >= 0.9)  return "bg-red-800 text-red-100";
  if (val >= 0.7)  return "bg-red-600/70 text-red-100";
  if (val >= 0.5)  return "bg-orange-600/60 text-orange-100";
  if (val >= 0.3)  return "bg-yellow-600/50 text-yellow-100";
  if (val >= 0.1)  return "bg-zinc-700 text-zinc-200";
  if (val >= -0.1) return "bg-zinc-800 text-zinc-400";
  if (val >= -0.3) return "bg-blue-900/50 text-blue-200";
  if (val >= -0.5) return "bg-blue-700/60 text-blue-100";
  return "bg-blue-500/60 text-blue-50";
}

interface CorrelationResult {
  symbols: string[];
  matrix: number[][];
  stats: Record<string, { annual_return: number; annual_vol: number; sharpe: number }>;
  period: string;
  data_points: number;
}

export default function CorrelationPage() {
  const [symbols, setSymbols] = useState<string[]>(["THYAO.IS", "GARAN.IS", "ASELS.IS", "BIMAS.IS"]);
  const [input, setInput] = useState("");
  const [period, setPeriod] = useState("1y");

  const mutation = useMutation<CorrelationResult, Error, void>({
    mutationFn: async () => {
      const { data } = await axios.post(`${API_BASE}/api/correlation`, { symbols, period });
      return data;
    },
  });

  function addSymbol() {
    const s = input.trim().toUpperCase();
    if (!s || symbols.includes(s) || symbols.length >= 15) return;
    setSymbols([...symbols, s]);
    setInput("");
  }

  function removeSymbol(s: string) {
    setSymbols(symbols.filter((x) => x !== s));
  }

  function applyPreset(preset: typeof PRESETS[0]) {
    setSymbols(preset.symbols);
  }

  const result = mutation.data;

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <GitBranch className="w-6 h-6 text-purple-400" />
          Korelasyon Matrisi
        </h1>
        <p className="text-zinc-500 text-sm mt-1">Hisseler arasındaki ilişkiyi analiz et — portföy çeşitliliğini ölç</p>
      </div>

      {/* Ayarlar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p.label} onClick={() => applyPreset(p)}
              className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 text-zinc-400 hover:text-white rounded-lg transition-colors">
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {symbols.map((s) => (
            <span key={s} className="flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs px-2.5 py-1.5 rounded-lg">
              {s}
              <button onClick={() => removeSymbol(s)} className="text-zinc-600 hover:text-red-400 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSymbol()}
            placeholder="Sembol ekle (örn: AAPL, THYAO.IS)..."
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500"
          />
          <button onClick={addSymbol}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 hover:border-zinc-600 text-zinc-400 hover:text-white rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-zinc-500">Periyot:</span>
          {PERIODS.map((p) => (
            <button key={p.value} onClick={() => setPeriod(p.value)}
              className={cn("text-xs px-3 py-1.5 rounded-lg border transition-colors",
                period === p.value
                  ? "bg-purple-600/20 border-purple-500/40 text-purple-300"
                  : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300")}>
              {p.label}
            </button>
          ))}

          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || symbols.length < 2}
            className="ml-auto flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors">
            <Play className="w-3.5 h-3.5" />
            {mutation.isPending ? "Hesaplanıyor..." : "Analiz Et"}
          </button>
        </div>

        {mutation.isError && (
          <p className="text-red-400 text-sm">{mutation.error.message}</p>
        )}
      </div>

      {mutation.isPending && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center h-48 text-zinc-400">
          <div className="text-center space-y-2">
            <Activity className="w-8 h-8 mx-auto animate-pulse text-purple-400" />
            <p className="text-sm">Veriler indiriliyor ve hesaplanıyor...</p>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <p className="text-xs text-zinc-600">{result.data_points} günlük veri • {PERIODS.find(p => p.value === result.period)?.label}</p>

          {/* Korelasyon Matrisi */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 overflow-x-auto">
            <h2 className="text-sm font-semibold text-zinc-300 mb-4">Korelasyon Matrisi</h2>
            <table className="border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="w-24" />
                  {result.symbols.map((s) => (
                    <th key={s} className="text-xs text-zinc-500 font-normal pb-1 px-1 text-center min-w-[72px]">
                      {s.replace(".IS", "")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.symbols.map((s1, i) => (
                  <tr key={s1}>
                    <td className="text-xs text-zinc-400 pr-2 text-right whitespace-nowrap">
                      {s1.replace(".IS", "")}
                    </td>
                    {result.matrix[i].map((val, j) => (
                      <td key={j}
                        className={cn("text-center text-xs font-mono rounded-md px-2 py-2 min-w-[72px]", corrColor(val))}
                        title={`${s1} ↔ ${result.symbols[j]}: ${val}`}>
                        {i === j ? "—" : val.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Legend */}
            <div className="flex items-center gap-1 mt-4 flex-wrap">
              <span className="text-xs text-zinc-600 mr-1">Korelasyon:</span>
              {[
                { color: "bg-blue-500/60",    label: "Güçlü negatif" },
                { color: "bg-blue-900/50",    label: "Negatif" },
                { color: "bg-zinc-800",       label: "Nötr" },
                { color: "bg-yellow-600/50",  label: "Zayıf pozitif" },
                { color: "bg-orange-600/60",  label: "Orta pozitif" },
                { color: "bg-red-600/70",     label: "Güçlü pozitif" },
                { color: "bg-red-800",        label: "Çok güçlü" },
              ].map((l) => (
                <span key={l.label} className="flex items-center gap-1 text-[10px] text-zinc-500">
                  <span className={cn("w-3 h-3 rounded-sm inline-block", l.color)} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>

          {/* İstatistikler */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-zinc-300 mb-4">Hisse İstatistikleri</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-zinc-600 border-b border-zinc-800">
                    <th className="text-left py-2 pr-4">Sembol</th>
                    <th className="text-right py-2 px-3">Yıllık Getiri</th>
                    <th className="text-right py-2 px-3">Volatilite</th>
                    <th className="text-right py-2 px-3">Sharpe</th>
                  </tr>
                </thead>
                <tbody>
                  {result.symbols.map((sym) => {
                    const s = result.stats[sym];
                    return (
                      <tr key={sym} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                        <td className="py-2.5 pr-4 font-mono text-zinc-300">{sym}</td>
                        <td className={cn("py-2.5 px-3 text-right font-mono",
                          s.annual_return >= 0 ? "text-emerald-400" : "text-red-400")}>
                          {s.annual_return > 0 ? "+" : ""}{s.annual_return}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-zinc-400">{s.annual_vol}%</td>
                        <td className={cn("py-2.5 px-3 text-right font-mono",
                          s.sharpe > 1 ? "text-emerald-400" : s.sharpe > 0 ? "text-zinc-300" : "text-red-400")}>
                          {s.sharpe}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Yorum */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-zinc-300 mb-3">Portföy Çeşitlilik Analizi</h2>
            <div className="space-y-2">
              {(() => {
                const n = result.symbols.length;
                const vals: number[] = [];
                for (let i = 0; i < n; i++)
                  for (let j = i + 1; j < n; j++)
                    vals.push(result.matrix[i][j]);
                const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
                const highPairs = result.symbols.flatMap((s1, i) =>
                  result.symbols.slice(i + 1).map((s2, jj) => ({
                    s1, s2, val: result.matrix[i][i + 1 + jj]
                  }))
                ).filter(p => p.val > 0.8).slice(0, 3);

                const lowPairs = result.symbols.flatMap((s1, i) =>
                  result.symbols.slice(i + 1).map((s2, jj) => ({
                    s1, s2, val: result.matrix[i][i + 1 + jj]
                  }))
                ).filter(p => p.val < 0.2).sort((a, b) => a.val - b.val).slice(0, 3);

                return (
                  <>
                    <p className="text-sm text-zinc-400">
                      Ortalama korelasyon: <span className={cn("font-semibold",
                        avg > 0.7 ? "text-red-400" : avg > 0.4 ? "text-yellow-400" : "text-emerald-400")}>
                        {avg.toFixed(2)}
                      </span>
                      {avg > 0.7 && " — Portföy yeterince çeşitlendirilmemiş, hisseler birlikte hareket ediyor."}
                      {avg > 0.4 && avg <= 0.7 && " — Orta düzey çeşitlilik. Farklı sektörlerden eklemeler faydalı olabilir."}
                      {avg <= 0.4 && " — İyi çeşitlilik. Hisseler birbirinden bağımsız hareket ediyor."}
                    </p>
                    {highPairs.length > 0 && (
                      <p className="text-sm text-zinc-500">
                        Yüksek korelasyon (risk):
                        {highPairs.map(p => ` ${p.s1.replace(".IS","")}↔${p.s2.replace(".IS","")} (${p.val.toFixed(2)})`).join(",")}
                      </p>
                    )}
                    {lowPairs.length > 0 && (
                      <p className="text-sm text-zinc-500">
                        En düşük korelasyon (iyi çeşitlilik):
                        {lowPairs.map(p => ` ${p.s1.replace(".IS","")}↔${p.s2.replace(".IS","")} (${p.val.toFixed(2)})`).join(",")}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
