"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { API_BASE } from "@/lib/api";
import {
  Play, BarChart2, Activity, Trophy, AlertTriangle, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STRATEGIES = [
  { id: "ma_cross",   label: "Hareketli Ortalama",  desc: "Kısa MA uzun MA'yı geçince al" },
  { id: "rsi",        label: "RSI",                  desc: "Aşırı alım/satım sinyalleri" },
  { id: "bollinger",  label: "Bollinger Bantları",   desc: "Bant kırılımı sinyalleri" },
  { id: "ml_signal",  label: "XGBoost ML",           desc: "Makine öğrenmesi tahmin sinyali", ml: true },
];

interface Stats {
  total_return: number;
  final_value: number;
  sharpe_ratio: number;
  max_drawdown: number;
  win_rate: number;
  total_trades: number;
  cagr?: number;
  sortino?: number;
  calmar?: number;
  profit_factor?: number;
  avg_hold_days?: number;
  rr_ratio?: number;
  alpha?: number;
}

interface Trade {
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  pnl: number;
  pnl_pct: number;
  hold_days: number;
}

interface BacktestResult {
  symbol: string;
  strategy: string;
  stats: Stats;
  buy_hold_return: number;
  equity_curve: { date: string; value: number }[];
  trades: Trade[];
  n_days?: number;
}

function StatCard({
  label, value, sub, color,
}: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={cn("text-2xl font-bold", color ?? "text-zinc-100")}>{value}</p>
      {sub && <p className="text-xs text-zinc-600 mt-1">{sub}</p>}
    </div>
  );
}

function input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100",
        "focus:outline-none focus:border-blue-500",
        props.className,
      )}
    />
  );
}

export default function BacktestPage() {
  const [symbol, setSymbol]     = useState("THYAO");
  const [strategy, setStrategy] = useState("rsi");
  const [startDate, setStartDate] = useState("2022-01-01");
  const [endDate, setEndDate]   = useState(new Date().toISOString().slice(0, 10));
  const [capital, setCapital]   = useState(100_000);
  // MA
  const [fastPeriod, setFastPeriod] = useState(10);
  const [slowPeriod, setSlowPeriod] = useState(50);
  // RSI
  const [rsiBuy, setRsiBuy]   = useState(30);
  const [rsiSell, setRsiSell] = useState(70);
  // Bollinger
  const [bbPeriod, setBbPeriod] = useState(20);
  const [bbStd, setBbStd]       = useState(2.0);
  // ML
  const [mlThreshold, setMlThreshold] = useState(55);
  // Risk
  const [stopLoss, setStopLoss]     = useState<string>("");
  const [takeProfit, setTakeProfit] = useState<string>("");

  const mutation = useMutation<BacktestResult, Error, void>({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        symbol, strategy,
        start_date: startDate,
        end_date: endDate,
        initial_capital: capital,
        fast_period: fastPeriod,
        slow_period: slowPeriod,
        rsi_buy: rsiBuy,
        rsi_sell: rsiSell,
        bb_period: bbPeriod,
        bb_std: bbStd,
        ml_threshold: mlThreshold,
        stop_loss_pct:   stopLoss   ? parseFloat(stopLoss) / 100   : null,
        take_profit_pct: takeProfit ? parseFloat(takeProfit) / 100 : null,
      };
      const { data } = await axios.post(`${API_BASE}/api/backtest`, body);
      return data;
    },
  });

  const result = mutation.data;
  const s = result?.stats;

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-blue-400" />
          Strateji Backtest
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          Gerçekçi ticaret simülasyonu — komisyon, spread ve slippage dahil
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sol: Parametreler */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-300">Parametreler</h2>

            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Sembol (BIST: sadece kod, Global: AAPL vs)</label>
              {input({
                value: symbol,
                onChange: (e) => setSymbol(e.target.value.toUpperCase()),
                placeholder: "THYAO, GARAN, AAPL...",
              })}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Başlangıç</label>
                {input({ type: "date", value: startDate, onChange: (e) => setStartDate(e.target.value) })}
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Bitiş</label>
                {input({ type: "date", value: endDate, onChange: (e) => setEndDate(e.target.value) })}
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Başlangıç Sermayesi</label>
              {input({
                type: "number",
                value: capital,
                onChange: (e) => setCapital(Number(e.target.value)),
              })}
            </div>

            {/* Strateji seçici */}
            <div>
              <label className="text-xs text-zinc-500 mb-2 block">Strateji</label>
              <div className="space-y-2">
                {STRATEGIES.map((str) => (
                  <button
                    key={str.id}
                    onClick={() => setStrategy(str.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border text-sm transition-all",
                      strategy === str.id
                        ? str.ml
                          ? "bg-purple-600/15 border-purple-500/40 text-purple-300"
                          : "bg-blue-600/15 border-blue-500/40 text-blue-300"
                        : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600",
                    )}
                  >
                    <div className="font-medium flex items-center gap-1.5">
                      {str.ml && <Zap className="w-3.5 h-3.5" />}
                      {str.label}
                    </div>
                    <div className="text-xs opacity-70 mt-0.5">{str.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Strateji parametreleri */}
            {strategy === "ma_cross" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Hızlı MA</label>
                  {input({ type: "number", value: fastPeriod, onChange: (e) => setFastPeriod(Number(e.target.value)) })}
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Yavaş MA</label>
                  {input({ type: "number", value: slowPeriod, onChange: (e) => setSlowPeriod(Number(e.target.value)) })}
                </div>
              </div>
            )}
            {strategy === "rsi" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">RSI Al (&lt;)</label>
                  {input({ type: "number", value: rsiBuy, onChange: (e) => setRsiBuy(Number(e.target.value)) })}
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">RSI Sat (&gt;)</label>
                  {input({ type: "number", value: rsiSell, onChange: (e) => setRsiSell(Number(e.target.value)) })}
                </div>
              </div>
            )}
            {strategy === "bollinger" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">BB Periyot</label>
                  {input({ type: "number", value: bbPeriod, onChange: (e) => setBbPeriod(Number(e.target.value)) })}
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">BB Std</label>
                  {input({ type: "number", step: "0.1", value: bbStd, onChange: (e) => setBbStd(Number(e.target.value)) })}
                </div>
              </div>
            )}
            {strategy === "ml_signal" && (
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">ML Eşik (%) — al sinyali</label>
                {input({ type: "number", value: mlThreshold, onChange: (e) => setMlThreshold(Number(e.target.value)) })}
                <p className="text-xs text-zinc-600 mt-1">
                  XGBoost model eğitilmemişse RSI stratejisi kullanılır
                </p>
              </div>
            )}

            {/* Risk yönetimi */}
            <div className="border-t border-zinc-800 pt-4">
              <label className="text-xs text-zinc-500 mb-2 block">Risk Yönetimi (opsiyonel)</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-600 mb-1 block">Stop-Loss %</label>
                  {input({
                    type: "number", step: "0.5", placeholder: "5",
                    value: stopLoss,
                    onChange: (e) => setStopLoss(e.target.value),
                  })}
                </div>
                <div>
                  <label className="text-xs text-zinc-600 mb-1 block">Take-Profit %</label>
                  {input({
                    type: "number", step: "1", placeholder: "10",
                    value: takeProfit,
                    onChange: (e) => setTakeProfit(e.target.value),
                  })}
                </div>
              </div>
            </div>

            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors"
            >
              <Play className="w-4 h-4" />
              {mutation.isPending ? "Hesaplanıyor..." : "Backtest Başlat"}
            </button>

            {mutation.isError && (
              <p className="text-red-400 text-xs text-center">
                {(mutation.error as Error).message}
              </p>
            )}

            <div className="text-xs text-zinc-600 space-y-0.5 border-t border-zinc-800 pt-3">
              <p>Komisyon: %0.1 · Spread: %0.05 · Slippage: %0.05</p>
              <p>Toplam işlem maliyeti: ~%0.4 (giriş+çıkış)</p>
            </div>
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
                {strategy === "ml_signal" && (
                  <p className="text-xs text-zinc-600">ML sinyali her gün için hesaplanıyor, biraz zaman alabilir</p>
                )}
              </div>
            </div>
          )}

          {result && s && (
            <>
              {/* Özet başlık */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-zinc-300 font-semibold">{result.symbol}</span>
                <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                  {STRATEGIES.find((x) => x.id === result.strategy)?.label}
                </span>
                {result.n_days && (
                  <span className="text-xs text-zinc-600">{result.n_days} işlem günü</span>
                )}
                <div
                  className={cn(
                    "ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold",
                    s.total_return > (result.buy_hold_return ?? 0)
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-red-500/10 text-red-400 border border-red-500/20",
                  )}
                >
                  {s.total_return > (result.buy_hold_return ?? 0)
                    ? <Trophy className="w-4 h-4" />
                    : <AlertTriangle className="w-4 h-4" />}
                  {s.total_return > (result.buy_hold_return ?? 0) ? "Strateji Kazandı" : "Al&Tut Kazandı"}
                </div>
              </div>

              {/* Ana metrikler */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  label="Toplam Getiri"
                  value={`${s.total_return >= 0 ? "+" : ""}${s.total_return}%`}
                  sub={`Son: ${s.final_value.toLocaleString("tr-TR")}`}
                  color={s.total_return >= 0 ? "text-emerald-400" : "text-red-400"}
                />
                <StatCard
                  label="Al & Tut"
                  value={`${result.buy_hold_return >= 0 ? "+" : ""}${result.buy_hold_return}%`}
                  sub={s.alpha !== undefined ? `Alpha: ${s.alpha >= 0 ? "+" : ""}${s.alpha}%` : "Karşılaştırma"}
                  color={result.buy_hold_return >= 0 ? "text-blue-400" : "text-red-400"}
                />
                <StatCard
                  label="CAGR"
                  value={s.cagr !== undefined ? `${s.cagr >= 0 ? "+" : ""}${s.cagr}%` : "-"}
                  sub="Yıllık bileşik getiri"
                  color={s.cagr !== undefined && s.cagr >= 0 ? "text-emerald-400" : "text-red-400"}
                />
                <StatCard
                  label="Maks. Düşüş"
                  value={`-${s.max_drawdown}%`}
                  color="text-red-400"
                />
              </div>

              {/* Risk/kalite metrikleri */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  label="Sharpe"
                  value={s.sharpe_ratio?.toFixed(2) ?? "-"}
                  sub={s.sharpe_ratio !== null && s.sharpe_ratio !== undefined
                    ? s.sharpe_ratio > 1.5 ? "Çok iyi" : s.sharpe_ratio > 1 ? "İyi" : s.sharpe_ratio > 0 ? "Orta" : "Kötü"
                    : ""}
                  color={s.sharpe_ratio !== null && s.sharpe_ratio !== undefined && s.sharpe_ratio > 1 ? "text-emerald-400" : "text-zinc-100"}
                />
                <StatCard
                  label="Sortino"
                  value={s.sortino?.toFixed(2) ?? "-"}
                  sub="Aşağı risk düzeltmeli"
                />
                <StatCard
                  label="Kazanma Oranı"
                  value={`${s.win_rate}%`}
                  sub={`${s.total_trades} işlem`}
                  color={s.win_rate >= 50 ? "text-emerald-400" : "text-amber-400"}
                />
                <StatCard
                  label="Profit Factor"
                  value={s.profit_factor?.toFixed(2) ?? "-"}
                  sub={s.profit_factor !== undefined
                    ? s.profit_factor > 2 ? "Mükemmel" : s.profit_factor > 1.5 ? "İyi" : s.profit_factor > 1 ? "Orta" : "Kötü"
                    : ""}
                  color={s.profit_factor !== undefined && s.profit_factor > 1.5 ? "text-emerald-400" : "text-zinc-100"}
                />
              </div>

              {/* Equity Curve */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-zinc-300 mb-4">Portföy Değeri (Equity Curve)</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={result.equity_curve}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#71717a", fontSize: 10 }}
                      tickFormatter={(v) => v.slice(2, 10)}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fill: "#71717a", fontSize: 10 }}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
                    />
                    <Tooltip
                      contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                      labelStyle={{ color: "#a1a1aa" }}
                      formatter={(v) => [Number(v).toLocaleString("tr-TR"), "Değer"]}
                    />
                    <ReferenceLine y={capital} stroke="#3f3f46" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* İşlem tablosu */}
              {result.trades.length > 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-zinc-300 mb-3">
                    Son İşlemler ({result.trades.length} adet)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-zinc-500 border-b border-zinc-800">
                          <th className="text-left py-2 pr-3">Giriş</th>
                          <th className="text-left py-2 pr-3">Çıkış</th>
                          <th className="text-right py-2 pr-3">Giriş Fiyatı</th>
                          <th className="text-right py-2 pr-3">Çıkış Fiyatı</th>
                          <th className="text-right py-2 pr-3">P&L</th>
                          <th className="text-right py-2">Gün</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.trades.slice().reverse().map((t, i) => (
                          <tr key={i} className="border-b border-zinc-800/50 last:border-0">
                            <td className="py-2 pr-3 text-zinc-400">{t.entry_date}</td>
                            <td className="py-2 pr-3 text-zinc-400">
                              {t.exit_date === "open" ? (
                                <span className="text-amber-400">Açık</span>
                              ) : t.exit_date}
                            </td>
                            <td className="py-2 pr-3 text-right text-zinc-300">{t.entry_price?.toFixed(2)}</td>
                            <td className="py-2 pr-3 text-right text-zinc-300">{t.exit_price?.toFixed(2)}</td>
                            <td className={cn("py-2 pr-3 text-right font-medium", t.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                              {t.pnl >= 0 ? "+" : ""}{t.pnl_pct?.toFixed(1)}%
                            </td>
                            <td className="py-2 text-right text-zinc-500">
                              {t.hold_days === -1 ? "—" : t.hold_days}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
