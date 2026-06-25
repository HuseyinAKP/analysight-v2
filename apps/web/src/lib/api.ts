import axios from "axios";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const api = axios.create({ baseURL: API_BASE });

export interface SymbolInfo {
  symbol: string;
  name: string;
  market: string;
  currency: string;
  price: number;
  change_pct: number;
  change_abs: number;
}

export interface ConfluenceSignal {
  key: string;
  label: string;
  signal: "bull" | "bear" | "neutral";
  value: string;
  note: string;
}

export interface Confluence {
  score: number;
  bull_count: number;
  bear_count: number;
  neutral_count: number;
  signals: ConfluenceSignal[];
}

export interface Indicators {
  rsi: number;
  macd: number;
  macd_signal: number;
  macd_histogram: number;
  bb_upper: number;
  bb_middle: number;
  bb_lower: number;
  atr: number;
  ema20: number;
  ema50: number;
  ema200: number;
  vwap: number | null;
  stoch_k: number;
  stoch_d: number | null;
  adx?: number;
  williams_r?: number;
  confluence: Confluence;
  series: {
    rsi: number[];
    macd: number[];
    macd_signal: number[];
    macd_histogram: number[];
    bb_upper: number[];
    bb_middle: number[];
    bb_lower: number[];
    ema20: number[];
    ema50: number[];
    ema200: number[];
    vwap: number[];
    volume: number[];
    close: number[];
    dates: string[];
  };
}

export interface MultiframeRow {
  timeframe: string;
  label: string;
  direction: "bull" | "bear" | "neutral";
  confluence_score: number;
  bull_count: number;
  bear_count: number;
  rsi: number;
  macd_bullish: boolean;
  price_vs_ema200: "above" | "below";
}

export interface MultiframeData {
  symbol: string;
  frames: MultiframeRow[];
}

export interface FundamentalsData {
  symbol: string;
  available: boolean;
  reason?: string;
  sector?: string;
  valuation?: {
    pe: number; pb: number; ps: number; roe_pct: number;
    debt_equity: number; sector_avg_pe: number; pe_vs_sector: string;
  };
  annual?: { revenue_b: number; net_income_b: number; net_margin_pct: number };
  quarters?: {
    quarter: string; revenue_b: number; net_income_b: number;
    eps_actual: number; eps_estimate: number; beat: boolean;
    revenue_growth_yoy: number; net_margin_pct: number;
  }[];
  insights?: string[];
}

export interface Scenarios {
  current_price: number;
  horizon_days: number;
  scenarios: {
    bull: { target: number; probability: number; upside_pct: number };
    base: { target: number; probability: number; upside_pct: number };
    bear: { target: number; probability: number; downside_pct: number };
  };
  uncertainty_index: number;
  volatility_annual_pct: number;
}

export interface RiskData {
  entry_price: number;
  stop_loss: number;
  stop_pct: number;
  target1: number;
  target1_pct: number;
  target2: number;
  target2_pct: number;
  rr_ratio_t1: number;
  rr_ratio_t2: number;
  atr: number;
  position_sizing: {
    account_size: number;
    risk_pct: number;
    max_risk_amount: number;
    shares: number;
    position_value: number;
  };
}

export interface OHLCVBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const symbolsApi = {
  search: (q: string) => api.get<SymbolInfo[]>(`/api/symbols/search?q=${q}`).then(r => r.data),
  get: (symbol: string) => api.get<SymbolInfo>(`/api/symbols/${symbol}`).then(r => r.data),
  list: () => api.get<SymbolInfo[]>("/api/symbols/").then(r => r.data),
};

export const analysisApi = {
  indicators: (symbol: string) => api.get<Indicators>(`/api/analysis/${symbol}/indicators`).then(r => r.data),
  scenarios: (symbol: string) => api.get<Scenarios>(`/api/analysis/${symbol}/scenarios`).then(r => r.data),
  ohlcv: (symbol: string, days = 90) => api.get<OHLCVBar[]>(`/api/analysis/${symbol}/ohlcv?days=${days}`).then(r => r.data),
  multiframe: (symbol: string) => api.get<MultiframeData>(`/api/analysis/${symbol}/multiframe`).then(r => r.data),
  fundamentals: (symbol: string) => api.get<FundamentalsData>(`/api/analysis/${symbol}/fundamentals`).then(r => r.data),
};

export interface MarketStructure {
  adx: { adx: number; di_plus: number; di_minus: number; label: string; direction: string; series: number[] };
  stochastic: { k: number; d: number; label: string; color: string; signal: string; series_k: number[]; series_d: number[] };
  structure: {
    structure: string; bias: string;
    events: { type: string; date: string; price: number; level: number; sentiment: string }[];
    swing_highs: { date: string; price: number; index: number }[];
    swing_lows:  { date: string; price: number; index: number }[];
  };
}

export interface EventStudy {
  current_move_pct: number;
  direction: string;
  events: { date: string; trigger_return: number; ret5: number; ret10: number; ret20: number }[];
  stats: { count: number; avg_ret5: number; avg_ret10: number; avg_ret20: number; positive_5d: number; positive_10d: number; positive_20d: number } | null;
}

export interface MLForecast {
  model: string; disclaimer: string;
  ml_version?: boolean;
  trained_at?: string;
  top_features?: { feature: string; importance: number }[];
  forecasts: { horizon_days: number; up_probability: number; expected_return_pct: number; volatility_pct: number; confidence: string }[];
}

export interface NewsItem {
  headline: string; category: string; category_label: string; category_color: string;
  impact: string; sentiment: string; timestamp: string; hours_ago: number; source: string;
}

export interface SocialSignal {
  symbol: string; data_source: string;
  mentions: { last_15min: number; last_1h: number; daily_avg: number };
  deviation_score: number; deviation_label: string;
  sentiment: { score: number; label: string; color: string };
  influencer_sentiment: { score: number; label: string };
  coordination_score: number; coordination_label: string;
  top_keywords: string[];
}

export interface WhyChain {
  why_happened: string[];
  why_might: string[];
  technical_signals: { signal: string; direction: string; strength: string }[];
  news_signals: { headline: string; category: string; sentiment: string }[];
  social_signal: { label: string; sentiment: string; coordination: string };
  conflict_detected: boolean;
  dominant_direction: string;
}

export const insightsApi = {
  structure: (s: string) => api.get<MarketStructure>(`/api/insights/${s}/structure`).then(r => r.data),
  events:    (s: string) => api.get<EventStudy>(`/api/insights/${s}/events`).then(r => r.data),
  forecast:  (s: string) => api.get<MLForecast>(`/api/insights/${s}/forecast`).then(r => r.data),
  news:      (s: string) => api.get<{ items: NewsItem[] }>(`/api/insights/${s}/news`).then(r => r.data.items),
  social:    (s: string) => api.get<SocialSignal>(`/api/insights/${s}/social`).then(r => r.data),
  why:       (s: string) => api.get<WhyChain>(`/api/insights/${s}/why`).then(r => r.data),
};

export interface ScanResult {
  symbol: string; name: string; market: string; currency: string;
  price: number; change_pct: number; score: number;
  rsi: number; macd_bullish: boolean; adx: number; adx_label: string;
  stoch_k: number; stoch_signal: string; bb_pct: number;
  uncertainty: number; bull_prob: number; bear_prob: number;
  stop_loss: number; target1: number; rr_ratio: number;
}

export interface ScanPreset { id: string; label: string; }

export interface Alert {
  id: string; symbol: string; condition_type: string; condition_label: string;
  threshold: number; label: string; notify_channels: string[];
  active: boolean; triggered: boolean; triggered_at: string | null; created_at: string;
}

export interface WatchlistScanItem {
  symbol: string; name: string; price: number; currency: string;
  change_pct: number; score: number; signal: string; signal_color: string;
  rsi: number; rsi_comment: string; macd_bull: boolean; ema_trend: string;
  bull_count: number; bear_count: number; neutral_count: number;
  commentary: string;
}

export interface WatchlistScanResult {
  scanned_at: string; total_scanned: number; market_mood: string;
  avg_score: number; bullish_count: number; bearish_count: number;
  top_pick: string | null; results: WatchlistScanItem[]; errors: string[];
}

export const scannerApi = {
  presets: () => api.get<ScanPreset[]>("/api/scan/presets").then(r => r.data),
  runPreset: (id: string) => api.get<ScanResult[]>(`/api/scan/preset/${id}`).then(r => r.data),
  runCustom: (filters: Record<string, unknown>) => api.post<ScanResult[]>("/api/scan/custom", filters).then(r => r.data),
  watchlist: () => api.get<WatchlistScanResult>("/api/scan/watchlist").then(r => r.data),
  alertConditions: () => api.get<{ id: string; label: string }[]>("/api/alerts/conditions").then(r => r.data),
  listAlerts: () => api.get<Alert[]>("/api/alerts").then(r => r.data),
  createAlert: (body: { symbol: string; condition_type: string; threshold: number; notify_channels: string[]; label?: string }) =>
    api.post<Alert>("/api/alerts", body).then(r => r.data),
  deleteAlert: (id: string) => api.delete(`/api/alerts/${id}`).then(r => r.data),
  toggleAlert: (id: string) => api.patch<Alert>(`/api/alerts/${id}/toggle`).then(r => r.data),
  testWebhook: (symbol: string) => api.get(`/api/webhook/tradingview/test/${symbol}`).then(r => r.data),
  alertFeed: () => api.get<{ alerts: unknown[]; count: number }>("/api/webhook/tradingview/feed").then(r => r.data),
};

export const riskApi = {
  get: (symbol: string) => api.get<RiskData>(`/api/risk/${symbol}`).then(r => r.data),
  calc: (symbol: string, params: { entry_price?: number; account_size?: number; risk_pct?: number }) =>
    api.post<RiskData>(`/api/risk/${symbol}`, params).then(r => r.data),
};

// ── Portfolio / ETF / Trade Setup / Market Updates ───────────────────────────
export const portfolioApi = {
  get: () => api.get("/api/portfolio").then(r => r.data),
  add: (body: { symbol: string; quantity: number; avg_cost: number; notes?: string }) =>
    api.post("/api/portfolio", body).then(r => r.data),
  remove: (id: string) => api.delete(`/api/portfolio/${id}`).then(r => r.data),
  metrics: () => api.post("/api/portfolio-ai/metrics", {}).then(r => r.data),
};

export const etfApi = {
  list: () => api.get<string[]>("/api/etf/list").then(r => r.data),
  get: (symbol: string) => api.get(`/api/etf/${symbol}`).then(r => r.data),
  compare: (symbols: string[]) => api.get(`/api/etf/compare/${symbols.join(",")}`).then(r => r.data),
};

export const setupApi = {
  get: (symbol: string) => api.get(`/api/setup/${symbol}`).then(r => r.data),
};

export const marketApi = {
  briefing:    () => api.get("/api/briefing").then(r => r.data),
  commentary:  () => api.get("/api/commentary").then(r => r.data),
  snapshot:    () => api.get("/api/snapshot").then(r => r.data),
};

export interface NewsSource {
  id: string; name: string; country: string; language: string;
  category: string; logo: string; color: string; url: string;
}

export interface NewsArticle {
  id: string;
  headline: string;
  summary?: string;
  sentiment: "positive" | "negative" | "neutral";
  sentiment_label: string;
  sentiment_color: string;
  category: string;
  category_label: string;
  impact: string;
  source: NewsSource;
  published_at: string;
  hours_ago: number;
  url: string;
  symbol?: string;
}

export interface NewsFeed {
  items: NewsArticle[];
  sources: NewsSource[];
  stats: {
    total: number;
    positive_pct: number;
    negative_pct: number;
    neutral_pct: number;
    market_mood: string;
    mood_color: string;
  };
}

export const newsApi = {
  all: (params?: { source?: string; sentiment?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.source)    q.set("source", params.source);
    if (params?.sentiment) q.set("sentiment", params.sentiment);
    if (params?.limit)     q.set("limit", String(params.limit));
    return api.get<NewsFeed>(`/api/news?${q}`).then(r => r.data);
  },
  sources: () => api.get<NewsSource[]>("/api/news/sources").then(r => r.data),
  symbol: (symbol: string) => api.get<{ symbol: string; items: NewsArticle[] }>(`/api/news/${symbol}`).then(r => r.data),
};

// ── Tools API (Earnings / Research / Model) ───────────────────────────────────
export const toolsApi = {
  // Earnings
  earningsCalendar: (days = 45) => api.get(`/api/earnings/calendar?days=${days}`).then(r => r.data),
  earnings: (symbol: string) => api.get(`/api/earnings/${symbol}`).then(r => r.data),

  // Market Research
  marketOverview: () => api.get(`/api/research/overview`).then(r => r.data),
  allSectors: () => api.get(`/api/research/sectors`).then(r => r.data),
  sectorResearch: (sector: string) => api.get(`/api/research/sector/${encodeURIComponent(sector)}`).then(r => r.data),

  // Model Builder
  dcfTemplates: () => api.get<string[]>(`/api/model/templates`).then(r => r.data),
  dcfTemplate: (symbol: string) => api.get(`/api/model/template/${symbol}`).then(r => r.data),
  runDcf: (body: Record<string, unknown>) => api.post(`/api/model/dcf`, body).then(r => r.data),
  runMultiples: (body: Record<string, unknown>) => api.post(`/api/model/multiples`, body).then(r => r.data),
  runScenario: (body: Record<string, unknown>) => api.post(`/api/model/scenario`, body).then(r => r.data),
};
