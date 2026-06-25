"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

// ── Competitor table data ─────────────────────────────────────────────────────
const COMPARE = [
  { feature: "Teknik analiz (RSI, MACD, EMA…)",   tv: true,     midas: true,     matriks: true,     us: true  },
  { feature: "Senaryo bandı — 3 olasılık",         tv: false,    midas: false,    matriks: false,    us: true  },
  { feature: "Belirsizlik endeksi",                tv: false,    midas: false,    matriks: false,    us: true  },
  { feature: "Neden / Neden olabilir zinciri",     tv: false,    midas: false,    matriks: false,    us: true  },
  { feature: "Sosyal sinyal + bot tespiti",        tv: false,    midas: false,    matriks: false,    us: true  },
  { feature: "Yapay zeka asistanı",                tv: false,    midas: false,    matriks: false,    us: true  },
  { feature: "Geçmiş olay analizi",                tv: false,    midas: false,    matriks: "kısmen", us: true  },
  { feature: "Risk motoru (stop / hedef / R/R)",   tv: "kısmen", midas: true,     matriks: "kısmen", us: true  },
  { feature: "Haber + teknik entegrasyonu",        tv: false,    midas: false,    matriks: "kısmen", us: true  },
  { feature: "Türkçe, ücretsiz, web + mobil",      tv: false,    midas: false,    matriks: false,    us: true  },
];

const FEATURES = [
  {
    icon: "📊",
    title: "Senaryo Bandı",
    desc: "Tek fiyat tahmini yerine boğa / baz / ayı senaryoları ve her birinin gerçekleşme olasılığı. En kötü ihtimali önceden görürsün.",
    tag: "Analysight'e özgü",
  },
  {
    icon: "❓",
    title: "Neden Zinciri",
    desc: "Hisse %5 düştü — neden? Platform teknik kırılım, haber ve sosyal sinyali birleştirerek anlaşılır bir açıklama üretir.",
    tag: "Analysight'e özgü",
  },
  {
    icon: "⚡",
    title: "Risk Motoru",
    desc: "Stop-loss, hedef fiyat ve R/R oranı her varlık için otomatik hesaplanır. R/R < 1.8 olan sinyaller geçersiz sayılır.",
    tag: "Aktif",
  },
  {
    icon: "🤖",
    title: "AI Analist",
    desc: "10 farklı Claude analiz modu: Wall Street yorumu, risk haritası, bear/bull case, senaryo gerekçesi. Bağlam bilerek yanıt verir.",
    tag: "Claude AI",
  },
  {
    icon: "📰",
    title: "Haber + KAP",
    desc: "GDELT ve NewsAPI entegrasyonu. Her haber kategori etiketi taşır (Bilanço, Makro, Jeopolitik…) ve tipik fiyat etkisi gösterilir.",
    tag: "Gerçek veri",
  },
  {
    icon: "🔬",
    title: "Backtest",
    desc: "MA cross, RSI ve Bollinger stratejilerini geçmiş veriye uygula. Equity curve, Sharpe oranı ve max drawdown hesaplanır.",
    tag: "Aktif",
  },
  {
    icon: "💼",
    title: "Portföy AI",
    desc: "Konsantrasyon riski, korelasyon uyarısı, P&L takibi. Claude tüm portföyü okuyarak stratejik yorum üretir.",
    tag: "Aktif",
  },
  {
    icon: "⚙️",
    title: "HUD Terminal",
    desc: "Sci-fi arayüz, Finnhub canlı veri, sesli Türkçe alarm sistemi. Birden fazla hisseyi radyal göstergelerle takip et.",
    tag: "Aktif",
  },
];

const MARKETS = ["BIST 100", "NASDAQ", "NYSE", "S&P 500", "Kripto", "Emtia"];

function Cell({ val }: { val: boolean | string }) {
  if (val === true)  return <span className="text-emerald-400 font-bold text-base">✓</span>;
  if (val === false) return <span className="text-zinc-700 text-base">—</span>;
  return <span className="text-amber-500 text-xs">{val}</span>;
}

// ── Animated ticker ───────────────────────────────────────────────────────────
const TICKERS = [
  { sym: "THYAO", chg: "+1.23%" }, { sym: "AAPL", chg: "+0.87%" },
  { sym: "GARAN", chg: "-0.42%" }, { sym: "NVDA", chg: "+3.21%" },
  { sym: "BTC",   chg: "+2.18%" }, { sym: "EREGL", chg: "+0.65%" },
  { sym: "MSFT",  chg: "+1.04%" }, { sym: "ETH",   chg: "-0.93%" },
];

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="min-h-screen bg-zinc-950 text-white overflow-x-hidden">

      {/* ── Minimal nav ──────────────────────────────────────────────────── */}
      <nav className="border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-white text-lg tracking-tight">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="11" r="9" stroke="rgba(255,255,255,.15)" strokeWidth="1.5"/>
              <circle cx="11" cy="11" r="9" stroke="#3b82f6" strokeWidth="1.5"
                strokeDasharray="32 26" strokeLinecap="round" transform="rotate(-90 11 11)"/>
              <circle cx="11" cy="11" r="4" stroke="rgba(255,255,255,.08)" strokeWidth="1"/>
              <circle cx="11" cy="11" r="2" fill="#3b82f6"/>
            </svg>
            Analysight
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-zinc-400">
            <a href="#features" className="hover:text-white transition-colors">Özellikler</a>
            <a href="#compare"  className="hover:text-white transition-colors">Karşılaştırma</a>
            <a href="#b2b"      className="hover:text-white transition-colors">Kurumsal</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login"
              className="text-sm text-zinc-400 hover:text-white transition-colors px-3 py-1.5">
              Giriş Yap
            </Link>
            <Link href="/auth/register"
              className="text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg transition-colors">
              Ücretsiz Başla
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Ticker strip ─────────────────────────────────────────────────── */}
      <div className="bg-zinc-900/50 border-b border-zinc-800/40 overflow-hidden">
        <div className="flex gap-6 px-4 py-1.5 whitespace-nowrap text-[11px] font-mono animate-none">
          {[...TICKERS, ...TICKERS].map((t, i) => (
            <span key={i} className="flex items-center gap-1.5 shrink-0">
              <span className="text-zinc-400">{t.sym}</span>
              <span className={t.chg.startsWith("+") ? "text-emerald-400" : "text-red-400"}>{t.chg}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-20 pb-24 px-6 overflow-hidden">
        {/* Grid bg */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.018)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-600/8 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-700 text-zinc-400 text-xs px-3 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            Beta · Ücretsiz Erişim Açık
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight tracking-tight mb-6">
            Türkiye'nin cebindeki<br />
            <span className="text-blue-400">Wall Street analisti</span>
          </h1>

          <p className="text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-8">
            Teknik analiz, AI yorumu, senaryo bandı ve risk motoru tek ekranda.
            Veri göstermez — <strong className="text-white">karar üretir.</strong>
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
            <Link href="/auth/register"
              className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-blue-500/20 text-sm">
              Ücretsiz Hesap Aç →
            </Link>
            <Link href="/kesfet"
              className="w-full sm:w-auto px-6 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white font-medium rounded-xl transition-all text-sm">
              Demo'ya Bak
            </Link>
          </div>

          {/* Markets row */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {MARKETS.map(m => (
              <span key={m} className="text-xs text-zinc-600 border border-zinc-800 px-2.5 py-1 rounded-full">
                {m}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3 Problems ───────────────────────────────────────────────────── */}
      <section className="py-16 px-6 bg-zinc-900/30 border-y border-zinc-800/50">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-xs font-semibold text-blue-400 tracking-widest uppercase mb-3">Çözdüğümüz Problemler</p>
          <h2 className="text-2xl font-bold text-white text-center mb-10">Neden farklıyız?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: "📊",
                title: "Veri Dağınıklığı",
                problem: "Fiyat için uygulama, haber için site, sosyal medya ayrı. Kararı zihninde sentezlemek saatler alıyor.",
                solution: "Fiyat, haber, sosyal ilgi, makro ve teknik analiz tek ekranda, birbirine bağlı.",
              },
              {
                icon: "🎯",
                title: "Tek Fiyat Yanılgısı",
                problem: '"Biri 200 diyor, biri 180." Tek tahmin belirsizliği gizler, hedef tutmadığında ne yapacağını bilemezsin.',
                solution: "3 senaryo bandı + olasılık + belirsizlik endeksi. En kötü ihtimali önceden görürsün.",
              },
              {
                icon: "❓",
                title: '"Neden?" Sorusu',
                problem: "Hisse %5 düştü, neden? Devam edecek mi? Klasik araçlar fiyatı gösterir, nedeni açıklamaz.",
                solution: "Otomatik neden zinciri: teknik kırılım + haber + sosyal sinyal birleşik açıklama.",
              },
            ].map(p => (
              <div key={p.title} className="rounded-2xl bg-zinc-900 border border-zinc-800 p-6">
                <span className="text-2xl mb-4 block">{p.icon}</span>
                <h3 className="font-semibold text-white mb-2">{p.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed mb-4">{p.problem}</p>
                <div className="border-t border-zinc-800 pt-3">
                  <p className="text-sm text-emerald-400 font-medium leading-relaxed">→ {p.solution}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features grid ────────────────────────────────────────────────── */}
      <section id="features" className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-xs font-semibold text-blue-400 tracking-widest uppercase mb-3">Platform</p>
          <h2 className="text-2xl font-bold text-white text-center mb-10">25+ Analiz Aracı</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map(f => (
              <div key={f.title}
                className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 hover:border-zinc-700 transition-colors group">
                <div className="text-2xl mb-3">{f.icon}</div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-white text-sm">{f.title}</h3>
                  <span className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0",
                    f.tag === "Analysight'e özgü"
                      ? "bg-blue-500/15 text-blue-400 border border-blue-500/20"
                      : f.tag === "Claude AI"
                      ? "bg-purple-500/15 text-purple-400 border border-purple-500/20"
                      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15"
                  )}>
                    {f.tag}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Competitor comparison ─────────────────────────────────────────── */}
      <section id="compare" className="py-16 px-6 bg-zinc-900/30 border-y border-zinc-800/50">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-xs font-semibold text-blue-400 tracking-widest uppercase mb-3">Karşılaştırma</p>
          <h2 className="text-2xl font-bold text-white text-center mb-2">Rakiplere Göre</h2>
          <p className="text-zinc-500 text-sm text-center mb-8">
            Analysight grafik platformu değil, karar destek katmanıdır.
          </p>
          <div className="rounded-2xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900">
                  <th className="text-left px-5 py-4 text-zinc-400 font-medium">Özellik</th>
                  <th className="text-center px-4 py-4 text-zinc-500 font-medium text-xs">TradingView</th>
                  <th className="text-center px-4 py-4 text-zinc-500 font-medium text-xs">Midas</th>
                  <th className="text-center px-4 py-4 text-zinc-500 font-medium text-xs">Matriks</th>
                  <th className="text-center px-4 py-4 text-blue-400 font-bold text-xs">Analysight</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row, i) => (
                  <tr key={row.feature}
                    className={cn("border-b border-zinc-800/50 last:border-0",
                      i % 2 === 0 ? "bg-zinc-950/40" : "bg-zinc-900/20")}>
                    <td className="px-5 py-3 text-zinc-300 text-xs">{row.feature}</td>
                    <td className="px-4 py-3 text-center"><Cell val={row.tv} /></td>
                    <td className="px-4 py-3 text-center"><Cell val={row.midas} /></td>
                    <td className="px-4 py-3 text-center"><Cell val={row.matriks} /></td>
                    <td className="px-4 py-3 text-center"><Cell val={row.us} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── B2B teaser ───────────────────────────────────────────────────── */}
      <section id="b2b" className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-3xl border border-zinc-700 bg-gradient-to-br from-zinc-900 to-zinc-950 p-8 md:p-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-72 h-72 bg-blue-600/5 blur-[80px] rounded-full pointer-events-none" />
            <div className="relative">
              <span className="inline-block text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full mb-4">
                Kurumsal · Yakında
              </span>
              <h2 className="text-2xl font-bold text-white mb-4">
                İşletmeniz için özel karar desteği
              </h2>
              <p className="text-zinc-400 leading-relaxed mb-6 max-w-xl">
                Hammaddeye bağımlı üreticiler, tedarik zinciri firmaları ve al-sat yapan işletmeler için:
                pamuk, enerji, metal fiyat tahmini; ERP entegrasyonu; nakit akışı projeksiyonu ve
                tedarik zinciri zincirleme risk analizi.
              </p>
              <div className="grid sm:grid-cols-3 gap-4 mb-8">
                {[
                  { icon: "🏭", title: "Hammadde Takibi", desc: "ICE, CME, LME vadeli fiyatlar" },
                  { icon: "⛓", title: "Tedarik Zinciri", desc: "Zincirleme etki & erken uyarı" },
                  { icon: "💰", title: "Nakit Akışı", desc: "Kur riski & likidite tahmini" },
                ].map(b => (
                  <div key={b.title} className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
                    <span className="text-xl mb-2 block">{b.icon}</span>
                    <p className="text-sm font-semibold text-white">{b.title}</p>
                    <p className="text-xs text-zinc-500 mt-1">{b.desc}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <Link href="/auth/register"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition-colors">
                  Erken Erişim Kaydı
                </Link>
                <span className="text-xs text-zinc-600">veya info@analysight.com</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <span className="font-bold text-white">Analysight</span>
            <span>·</span>
            <span>Finansal Karar Destek Platformu</span>
          </div>
          <p className="text-xs text-zinc-700 text-center max-w-sm">
            Sunulan tüm analizler yalnızca bilgilendirme amaçlıdır. Yatırım tavsiyesi değildir.
            Geçmiş performans gelecekteki sonuçların garantisi değildir.
          </p>
          <div className="flex items-center gap-4 text-xs text-zinc-600">
            <Link href="/kesfet" className="hover:text-zinc-400 transition-colors">Uygulamaya Gir</Link>
            <Link href="/auth/login" className="hover:text-zinc-400 transition-colors">Giriş</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
