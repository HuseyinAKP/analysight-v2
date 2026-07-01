"use client";
import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { symbolsApi, analysisApi, riskApi, insightsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

import { PriceHeader }           from "@/components/dashboard/PriceHeader";
import { StatBar }               from "@/components/dashboard/StatBar";
import { CandlestickChart }      from "@/components/dashboard/CandlestickChart";
import { TechnicalPanel }        from "@/components/dashboard/TechnicalPanel";
import { TechnicalSummary }      from "@/components/dashboard/TechnicalSummary";
import { SignalConfluencePanel } from "@/components/dashboard/SignalConfluencePanel";
import { MultiframePanel }       from "@/components/dashboard/MultiframePanel";
import { FundamentalsPanel }     from "@/components/dashboard/FundamentalsPanel";
import { MarketStructurePanel }  from "@/components/dashboard/MarketStructurePanel";
import { WhyPanel }              from "@/components/dashboard/WhyPanel";
import { ScenarioPanel }         from "@/components/dashboard/ScenarioPanel";
import { RiskPanel }             from "@/components/dashboard/RiskPanel";
import { MLForecastPanel }       from "@/components/dashboard/MLForecastPanel";
import { EventStudyPanel }       from "@/components/dashboard/EventStudyPanel";
import { NewsPanel }             from "@/components/dashboard/NewsPanel";
import { SocialPanel }           from "@/components/dashboard/SocialPanel";
import { AIAssistant }           from "@/components/dashboard/AIAssistant";
import { InvestorSummary }       from "@/components/dashboard/InvestorSummary";
import { AnalystTargets }        from "@/components/dashboard/AnalystTargets";
import { ScoreCard }             from "@/components/dashboard/ScoreCard";
import { KapPanel }              from "@/components/dashboard/KapPanel";
import { StatusBadges }          from "@/components/dashboard/StatusBadges";
import { EventTimeline }         from "@/components/dashboard/EventTimeline";
import { PatternMatchPanel }     from "@/components/dashboard/PatternMatchPanel";
import { ClassicPatternsPanel }  from "@/components/dashboard/ClassicPatternsPanel";
import { MoneyFlowPanel }        from "@/components/dashboard/MoneyFlowPanel";
import { CompositeScore }        from "@/components/dashboard/CompositeScore";
import { PineScriptGenerator }   from "@/components/tools/PineScriptGenerator";
import { ChartVision }           from "@/components/tools/ChartVision";
import { BeginnerGuide }         from "@/components/ui/BeginnerGuide";
import EventForecast             from "@/components/dashboard/EventForecast";
import { Skeleton }              from "@/components/ui/Skeleton";
import {
  BarChart2, TrendingUp, BookOpen, Newspaper, Bot, Shield
} from "lucide-react";

// ── Sekmeler ──────────────────────────────────────────────────────────────────
const TABS = [
  { key: "grafik",   label: "Grafik",   icon: BarChart2  },
  { key: "teknik",   label: "Teknik",   icon: TrendingUp },
  { key: "temel",    label: "Temel",    icon: BookOpen   },
  { key: "haberler", label: "Haberler", icon: Newspaper  },
  { key: "risk",     label: "Risk & AI",icon: Shield     },
  { key: "ai",       label: "AI Chat",  icon: Bot        },
] as const;

type Tab = typeof TABS[number]["key"];

export default function SymbolPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = use(params);
  const sym = symbol.toUpperCase();
  const [tab, setTab] = useState<Tab>("grafik");

  // Queries
  const { data: info }         = useQuery({ queryKey: ["symbol",       sym], queryFn: () => symbolsApi.get(sym) });
  const { data: indicators }   = useQuery({ queryKey: ["indicators",   sym], queryFn: () => analysisApi.indicators(sym) });
  const { data: scenarios }    = useQuery({ queryKey: ["scenarios",    sym], queryFn: () => analysisApi.scenarios(sym) });
  const { data: risk }         = useQuery({ queryKey: ["risk",         sym], queryFn: () => riskApi.get(sym) });
  const { data: structure }    = useQuery({ queryKey: ["structure",    sym], queryFn: () => insightsApi.structure(sym) });
  const { data: why }          = useQuery({ queryKey: ["why",          sym], queryFn: () => insightsApi.why(sym) });
  const { data: forecast }     = useQuery({ queryKey: ["forecast",     sym], queryFn: () => insightsApi.forecast(sym) });
  const { data: events }       = useQuery({ queryKey: ["events",       sym], queryFn: () => insightsApi.events(sym) });
  const { data: news }         = useQuery({ queryKey: ["news",         sym], queryFn: () => insightsApi.news(sym) });
  const { data: social }       = useQuery({ queryKey: ["social",       sym], queryFn: () => insightsApi.social(sym) });
  const { data: multiframe }   = useQuery({ queryKey: ["multiframe",   sym], queryFn: () => analysisApi.multiframe(sym) });
  const { data: fundamentals } = useQuery({ queryKey: ["fundamentals", sym], queryFn: () => analysisApi.fundamentals(sym) });

  const aiContext = indicators && scenarios && risk ? {
    rsi: indicators.rsi, macd: indicators.macd,
    scenarios: scenarios.scenarios,
    uncertainty: scenarios.uncertainty_index,
    stop_loss: risk.stop_loss, rr_t1: risk.rr_ratio_t1,
  } : undefined;

  return (
    <div className="pb-24">
      <BeginnerGuide />

      {/* ── Başlık (her sekmede sabit) ── */}
      <div className="sticky top-0 z-30 bg-zinc-950/95 backdrop-blur border-b border-zinc-800">
        <div className="max-w-screen-xl mx-auto px-4">
          {info
            ? <PriceHeader info={info} />
            : <div className="h-16 flex items-center"><Skeleton className="h-8 w-48 rounded-lg" /></div>}

          {/* Tab bar */}
          <div className="flex items-center gap-1 pb-0 overflow-x-auto scrollbar-hide">
            {TABS.map(t => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                    active
                      ? "border-blue-500 text-blue-400"
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 pt-4 space-y-4">
        {/* Durum şeridi — her sekmede */}
        {indicators && info && <StatBar indicators={indicators} info={info} />}
        {indicators && scenarios && risk && (
          <StatusBadges indicators={indicators} scenarios={scenarios} risk={risk} />
        )}

        {/* ══ GRAFİK sekmesi ══════════════════════════════════════════════════ */}
        {tab === "grafik" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Sol — büyük grafik alanı */}
            <div className="lg:col-span-2 space-y-4">
              <CompositeScore symbol={sym} />
              <EventForecast symbol={sym} />
              {indicators
                ? <CandlestickChart symbol={sym} indicators={indicators} />
                : <Skeleton className="h-[460px] rounded-xl" />}
              <MoneyFlowPanel symbol={sym} />
              <ClassicPatternsPanel symbol={sym} />
              <PatternMatchPanel symbol={sym} />
              <ChartVision symbol={sym} mode="inline" />
            </div>
            {/* Sağ — özet kartları */}
            <div className="space-y-4">
              {indicators && risk && scenarios && info
                ? <ScoreCard symbol={sym} price={info.price} indicators={indicators} risk={risk} scenarios={scenarios} compact />
                : <Skeleton className="h-48 rounded-2xl" />}
              {indicators && scenarios && risk && info
                ? <InvestorSummary symbol={sym} indicators={indicators} scenarios={scenarios} risk={risk} />
                : <Skeleton className="h-40 rounded-2xl" />}
              {scenarios
                ? <ScenarioPanel scenarios={scenarios} />
                : <Skeleton className="h-64 rounded-xl" />}
              {forecast
                ? <MLForecastPanel data={forecast} />
                : <Skeleton className="h-48 rounded-xl" />}
            </div>
          </div>
        )}

        {/* ══ TEKNİK sekmesi ══════════════════════════════════════════════════ */}
        {tab === "teknik" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              {indicators
                ? <TechnicalSummary indicators={indicators} symbol={sym} />
                : <Skeleton className="h-64 rounded-xl" />}
              {indicators
                ? <TechnicalPanel indicators={indicators} />
                : <Skeleton className="h-80 rounded-xl" />}
              {indicators
                ? <SignalConfluencePanel confluence={indicators.confluence} symbol={sym} />
                : <Skeleton className="h-64 rounded-xl" />}
              {multiframe
                ? <MultiframePanel data={multiframe} />
                : <Skeleton className="h-48 rounded-xl" />}
              {structure
                ? <MarketStructurePanel data={structure} />
                : <Skeleton className="h-72 rounded-xl" />}
              {why
                ? <WhyPanel why={why} />
                : <Skeleton className="h-48 rounded-xl" />}
              <PineScriptGenerator symbol={sym} />
            </div>
            <div className="space-y-4">
              {indicators && scenarios && risk && info
                ? <AnalystTargets symbol={sym} price={info.price} scenarios={scenarios} indicators={indicators} risk={risk} />
                : <Skeleton className="h-[520px] rounded-2xl" />}
              {indicators && scenarios && risk && info
                ? <ScoreCard symbol={sym} price={info.price} indicators={indicators} risk={risk} scenarios={scenarios} />
                : <Skeleton className="h-64 rounded-2xl" />}
            </div>
          </div>
        )}

        {/* ══ TEMEL sekmesi ══════════════════════════════════════════════════ */}
        {tab === "temel" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              {fundamentals
                ? <FundamentalsPanel data={fundamentals} />
                : <Skeleton className="h-80 rounded-xl" />}
              {events
                ? <EventStudyPanel data={events} />
                : <Skeleton className="h-48 rounded-xl" />}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
                <EventTimeline symbol={sym} />
              </div>
            </div>
            <div className="space-y-4">
              {indicators && scenarios && risk && info
                ? <AnalystTargets symbol={sym} price={info.price} scenarios={scenarios} indicators={indicators} risk={risk} />
                : <Skeleton className="h-[520px] rounded-2xl" />}
            </div>
          </div>
        )}

        {/* ══ HABERLER sekmesi ════════════════════════════════════════════════ */}
        {tab === "haberler" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <KapPanel symbol={sym} />
              {news
                ? <NewsPanel items={news} />
                : <Skeleton className="h-64 rounded-xl" />}
              {social
                ? <SocialPanel data={social} />
                : <Skeleton className="h-64 rounded-xl" />}
            </div>
            <div className="space-y-4">
              {indicators && scenarios && risk && info
                ? <InvestorSummary symbol={sym} indicators={indicators} scenarios={scenarios} risk={risk} />
                : <Skeleton className="h-40 rounded-2xl" />}
              <EventForecast symbol={sym} />
            </div>
          </div>
        )}

        {/* ══ RİSK & AI sekmesi ════════════════════════════════════════════ */}
        {tab === "risk" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              {risk
                ? <RiskPanel risk={risk} symbol={sym} />
                : <Skeleton className="h-80 rounded-xl" />}
              {scenarios
                ? <ScenarioPanel scenarios={scenarios} />
                : <Skeleton className="h-80 rounded-xl" />}
              {forecast
                ? <MLForecastPanel data={forecast} />
                : <Skeleton className="h-64 rounded-xl" />}
            </div>
            <div className="space-y-4">
              {indicators && risk && scenarios && info
                ? <ScoreCard symbol={sym} price={info.price} indicators={indicators} risk={risk} scenarios={scenarios} />
                : <Skeleton className="h-64 rounded-2xl" />}
              {indicators && scenarios && risk && info
                ? <AnalystTargets symbol={sym} price={info.price} scenarios={scenarios} indicators={indicators} risk={risk} />
                : <Skeleton className="h-[520px] rounded-2xl" />}
            </div>
          </div>
        )}

        {/* ══ AI CHAT sekmesi ═════════════════════════════════════════════════ */}
        {tab === "ai" && (
          <div className="max-w-2xl mx-auto">
            <AIAssistant symbol={sym} context={aiContext} />
          </div>
        )}
      </div>
    </div>
  );
}
