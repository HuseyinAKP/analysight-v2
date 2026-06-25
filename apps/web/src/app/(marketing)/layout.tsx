import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analysight — Türkiye'nin AI Destekli Finansal Karar Platformu",
  description: "Teknik analiz, senaryo bandı, neden zinciri ve risk motoru tek ekranda. TradingView'dan farkı: veri göstermez, karar üretir.",
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
