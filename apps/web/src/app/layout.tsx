import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/layout/Navbar";
import { FinancialAssistant } from "@/components/layout/FinancialAssistant";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Analysight — Veriye Bakarak Karar Ver",
  description: "AI destekli finansal karar destek platformu. Teknik analiz, senaryo bandı ve risk motoru.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className={`${inter.className} bg-gray-950 text-gray-100 min-h-screen transition-colors duration-200`}>
        <Providers>
          <Navbar />
          <main className="max-w-screen-xl mx-auto px-4 py-6">{children}</main>
          <FinancialAssistant />
        </Providers>
      </body>
    </html>
  );
}
