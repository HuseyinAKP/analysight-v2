"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, TrendingDown, Plus, Minus, RefreshCw,
  Wallet, BarChart2, History, Trash2, Trophy, AlertCircle, ChevronUp, ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Position {
  symbol:    string;
  shares:    number;
  avgCost:   number;   // per share
  totalCost: number;
}

interface Trade {
  id:        string;
  symbol:    string;
  type:      "buy" | "sell";
  shares:    number;
  price:     number;
  total:     number;
  timestamp: number;
  pnl?:      number;   // only on sell
}

interface LivePrice {
  symbol:    string;
  price:     number;
  changePct: number;
  loading:   boolean;
}

interface Portfolio {
  cash:       number;
  positions:  Position[];
  trades:     Trade[];
  createdAt:  number;
}

const STORAGE_KEY   = "analysight_paper_trade_v1";
const STARTING_CASH = 100_000;
const API           = "http://localhost:8000";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number, dec = 2) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}
function uid() { return Math.random().toString(36).slice(2); }

function defaultPortfolio(): Portfolio {
  return { cash: STARTING_CASH, positions: [], trades: [], createdAt: Date.now() };
}

// ── Hooks ─────────────────────────────────────────────────────────────────────
function usePortfolio() {
  const [portfolio, setPortfolio] = useState<Portfolio>(defaultPortfolio);
  const [mounted,   setMounted]   = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPortfolio(JSON.parse(raw));
    } catch {}
    setMounted(true);
  }, []);

  const save = useCallback((p: Portfolio) => {
    setPortfolio(p);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  }, []);

  const buy = useCallback((symbol: string, shares: number, price: number) => {
    setPortfolio(prev => {
      const total = shares * price;
      if (total > prev.cash) return prev;
      const positions = [...prev.positions];
      const idx = positions.findIndex(p => p.symbol === symbol);
      if (idx >= 0) {
        const old = positions[idx];
        positions[idx] = {
          ...old,
          shares:    old.shares + shares,
          avgCost:   (old.totalCost + total) / (old.shares + shares),
          totalCost: old.totalCost + total,
        };
      } else {
        positions.push({ symbol, shares, avgCost: price, totalCost: total });
      }
      const trade: Trade = { id: uid(), symbol, type: "buy", shares, price, total, timestamp: Date.now() };
      const updated: Portfolio = { ...prev, cash: prev.cash - total, positions, trades: [trade, ...prev.trades] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const sell = useCallback((symbol: string, shares: number, price: number) => {
    setPortfolio(prev => {
      const positions = [...prev.positions];
      const idx = positions.findIndex(p => p.symbol === symbol);
      if (idx < 0 || positions[idx].shares < shares) return prev;
      const pos   = positions[idx];
      const total = shares * price;
      const pnl   = (price - pos.avgCost) * shares;
      if (shares >= pos.shares) {
        positions.splice(idx, 1);
      } else {
        positions[idx] = {
          ...pos,
          shares:    pos.shares - shares,
          totalCost: pos.totalCost - shares * pos.avgCost,
        };
      }
      const trade: Trade = { id: uid(), symbol, type: "sell", shares, price, total, timestamp: Date.now(), pnl };
      const updated: Portfolio = { ...prev, cash: prev.cash + total, positions, trades: [trade, ...prev.trades] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const reset = useCallback(() => {
    const fresh = defaultPortfolio();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    setPortfolio(fresh);
  }, []);

  return { portfolio, mounted, buy, sell, reset, save };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4">
      <p className="text-[10px] text-zinc-500 uppercase font-semibold mb-1">{label}</p>
      <p className={cn("text-2xl font-bold tabular-nums", color ?? "text-white")}>{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Trade Panel ────────────────────────────────────────────────────────────────
function TradePanel({
  cash, positions, livePrices, onBuy, onSell, loadPrice,
}: {
  cash: number;
  positions: Position[];
  livePrices: Map<string, LivePrice>;
  onBuy:  (sym: string, shares: number, price: number) => void;
  onSell: (sym: string, shares: number, price: number) => void;
  loadPrice: (sym: string) => void;
}) {
  const [sym,    setSym]    = useState("");
  const [shares, setShares] = useState("1");
  const [mode,   setMode]   = useState<"buy" | "sell">("buy");
  const [error,  setError]  = useState("");

  const lp      = livePrices.get(sym.toUpperCase());
  const price   = lp?.price ?? 0;
  const total   = price * Number(shares || 0);
  const hasPos  = positions.find(p => p.symbol === sym.toUpperCase());

  const handleSymChange = (v: string) => {
    setSym(v.toUpperCase());
    setError("");
    if (v.trim().length >= 2) loadPrice(v.toUpperCase());
  };

  const execute = () => {
    const s   = sym.toUpperCase().trim();
    const qty = parseInt(shares);
    if (!s || !qty || qty <= 0) { setError("Geçerli sembol ve adet gir"); return; }
    if (!price) { setError("Önce fiyat yükle"); return; }
    if (mode === "buy" && total > cash) { setError("Yetersiz bakiye"); return; }
    if (mode === "sell" && (!hasPos || (hasPos.shares < qty))) { setError("Yeterli pozisyon yok"); return; }
    if (mode === "buy") onBuy(s, qty, price);
    else onSell(s, qty, price);
    setSym(""); setShares("1"); setError("");
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
      <h3 className="font-semibold text-white">İşlem Yap</h3>

      {/* Buy / Sell toggle */}
      <div className="flex gap-1 bg-zinc-950 rounded-xl p-1">
        {(["buy", "sell"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={cn("flex-1 py-2 text-xs font-bold rounded-lg transition-all",
              mode === m
                ? m === "buy" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                : "text-zinc-500 hover:text-zinc-300")}>
            {m === "buy" ? "▲ AL" : "▼ SAT"}
          </button>
        ))}
      </div>

      {/* Symbol */}
      <div>
        <label className="text-[10px] text-zinc-500 uppercase font-semibold block mb-1.5">Hisse Sembolü</label>
        <div className="flex gap-2">
          <input value={sym} onChange={e => handleSymChange(e.target.value)}
            onKeyDown={e => e.key === "Enter" && execute()}
            placeholder="THYAO, GARAN…"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500" />
          <button onClick={() => loadPrice(sym)} disabled={!sym}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl hover:border-zinc-500 disabled:opacity-40 transition-colors">
            <RefreshCw className={cn("w-4 h-4 text-zinc-400", lp?.loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Live price */}
      {lp && !lp.loading && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-xs text-zinc-500">{lp.symbol} güncel fiyat</span>
          <div className="text-right">
            <span className="text-white font-bold tabular-nums">{fmt(lp.price)} ₺</span>
            <span className={cn("text-xs ml-2", lp.changePct >= 0 ? "text-emerald-400" : "text-red-400")}>
              {fmtPct(lp.changePct)}
            </span>
          </div>
        </div>
      )}

      {/* Shares */}
      <div>
        <label className="text-[10px] text-zinc-500 uppercase font-semibold block mb-1.5">Adet</label>
        <div className="flex gap-2 items-center">
          <button onClick={() => setShares(s => String(Math.max(1, Number(s) - 1)))}
            className="w-9 h-9 bg-zinc-800 border border-zinc-700 rounded-xl flex items-center justify-center hover:border-zinc-500 transition-colors">
            <Minus className="w-3.5 h-3.5 text-zinc-400" />
          </button>
          <input type="number" value={shares} onChange={e => setShares(e.target.value)} min={1}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white text-center focus:outline-none focus:border-blue-500" />
          <button onClick={() => setShares(s => String(Number(s) + 1))}
            className="w-9 h-9 bg-zinc-800 border border-zinc-700 rounded-xl flex items-center justify-center hover:border-zinc-500 transition-colors">
            <Plus className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        </div>
        {mode === "buy" && price > 0 && (
          <div className="flex gap-2 mt-2">
            {[10, 25, 50, 100].map(q => (
              <button key={q} onClick={() => setShares(String(q))}
                className="flex-1 text-[10px] py-1 bg-zinc-800 border border-zinc-700 rounded-lg hover:border-zinc-600 text-zinc-400 hover:text-zinc-200 transition-colors">
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Total */}
      {price > 0 && Number(shares) > 0 && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-500">Toplam Tutar</span>
            <span className="text-white font-bold tabular-nums">{fmt(total)} ₺</span>
          </div>
          {mode === "buy" && (
            <div className="flex justify-between text-xs mt-1">
              <span className="text-zinc-600">Kalan Bakiye</span>
              <span className={cn("font-mono", total > cash ? "text-red-400" : "text-zinc-400")}>
                {fmt(cash - total)} ₺
              </span>
            </div>
          )}
          {mode === "sell" && hasPos && (
            <div className="flex justify-between text-xs mt-1">
              <span className="text-zinc-600">Tahmini K/Z</span>
              <span className={cn("font-mono", (price - hasPos.avgCost) >= 0 ? "text-emerald-400" : "text-red-400")}>
                {fmt((price - hasPos.avgCost) * Number(shares))} ₺
              </span>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Execute */}
      <button onClick={execute}
        className={cn("w-full py-3 font-bold text-sm rounded-xl transition-all",
          mode === "buy"
            ? "bg-emerald-600 hover:bg-emerald-500 text-white"
            : "bg-red-600 hover:bg-red-500 text-white")}>
        {mode === "buy" ? `▲ ${sym || "Hisse"} AL` : `▼ ${sym || "Hisse"} SAT`}
      </button>

      {/* Cash reminder */}
      <p className="text-center text-[10px] text-zinc-600">
        Mevcut Nakit: <span className="text-zinc-400 font-mono">{fmt(cash)} ₺</span>
      </p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PaperTradePage() {
  const { portfolio, mounted, buy, sell, reset } = usePortfolio();
  const [livePrices, setLivePrices]   = useState<Map<string, LivePrice>>(new Map());
  const [activeTab,  setActiveTab]    = useState<"positions" | "history">("positions");
  const [showReset,  setShowReset]    = useState(false);

  // ── Load price for a symbol ─────────────────────────────────────────────────
  const loadPrice = useCallback(async (symbol: string) => {
    if (!symbol) return;
    setLivePrices(prev => new Map(prev).set(symbol, { symbol, price: 0, changePct: 0, loading: true }));
    try {
      const res  = await fetch(`${API}/api/analysis/${symbol}/info`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLivePrices(prev => new Map(prev).set(symbol, {
        symbol,
        price:     data.price,
        changePct: data.change_pct,
        loading:   false,
      }));
    } catch {
      setLivePrices(prev => {
        const m = new Map(prev);
        m.delete(symbol);
        return m;
      });
    }
  }, []);

  // ── Auto-load prices for open positions ────────────────────────────────────
  useEffect(() => {
    if (!mounted) return;
    portfolio.positions.forEach(p => loadPrice(p.symbol));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // ── Computed metrics ───────────────────────────────────────────────────────
  const positionsWithValue = portfolio.positions.map(p => {
    const lp          = livePrices.get(p.symbol);
    const currentPrice = lp?.price ?? p.avgCost;
    const marketValue  = currentPrice * p.shares;
    const unrealizedPnl = (currentPrice - p.avgCost) * p.shares;
    const pnlPct       = ((currentPrice / p.avgCost) - 1) * 100;
    return { ...p, currentPrice, marketValue, unrealizedPnl, pnlPct, loading: lp?.loading ?? false };
  });

  const totalMarketValue = positionsWithValue.reduce((s, p) => s + p.marketValue, 0);
  const totalUnrealized  = positionsWithValue.reduce((s, p) => s + p.unrealizedPnl, 0);
  const totalValue       = portfolio.cash + totalMarketValue;
  const totalPnl         = totalValue - STARTING_CASH;
  const totalPnlPct      = (totalPnl / STARTING_CASH) * 100;
  const realizedPnl      = portfolio.trades
    .filter(t => t.type === "sell" && t.pnl !== undefined)
    .reduce((s, t) => s + (t.pnl ?? 0), 0);
  const winTrades        = portfolio.trades.filter(t => t.type === "sell" && (t.pnl ?? 0) > 0).length;
  const totalSells       = portfolio.trades.filter(t => t.type === "sell").length;
  const winRate          = totalSells ? ((winTrades / totalSells) * 100).toFixed(0) : "—";

  if (!mounted) return <div className="min-h-screen bg-zinc-950" />;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wallet className="w-6 h-6 text-emerald-400" />
              Sanal Portföy
            </h1>
            <p className="text-zinc-500 text-sm mt-0.5">
              Gerçek para olmadan al-sat simülasyonu • Başlangıç: {fmt(STARTING_CASH)} ₺
            </p>
          </div>
          <button onClick={() => setShowReset(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-2 bg-zinc-800 border border-zinc-700 hover:border-red-500/50 hover:text-red-400 rounded-xl transition-all text-zinc-400">
            <Trash2 className="w-3.5 h-3.5" />
            Sıfırla
          </button>
        </div>

        {/* Reset confirm */}
        {showReset && (
          <div className="bg-red-950/30 border border-red-900/40 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
            <p className="text-sm text-red-300">Tüm işlemler ve pozisyonlar silinecek. Emin misin?</p>
            <div className="flex gap-2">
              <button onClick={() => setShowReset(false)}
                className="text-xs px-4 py-2 bg-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors">
                İptal
              </button>
              <button onClick={() => { reset(); setShowReset(false); setLivePrices(new Map()); }}
                className="text-xs px-4 py-2 bg-red-600 hover:bg-red-500 rounded-xl text-white font-bold transition-colors">
                Evet, Sıfırla
              </button>
            </div>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Toplam Portföy Değeri"
            value={`${fmt(totalValue)} ₺`}
            sub={`Başlangıç: ${fmt(STARTING_CASH)} ₺`}
            color={totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}
          />
          <StatCard
            label="Toplam K/Z"
            value={`${totalPnl >= 0 ? "+" : ""}${fmt(totalPnl)} ₺`}
            sub={fmtPct(totalPnlPct)}
            color={totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}
          />
          <StatCard
            label="Mevcut Nakit"
            value={`${fmt(portfolio.cash)} ₺`}
            sub={`${((portfolio.cash / totalValue) * 100).toFixed(0)}% nakit`}
          />
          <StatCard
            label="Gerçekleşen K/Z"
            value={`${realizedPnl >= 0 ? "+" : ""}${fmt(realizedPnl)} ₺`}
            sub={`Kazanma Oranı: ${winRate}%`}
            color={realizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}
          />
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left: Trade Panel */}
          <div className="lg:col-span-1">
            <TradePanel
              cash={portfolio.cash}
              positions={portfolio.positions}
              livePrices={livePrices}
              onBuy={buy}
              onSell={sell}
              loadPrice={loadPrice}
            />
          </div>

          {/* Right: Positions + History */}
          <div className="lg:col-span-2 space-y-4">

            {/* Tabs */}
            <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
              {([
                { key: "positions", label: "Pozisyonlar", icon: BarChart2 },
                { key: "history",   label: "İşlem Geçmişi", icon: History  },
              ] as const).map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={cn("flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg transition-all",
                    activeTab === tab.key ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300")}>
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {tab.key === "positions" && portfolio.positions.length > 0 && (
                    <span className="bg-zinc-600 text-zinc-300 text-[9px] px-1.5 rounded-full">
                      {portfolio.positions.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Positions tab */}
            {activeTab === "positions" && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                {positionsWithValue.length === 0 ? (
                  <div className="text-center py-16">
                    <BarChart2 className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                    <p className="text-zinc-500 text-sm">Henüz açık pozisyon yok</p>
                    <p className="text-zinc-700 text-xs mt-1">Sol panelden işlem yaparak başla</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-zinc-800 text-zinc-500">
                          <th className="text-left px-5 py-3 font-medium">Hisse</th>
                          <th className="text-right px-4 py-3 font-medium">Adet</th>
                          <th className="text-right px-4 py-3 font-medium">Ort. Maliyet</th>
                          <th className="text-right px-4 py-3 font-medium">Güncel Fiyat</th>
                          <th className="text-right px-4 py-3 font-medium">Piyasa Değeri</th>
                          <th className="text-right px-5 py-3 font-medium">K/Z</th>
                        </tr>
                      </thead>
                      <tbody>
                        {positionsWithValue.map(pos => (
                          <tr key={pos.symbol}
                            className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                            <td className="px-5 py-3">
                              <Link href={`/symbol/${pos.symbol}`}
                                className="font-bold text-white hover:text-blue-400 transition-colors">
                                {pos.symbol}
                              </Link>
                              <div className="text-zinc-600 text-[10px] mt-0.5">
                                Toplam Maliyet: {fmt(pos.totalCost)} ₺
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-zinc-300 font-mono">
                              {pos.shares}
                            </td>
                            <td className="px-4 py-3 text-right text-zinc-400 font-mono">
                              {fmt(pos.avgCost)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {pos.loading ? (
                                <RefreshCw className="w-3 h-3 animate-spin text-zinc-600 ml-auto" />
                              ) : (
                                <span className="text-white font-mono">{fmt(pos.currentPrice)}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-zinc-300 font-mono">
                              {fmt(pos.marketValue)}
                            </td>
                            <td className="px-5 py-3 text-right">
                              <div className={cn("font-bold font-mono", pos.unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                                {pos.unrealizedPnl >= 0 ? "+" : ""}{fmt(pos.unrealizedPnl)}
                              </div>
                              <div className={cn("text-[10px] flex items-center justify-end gap-0.5",
                                pos.pnlPct >= 0 ? "text-emerald-500" : "text-red-500")}>
                                {pos.pnlPct >= 0 ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                                {Math.abs(pos.pnlPct).toFixed(2)}%
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-zinc-700 bg-zinc-950/50">
                          <td colSpan={4} className="px-5 py-3 text-zinc-500 text-xs font-semibold">
                            Toplam Açık Pozisyon
                          </td>
                          <td className="px-4 py-3 text-right text-white font-bold font-mono text-xs">
                            {fmt(totalMarketValue)} ₺
                          </td>
                          <td className={cn("px-5 py-3 text-right font-bold font-mono text-xs",
                            totalUnrealized >= 0 ? "text-emerald-400" : "text-red-400")}>
                            {totalUnrealized >= 0 ? "+" : ""}{fmt(totalUnrealized)} ₺
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* History tab */}
            {activeTab === "history" && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                {portfolio.trades.length === 0 ? (
                  <div className="text-center py-16">
                    <History className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                    <p className="text-zinc-500 text-sm">Henüz işlem yapılmadı</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800/50 max-h-[480px] overflow-y-auto">
                    {portfolio.trades.slice(0, 50).map(trade => (
                      <div key={trade.id} className="flex items-center gap-4 px-5 py-3 hover:bg-zinc-800/30 transition-colors">
                        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                          trade.type === "buy" ? "bg-emerald-500/15" : "bg-red-500/15")}>
                          {trade.type === "buy"
                            ? <TrendingUp className="w-4 h-4 text-emerald-400" />
                            : <TrendingDown className="w-4 h-4 text-red-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{trade.symbol}</span>
                            <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                              trade.type === "buy"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-red-500/15 text-red-400")}>
                              {trade.type === "buy" ? "AL" : "SAT"}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {trade.shares} adet × {fmt(trade.price)} ₺
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-white tabular-nums">{fmt(trade.total)} ₺</p>
                          {trade.pnl !== undefined && (
                            <p className={cn("text-xs font-mono", trade.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                              {trade.pnl >= 0 ? "+" : ""}{fmt(trade.pnl)} ₺
                            </p>
                          )}
                          <p className="text-[10px] text-zinc-600 mt-0.5">
                            {new Date(trade.timestamp).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Leaderboard hint */}
            {totalPnl > 0 && (
              <div className="bg-gradient-to-r from-yellow-950/30 to-amber-950/20 border border-yellow-900/30 rounded-2xl px-5 py-4 flex items-center gap-3">
                <Trophy className="w-6 h-6 text-yellow-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-yellow-300">
                    Portföyün %{fmtPct(totalPnlPct)} getiri sağlıyor!
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Gerçek para yatırmadan önce strateji geliştirmeye devam et.
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
