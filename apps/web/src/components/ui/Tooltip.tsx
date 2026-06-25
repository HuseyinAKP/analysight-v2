"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({ content, children, side = "top" }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setVisible(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const posClass = {
    top:    "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left:   "right-full top-1/2 -translate-y-1/2 mr-2",
    right:  "left-full top-1/2 -translate-y-1/2 ml-2",
  }[side];

  return (
    <div ref={ref} className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onClick={() => setVisible(v => !v)}>
      {children}
      {visible && (
        <div className={cn(
          "absolute z-50 w-56 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl p-3 text-xs text-zinc-300 leading-relaxed pointer-events-none",
          posClass)}>
          {content}
        </div>
      )}
    </div>
  );
}

// Terminoloji sözlüğü — teknik terimler için hazır açıklamalar
export const TERM_TIPS: Record<string, React.ReactNode> = {
  RSI: (
    <span>
      <strong className="text-white">RSI (Göreceli Güç Endeksi)</strong><br/>
      0–100 arası değer alır.<br/>
      <span className="text-emerald-400">30 altı:</span> Aşırı satılmış — ucuz olabilir<br/>
      <span className="text-red-400">70 üstü:</span> Aşırı alınmış — pahalı olabilir<br/>
      <span className="text-zinc-400">Ortası:</span> Nötr bölge
    </span>
  ),
  MACD: (
    <span>
      <strong className="text-white">MACD</strong><br/>
      İki hareketli ortalamanın farkıdır. Momentum göstergesidir.<br/>
      <span className="text-emerald-400">Pozitif:</span> Yükseliş baskısı var<br/>
      <span className="text-red-400">Negatif:</span> Düşüş baskısı var
    </span>
  ),
  ADX: (
    <span>
      <strong className="text-white">ADX (Ortalama Yönsel Endeks)</strong><br/>
      Trendin <em>gücünü</em> ölçer, yönünü değil.<br/>
      <span className="text-zinc-400">0–20:</span> Trendsiz, dalgalı piyasa<br/>
      <span className="text-yellow-400">20–25:</span> Zayıf trend<br/>
      <span className="text-emerald-400">25+:</span> Güçlü trend var
    </span>
  ),
  Stochastic: (
    <span>
      <strong className="text-white">Stochastic Osilatör</strong><br/>
      Fiyatın belirli periyottaki en yüksek-en düşük aralığındaki konumunu gösterir.<br/>
      <span className="text-emerald-400">20 altı:</span> Aşırı satım (al sinyali olabilir)<br/>
      <span className="text-red-400">80 üstü:</span> Aşırı alım (sat sinyali olabilir)
    </span>
  ),
  Bollinger: (
    <span>
      <strong className="text-white">Bollinger Bantları</strong><br/>
      Fiyatın volatiliteye göre "normal aralığını" gösterir.<br/>
      Alt banda yakın → ucuz bölge olabilir<br/>
      Üst banda yakın → pahalı bölge olabilir
    </span>
  ),
  ATR: (
    <span>
      <strong className="text-white">ATR (Gerçek Aralık Ortalaması)</strong><br/>
      Bir hissenin günlük ortalama fiyat hareketini gösterir.<br/>
      Yüksek ATR = Daha volatil, daha riskli<br/>
      Düşük ATR = Daha sakin, daha stabil
    </span>
  ),
  "EPS": (
    <span>
      <strong className="text-white">EPS (Hisse Başına Kâr)</strong><br/>
      Şirketin her hisse için kazandığı net kâr miktarı.<br/>
      Yüksek ve büyüyen EPS = güçlü şirket
    </span>
  ),
  "F/K": (
    <span>
      <strong className="text-white">F/K Oranı (Fiyat/Kazanç)</strong><br/>
      Hisse fiyatının, hisse başına kâra oranıdır.<br/>
      Düşük F/K → görece ucuz olabilir<br/>
      Yüksek F/K → büyüme beklentisi yüksek veya pahalı<br/>
      Sektör ortalamasıyla kıyaslayın.
    </span>
  ),
  "EV/EBITDA": (
    <span>
      <strong className="text-white">EV/EBITDA</strong><br/>
      Şirketin toplam değerinin, faiz/vergi/amortisman öncesi kârına oranı.<br/>
      Düşük = görece ucuz, yüksek = primli değerleme
    </span>
  ),
  DCF: (
    <span>
      <strong className="text-white">DCF (İndirgenmiş Nakit Akışı)</strong><br/>
      Şirketin gelecekte üreteceği nakit akışlarını bugünkü değere çevirerek "içsel değer" hesaplayan yöntem.<br/>
      Varsayımlara çok duyarlıdır — temkinli kullanın.
    </span>
  ),
  WACC: (
    <span>
      <strong className="text-white">WACC (Ağırlıklı Ortalama Sermaye Maliyeti)</strong><br/>
      Şirketin faaliyetlerini finanse etmek için katlandığı ortalama maliyet oranı.<br/>
      DCF hesaplamasında iskonto oranı olarak kullanılır.
    </span>
  ),
  Belirsizlik: (
    <span>
      <strong className="text-white">Belirsizlik Endeksi</strong><br/>
      Analysight'ın kendi geliştirdiği 0–100 arası gösterge.<br/>
      <span className="text-emerald-400">0–40:</span> Düşük belirsizlik — daha öngörülebilir<br/>
      <span className="text-yellow-400">40–65:</span> Orta belirsizlik<br/>
      <span className="text-red-400">65+:</span> Yüksek belirsizlik — dikkatli olun
    </span>
  ),
};

// Kullanımı kolay sarmalayıcı — sadece term string'i geçin
export function TermTip({ term, children }: { term: keyof typeof TERM_TIPS; children: React.ReactNode }) {
  return (
    <Tooltip content={TERM_TIPS[term]} side="top">
      <span className="border-b border-dashed border-zinc-600 cursor-help hover:border-zinc-400 transition-colors">
        {children}
      </span>
    </Tooltip>
  );
}
