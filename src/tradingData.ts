export type Direction = "Long" | "Short";
export type TradeResult = "Win" | "Loss" | "Break even";
export type SessionName = "Asia" | "London" | "New York" | "Overlap";

export interface JournalTrade {
  id: string;
  date: string;
  time: string;
  instrument: string;
  direction: Direction;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  result: TradeResult;
  pnl: number;
  r: number;
  setup: string;
  timeframe: string;
  session: SessionName;
  emotion: string;
  notes: string;
  screenshotUrl?: string;
  tags: string[];
  rulesBroken: string[];
  source: "Journal" | "Forward";
}

export interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradingRule {
  id: string;
  title: string;
  group: string;
  priority: "Critical" | "Important" | "Standard";
  enabled: boolean;
  source: "Notion plan" | "Suggested guardrail";
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  category: "Short-term" | "Medium-term" | "Long-term";
  metric: "trades" | "win-rate" | "adherence" | "reviews";
  target: number;
  deadline: string;
  achieved: boolean;
}

export interface PaperPosition {
  id: string;
  openedAt: string;
  instrument: string;
  direction: Direction;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  size: number;
  setup: string;
  timeframe: string;
  session: SessionName;
  currentPrice: number;
}

export interface BacktestSummary {
  id: string;
  name: string;
  instrument: string;
  strategy: string;
  trades: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpe: number;
  averageR: number;
  pnl: number;
  savedAt: string;
}

export const instruments = [
  { symbol: "EUR/USD", name: "Euro / US Dollar", decimals: 5, base: 1.08425 },
  { symbol: "NAS100", name: "Nasdaq 100", decimals: 2, base: 18482.5 },
];

export const setupNames = [
  "Entry Model 1",
  "Entry Model 2",
  "Entry Model 3",
  "Entry Model 4",
];

export const notionConfluences = [
  "HTF POI Mitigation",
  "LTF CHoCH",
  "Sweep Flip",
  "V-Shape",
  "MTF LID",
  "Premium / Discount",
  "POI Mitigation",
  "Sweep POI",
];

export const mistakeTags = [
  "FOMO",
  "Moved stop loss",
  "Overtrading",
  "Early entry",
  "Ignored session plan",
];

export const planStages = [
  {
    timeframe: "W / D",
    title: "Higher-timeframe perspective",
    source: "Weekly / daily mapping",
    checklist: [
      "Map current swing ranges",
      "Mark relevant supply and demand zones",
      "Note liquidity sweeps and pools",
    ],
  },
  {
    timeframe: "4H",
    title: "Narrative and dealing range",
    source: "4H narrative",
    checklist: [
      "Map the current swing range and premium / discount",
      "Mark relevant supply and demand zones",
      "Map liquidity sweeps and pools",
    ],
  },
  {
    timeframe: "M15",
    title: "Immediate execution bias",
    source: "M15 immediate bias",
    checklist: [
      "Map current swing range and premium / discount",
      "Refine zones and liquidity",
      "Wait for higher-timeframe point-of-interest mitigation",
    ],
  },
  {
    timeframe: "M1",
    title: "Entry and trade management",
    source: "M1 execution",
    checklist: [
      "Wait for M15 mitigation before execution",
      "Use a documented entry model",
      "Follow the management plan",
    ],
  },
];

export const planPhilosophy = [
  "Stay patient and process-led; only act when preparation and price evidence align.",
  "Trading conditions move in cycles. Accept that a sound process can still produce a loss.",
  "Focus on capturing a small, repeatable part of available opportunity rather than predicting every move.",
  "Let market evidence lead the decision; do not argue with invalidation or force a trade.",
];

export const initialRules: TradingRule[] = [
  {
    id: "rule-1",
    title: "Map weekly / daily swing ranges before the session",
    group: "Preparation",
    priority: "Important",
    enabled: true,
    source: "Notion plan",
  },
  {
    id: "rule-2",
    title: "Mark supply / demand zones and liquidity pools",
    group: "Preparation",
    priority: "Important",
    enabled: true,
    source: "Notion plan",
  },
  {
    id: "rule-3",
    title: "Confirm 4H narrative and premium / discount",
    group: "Bias",
    priority: "Critical",
    enabled: true,
    source: "Notion plan",
  },
  {
    id: "rule-4",
    title: "Wait for M15 point-of-interest mitigation before M1 entry",
    group: "Execution",
    priority: "Critical",
    enabled: true,
    source: "Notion plan",
  },
  {
    id: "rule-5",
    title: "Entry matches one of the four documented entry models",
    group: "Execution",
    priority: "Critical",
    enabled: true,
    source: "Notion plan",
  },
  {
    id: "rule-6",
    title: "Define stop loss and target before placing the trade",
    group: "Risk",
    priority: "Critical",
    enabled: true,
    source: "Suggested guardrail",
  },
  {
    id: "rule-7",
    title: "Keep risk inside the configured per-trade limit",
    group: "Risk",
    priority: "Critical",
    enabled: true,
    source: "Suggested guardrail",
  },
  {
    id: "rule-8",
    title: "Avoid scheduled high-impact news and unplanned sessions",
    group: "Discipline",
    priority: "Standard",
    enabled: true,
    source: "Suggested guardrail",
  },
];

export const initialGoals: Goal[] = [
  {
    id: "goal-1",
    title: "Build a compliant trade sample",
    description:
      "Log trades with a documented entry model and complete review notes.",
    category: "Short-term",
    metric: "trades",
    target: 24,
    deadline: "2026-10-31",
    achieved: false,
  },
  {
    id: "goal-2",
    title: "Maintain plan discipline",
    description:
      "Keep rule adherence above the chosen threshold across logged trades.",
    category: "Medium-term",
    metric: "adherence",
    target: 85,
    deadline: "2026-12-31",
    achieved: false,
  },
  {
    id: "goal-3",
    title: "Review performance weekly",
    description: "Complete one structured weekly review each week.",
    category: "Short-term",
    metric: "reviews",
    target: 8,
    deadline: "2026-11-30",
    achieved: false,
  },
  {
    id: "goal-4",
    title: "Measure setup expectancy",
    description: "Build a reviewed sample before evaluating win rate by setup.",
    category: "Long-term",
    metric: "win-rate",
    target: 55,
    deadline: "2027-03-31",
    achieved: false,
  },
];

const sessions: SessionName[] = ["Asia", "London", "New York", "Overlap"];
const moods = ["Focused", "Patient", "Confident", "Hesitant", "Tired"];
const sampleTimes = [
  "02:20",
  "08:35",
  "10:10",
  "13:45",
  "15:20",
  "17:05",
  "21:30",
];
const outcomes = [
  1.4, -1, 2.1, 0.7, -1, 1.1, -0.6, 1.8, 0.4, -1, 2.4, 0.9, -0.8, 1.2, -1, 1.6,
  0.5, -1, 2, 0.8, -0.4, 1.3, -1, 1.9, 0.6, -1, 1.1, -0.7, 2.2, 0.9, -1, 1.5,
  -0.5, 1.7, 0.6, -1,
];

export function makeSampleTrades(now = new Date()): JournalTrade[] {
  return outcomes.map((r, index) => {
    const dayOffset = (outcomes.length - index - 1) * 3 + (index % 4);
    const date = new Date(now);
    date.setDate(date.getDate() - dayOffset);
    const instrument = instruments[index % instruments.length];
    const direction: Direction = index % 3 === 0 ? "Short" : "Long";
    const risk = 112 + (index % 5) * 14;
    const entry =
      instrument.base *
      (1 +
        Math.sin(index * 1.8) *
          (instrument.symbol === "NAS100" ? 0.008 : 0.0018));
    const loss = r < 0;
    return {
      id: `sample-${index + 1}`,
      date: date.toISOString().slice(0, 10),
      time: sampleTimes[index % sampleTimes.length],
      instrument: instrument.symbol,
      direction,
      entry,
      stopLoss: entry * (direction === "Long" ? 0.998 : 1.002),
      takeProfit: entry * (direction === "Long" ? 1.004 : 0.996),
      result: loss ? "Loss" : r < 0.5 ? "Break even" : "Win",
      pnl: Math.round(r * risk * 100) / 100,
      r,
      setup: setupNames[index % setupNames.length],
      timeframe: ["M1", "M5", "M15", "H1"][index % 4],
      session: sessions[(index * 3 + 1) % sessions.length],
      emotion: moods[(index * 2 + 1) % moods.length],
      notes:
        index % 3 === 0
          ? "Waited for the mapped zone and documented the reaction."
          : "Sample journal record for workspace demonstration.",
      tags: [
        notionConfluences[index % notionConfluences.length],
        notionConfluences[(index + 3) % notionConfluences.length],
      ],
      rulesBroken:
        index % 9 === 4 ? ["rule-8"] : index % 13 === 7 ? ["rule-6"] : [],
      source: "Journal",
    };
  });
}

export function generateMarketData(
  symbol: string,
  bars = 184,
  now = new Date(),
): Candle[] {
  const instrument =
    instruments.find((item) => item.symbol === symbol) ?? instruments[0];
  const isIndex = instrument.symbol === "NAS100";
  const volatility = isIndex ? 0.009 : 0.0042;
  let previous = instrument.base * 0.94;
  return Array.from({ length: bars }, (_, index) => {
    const wave =
      Math.sin(index * 0.19) * volatility * 0.68 +
      Math.sin(index * 0.047) * volatility * 1.5;
    const noise =
      (Math.sin(index * 12.9898 + (isIndex ? 31 : 7)) * 0.5 +
        Math.sin(index * 5.712 + 2) * 0.28) *
      volatility;
    const open = previous;
    const close = open * (1 + wave + noise + volatility * 0.035);
    const spread =
      Math.abs(close - open) +
      open * volatility * (0.3 + Math.abs(Math.sin(index * 4.2)) * 0.4);
    const date = new Date(now);
    date.setDate(date.getDate() - (bars - index - 1));
    previous = close;
    return {
      date: date.toISOString().slice(0, 10),
      open,
      high: Math.max(open, close) + spread * 0.4,
      low: Math.min(open, close) - spread * 0.4,
      close,
      volume: Math.round(
        780 + (Math.sin(index * 2.4) + 1) * 540 + (index % 11) * 19,
      ),
    };
  });
}

export function makeInitialPaperPositions(): PaperPosition[] {
  return [
    {
      id: "paper-1",
      openedAt: new Date().toISOString().slice(0, 10),
      instrument: "EUR/USD",
      direction: "Long",
      entry: 1.08425,
      stopLoss: 1.0816,
      takeProfit: 1.08955,
      size: 0.4,
      setup: "Entry Model 2",
      timeframe: "M15",
      session: "London",
      currentPrice: 1.0862,
    },
    {
      id: "paper-2",
      openedAt: new Date().toISOString().slice(0, 10),
      instrument: "NAS100",
      direction: "Short",
      entry: 18482.5,
      stopLoss: 18535,
      takeProfit: 18377.5,
      size: 0.2,
      setup: "Entry Model 1",
      timeframe: "M5",
      session: "New York",
      currentPrice: 18446.2,
    },
  ];
}

export function currency(value: number, compact = false): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(value);
}

export function formatPrice(symbol: string, value: number): string {
  const decimals =
    instruments.find((item) => item.symbol === symbol)?.decimals ?? 2;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
