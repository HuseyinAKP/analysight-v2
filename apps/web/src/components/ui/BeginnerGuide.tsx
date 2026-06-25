"use client";

import { useState, useEffect } from "react";
import { BookOpen, ChevronDown, ChevronUp, X, Lightbulb, TrendingUp, ShieldCheck, BarChart2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    icon: <Eye className="w-4 h-4 text-blue-400" />,
    title: "1. Fiyat ve Genel Duruma Bak",
    color: "border-blue-500/20 bg-blue-500/5",
    points: [
      "En üstteki fiyat ve % değişim anlık durumu gösterir.",
      "Yeşil Fırsat Skoru ve 'Teknik Görünüm: Güçlü' → olumlu sinyal.",
      "Kırmızı görünüm → acele etme, bekle-izle modu düşün.",
    ],
  },
  {
    icon: <BarChart2 className="w-4 h-4 text-violet-400" />,
    title: "2. Grafiği Oku",
    color: "border-violet-500/20 bg-violet-500/5",
    points: [
      "Yeşil mumlar fiyat yükseldi, kırmızı mumlar düştü demektir.",
      "Altta RSI grafiği var. 30 altı yeşil bölge (aşırı satılmış), 70 üstü kırmızı bölge (aşırı alınmış).",
      "Grafik üzerindeki renkli çizgiler hareketli ortalamalar — trendin yönünü gösterir.",
    ],
  },
  {
    icon: <TrendingUp className="w-4 h-4 text-emerald-400" />,
    title: "3. Teknik Özet Tablosuna Bak",
    color: "border-emerald-500/20 bg-emerald-500/5",
    points: [
      "'Güçlü Al' veya 'Al' etiketi → birden fazla gösterge yükselişe işaret ediyor.",
      "Gauge (yarım daire gösterge) ne kadar sağa kayıksa o kadar olumlu sinyal var.",
      "Her satırın yanındaki ? ikonuna tıklarsan ne anlama geldiğini okuyabilirsin.",
    ],
  },
  {
    icon: <ShieldCheck className="w-4 h-4 text-yellow-400" />,
    title: "4. Risk Panelini Kontrol Et",
    color: "border-yellow-500/20 bg-yellow-500/5",
    points: [
      "Hedef Fiyat: bu seviyede kâr almayı düşünebilirsin.",
      "Stop-Loss: fiyat buraya düşerse zararı sınırlamak için çıkış noktası.",
      "R/R Oranı: 2x demek 1 birim riske 2 birim kazanç potansiyeli var.",
    ],
  },
  {
    icon: <Lightbulb className="w-4 h-4 text-orange-400" />,
    title: "5. AI Yorumunu Kullan",
    color: "border-orange-500/20 bg-orange-500/5",
    points: [
      "Sayfanın altındaki AI asistanına Türkçe soru sorabilirsin.",
      "'Bu hisseyi almalı mıyım?' yerine 'Teknik görünüm ne söylüyor?' diye sor — daha doğru cevap alırsın.",
      "Tüm analizler bilgi amaçlıdır. Son karar her zaman senin.",
    ],
  },
];

const STORAGE_KEY = "analysight_beginner_guide_dismissed";

export function BeginnerGuide() {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(true); // başlangıçta gizli
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const val = localStorage.getItem(STORAGE_KEY);
    // İlk kez geliyorsa otomatik aç
    if (!val) {
      setDismissed(false);
      setOpen(true);
    } else {
      setDismissed(false);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  };

  if (!mounted || dismissed) {
    // Kapatılmış ama küçük trigger buton göster
    return (
      <button
        onClick={() => { setDismissed(false); setOpen(true); }}
        className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800/50 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-all">
        <BookOpen className="w-3 h-3" />
        Sayfayı nasıl okurum?
      </button>
    );
  }

  return (
    <div className={cn(
      "rounded-2xl border overflow-hidden transition-all",
      "border-zinc-700 bg-zinc-900"
    )}>
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-zinc-800/40 transition-colors">
        <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
          <BookOpen className="w-4 h-4 text-blue-400" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-bold text-white">Yeni Başlayanlar için Hızlı Rehber</p>
          <p className="text-xs text-zinc-500">Bu sayfayı nasıl okumalısın? · 5 adımda analiz rehberi</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">YENİ</span>
          {open
            ? <ChevronUp className="w-4 h-4 text-zinc-500" />
            : <ChevronDown className="w-4 h-4 text-zinc-500" />}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3 border-t border-zinc-800">
          <p className="text-xs text-zinc-500 pt-4">
            Aşağıdaki adımları takip ederek bu sayfadaki verileri anlayabilirsin.
            Her metriğin yanındaki <span className="inline-flex items-center gap-0.5 text-zinc-400">?</span> ikonuna tıklayarak detaylı açıklama görebilirsin.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {STEPS.map((step, i) => (
              <div key={i} className={cn("rounded-xl border p-4", step.color)}>
                <div className="flex items-center gap-2 mb-2">
                  {step.icon}
                  <p className="text-xs font-bold text-zinc-200">{step.title}</p>
                </div>
                <ul className="space-y-1.5">
                  {step.points.map((pt, j) => (
                    <li key={j} className="flex items-start gap-2">
                      <span className="text-zinc-600 text-xs mt-0.5 shrink-0">·</span>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">{pt}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Disclaimer */}
          <div className="bg-zinc-800/60 rounded-xl p-3 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Analysight bir <strong className="text-zinc-400">karar destek aracıdır</strong>, yatırım tavsiyesi değildir.
              Tüm analizler geçmiş fiyat verilerine dayanır, gelecekteki fiyat hareketini garanti etmez.
              Yatırım kararı vermeden önce kendi araştırmanızı yapın.
            </p>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button onClick={dismiss}
              className="flex items-center gap-1.5 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors">
              <X className="w-3 h-3" />
              Anladım, bir daha gösterme
            </button>
            <button onClick={() => setOpen(false)}
              className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors">
              Şimdilik kapat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
