"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart2, ChevronDown, Globe2, LineChart, Zap, BookOpen, Star, Compass, Sun, Moon, User, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { SymbolSearch } from "@/components/dashboard/SymbolSearch";
import { NotificationCenter } from "@/components/ui/NotificationCenter";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

const NAV_GROUPS = [
  {
    label: "Piyasa",
    icon: Globe2,
    links: [
      { href: "/kesfet",    label: "Keşfet",          desc: "Bugünün fırsatlarını & fırsat radarı" },
      { href: "/scanner",   label: "Tarayıcı",        desc: "RSI, momentum ile fırsat tara" },
      { href: "/news",      label: "Haberler",        desc: "Gerçek zamanlı haber & KAP akışı" },
      { href: "/calendar",  label: "Ekonomik Takvim", desc: "TCMB, Fed, CPI, GDP takvimi" },
      { href: "/heatmap",   label: "Isı Haritası",    desc: "Sektör bazlı piyasa görünümü" },
      { href: "/crypto",    label: "Kripto",          desc: "BTC, ETH ve DeFi takibi" },
    ],
  },
  {
    label: "Analiz",
    icon: LineChart,
    links: [
      { href: "/analyst",      label: "AI Analist",     desc: "Claude ile derinlemesine analiz" },
      { href: "/reports",      label: "Raporlar",       desc: "Kazanç, DCF, Quant raporu" },
      { href: "/correlation",  label: "Korelasyon",     desc: "Portföy çeşitlilik matrisi" },
      { href: "/compare",      label: "Karşılaştırma",  desc: "Hisseleri yan yana karşılaştır" },
      { href: "/earnings",     label: "Kazançlar",      desc: "EPS, gelir, tahmin takibi" },
      { href: "/model",        label: "Model Builder",  desc: "DCF & çarpan değerleme" },
      { href: "/etf",          label: "ETF Analyzer",   desc: "ETF içerik & karşılaştır" },
    ],
  },
  {
    label: "Trade",
    icon: Zap,
    links: [
      { href: "/portfolio",    label: "Portföy",        desc: "P&L, dağılım ve risk takibi" },
      { href: "/portfolio-ai", label: "Portföy AI",     desc: "Claude ile portföy analizi" },
      { href: "/backtest",     label: "Backtest",       desc: "Strateji geçmiş veri testi" },
      { href: "/paper-trade",  label: "Sanal Portföy",  desc: "Gerçek para olmadan al-sat" },
      { href: "/position",     label: "Pozisyon",       desc: "Risk hesabı & lot boyutu" },
      { href: "/briefing",     label: "Sabah Brifing",  desc: "60 saniyelik günlük özet" },
    ],
  },
  {
    label: "Kurumsal",
    icon: BarChart2,
    links: [
      { href: "/enterprise",  label: "Emtia Takibi",   desc: "Hammadde fiyatları & alım zamanlama" },
      { href: "/landing#b2b", label: "B2B Planı",      desc: "Kurumsal erişim ve özel entegrasyon" },
    ],
  },
  {
    label: "Öğren",
    icon: BookOpen,
    links: [
      { href: "/learn",          label: "Yatırımcı Okulu", desc: "Borsa 101, teknik analiz, risk" },
      { href: "/learn#glossary", label: "Terim Sözlüğü",   desc: "20+ finansal terim açıklaması" },
      { href: "/research",       label: "Araştırma",       desc: "Sektör & makro analizi" },
    ],
  },
];

function NavDropdown({ group }: { group: typeof NAV_GROUPS[0] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const Icon = group.icon;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isActive = group.links.some(l => pathname === l.href);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
          isActive ? "text-white bg-zinc-800" : "text-zinc-400 hover:text-white hover:bg-zinc-800/60")}>
        <Icon className="w-3.5 h-3.5" />
        <span>{group.label}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-52 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl z-50 overflow-hidden py-1.5">
          {group.links.map(link => (
            <Link key={link.href + link.label} href={link.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex flex-col px-3 py-2.5 mx-1.5 rounded-xl transition-colors",
                pathname === link.href ? "bg-blue-600" : "hover:bg-zinc-800")}>
              <span className="text-sm font-medium text-white">{link.label}</span>
              <span className="text-[10px] text-zinc-500">{link.desc}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-8 h-8" />;

  const isDark = theme === "dark";
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Açık temaya geç" : "Koyu temaya geç"}
      className={cn(
        "p-2 rounded-lg transition-all",
        isDark
          ? "text-zinc-400 hover:text-amber-400 hover:bg-zinc-800"
          : "text-zinc-500 hover:text-blue-600 hover:bg-zinc-800/60"
      )}>
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

function UserMenu() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (!user) {
    return (
      <Link href="/auth/login"
        className="hidden md:flex items-center gap-1.5 text-xs px-3 py-1.5 bg-zinc-800 border border-zinc-700 hover:border-zinc-600 text-zinc-400 hover:text-white rounded-lg transition-all">
        <User className="w-3.5 h-3.5" />
        Giriş Yap
      </Link>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
      >
        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
          {user.email?.[0]?.toUpperCase() ?? "U"}
        </div>
        <ChevronDown className="w-3 h-3 text-zinc-500" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl z-50 py-1">
          <div className="px-3 py-2 border-b border-zinc-800">
            <p className="text-xs text-zinc-400 truncate">{user.email}</p>
          </div>
          <Link href="/watchlist" onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors">
            <Star className="w-4 h-4" />
            Takip Listem
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-zinc-800 hover:text-red-300 transition-colors">
            <LogOut className="w-4 h-4" />
            Çıkış Yap
          </button>
        </div>
      )}
    </div>
  );
}

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur sticky top-0 z-50">
      <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-white shrink-0 hover:opacity-80 transition-opacity">
          <BarChart2 className="w-5 h-5 text-blue-400" />
          <span>Analysight</span>
        </Link>

        {/* Search */}
        <div className="flex-1 max-w-xs">
          <SymbolSearch />
        </div>

        {/* Nav groups */}
        <nav className="hidden md:flex items-center gap-1">
          <Link href="/"
            className={cn("px-3 py-1.5 rounded-lg text-sm transition-colors",
              pathname === "/" ? "text-white bg-zinc-800" : "text-zinc-400 hover:text-white hover:bg-zinc-800/60")}>
            Ana Sayfa
          </Link>
          <Link href="/kesfet"
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
              pathname === "/kesfet"
                ? "text-amber-400 bg-amber-500/10"
                : "text-zinc-400 hover:text-amber-400 hover:bg-zinc-800/60")}>
            <Compass className="w-3.5 h-3.5" />
            Keşfet
          </Link>
          {NAV_GROUPS.map(g => <NavDropdown key={g.label} group={g} />)}
        </nav>

        {/* Watchlist shortcut */}
        <Link href="/watchlist"
          className={cn("hidden md:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all shrink-0",
            pathname === "/watchlist"
              ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-400"
              : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-white")}>
          <Star className="w-3.5 h-3.5" />
          Takip
        </Link>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* User Menu */}
        <UserMenu />

        {/* Notification Center */}
        <NotificationCenter />

        {/* Terminal CTA */}
        <Link href="/terminal"
          className="hidden md:flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors shrink-0">
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          Terminal
        </Link>
      </div>

      {/* Ana Döngü hint — only on homepage */}
      {pathname === "/" && (
        <div className="bg-zinc-900 border-b border-zinc-800/50">
          <div className="max-w-screen-xl mx-auto px-4 py-1 flex items-center justify-center gap-1.5 text-[10px] text-zinc-600">
            <span className="text-blue-600">Hisse Ara</span>
            <span className="text-zinc-700">→</span>
            <span className="text-purple-600">Analiz Et</span>
            <span className="text-zinc-700">→</span>
            <span className="text-yellow-600">Takip Et</span>
            <span className="text-zinc-700">→</span>
            <span className="text-orange-600">Bildirim Al</span>
            <span className="text-zinc-700">→</span>
            <span className="text-emerald-600">Karar Ver</span>
          </div>
        </div>
      )}
    </header>
  );
}
