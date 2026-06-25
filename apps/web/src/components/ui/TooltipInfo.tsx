"use client";

import { useState, useRef, useEffect } from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  content: string;
  /** Opsiyonel başlık */
  title?: string;
  /** Pozisyon: default sağ, "left" | "top" | "bottom" */
  side?: "right" | "left" | "top" | "bottom";
  className?: string;
  /** İkon boyutu */
  size?: "sm" | "md";
}

export function TooltipInfo({ content, title, side = "right", className, size = "sm" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Click dışına tıklayınca kapat
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const posClass = {
    right:  "left-full top-1/2 -translate-y-1/2 ml-2",
    left:   "right-full top-1/2 -translate-y-1/2 mr-2",
    top:    "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  }[side];

  return (
    <div ref={ref} className={cn("relative inline-flex items-center", className)}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className={cn(
          "rounded-full transition-colors flex items-center justify-center shrink-0",
          open ? "text-blue-400" : "text-zinc-600 hover:text-zinc-400",
        )}
        aria-label="Açıklama">
        <HelpCircle className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} />
      </button>

      {open && (
        <div className={cn(
          "absolute z-50 w-56 rounded-xl bg-zinc-800 border border-zinc-700 shadow-2xl shadow-black/60 p-3",
          posClass,
        )}>
          {title && (
            <p className="text-[11px] font-bold text-white mb-1.5">{title}</p>
          )}
          <p className="text-[11px] text-zinc-300 leading-relaxed">{content}</p>
          {/* Arrow */}
          <div className={cn(
            "absolute w-2 h-2 bg-zinc-800 border-zinc-700 rotate-45",
            side === "right"  && "-left-1 top-1/2 -translate-y-1/2 border-b border-l",
            side === "left"   && "-right-1 top-1/2 -translate-y-1/2 border-t border-r",
            side === "top"    && "-bottom-1 left-1/2 -translate-x-1/2 border-b border-r",
            side === "bottom" && "-top-1 left-1/2 -translate-x-1/2 border-t border-l",
          )} />
        </div>
      )}
    </div>
  );
}

// ── Hazır açıklama seti — tüm uygulamada ortak kullanım ───────────────────────
export const TIPS = {
  rsi: {
    title: "RSI (Göreceli Güç Endeksi)",
    content: "0-100 arası değer. 30'un altı aşırı satılmış (alım fırsatı olabilir), 70'in üstü aşırı alınmış (kâr satışı riski). 50 nötr bölgedir.",
  },
  macd: {
    title: "MACD",
    content: "İki hareketli ortalamanın farkı. MACD çizgisi sinyal çizgisini yukarı keserse yükseliş sinyali, aşağı keserse düşüş sinyali üretir.",
  },
  ema20: {
    title: "EMA 20 (20 Günlük Hareketli Ortalama)",
    content: "Son 20 günün ağırlıklı ortalama fiyatı. Kısa vadeli trendin yönünü gösterir. Fiyat EMA20 üzerindeyse kısa vade olumlu.",
  },
  ema50: {
    title: "EMA 50 (50 Günlük Hareketli Ortalama)",
    content: "Orta vadeli trend göstergesi. EMA20, EMA50'yi yukarı keserse 'Altın Çapraz' — güçlü yükseliş sinyali sayılır.",
  },
  ema200: {
    title: "EMA 200 (200 Günlük Hareketli Ortalama)",
    content: "Uzun vadeli trendin ana filtresi. Fiyat EMA200 üzerindeyse piyasa boğa trendinde, altındaysa ayı trendinde sayılır.",
  },
  bb: {
    title: "Bollinger Bantları",
    content: "Fiyatın etrafındaki üst ve alt bant. Alt banda yaklaşmak aşırı satılmışlığa, üst banda yaklaşmak aşırı alınmışlığa işaret edebilir.",
  },
  atr: {
    title: "ATR (Gerçek Aralık Ortalaması)",
    content: "Hissenin ortalama günlük fiyat dalgalanması. Yüksek ATR = yüksek volatilite. Stop-loss seviyeleri belirlemede kullanılır.",
  },
  adx: {
    title: "ADX (Ortalama Yön Endeksi)",
    content: "Trendin gücünü ölçer (0-100). 25 altı trendsiz, 25-50 orta güçlü trend, 50 üstü güçlü trend anlamına gelir. Yön söylemez, güç söyler.",
  },
  stoch: {
    title: "Stokastik Osilatör",
    content: "Fiyatın son dönemdeki aralığa göre nerede olduğunu gösterir. 20 altı aşırı satılmış, 80 üstü aşırı alınmış bölgedir.",
  },
  vwap: {
    title: "VWAP (Hacim Ağırlıklı Ortalama Fiyat)",
    content: "Gün içinde işlem hacmiyle ağırlıklandırılmış ortalama fiyat. Kurumsal yatırımcılar referans alır. Fiyat VWAP üstündeyse güçlü.",
  },
  williamsR: {
    title: "Williams %R",
    content: "RSI'ya benzer momentum göstergesi. -80 altı aşırı satılmış, -20 üstü aşırı alınmış bölge. -50 civarı nötr.",
  },
  score: {
    title: "Fırsat Skoru",
    content: "RSI, MACD, hareketli ortalamalar ve senaryo olasılıklarını birleştiren Analysight'a özel 0-100 skoru. 65+ olumlu, 40 altı zayıf.",
  },
  target: {
    title: "Hedef Fiyat",
    content: "ATR tabanlı hesaplanan ilk kâr alma seviyesi. Risk/getiri oranı hesaplamada kullanılır. Kesin garanti değil, olasılıksal tahmindir.",
  },
  stopLoss: {
    title: "Stop-Loss (Zararı Durdur)",
    content: "Pozisyon bu seviyenin altına düşerse zararı sınırlamak için çıkış noktası. ATR'ın 1.5 katı uzaklıkta belirlenir.",
  },
  rr: {
    title: "Risk/Getiri Oranı (R/R)",
    content: "Potansiyel kazancın riske oranı. 2x = 1 birim riske 2 birim kazanç. Profesyonel yatırımcılar genellikle en az 2x talep eder.",
  },
  confluence: {
    title: "Sinyal Uyumu",
    content: "Birden fazla teknik göstergenin aynı yönü işaret etme oranı. Yüksek uyum = sinyale güven artar. Düşük uyum = çelişkili tablo.",
  },
  bullProb: {
    title: "Yükseliş Olasılığı",
    content: "Monte Carlo simülasyonu ile hesaplanan 28 günlük yükseliş senaryosu ihtimali. %50 üstü yükseliş lehinde.",
  },
  uncertainty: {
    title: "Belirsizlik Endeksi",
    content: "Senaryo tahminlerinin ne kadar güvenilir olduğunu gösterir. Yüksek belirsizlik = tahminlere daha az güven, pozisyon büyüklüğünü sınırla.",
  },
  beta: {
    title: "Beta",
    content: "Hissenin piyasaya göre duyarlılığı. Beta 1 = piyasayla aynı hareket, 1.5 = piyasa %10 düşerse hisse ~%15 düşer, 0.7 = daha az etkilenir.",
  },
  pe: {
    title: "F/K Oranı (Fiyat/Kazanç)",
    content: "Hisse fiyatının yıllık kazanca oranı. Sektör ortalamasından yüksekse pahalı, düşükse ucuz olarak yorumlanabilir. Bağlam önemlidir.",
  },
  roe: {
    title: "Özsermaye Getirisi (ROE)",
    content: "Şirketin özsermayesiyle ne kadar kâr ürettiğini gösterir. Yüksek ROE = yönetim verimliliği iyi. Sektöre göre karşılaştırılmalıdır.",
  },
  macdHistogram: {
    title: "MACD Histogramı",
    content: "MACD ile sinyal çizgisi arasındaki fark. Çubuklar büyüyorsa momentum artıyor, küçülüyorsa zayıflıyor demektir.",
  },
  sector: {
    title: "Sektör",
    content: "Şirketin faaliyet gösterdiği endüstri. Aynı sektördeki hisseler genellikle birbirine benzer hareket eder — diversifikasyon için farklı sektörlere yay.",
  },
  concentration: {
    title: "Konsantrasyon Riski",
    content: "Portföyün tek bir hisseye veya sektöre ne kadar bağımlı olduğu. Tek pozisyon %40'ı geçerse risk yüksek sayılır.",
  },
  weightedBeta: {
    title: "Ağırlıklı Beta",
    content: "Tüm portföyün piyasaya duyarlılığı. 1.5 = piyasa %10 düşerse portföy yaklaşık %15 düşer. Kripto ağırlıklı portföylerde çok yüksek olur.",
  },
} as const;
