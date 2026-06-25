"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Calendar, ChevronDown, ChevronUp, Sparkles, AlertTriangle, Info } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface CalendarEvent {
  id: string;
  name: string;
  abbr: string;
  country: string;
  flag: string;
  impact: "high" | "medium" | "low";
  currency: string;
  category: string;
  date: string;
  datetime: string;
  time_tr: string;
  days_until: number;
  is_today: boolean;
  forecast: string;
  previous: string;
  actual: string | null;
  description: string;
  market_impact: string;
  sector_impacts: Record<string, string>;
}

interface CalendarData {
  events: CalendarEvent[];
  total: number;
  high_impact_count: number;
  today_count: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const IMPACT_CONFIG = {
  high:   { label: "Yüksek",  color: "text-red-400",    bg: "bg-red-500/15 border-red-500/30",       dot: "bg-red-400" },
  medium: { label: "Orta",    color: "text-yellow-400", bg: "bg-yellow-500/15 border-yellow-500/30", dot: "bg-yellow-400" },
  low:    { label: "Düşük",   color: "text-zinc-400",   bg: "bg-zinc-700 border-zinc-600",           dot: "bg-zinc-500" },
};

const COUNTRY_FILTERS = [
  { id: "all", label: "Tümü" },
  { id: "TR",  label: "Türkiye" },
  { id: "US",  label: "ABD" },
  { id: "EU",  label: "Avrupa" },
  { id: "CN",  label: "Çin" },
];

function formatDaysUntil(days: number): string {
  if (days === 0) return "Bugün";
  if (days === 1) return "Yarın";
  return `${days} gün sonra`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("tr-TR", { weekday: "short", day: "numeric", month: "short" });
}

// ── Markdown mini ─────────────────────────────────────────────────────────────
function MiniMd({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-xs leading-relaxed">
      {text.split("\n").map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        const html = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        if (line.startsWith("**") && line.endsWith("**"))
          return <p key={i} className="font-bold text-white mt-2" dangerouslySetInnerHTML={{ __html: html }} />;
        if (line.startsWith("- "))
          return <p key={i} className="text-zinc-300 pl-2">· {line.replace(/^- /, "")}</p>;
        return <p key={i} className="text-zinc-300" dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </div>
  );
}

// ── Event Card ────────────────────────────────────────────────────────────────
function EventCard({ event }: { event: CalendarEvent }) {
  const [expanded, setExpanded] = useState(event.is_today);
  const [analysis, setAnalysis] = useState<{ text: string; is_claude: boolean } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const impact = IMPACT_CONFIG[event.impact];

  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    try {
      const res = await fetch("http://localhost:8000/api/calendar/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_abbr: event.abbr,
          event_name: event.name,
          forecast: event.forecast,
          previous: event.previous,
          actual: event.actual,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setAnalysis({ text: d.analysis, is_claude: d.is_claude });
      }
    } catch {
      setAnalysis({ text: "Analiz yapılamadı. Tekrar deneyin.", is_claude: false });
    } finally {
      setAnalyzing(false);
    }
  }, [event]);

  return (
    <div className={cn(
      "border rounded-xl overflow-hidden transition-all",
      event.is_today
        ? "border-blue-500/40 bg-blue-500/5"
        : event.impact === "high"
        ? "border-red-500/20 bg-zinc-900/80"
        : "border-zinc-800 bg-zinc-900/50"
    )}>
      {/* Card header — always visible */}
      <button className="w-full text-left px-4 py-3 flex items-center gap-3" onClick={() => setExpanded(v => !v)}>

        {/* Flag + country */}
        <span className="text-xl shrink-0">{event.flag}</span>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-semibold text-white">{event.name}</span>
            {event.is_today && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                BUGÜN
              </span>
            )}
            {event.actual && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                AÇIKLANDI
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[10px] text-zinc-500">
            <span>{formatDate(event.date)} — {event.time_tr} TSİ</span>
            <span className="text-zinc-700">·</span>
            <span className={cn("font-medium", event.days_until === 0 ? "text-blue-400" : "text-zinc-500")}>
              {formatDaysUntil(event.days_until)}
            </span>
          </div>
        </div>

        {/* Impact badge */}
        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border shrink-0", impact.bg, impact.color)}>
          {impact.label}
        </span>

        {/* Beklenti / Gerçek */}
        <div className="hidden sm:flex flex-col items-end gap-0.5 text-[10px] shrink-0 w-20">
          <div className="flex items-center gap-1">
            <span className="text-zinc-600">Beklenti</span>
            <span className="font-mono text-zinc-300">{event.forecast}</span>
          </div>
          {event.actual ? (
            <div className="flex items-center gap-1">
              <span className="text-zinc-600">Gerçek</span>
              <span className={cn("font-mono font-bold",
                parseFloat(event.actual) > parseFloat(event.forecast) ? "text-red-400" : "text-emerald-400")}>
                {event.actual}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-zinc-600">Önceki</span>
              <span className="font-mono text-zinc-500">{event.previous}</span>
            </div>
          )}
        </div>

        {expanded ? <ChevronUp className="w-4 h-4 text-zinc-600 shrink-0" /> : <ChevronDown className="w-4 h-4 text-zinc-600 shrink-0" />}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-zinc-800/60 pt-3 space-y-4">

          {/* Data row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-zinc-800/50 rounded-lg p-2.5">
              <p className="text-[9px] text-zinc-500 mb-1">BEKLENTI</p>
              <p className="font-mono font-bold text-white text-sm">{event.forecast}</p>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-2.5">
              <p className="text-[9px] text-zinc-500 mb-1">ÖNCEKİ</p>
              <p className="font-mono font-bold text-zinc-300 text-sm">{event.previous}</p>
            </div>
            <div className={cn("rounded-lg p-2.5", event.actual ? "bg-blue-500/10" : "bg-zinc-800/30")}>
              <p className="text-[9px] text-zinc-500 mb-1">GERÇEK</p>
              <p className={cn("font-mono font-bold text-sm",
                event.actual
                  ? parseFloat(event.actual) > parseFloat(event.forecast) ? "text-red-400" : "text-emerald-400"
                  : "text-zinc-600")}>
                {event.actual ?? "Açıklanmadı"}
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-zinc-400 leading-relaxed">{event.description}</p>
          </div>

          {/* Market impact */}
          <div className="bg-zinc-800/40 rounded-xl p-3">
            <p className="text-[10px] text-zinc-500 uppercase mb-1.5 font-semibold">Piyasa Etkisi</p>
            <p className="text-xs text-zinc-300 leading-relaxed">{event.market_impact}</p>
          </div>

          {/* Sector impacts */}
          {Object.keys(event.sector_impacts).length > 0 && (
            <div>
              <p className="text-[10px] text-zinc-500 uppercase mb-2 font-semibold">Sektör Etkileri</p>
              <div className="space-y-1.5">
                {Object.entries(event.sector_impacts).map(([sector, impact]) => (
                  <div key={sector} className="flex items-start gap-2">
                    <span className="text-[10px] font-bold text-zinc-400 w-20 shrink-0 pt-0.5">{sector}</span>
                    <p className="text-xs text-zinc-500 flex-1">{impact}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Analysis */}
          <div className="border-t border-zinc-800 pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-xs font-semibold text-zinc-300">AI Yorumu</span>
              </div>
              <button onClick={runAnalysis} disabled={analyzing}
                className={cn(
                  "text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all",
                  analyzing
                    ? "bg-zinc-800 border-zinc-700 text-zinc-500"
                    : analysis
                    ? "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"
                    : "bg-violet-600 hover:bg-violet-500 border-violet-500 text-white"
                )}>
                {analyzing ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 border border-white border-t-transparent rounded-full animate-spin" />
                    Yorumlanıyor…
                  </span>
                ) : analysis ? "Yenile" : "AI Yorumu Al"}
              </button>
            </div>

            {analysis && !analyzing && (
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  {analysis.is_claude ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">Claude AI</span>
                  ) : (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400 border border-zinc-600">Şablon</span>
                  )}
                </div>
                <MiniMd text={analysis.text} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Impact bar ────────────────────────────────────────────────────────────────
function ImpactBar({ events }: { events: CalendarEvent[] }) {
  const high = events.filter(e => e.impact === "high").length;
  const med  = events.filter(e => e.impact === "medium").length;
  const low  = events.filter(e => e.impact === "low").length;
  const total = events.length || 1;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden flex">
        <div className="bg-red-400 h-full transition-all"    style={{ width: `${(high / total) * 100}%` }} />
        <div className="bg-yellow-400 h-full transition-all" style={{ width: `${(med  / total) * 100}%` }} />
        <div className="bg-zinc-500 h-full transition-all"   style={{ width: `${(low  / total) * 100}%` }} />
      </div>
      <div className="flex items-center gap-3 text-[10px] shrink-0">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" />{high} yüksek</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" />{med} orta</span>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const [countryFilter, setCountryFilter] = useState("all");
  const [impactFilter, setImpactFilter] = useState<"all" | "high" | "medium">("all");

  const { data, isLoading } = useQuery<CalendarData>({
    queryKey: ["economic-calendar"],
    queryFn: () => fetch("http://localhost:8000/api/calendar?days=30").then(r => r.json()),
    staleTime: 300_000,
  });

  const filtered = (data?.events ?? []).filter(e => {
    if (countryFilter !== "all" && e.country !== countryFilter) return false;
    if (impactFilter !== "all" && e.impact !== impactFilter) return false;
    return true;
  });

  // Group by date
  const grouped = filtered.reduce<Record<string, CalendarEvent[]>>((acc, ev) => {
    if (!acc[ev.date]) acc[ev.date] = [];
    acc[ev.date].push(ev);
    return acc;
  }, {});

  return (
    <div className="max-w-3xl mx-auto pb-16 space-y-5">

      {/* Header */}
      <div className="pt-2 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Calendar className="w-5 h-5 text-blue-400" />
            <h1 className="text-xl font-bold text-white">Ekonomik Takvim</h1>
          </div>
          <p className="text-sm text-zinc-500">
            Önümüzdeki 30 günün yüksek etkili makro olayları — BIST ve küresel piyasa etkileri ile
          </p>
        </div>
      </div>

      {/* Stats row */}
      {data && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <p className="text-[10px] text-zinc-500 mb-1">Toplam Olay</p>
            <p className="text-xl font-bold text-white">{data.total}</p>
          </div>
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
            <p className="text-[10px] text-zinc-500 mb-1">Yüksek Etki</p>
            <p className="text-xl font-bold text-red-400">{data.high_impact_count}</p>
          </div>
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3">
            <p className="text-[10px] text-zinc-500 mb-1">Bugün</p>
            <p className="text-xl font-bold text-blue-400">{data.today_count}</p>
          </div>
        </div>
      )}

      {/* Impact bar */}
      {data && data.events.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
          <ImpactBar events={data.events} />
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {/* Country */}
        <div className="flex bg-zinc-800 rounded-lg p-0.5 border border-zinc-700">
          {COUNTRY_FILTERS.map(f => (
            <button key={f.id} onClick={() => setCountryFilter(f.id)}
              className={cn("text-xs px-3 py-1 rounded-md transition-colors",
                countryFilter === f.id ? "bg-zinc-600 text-white" : "text-zinc-500 hover:text-zinc-300")}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Impact */}
        <div className="flex bg-zinc-800 rounded-lg p-0.5 border border-zinc-700">
          {[["all","Tümü"],["high","Yüksek"],["medium","Orta"]] .map(([val, lbl]) => (
            <button key={val} onClick={() => setImpactFilter(val as "all" | "high" | "medium")}
              className={cn("text-xs px-3 py-1 rounded-md transition-colors",
                impactFilter === val ? "bg-zinc-600 text-white" : "text-zinc-500 hover:text-zinc-300")}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Events */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && Object.entries(grouped).map(([date, events]) => (
        <div key={date} className="space-y-2">
          {/* Date header */}
          <div className="flex items-center gap-3">
            <p className="text-xs font-bold text-zinc-400">{formatDate(date)}</p>
            {events.some(e => e.is_today) && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">BUGÜN</span>
            )}
            {events.some(e => e.impact === "high") && (
              <AlertTriangle className="w-3 h-3 text-red-400" />
            )}
            <div className="flex-1 h-px bg-zinc-800" />
          </div>

          {/* Events */}
          <div className="space-y-2">
            {events.map(ev => <EventCard key={ev.id} event={ev} />)}
          </div>
        </div>
      ))}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-12 text-zinc-600">
          <Calendar className="w-8 h-8 mx-auto mb-3 opacity-50" />
          <p>Bu filtreler için olay bulunamadı.</p>
        </div>
      )}

      <p className="text-[10px] text-zinc-700 text-center">
        Veri: Mock takvim. Gerçek entegrasyon: Trading Economics API, Investing.com
      </p>
    </div>
  );
}
