"use client";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { symbolsApi, analysisApi, riskApi, insightsApi } from "@/lib/api";

// Components — PDF §6.2 sıralamasına göre
import { PriceHeader }           from "@/components/dashboard/PriceHeader";
import { StatBar }               from "@/components/dashboard/StatBar";
import { CandlestickChart }      from "@/components/dashboard/CandlestickChart";
import { PineScriptGenerator }  from "@/components/tools/PineScriptGenerator";
import { ChartVision }          from "@/components/tools/ChartVision";
import { BeginnerGuide }        from "@/components/ui/BeginnerGuide";
import { TechnicalPanel }        from "@/components/dashboard/TechnicalPanel";
import { TechnicalSummary }     from "@/components/dashboard/TechnicalSummary";
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
import { KapPanel }             from "@/components/dashboard/KapPanel";
import { StatusBadges }         from "@/components/dashboard/StatusBadges";
import { EventTimeline }        from "@/components/dashboard/EventTimeline";
import { PatternMatchPanel }    from "@/components/dashboard/PatternMatchPanel";
import { ClassicPatternsPanel } from "@/components/dashboard/ClassicPatternsPanel";
import { MoneyFlowPanel }      from "@/components/dashboard/MoneyFlowPanel";
import { CompositeScore }       from "@/components/dashboard/CompositeScore";
import EventForecast             from "@/components/dashboard/EventForecast";
import { Skeleton }              from "@/components/ui/Skeleton";

export default function SymbolPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = use(params);
  const sym = symbol.toUpperCase();

  // All queries
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

  // Context for AI assistant
  const aiContext = indicators && scenarios && risk ? {
    rsi: indicators.rsi, macd: indicators.macd,
    scenarios: scenarios.scenarios,
    uncertainty: scenarios.uncertainty_index,
    stop_loss: risk.stop_loss, rr_t1: risk.rr_ratio_t1,
  } : undefined;

  return (
    <div className="space-y-4 pb-24">

      {/* Yeni başlayanlar rehberi */}
      <BeginnerGuide />

      {/* 1. Fiyat başlığı */}
      {info ? <PriceHeader info={info} /> : <Skeleton className="h-24 rounded-xl" />}

      {/* 1b. Composite Skor */}
      <CompositeScore symbol={sym} />

      {/* 1c. Tarihsel Olay Zekası */}
      <EventForecast symbol={sym} />

      {/* 2. İstatistik şeridi */}
      {indicators && info && <StatBar indicators={indicators} info={info} />}

      {/* 2x. Durum etiketleri — hızlı sinyal özeti */}
      {indicators && scenarios && risk && (
        <StatusBadges indicators={indicators} scenarios={scenarios} risk={risk} />
      )}

      {/* 2a. Compact Yatırım Puanı (inline banner) */}
      {indicators && risk && scenarios && info && (
        <ScoreCard symbol={sym} price={info.price} indicators={indicators} risk={risk} scenarios={scenarios} compact />
      )}

      {/* 2b. Yatırımcı Özet Kartı — sade dilde ne durumda? */}
      {indicators && scenarios && risk
        ? <InvestorSummary symbol={sym} indicators={indicators} scenarios={scenarios} risk={risk} />
        : <Skeleton className="h-40 rounded-2xl" />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Sol kolon (2/3) ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* 3. Candlestick grafik + AI analiz */}
          {indicators
            ? <CandlestickChart symbol={sym} indicators={indicators} />
            : <Skeleton className="h-[460px] rounded-xl" />}

          {/* 4. Teknik tablo */}
          {indicators
            ? <TechnicalPanel indicators={indicators} />
            : <Skeleton className="h-80 rounded-xl" />}

          {/* 4a. Teknik özet (Investing.com tarzı) */}
          {indicators
            ? <TechnicalSummary indicators={indicators} symbol={sym} />
            : <Skeleton className="h-64 rounded-xl" />}

          {/* 4b. Sinyal uyumu */}
          {indicators
            ? <SignalConfluencePanel confluence={indicators.confluence} symbol={sym} />
            : <Skeleton className="h-64 rounded-xl" />}

          {/* 4c. Çoklu zaman dilimi */}
          {multiframe
            ? <MultiframePanel data={multiframe} />
            : <Skeleton className="h-48 rounded-xl" />}

          {/* 5. Piyasa yapısı (BOS, CHoCH, ADX, Stoch) */}
          {structure
            ? <MarketStructurePanel data={structure} />
            : <Skeleton className="h-72 rounded-xl" />}

          {/* 6. Neden / Neden Olabilir */}
          {why
            ? <WhyPanel why={why} />
            : <Skeleton className="h-48 rounded-xl" />}

          {/* 6b. Temel Analiz */}
          {fundamentals
            ? <FundamentalsPanel data={fundamentals} />
            : <Skeleton className="h-80 rounded-xl" />}

          {/* Pine Script Üreteci */}
          <PineScriptGenerator symbol={sym} />

          {/* Grafik Görüntü Analizi */}
          <ChartVision symbol={sym} mode="inline" />

          {/* 10. KAP Bildirimleri */}
          <KapPanel symbol={sym} />

          {/* 10b. Haber akışı */}
          {news
            ? <NewsPanel items={news} />
            : <Skeleton className="h-64 rounded-xl" />}

          {/* 11. Geçmiş olay analizi */}
          {events
            ? <EventStudyPanel data={events} />
            : <Skeleton className="h-48 rounded-xl" />}

          {/* 11b. HEI — Tarihsel Kırılım Noktaları */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
            <EventTimeline symbol={sym} />
          </div>

          {/* 11c. Para Akışı Analizi */}
          <MoneyFlowPanel symbol={sym} />

          {/* 11d. Klasik Formasyon Analizi */}
          <ClassicPatternsPanel symbol={sym} />

          {/* 11d. HEI — Tarihsel Örüntü Eşleştirme */}
          <PatternMatchPanel symbol={sym} />
        </div>

        {/* ── Sağ kolon (1/3) ── */}
        <div className="space-y-4">

          {/* 6b. Yatırım Puanı */}
          {indicators && risk && scenarios && info
            ? <ScoreCard
                symbol={sym}
                price={info.price}
                indicators={indicators}
                risk={risk}
                scenarios={scenarios}
              />
            : <Skeleton className="h-64 rounded-2xl" />}

          {/* 7. Fiyat Hedefi & Analist Konsensüsü */}
          {scenarios && indicators && risk && info
            ? <AnalystTargets
                symbol={sym}
                price={info.price}
                scenarios={scenarios}
                indicators={indicators}
                risk={risk}
              />
            : <Skeleton className="h-[520px] rounded-2xl" />}

          {/* 8. Senaryo bandı */}
          {scenarios
            ? <ScenarioPanel scenarios={scenarios} />
            : <Skeleton className="h-80 rounded-xl" />}

          {/* 9. Risk özeti */}
          {risk
            ? <RiskPanel risk={risk} symbol={sym} />
            : <Skeleton className="h-80 rounded-xl" />}

          {/* 9. ML tahminleri */}
          {forecast
            ? <MLForecastPanel data={forecast} />
            : <Skeleton className="h-64 rounded-xl" />}

          {/* 12. Sosyal sinyal */}
          {social
            ? <SocialPanel data={social} />
            : <Skeleton className="h-64 rounded-xl" />}
        </div>
      </div>

      {/* Sabit AI asistanı */}
      <AIAssistant symbol={sym} context={aiContext} />
    </div>
  );
}
