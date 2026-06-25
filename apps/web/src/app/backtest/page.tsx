"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { API_BASE } from "@/lib/api";
import {
  Play, TrendingUp, TrendingDown, AlertTriangle, BarChart2,
  Trophy, Activity, Target, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STRATEGIES = [
  { id: "ma_cross",   label: "Hareketli Ortalama Kesişimi", desc: "Kısa MA uzun MA'yı geçince al, geçince sat" },
  { id: "rsi",        label: "RSI Aşırı Alım/Satım",        desc: "RSI düşükken al, yüksekken sat" },
  { id: "bollinger",  label: "Bollinger Bantları",           desc: "Bant dışına çıkınca zıt yöne işlem" },
];

interface Stats {
  total_return: number;
  final_value: number;
  sharpe_ratio: number;
  max_drawdown: number;
  win_rate: number;
  total_trades: number;
}

interface BacktestResult {
  symbol: string;
  strategy: string;
  stats: Stats;
  buy_hold_return: number;
  equity_curve: { date: string; value: number }[];
  trades: { date: string; type: string; price: number; shares: number; value?: number }[];
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={cn("text-2xl font-bold", color ?? "text-zinc-100")}>{value}</p>
      {sub && <p className="text-xs text-zinc-600 mt-1">{sub}</p>}
    </div>
  );
}

export default function BacktestPage() {
  const [symbol, setSymbol] = useState("THYAO.IS");
  const [strategy, setStrategy] = useState("ma_cross");
  const [startDate, setStartDate] = useState("2023-01-01");
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [capital, setCapital] = useState(10000);
  const [fastPeriod, setFastPeriod] = useState(10);
  const [slowPeriod, setSlowPeriod] = useState(50);
  const [rsiBuy, setRsiBuy] = useState(30);
  const [rsiSell, setRsiSell] = useState(70);

  const mutation = useMutation<BacktestResult, Error, void>({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        symbol, strategy, start_date: startDate, end_date: endDate,
        initial_capital: capital, fast_period: fastPeriod, slow_period: slowPeriod,
        rsi_buy: rsiBuy, rsi_sell: rsiSell,
      };
      const { data } = await axios.post(`${API_BASE}/api/backtest`, body);
      return data;
    },
  });

  const result = mutation.data;

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-blue-400" />
          Strateji Backtest
        </h1>
        <p className="text-zinc-500 text-sm mt-1">Geçmiş verilerle trading stratejini test et</p>
      </div>

      {/* Config */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sol: Ayarlar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-300">Parametreler</h2>

            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Sembol</label>
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="THYAO.IS, AAPL..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Başlangıç</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Bitiş</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500" />
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Başlangıç Sermayesi (₺/$)</label>
              <input type="number" value={capital} onChange={(e) => setCapital(Number(e.target.value))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500" />
            </div>

            <div>
              <label className="text-xs text-zinc-500 mb-2 block">Strateji</label>
              <div className="space-y-2">
                {STRATEGIES.map((s) => (
                  <button key={s.id} onClick={() => setStrategy(s.id)}
                    className={cn("w-full text-left p-3 rounded-lg border text-sm transition-all",
                      strategy === s.id
                        ? "bg-blue-600/15 border-blue-500/40 text-blue-300"
                        : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600")}>
                    <div className="font-medium">{s.label}</div>
                    <div className="text-xs opacity-70 mt-0.5">{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Strateji parametreleri */}
            {strategy === "ma_cross" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Hızlı MA</label>
                  <input type="number" value={fastPeriod} onChange={(e) => setFastPeriod(Number(e.target.value))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Yavaş MA</label>
                  <input type="number" value={slowPeriod} onChange={(e) => setSlowPeriod(Number(e.target.value))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500" />
                </div>
              </div>
            )}
            {strategy === "rsi" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">RSI Al (&lt;)</label>
                  <input type="number" value={rsiBuy} onChange={(e) => setRsiBuy(Number(e.target.value))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">RSI Sat (&gt;)</label>
                  <input type="number" value={rsiSell} onChange={(e) => setRsiSell(Number(e.target.value))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500" />
                </div>
              </div>
            )}

            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors">
              <Play className="w-4 h-4" />
              {mutation.isPending ? "Hesaplanıyor..." : "Backtest Başlat"}
            </button>

            {mutation.isError && (
              <p className="text-red-400 text-xs text-center">
                {(mutation.error as Error).message}
              </p>
            )}
          </div>
        </div>

        {/* Sağ: Sonuçlar */}
        <div className="lg:col-span-2 space-y-5">
          {!result && !mutation.isPending && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center h-64 text-zinc-600">
              <div className="text-center">
                <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Parametreleri ayarlayıp backtest başlat</p>
              </div>
            </div>
          )}

          {mutation.isPending && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center h-64 text-zinc-400">
              <div className="text-center space-y-2">
                <Activity className="w-8 h-8 mx-auto animate-pulse text-blue-400" />
                <p className="text-sm">Geçmiş veriler hesaplanıyor...</p>
              </div>
            </div>
          )}

          {result && (
            <>
              {/* İstatistikler */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatCard
                  label="Toplam Getiri"
                  value={`${result.stats.total_return > 0 ? "+" : ""}${result.stats.total_return}%`}
                  sub={`${result.stats.final_value.toLocaleString("tr-TR")} son değer`}
                  color={result.stats.total_return >= 0 ? "text-emerald-400" : "text-red-400"}
                />
                <StatCard
                  label="Al & Tut Getirisi"
                  value={`${result.buy_hold_return > 0 ? "+" : ""}${result.buy_hold_return}%`}
                  sub="Karşılaştırma"
                  color={result.buy_hold_return >= 0 ? "text-blue-400" : "text-red-400"}
                />
                <StatCard
                  label="Sharpe Oranı"
                  value={result.stats.sharpe_ratio.toString()}
                  sub={result.stats.sharpe_ratio > 1 ? "İyi" : result.stats.sharpe_ratio > 0 ? "Orta" : "Kötü"}
                  color={result.stats.sharpe_ratio > 1 ? "text-emerald-400" : "text-zinc-100"}
                />
                <StatCard
                  label="Maks. Düşüş"
                  value={`${result.stats.max_drawdown}%`}
                  color="text-red-400"
                />
                <StatCard
                  label="Kazanma Oranı"
                  value={`${result.stats.win_rate}%`}
                  sub={`${result.stats.total_trades} işlem`}
                  color={result.stats.win_rate >= 50 ? "text-emerald-400" : "text-red-400"}
                />
                <div className={cn(
                  "bg-zinc-900 border rounded-xl p-4 flex items-center gap-3",
                  result.stats.total_return > result.buy_hold_return
                    ? "border-emerald-500/30 bg-emerald-900/10"
                    : "border-red-500/30 bg-red-900/10"
                )}>
                  {result.stats.total_return > result.buy_hold_return
                    ? <Trophy className="w-8 h-8 text-emerald-400 shrink-0" />
                    : <AlertTriangle className="w-8 h-8 text-red-400 shrink-0" />}
                  <div>
                    <p className="text-xs text-zinc-500">Al&Tut'a göre</p>
                    <p className={cn("text-sm font-bold",
                      result.stats.total_return > result.buy_hold_return ? "text-emerald-400" : "text-red-400")}>
                      {result.stats.total_return > result.buy_hold_return ? "Strateji Kazandı" : "Al&Tut Kazandı"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Equity Curve */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-zinc-300 mb-4">Portföy Değeri</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={result.equity_curve}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 10 }}
                      tickFormatter={(v) => v.slice(2, 10)} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "#71717a", fontSize: 10 }}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip
                      contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                      labelStyle={{ color: "#a1a1aa" }}
                      formatter={(v) => [`${Number(v).toLocaleString("tr-TR")}`, "Değer"]}
                    />
                    <ReferenceLine y={capital} stroke="#3f3f46" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* İşlem Listesi */}
              {result.trades.length > 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-zinc-300 mb-3">Son İşlemler</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {result.trades.slice().reverse().map((t, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                        <div className="flex items-center gap-3">
                          <span className={cn("text-xs font-bold px-2 py-0.5 rounded",
                            t.type === "BUY"
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-red-500/15 text-red-400")}>
                            {t.type === "BUY" ? "AL" : "SAT"}
                          </span>
                          <span className="text-xs text-zinc-500">{t.date}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-zinc-200">{t.price.toFixed(2)}</p>
                          {t.value && <p className="text-xs text-zinc-500">{t.value.toLocaleString("tr-TR")}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
