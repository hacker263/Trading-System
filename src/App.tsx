import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  Clock3,
  Cloud,
  CloudOff,
  Download,
  FlaskConical,
  Gauge,
  ListChecks,
  Menu,
  Moon,
  MoreHorizontal,
  NotebookPen,
  Plus,
  Radio,
  LogOut,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, isThisMonth, isThisWeek, parseISO, subDays } from "date-fns";
import {
  currency,
  formatPrice,
  generateMarketData,
  initialGoals,
  initialRules,
  instruments,
  makeInitialPaperPositions,
  makeSampleTrades,
  mistakeTags,
  notionConfluences,
  planPhilosophy,
  planStages,
  setupNames,
  type BacktestSummary,
  type Candle,
  type Direction,
  type Goal,
  type JournalTrade,
  type PaperPosition,
  type SessionName,
  type TradingRule,
} from "./tradingData";
import {
  hasSupabaseConfig,
  loadCloudWorkspace,
  supabase,
  syncCloudWorkspace,
  type CloudUser,
  type CloudWorkspace,
} from "./lib/supabase";
import "./App.css";

type ModuleId =
  | "dashboard"
  | "plan"
  | "backtest"
  | "forward"
  | "journal"
  | "goals"
  | "rules"
  | "risk"
  | "analytics"
  | "sessions";
type Indicator =
  "MA crossover" | "RSI reversal" | "MACD crossover" | "Range breakout";
type BacktestTrade = {
  date: string;
  direction: Direction;
  entry: number;
  exit: number;
  r: number;
  pnl: number;
  result: string;
};
type BacktestResult = {
  summary: Omit<BacktestSummary, "id" | "savedAt">;
  trades: BacktestTrade[];
  equity: { date: string; balance: number }[];
  monthly: { month: string; pnl: number }[];
  heatmap: { month: string; week: number; value: number }[];
};
type ModalType = "journal" | "paper" | "close" | "goal" | null;

const navItems: {
  id: ModuleId;
  label: string;
  icon: typeof Gauge;
  group: string;
}[] = [
  { id: "dashboard", label: "Dashboard", icon: Gauge, group: "Workspace" },
  { id: "plan", label: "Trading plan", icon: BookOpen, group: "Workspace" },
  {
    id: "backtest",
    label: "Backtest lab",
    icon: FlaskConical,
    group: "Workspace",
  },
  { id: "forward", label: "Forward test", icon: Radio, group: "Workspace" },
  { id: "journal", label: "Trade journal", icon: NotebookPen, group: "Review" },
  { id: "goals", label: "Goals", icon: Target, group: "Review" },
  {
    id: "rules",
    label: "Rules & checklist",
    icon: ListChecks,
    group: "Control",
  },
  { id: "risk", label: "Risk management", icon: ShieldCheck, group: "Control" },
  { id: "analytics", label: "Analytics", icon: Activity, group: "Review" },
  {
    id: "sessions",
    label: "Sessions & calendar",
    icon: CalendarDays,
    group: "Control",
  },
];

const pageDescriptions: Record<ModuleId, string> = {
  dashboard: "Your process, performance and next move in one view.",
  plan: "A living playbook from higher-timeframe mapping to execution.",
  backtest: "Test an idea against six months of deterministic sample data.",
  forward: "Practice the plan in a simulated market before risking capital.",
  journal: "Capture the trade, the context and the decisions behind it.",
  goals: "Turn repeatable process milestones into measurable progress.",
  rules: "Make the process visible before, during and after each trade.",
  risk: "Size positions from invalidation, then keep daily exposure in view.",
  analytics: "Compare what the plan expects with what your decisions deliver.",
  sessions: "Put session context and scheduled event risk on the same clock.",
};

const sessionColors: Record<string, string> = {
  Asia: "#81958b",
  London: "#d27648",
  "New York": "#506a80",
  Overlap: "#bc9d55",
};
const chartTooltipStyle = {
  background: "#fffefa",
  border: "1px solid #e9e4db",
  borderRadius: 9,
  fontSize: 12,
  color: "#393a35",
};

function usePersisted<T>(
  key: string,
  initial: T,
): [T, (next: T | ((current: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* Storage may be disabled. */
    }
  }, [key, value]);
  return [value, setValue];
}

function mean(values: number[]): number {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function metricsFor(trades: JournalTrade[], startingBalance = 25000) {
  const wins = trades.filter((trade) => trade.result === "Win");
  const losses = trades.filter((trade) => trade.result === "Loss");
  const decisive = wins.length + losses.length;
  const grossWins = wins.reduce(
    (sum, trade) => sum + Math.max(trade.pnl, 0),
    0,
  );
  const grossLosses = Math.abs(
    losses.reduce((sum, trade) => sum + Math.min(trade.pnl, 0), 0),
  );
  const profitFactor = grossLosses
    ? grossWins / grossLosses
    : grossWins
      ? grossWins
      : 0;
  const ordered = [...trades].sort((a, b) => a.date.localeCompare(b.date));
  let streak = 0;
  let peak = startingBalance;
  let curve = startingBalance;
  let drawdown = 0;
  ordered.forEach((trade) => {
    curve += trade.pnl;
    peak = Math.max(peak, curve);
    if (peak > 0) drawdown = Math.max(drawdown, ((peak - curve) / peak) * 100);
  });
  for (const trade of [...trades].sort((a, b) =>
    b.date.localeCompare(a.date),
  )) {
    const sign = trade.result === "Win" ? 1 : trade.result === "Loss" ? -1 : 0;
    if (!sign) break;
    if (streak && Math.sign(streak) !== sign) break;
    streak += sign;
  }
  const allR = trades.map((trade) => trade.r);
  const avg = mean(allR);
  const std = Math.sqrt(mean(allR.map((value) => (value - avg) ** 2)));
  const adherent = trades.length
    ? Math.round(
        (1 -
          trades.filter((trade) => trade.rulesBroken.length).length /
            trades.length) *
          100,
      )
    : 0;
  return {
    total: trades.length,
    winRate: decisive ? (wins.length / decisive) * 100 : 0,
    profitFactor,
    net: trades.reduce((sum, trade) => sum + trade.pnl, 0),
    averageR: avg,
    drawdown,
    streak,
    adherent,
    grossWins,
    grossLosses,
    sharpe: std ? (avg / std) * Math.sqrt(12) : 0,
  };
}

function averageAt(values: number[], end: number, length: number): number {
  const start = Math.max(0, end - length + 1);
  const selected = values.slice(start, end + 1);
  return selected.reduce((sum, value) => sum + value, 0) / selected.length;
}

function rsiAt(values: number[], end: number, period = 14): number {
  let gains = 0;
  let losses = 0;
  for (let index = Math.max(1, end - period + 1); index <= end; index += 1) {
    const change = values[index] - values[index - 1];
    gains += Math.max(change, 0);
    losses += Math.max(-change, 0);
  }
  if (!losses) return 100;
  return 100 - 100 / (1 + gains / losses);
}

function runBacktest(
  instrument: string,
  strategy: Indicator,
  candles: Candle[],
  risk: number,
  name: string,
): BacktestResult {
  const closes = candles.map((candle) => candle.close);
  const raw: BacktestTrade[] = [];
  const isIndex = instrument === "NAS100";
  const stopFraction = isIndex ? 0.012 : 0.005;
  const evaluate = (index: number, direction: Direction) => {
    const exitIndex = Math.min(index + 6, candles.length - 1);
    const entry = closes[index];
    const exit = closes[exitIndex];
    const movement = direction === "Long" ? exit - entry : entry - exit;
    const r = Math.max(-2.4, Math.min(3.6, movement / (entry * stopFraction)));
    raw.push({
      date: candles[index].date,
      direction,
      entry,
      exit,
      r,
      pnl: Math.round(r * risk * 100) / 100,
      result: r > 0.1 ? "Win" : r < -0.1 ? "Loss" : "Flat",
    });
  };
  for (let index = 28; index < candles.length - 7; index += 1) {
    let signal: Direction | null = null;
    if (strategy === "MA crossover") {
      const fast = averageAt(closes, index, 8);
      const slow = averageAt(closes, index, 21);
      const previousFast = averageAt(closes, index - 1, 8);
      const previousSlow = averageAt(closes, index - 1, 21);
      if (fast > slow && previousFast <= previousSlow) signal = "Long";
      if (fast < slow && previousFast >= previousSlow) signal = "Short";
    } else if (strategy === "RSI reversal") {
      const rsi = rsiAt(closes, index);
      if (rsi < 34) signal = "Long";
      if (rsi > 66) signal = "Short";
    } else if (strategy === "MACD crossover") {
      const macd = averageAt(closes, index, 12) - averageAt(closes, index, 26);
      const previous =
        averageAt(closes, index - 1, 12) - averageAt(closes, index - 1, 26);
      const signalLine = averageAt(
        closes.map(
          (_, cursor) =>
            averageAt(closes, cursor, 12) - averageAt(closes, cursor, 26),
        ),
        index,
        9,
      );
      const previousLine = averageAt(
        closes.map(
          (_, cursor) =>
            averageAt(closes, cursor, 12) - averageAt(closes, cursor, 26),
        ),
        index - 1,
        9,
      );
      if (macd > signalLine && previous <= previousLine) signal = "Long";
      if (macd < signalLine && previous >= previousLine) signal = "Short";
    } else {
      const rangeHigh = Math.max(...closes.slice(index - 20, index));
      const rangeLow = Math.min(...closes.slice(index - 20, index));
      if (closes[index] > rangeHigh) signal = "Long";
      if (closes[index] < rangeLow) signal = "Short";
    }
    if (
      signal &&
      (!raw.length ||
        index -
          candles.findIndex(
            (candle) => candle.date === raw[raw.length - 1].date,
          ) >
          5)
    )
      evaluate(index, signal);
  }
  if (raw.length < 8) {
    for (let index = 34; index < candles.length - 7; index += 20) {
      if (
        raw.length < 18 &&
        (!raw.length ||
          candles.findIndex(
            (candle) => candle.date === raw[raw.length - 1].date,
          ) <
            index - 5)
      ) {
        evaluate(index, closes[index] >= closes[index - 5] ? "Long" : "Short");
      }
    }
  }
  const equity = [{ date: candles[0]?.date ?? "", balance: 10000 }];
  let balance = 10000;
  raw.forEach((trade) => {
    balance += trade.pnl;
    equity.push({ date: trade.date, balance });
  });
  let highWater = 10000;
  let maxDrawdown = 0;
  equity.forEach((point) => {
    highWater = Math.max(highWater, point.balance);
    maxDrawdown = Math.max(
      maxDrawdown,
      ((highWater - point.balance) / highWater) * 100,
    );
  });
  const winners = raw.filter((trade) => trade.result === "Win");
  const losers = raw.filter((trade) => trade.result === "Loss");
  const grossWin = winners.reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(losers.reduce((sum, trade) => sum + trade.pnl, 0));
  const rs = raw.map((trade) => trade.r);
  const rMean = mean(rs);
  const rStd = Math.sqrt(mean(rs.map((value) => (value - rMean) ** 2)));
  const byMonth = new Map<string, number>();
  raw.forEach((trade) => {
    const month = format(parseISO(trade.date), "MMM");
    byMonth.set(month, (byMonth.get(month) ?? 0) + trade.pnl);
  });
  const monthly = [...byMonth].map(([month, pnl]) => ({ month, pnl }));
  const weekMap = new Map<string, number>();
  raw.forEach((trade) => {
    const date = parseISO(trade.date);
    const key = `${format(date, "MMM")}-${Math.ceil(date.getDate() / 7)}`;
    weekMap.set(key, (weekMap.get(key) ?? 0) + trade.pnl);
  });
  const heatmap = [...weekMap].map(([key, value]) => {
    const [month, week] = key.split("-");
    return { month, week: Number(week), value };
  });
  return {
    summary: {
      name,
      instrument,
      strategy,
      trades: raw.length,
      winRate: raw.length
        ? (winners.length / Math.max(1, winners.length + losers.length)) * 100
        : 0,
      profitFactor: grossLoss ? grossWin / grossLoss : grossWin ? grossWin : 0,
      maxDrawdown,
      sharpe: rStd ? (rMean / rStd) * Math.sqrt(12) : 0,
      averageR: rMean,
      pnl: raw.reduce((sum, trade) => sum + trade.pnl, 0),
    },
    trades: raw,
    equity,
    monthly,
    heatmap,
  };
}

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>{children}</section>;
}

function PanelHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function MetricCard({
  label,
  value,
  change,
  detail,
  icon: Icon,
  color = "orange",
}: {
  label: string;
  value: string;
  change?: string;
  detail: string;
  icon: typeof Gauge;
  color?: string;
}) {
  return (
    <article className={`metric-card metric-${color}`}>
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">
          <Icon size={16} strokeWidth={1.8} />
        </span>
      </div>
      <div className="metric-value-row">
        <strong>{value}</strong>
        {change && <span className="metric-change">{change}</span>}
      </div>
      <p>{detail}</p>
    </article>
  );
}

function ProgressRing({
  value,
  size = 112,
  label = "adherence",
}: {
  value: number;
  size?: number;
  label?: string;
}) {
  const radius = 43;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-label={`${clamped}% ${label}`}>
        <circle className="ring-track" cx="50" cy="50" r={radius} />
        <circle
          className="ring-value"
          cx="50"
          cy="50"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
        />
      </svg>
      <div className="ring-copy">
        <strong>{clamped}%</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="chart-empty">
      <Activity size={20} />
      <span>{message}</span>
    </div>
  );
}

function App() {
  const [active, setActive] = useState<ModuleId>("dashboard");
  const [trades, setTrades] = usePersisted<JournalTrade[]>(
    "aperture.trades",
    makeSampleTrades(),
  );
  const [paper, setPaper] = usePersisted<PaperPosition[]>(
    "aperture.paper",
    makeInitialPaperPositions(),
  );
  const [rules, setRules] = usePersisted<TradingRule[]>(
    "aperture.rules",
    initialRules,
  );
  const [goals, setGoals] = usePersisted<Goal[]>(
    "aperture.goals",
    initialGoals,
  );
  const [checks, setChecks] = usePersisted<Record<string, boolean>>(
    "aperture.checks",
    Object.fromEntries(
      initialRules.map((rule, index) => [rule.id, index !== 2 && index !== 7]),
    ),
  );
  const [planNotes, setPlanNotes] = usePersisted<string[]>("aperture.plan", [
    "Map weekly and daily swing ranges, relevant supply / demand zones, and liquidity sweeps or pools.",
    "On 4H, map the current swing range and premium / discount, then refine zones and liquidity.",
    "On M15, establish immediate bias. Wait for higher-timeframe point-of-interest mitigation.",
    "Use M1 only after M15 mitigation. Take a documented Entry Model 1–4 and follow the management plan.",
  ]);
  const [savedRuns, setSavedRuns] = usePersisted<BacktestSummary[]>(
    "aperture.backtests",
    [],
  );
  const [reviews, setReviews] = usePersisted<number>("aperture.reviews", 3);
  const [riskSettings, setRiskSettings] = usePersisted("aperture.risk", {
    balance: 25000,
    riskPct: 0.5,
    dailyLossPct: 2,
    maxPositions: 3,
    stopValue: 10,
  });
  const [stopDistance, setStopDistance] = useState(25);
  const [activeInstrument, setActiveInstrument] = useState("EUR/USD");
  const [indicator, setIndicator] = useState<Indicator>("MA crossover");
  const [strategyName, setStrategyName] = useState("HTF mitigation · model A");
  const [modal, setModal] = useState<ModalType>(null);
  const [closingId, setClosingId] = useState("");
  const [toast, setToast] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [traderType, setTraderType] = usePersisted(
    "aperture.traderType",
    "Swing trader",
  );
  const [marketStep, setMarketStep] = useState(0);
  const [timeFilter, setTimeFilter] = useState("All trades");
  const [searchTerm, setSearchTerm] = useState("");
  const [noTradeEvents, setNoTradeEvents] = usePersisted<string[]>(
    "aperture.noTradeEvents",
    [],
  );
  const [cloudUser, setCloudUser] = useState<CloudUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [cloudLoadStatus, setCloudLoadStatus] = useState<"loading" | "ready">(
    supabase ? "loading" : "ready",
  );
  const lastSyncedSnapshotRef = useRef<string | null>(null);
  const [today] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [currentTime] = useState(() => format(new Date(), "HH:mm"));
  const [dayLabel] = useState(() => format(new Date(), "EEEE, MMMM d"));
  const [weekdayLabel] = useState(() => format(new Date(), "EEEE").toUpperCase());
  const [topbarDateLabel] = useState(() => format(new Date(), "MMM d, yyyy"));
  const [currentYear] = useState(() => format(new Date(), "yyyy"));
  const [sessionNow] = useState(() => new Date());
  const [_goalDeadlineDefault] = useState(() =>
    format(subDays(new Date(), -30), "yyyy-MM-dd"),
  );
  const metadataName = cloudUser?.user_metadata?.full_name;
  const traderName =
    typeof metadataName === "string" && metadataName.trim()
      ? metadataName
      : cloudUser?.email?.split("@")[0] ?? "Trader";
  const greeting =
    Number(currentTime.slice(0, 2)) < 12
      ? "Good morning"
      : Number(currentTime.slice(0, 2)) < 17
        ? "Good afternoon"
        : "Good evening";
  const cloudReady = !supabase || !cloudUser || cloudLoadStatus === "ready";

  const [backtest, setBacktest] = useState<BacktestResult>(() =>
    runBacktest(
      "EUR/USD",
      "MA crossover",
      generateMarketData("EUR/USD"),
      100,
      "HTF mitigation · model A",
    ),
  );
  const stats = metricsFor(trades, riskSettings.balance);
  const enabledRules = rules.filter((rule) => rule.enabled);
  const dailyCheckRate = enabledRules.length
    ? (enabledRules.filter((rule) => checks[rule.id]).length /
        enabledRules.length) *
      100
    : 0;
  const adherence = Math.round(stats.adherent * 0.72 + dailyCheckRate * 0.28);
  const dailyPnl = trades
    .filter((trade) => trade.date === today)
    .reduce((sum, trade) => sum + trade.pnl, 0);
  const currentPage =
    navItems.find((item) => item.id === active) ?? navItems[0];
  const currentMarket = instruments.map((instrument, index) => {
    const change =
      (Math.sin((marketStep + index + 1) * 0.73) * 0.35 + 0.14) / 100;
    return { ...instrument, price: instrument.base * (1 + change), change };
  });

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setCloudUser(data.session?.user ?? null);
      if (!data.session) setCloudLoadStatus("ready");
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCloudUser(session?.user ?? null);
      if (!session) setCloudLoadStatus("ready");
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const notify = useCallback((message: string) => {
    setToast(message);
  }, []);

  useEffect(() => {
    if (!cloudUser || !supabase) return;
    let mounted = true;
    lastSyncedSnapshotRef.current = null;
    void loadCloudWorkspace(cloudUser.id)
      .then((workspace) => {
        if (!mounted) return;
        if (workspace) {
          setTrades(workspace.trades);
          setPaper(workspace.paper);
          setRules(workspace.rules);
          setGoals(workspace.goals);
          setSavedRuns(workspace.backtests);
          setRiskSettings(workspace.riskSettings);
          setPlanNotes(workspace.planNotes);
          setChecks(workspace.checks);
          setTraderType(workspace.traderType);
          setReviews(workspace.reviews);
          lastSyncedSnapshotRef.current = JSON.stringify(workspace);
        }
        setCloudLoadStatus("ready");
      })
      .catch((error: Error) => {
        if (mounted) {
          setCloudLoadStatus("ready");
          notify(`Cloud load failed: ${error.message}`);
        }
      });
    return () => {
      mounted = false;
    };
  }, [
    cloudUser,
    notify,
    setTrades,
    setPaper,
    setRules,
    setGoals,
    setSavedRuns,
    setRiskSettings,
    setPlanNotes,
    setChecks,
    setTraderType,
    setReviews,
  ]);

  useEffect(() => {
    if (!cloudUser || !cloudReady || cloudLoadStatus !== "ready") return;
    const workspace: CloudWorkspace = {
      trades,
      paper,
      rules,
      goals,
      backtests: savedRuns,
      riskSettings,
      planNotes,
      checks,
      traderType,
      reviews,
    };
    const snapshot = JSON.stringify(workspace);
    if (lastSyncedSnapshotRef.current === snapshot) return;
    lastSyncedSnapshotRef.current = snapshot;
    const timeout = window.setTimeout(() => {
      void syncCloudWorkspace(cloudUser.id, workspace).catch((error: Error) =>
        notify(`Cloud sync failed: ${error.message}`),
      );
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [
    cloudUser,
    cloudReady,
    cloudLoadStatus,
    trades,
    paper,
    rules,
    goals,
    savedRuns,
    riskSettings,
    planNotes,
    checks,
    traderType,
    reviews,
    notify,
  ]);

  function tradeFromForm(
    form: FormData,
    source: "Journal" | "Forward" = "Journal",
  ): JournalTrade {
    const read = (name: string) => String(form.get(name) ?? "");
    const result = read("result") as JournalTrade["result"];
    const broken = enabledRules
      .filter((rule) => !checks[rule.id])
      .map((rule) => rule.id);
    return {
      id: crypto.randomUUID(),
      date: read("date") || today,
      time: read("time") || currentTime,
      instrument: read("instrument"),
      direction: read("direction") as Direction,
      entry: Number(read("entry")) || 0,
      stopLoss: Number(read("stopLoss")) || 0,
      takeProfit: Number(read("takeProfit")) || 0,
      result,
      pnl: Number(read("pnl")) || 0,
      r: Number(read("r")) || 0,
      setup: read("setup"),
      timeframe: read("timeframe"),
      session: read("session") as SessionName,
      emotion: read("emotion"),
      notes: read("notes"),
      screenshotUrl: read("screenshotUrl") || undefined,
      tags: [read("tag"), read("tag2")].filter(Boolean),
      rulesBroken: broken,
      source,
    };
  }

  function handleModalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (modal === "journal") {
      const nextTrade = tradeFromForm(form);
      setTrades((current) => [nextTrade, ...current]);
      setModal(null);
      notify(
        nextTrade.rulesBroken.length
          ? "Trade logged · rule exception flagged"
          : "Trade logged · plan adherence updated",
      );
      return;
    }
    if (modal === "paper") {
      if (paper.length >= riskSettings.maxPositions) {
        notify(
          "Maximum open position limit reached · close a paper trade first",
        );
        return;
      }
      const value = (field: string) => String(form.get(field) ?? "");
      const symbol = value("instrument");
      const nextPaper: PaperPosition = {
        id: crypto.randomUUID(),
        openedAt: value("date") || today,
        instrument: symbol,
        direction: value("direction") as Direction,
        entry: Number(value("entry")),
        stopLoss: Number(value("stopLoss")),
        takeProfit: Number(value("takeProfit")),
        size: Number(value("size")),
        setup: value("setup"),
        timeframe: value("timeframe"),
        session: value("session") as SessionName,
        currentPrice:
          currentMarket.find((item) => item.symbol === symbol)?.price ??
          Number(value("entry")),
      };
      setPaper((current) => [nextPaper, ...current]);
      setModal(null);
      notify("Paper position opened");
      return;
    }
    if (modal === "close") {
      const position = paper.find((item) => item.id === closingId);
      if (!position) return;
      const r = Number(form.get("r")) || 0;
      const result = String(form.get("result")) as JournalTrade["result"];
      const risk =
        Math.abs(position.entry - position.stopLoss) *
        position.size *
        (position.instrument === "EUR/USD" ? 100000 : 1);
      const nextTrade: JournalTrade = {
        id: crypto.randomUUID(),
        date: today,
        time: currentTime,
        instrument: position.instrument,
        direction: position.direction,
        entry: position.entry,
        stopLoss: position.stopLoss,
        takeProfit: position.takeProfit,
        result,
        pnl: r * (risk || 100),
        r,
        setup: position.setup,
        timeframe: position.timeframe,
        session: position.session,
        emotion: String(form.get("emotion")),
        notes: String(form.get("notes")),
        tags: ["Forward test"],
        rulesBroken: enabledRules
          .filter((rule) => !checks[rule.id])
          .map((rule) => rule.id),
        source: "Forward",
      };
      setTrades((current) => [nextTrade, ...current]);
      setPaper((current) => current.filter((item) => item.id !== position.id));
      setModal(null);
      notify("Forward trade closed · journal entry created");
      return;
    }
    if (modal === "goal") {
      const value = (field: string) => String(form.get(field) ?? "");
      setGoals((current) => [
        {
          id: crypto.randomUUID(),
          title: value("title"),
          description: value("description"),
          category: value("category") as Goal["category"],
          metric: value("metric") as Goal["metric"],
          target: Number(value("target")) || 1,
          deadline: value("deadline"),
          achieved: false,
        },
        ...current,
      ]);
      setModal(null);
      notify("Goal added · progress will update from your activity");
    }
  }

  function runCurrentBacktest() {
    const next = runBacktest(
      activeInstrument,
      indicator,
      generateMarketData(activeInstrument),
      (riskSettings.balance * riskSettings.riskPct) / 100,
      strategyName,
    );
    setBacktest(next);
    notify(`${next.summary.trades} historical signals tested`);
  }

  function saveBacktest() {
    const record: BacktestSummary = {
      ...backtest.summary,
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
    };
    setSavedRuns((current) => [record, ...current]);
    notify("Backtest saved to analytics comparison");
  }

  function exportBacktest() {
    const lines = [
      ["date", "direction", "entry", "exit", "R", "P&L", "result"],
      ...backtest.trades.map((trade) => [
        trade.date,
        trade.direction,
        trade.entry,
        trade.exit,
        trade.r,
        trade.pnl,
        trade.result,
      ]),
    ];
    const file = new Blob([lines.map((line) => line.join(",")).join("\n")], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${backtest.summary.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-backtest.csv`;
    link.click();
    URL.revokeObjectURL(url);
    notify("Backtest trade list exported");
  }

  function toggleCheck(id: string) {
    setChecks((current) => ({ ...current, [id]: !current[id] }));
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      notify("Add Supabase credentials to enable cloud sync");
      return;
    }
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const { error } =
      authMode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    if (error) {
      notify(error.message);
      return;
    }
    if (authMode === "sign-up")
      notify("Account created · check email if confirmation is enabled");
    else notify("Signed in · workspace cloud sync is active");
    setAuthOpen(false);
  }
  function metricForGoal(goal: Goal): number {
    if (goal.metric === "trades") return trades.length;
    if (goal.metric === "win-rate") return Math.round(stats.winRate);
    if (goal.metric === "adherence") return adherence;
    return reviews;
  }

  const searchedTrades = trades
    .filter((trade) => {
      const matchesText =
        `${trade.instrument} ${trade.setup} ${trade.session} ${trade.notes} ${trade.tags.join(" ")}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
      const date = parseISO(trade.date);
      const matchesTime =
        timeFilter === "All trades" ||
        (timeFilter === "Today"
          ? trade.date === today
          : timeFilter === "This month"
            ? isThisMonth(date)
            : timeFilter === "This year"
              ? format(date, "yyyy") === currentYear
              : isThisWeek(date, { weekStartsOn: 1 }));
      return matchesText && matchesTime;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const equity = [...trades]
    .sort((a, b) => a.date.localeCompare(b.date))
    .reduce<{ date: string; pnl: number; balance: number }[]>(
      (points, trade) => {
        const last = points[points.length - 1]?.balance ?? riskSettings.balance;
        points.push({
          date: trade.date,
          pnl: trade.pnl,
          balance: last + trade.pnl,
        });
        return points;
      },
      [],
    );
  const monthlyPerformance = [
    ...new Set(trades.map((trade) => format(parseISO(trade.date), "MMM yy"))),
  ]
    .slice(-6)
    .map((month) => ({
      month,
      pnl: trades
        .filter((trade) => format(parseISO(trade.date), "MMM yy") === month)
        .reduce((sum, trade) => sum + trade.pnl, 0),
    }));
  const setupPerformance = setupNames.map((name) => {
    const sample = trades.filter((trade) => trade.setup === name);
    return {
      setup: name.replace("Entry Model ", "Model "),
      winRate: Math.round(metricsFor(sample).winRate),
      trades: sample.length,
      pnl: sample.reduce((sum, trade) => sum + trade.pnl, 0),
    };
  });
  const sessionPerformance = ["Asia", "London", "New York", "Overlap"].map(
    (session) => {
      const sample = trades.filter((trade) => trade.session === session);
      return {
        session,
        trades: sample.length,
        pnl: sample.reduce((sum, trade) => sum + trade.pnl, 0),
        winRate: Math.round(metricsFor(sample).winRate),
      };
    },
  );
  const todaysLossLimit =
    (riskSettings.balance * riskSettings.dailyLossPct) / 100;
  const dailyRiskUsed = Math.max(0, -dailyPnl);
  const riskRemaining = Math.max(0, todaysLossLimit - dailyRiskUsed);

  function renderDashboard() {
    const checklistPreview = enabledRules.slice(0, 5);
    const criticalChecksRemaining = enabledRules.filter(
      (rule) => rule.priority === "Critical" && !checks[rule.id],
    ).length;
    const dashboardLossLimit =
      (riskSettings.balance * riskSettings.dailyLossPct) / 100;
    const dashboardDailyLoss = Math.max(0, -dailyPnl);
    const dashboardLossPct = dashboardLossLimit
      ? Math.min(100, (dashboardDailyLoss / dashboardLossLimit) * 100)
      : 0;
    const positionsAtCapacity = paper.length >= riskSettings.maxPositions;
    const dailyLossLimitReached =
      dashboardLossLimit > 0 && dashboardDailyLoss >= dashboardLossLimit;
    const guardianStatus = dailyLossLimitReached
      ? "limit"
      : dashboardLossLimit <= 0 ||
          dashboardLossPct >= 70 ||
          criticalChecksRemaining > 0 ||
          positionsAtCapacity
        ? "review"
        : "clear";
    const guardianLabel =
      guardianStatus === "limit"
        ? "DAILY LIMIT REACHED"
        : guardianStatus === "review"
          ? "REVIEW REQUIRED"
          : "WITHIN LIMITS";
    const recent = [...trades]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
    return (
      <>
        <div className="welcome-row">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot" /> {weekdayLabel} · MARKET PREP
            </div>
            <h1>
              {greeting}, {traderName}<span className="heading-period">.</span>
            </h1>
            <p className="page-intro">
              {dayLabel}{" "}
              <span className="intro-separator">/</span>{" "}
              {pageDescriptions.dashboard}
            </p>
          </div>
          <div className="welcome-actions">
            <span className="sample-data-label">
              <span /> {cloudUser ? "CLOUD WORKSPACE" : "DEMO WORKSPACE"}
            </span>
            <button
              className="button button-primary"
              onClick={() => setModal("journal")}
            >
              <Plus size={16} /> Log a trade
            </button>
          </div>
        </div>
        <div className="market-strip">
          {currentMarket.map((item) => (
            <div className="market-quote" key={item.symbol}>
              <div className="instrument-mark">
                {item.symbol === "EUR/USD" ? "€" : "N"}
              </div>
              <div className="quote-name">
                <strong>{item.symbol}</strong>
                <span>{item.name}</span>
              </div>
              <div className="quote-number">
                <strong>{formatPrice(item.symbol, item.price)}</strong>
                <span className={item.change >= 0 ? "positive" : "negative"}>
                  {item.change >= 0 ? "+" : ""}
                  {(item.change * 100).toFixed(2)}%
                </span>
              </div>
              <div className="sparkline" aria-hidden="true">
                <span
                  style={{
                    height: `${30 + Math.abs(Math.sin(marketStep + item.base)) * 24}%`,
                  }}
                />
                <span
                  style={{
                    height: `${40 + Math.abs(Math.cos(marketStep + item.base)) * 34}%`,
                  }}
                />
                <span
                  style={{
                    height: `${26 + Math.abs(Math.sin(marketStep + 2)) * 45}%`,
                  }}
                />
                <span
                  style={{
                    height: `${44 + Math.abs(Math.cos(marketStep + 3)) * 31}%`,
                  }}
                />
                <span
                  style={{
                    height: `${34 + Math.abs(Math.sin(marketStep + 4)) * 42}%`,
                  }}
                />
                <span
                  style={{
                    height: `${40 + Math.abs(Math.cos(marketStep + 5)) * 38}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="metric-grid">
          <MetricCard
            label="Net P&L"
            value={currency(stats.net, true)}
            change={`${stats.net >= 0 ? "+" : ""}${((stats.net / riskSettings.balance) * 100).toFixed(1)}%`}
            detail="Across your trade journal"
            icon={TrendingUp}
            color={stats.net >= 0 ? "green" : "red"}
          />
          <MetricCard
            label="Win rate"
            value={`${stats.winRate.toFixed(0)}%`}
            detail={`${trades.filter((trade) => trade.result === "Win").length} wins · decisive trades`}
            icon={Activity}
            color="orange"
          />
          <MetricCard
            label="Profit factor"
            value={stats.profitFactor.toFixed(2)}
            detail="Gross profit / gross loss"
            icon={Zap}
            color="blue"
          />
          <MetricCard
            label="Plan adherence"
            value={`${adherence}%`}
            detail={`${stats.adherent}% historical · today ${dailyCheckRate.toFixed(0)}%`}
            icon={ShieldCheck}
            color="olive"
          />
        </div>
        <Panel className={`risk-guardian-panel risk-guardian-${guardianStatus}`}>
          <PanelHeading
            title="Risk guardian"
            subtitle="Daily loss, critical controls and simulated exposure"
            action={
              <span className={`guardian-status guardian-status-${guardianStatus}`}>
                <span />
                {guardianLabel}
              </span>
            }
          />
          <div className="guardian-grid">
            <div className="guardian-loss">
              <div className="guardian-stat-heading">
                <span>Daily loss limit</span>
                <strong>
                  {currency(dashboardDailyLoss)} <small>/ {currency(dashboardLossLimit)}</small>
                </strong>
              </div>
              <div className="guardian-meter">
                <span
                  className={dashboardLossPct >= 70 ? "guardian-meter-warn" : ""}
                  style={{ width: `${dashboardLossPct}%` }}
                />
              </div>
              <div className="guardian-stat-foot">
                <span>
                  {dashboardLossLimit > 0
                    ? `${currency(Math.max(0, dashboardLossLimit - dashboardDailyLoss))} remaining`
                    : "Set a daily loss limit"}
                </span>
                <span>{dashboardLossPct.toFixed(0)}% used</span>
              </div>
            </div>
            <div className="guardian-stat">
              <span>Critical checks</span>
              <strong>{criticalChecksRemaining}</strong>
              <small>
                {criticalChecksRemaining === 1 ? "item needs review" : "items need review"}
              </small>
            </div>
            <div className="guardian-stat">
              <span>Paper positions</span>
              <strong>
                {paper.length}<small> / {riskSettings.maxPositions}</small>
              </strong>
              <small>
                {positionsAtCapacity
                  ? "Capacity reached"
                  : `${riskSettings.maxPositions - paper.length} slots available`}
              </small>
            </div>
          </div>
          <div className="guardian-footer">
            <span>
              <ShieldAlert size={14} />
              Paper exposure only. Live broker execution and automatic lockout are not connected.
            </span>
            <div>
              <button className="text-button" onClick={() => setActive("rules")}>
                Review checks <ArrowRight size={13} />
              </button>
              <button className="text-button" onClick={() => setActive("risk")}>
                Risk settings <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </Panel>
        <div className="dashboard-grid">
          <Panel className="equity-panel">
            <PanelHeading
              title="Equity curve"
              subtitle="Cumulative journal P&L · all instruments"
              action={
                <button
                  className="icon-button subtle"
                  title="View analytics"
                  onClick={() => setActive("analytics")}
                >
                  <ArrowRight size={17} />
                </button>
              }
            />
            <div className="equity-legend">
              <span className="legend-line" /> Account equity{" "}
              <span className="chart-period">
                LAST 6 MONTHS <ChevronDown size={13} />
              </span>
            </div>
            <div className="chart-wrap chart-equity">
              {equity.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={equity}
                    margin={{ top: 12, right: 8, bottom: 0, left: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="equity-fill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#d77849"
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="100%"
                          stopColor="#d77849"
                          stopOpacity={0.015}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      vertical={false}
                      stroke="#eeeae2"
                      strokeDasharray="4 6"
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) =>
                        format(parseISO(value), "MMM d")
                      }
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#9d9b92", fontSize: 10 }}
                      minTickGap={50}
                    />
                    <YAxis
                      tickFormatter={(value) => currency(value, true)}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#9d9b92", fontSize: 10 }}
                      width={54}
                      domain={["dataMin - 120", "dataMax + 120"]}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      labelFormatter={(value) =>
                        format(parseISO(String(value)), "MMM d, yyyy")
                      }
                      formatter={(value) => [currency(Number(value)), "Equity"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke="#d77849"
                      strokeWidth={2.2}
                      fill="url(#equity-fill)"
                      activeDot={{
                        r: 4,
                        fill: "#d77849",
                        stroke: "#fff",
                        strokeWidth: 2,
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmpty message="Log a trade to build your equity curve." />
              )}
            </div>
            <div className="chart-foot">
              <span>
                Opening balance{" "}
                <strong>{currency(riskSettings.balance)}</strong>
              </span>
              <span>
                Current equity{" "}
                <strong>{currency(riskSettings.balance + stats.net)}</strong>
              </span>
              <span>
                Max drawdown <strong>{stats.drawdown.toFixed(1)}%</strong>
              </span>
            </div>
          </Panel>
          <Panel className="adherence-panel">
            <PanelHeading
              title="Process score"
              subtitle="Journal behavior + today’s checklist"
              action={
                <button
                  className="icon-button subtle"
                  title="Open trading plan"
                  onClick={() => setActive("plan")}
                >
                  <ArrowRight size={17} />
                </button>
              }
            />
            <div className="adherence-center">
              <ProgressRing value={adherence} size={138} label="adherence" />
              <p>
                {adherence >= 80
                  ? "You are building a consistent process."
                  : "A little more preparation can lift this score."}
              </p>
            </div>
            <div className="score-breakdown">
              <div>
                <span>Trade rule compliance</span>
                <strong>{stats.adherent}%</strong>
              </div>
              <div className="mini-progress">
                <span style={{ width: `${stats.adherent}%` }} />
              </div>
              <div>
                <span>Today’s pre-trade checks</span>
                <strong>{dailyCheckRate.toFixed(0)}%</strong>
              </div>
              <div className="mini-progress">
                <span style={{ width: `${dailyCheckRate}%` }} />
              </div>
            </div>
            <button
              className="text-button score-link"
              onClick={() => setActive("rules")}
            >
              Complete pre-trade checklist <ArrowRight size={14} />
            </button>
          </Panel>
          <Panel className="monthly-panel">
            <PanelHeading
              title="Monthly performance"
              subtitle="Realized journal P&L by month"
              action={
                <button
                  className="icon-button subtle"
                  title="Open journal"
                  onClick={() => setActive("journal")}
                >
                  <ArrowRight size={17} />
                </button>
              }
            />
            <div className="chart-wrap chart-monthly">
              {monthlyPerformance.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthlyPerformance}
                    margin={{ top: 10, right: 4, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke="#eeeae2"
                      strokeDasharray="4 6"
                    />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#9d9b92", fontSize: 10 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => currency(value, true)}
                      tick={{ fill: "#9d9b92", fontSize: 10 }}
                      width={48}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={(value) => [currency(Number(value)), "P&L"]}
                    />
                    <Bar dataKey="pnl" radius={[5, 5, 0, 0]}>
                      {monthlyPerformance.map((entry, index) => (
                        <Cell
                          key={entry.month}
                          fill={
                            entry.pnl >= 0
                              ? index === monthlyPerformance.length - 1
                                ? "#d77849"
                                : "#7fa58e"
                              : "#c66d5c"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmpty message="Monthly results appear as trades are logged." />
              )}
            </div>
          </Panel>
          <Panel className="checklist-panel">
            <PanelHeading
              title="Pre-trade checklist"
              subtitle="A quick pause before the next entry"
              action={
                <span className="check-count">
                  {enabledRules.filter((rule) => checks[rule.id]).length}/
                  {enabledRules.length}
                </span>
              }
            />
            <div className="checklist-list">
              {checklistPreview.map((rule) => (
                <label
                  key={rule.id}
                  className={`checklist-item ${checks[rule.id] ? "checked" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(checks[rule.id])}
                    onChange={() => toggleCheck(rule.id)}
                  />
                  <span className="custom-check">
                    <Check size={12} />
                  </span>
                  <span>{rule.title}</span>
                  {rule.priority === "Critical" && (
                    <i className="priority-dot" />
                  )}
                </label>
              ))}
            </div>
            <button className="text-button" onClick={() => setActive("rules")}>
              Review all rules <ArrowRight size={14} />
            </button>
          </Panel>
          <Panel className="recent-panel">
            <PanelHeading
              title="Recent trades"
              subtitle="Latest journal activity"
              action={
                <button
                  className="text-button"
                  onClick={() => setActive("journal")}
                >
                  Full journal <ArrowRight size={14} />
                </button>
              }
            />
            <TradeTable
              trades={recent}
              compact
              onClick={() => setActive("journal")}
            />
          </Panel>
          <Panel className="goal-panel">
            <PanelHeading
              title="Focus goals"
              subtitle="Live progress from your journal"
              action={
                <button
                  className="icon-button subtle"
                  title="Open goals"
                  onClick={() => setActive("goals")}
                >
                  <ArrowRight size={17} />
                </button>
              }
            />
            <div className="goal-mini-list">
              {goals.slice(0, 3).map((goal) => {
                const current = metricForGoal(goal);
                const progress = Math.min(
                  100,
                  Math.round((current / Math.max(1, goal.target)) * 100),
                );
                return (
                  <div className="goal-mini" key={goal.id}>
                    <div>
                      <span>{goal.title}</span>
                      <strong>
                        {Math.min(current, goal.target)}
                        <small>
                          {" "}
                          / {goal.target}{" "}
                          {goal.metric === "adherence" ||
                          goal.metric === "win-rate"
                            ? "%"
                            : ""}
                        </small>
                      </strong>
                    </div>
                    <div className="mini-progress">
                      <span style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <button className="text-button" onClick={() => setActive("goals")}>
              Open goal review <ArrowRight size={14} />
            </button>
          </Panel>
          <Panel className="session-panel">
            <PanelHeading
              title="Session pulse"
              subtitle={`Times shown in ${Intl.DateTimeFormat().resolvedOptions().timeZone}`}
              action={
                <button
                  className="icon-button subtle"
                  title="Open sessions"
                  onClick={() => setActive("sessions")}
                >
                  <ArrowRight size={17} />
                </button>
              }
            />
            <SessionBars sessions={sessionPerformance} />
          </Panel>
        </div>
      </>
    );
  }

  function renderPlan() {
    return (
      <>
        <PageTitle
          eyebrow="PROCESS PLAYBOOK"
          title="Trading plan"
          subtitle={pageDescriptions.plan}
          action={
            <button
              className="button button-secondary"
              onClick={() => {
                setActive("rules");
                notify("Plan rules are editable in Rules & checklist");
              }}
            >
              <Settings2 size={15} /> Edit rule set
            </button>
          }
        />
        <div className="plan-hero">
          <div className="plan-hero-copy">
            <div className="eyebrow light-eyebrow">
              <span className="eyebrow-dot" /> PROCESS OVER PREDICTION
            </div>
            <h2>
              Prepare with context.
              <br />
              <em>Execute with patience.</em>
            </h2>
            <p>
              A higher-timeframe map becomes an entry only after mitigation,
              confirmation and a defined management plan.
            </p>
          </div>
          <div className="plan-hero-score">
            <span>LIVE PLAN ADHERENCE</span>
            <ProgressRing value={adherence} size={116} label="score" />
            <button
              className="button button-cream"
              onClick={() => setActive("journal")}
            >
              Review trade log <ArrowRight size={15} />
            </button>
          </div>
          <div className="plan-orbit orbit-one" />
          <div className="plan-orbit orbit-two" />
        </div>
        <div className="plan-columns">
          <Panel className="plan-stages-panel">
            <PanelHeading
              title="Multi-timeframe process"
              subtitle="Captured from your Notion plan · edit the working notes inline"
              action={
                <span className="notion-source">
                  <BookOpen size={13} /> NOTION EXPORT
                </span>
              }
            />
            <div className="plan-stage-list">
              {planStages.map((stage, index) => (
                <article className="plan-stage" key={stage.timeframe}>
                  <div className="stage-index">
                    0{index + 1}
                    <span>{stage.timeframe}</span>
                  </div>
                  <div className="stage-content">
                    <div className="stage-title-row">
                      <div>
                        <span className="stage-source">
                          {stage.source.toUpperCase()}
                        </span>
                        <h3>{stage.title}</h3>
                      </div>
                      <span className="stage-status">
                        <span /> ACTIVE
                      </span>
                    </div>
                    <textarea
                      aria-label={`Edit ${stage.title}`}
                      value={planNotes[index] ?? ""}
                      onChange={(event) =>
                        setPlanNotes((current) =>
                          current.map((note, noteIndex) =>
                            noteIndex === index ? event.target.value : note,
                          ),
                        )
                      }
                      rows={2}
                    />
                    <div className="stage-checks">
                      {stage.checklist.map((item) => (
                        <span key={item}>
                          <Check size={12} />
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </Panel>
          <div className="plan-side-column">
            <Panel>
              <PanelHeading
                title="Trading philosophy"
                subtitle="Working principles from the plan"
              />
              <div className="philosophy-list">
                {planPhilosophy.map((principle, index) => (
                  <div key={principle}>
                    <span>0{index + 1}</span>
                    <p>{principle}</p>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel>
              <PanelHeading
                title="Entry models"
                subtitle="Four documented model slots from the export"
                action={
                  <span className="muted-label">CRITERIA TO COMPLETE</span>
                }
              />
              <div className="entry-model-grid">
                {setupNames.map((name, index) => (
                  <button
                    key={name}
                    onClick={() => {
                      setActive("journal");
                      notify(`${name} is ready for a journal entry`);
                    }}
                  >
                    <span>0{index + 1}</span>
                    <strong>{name}</strong>
                    <small>Criteria not specified in export</small>
                  </button>
                ))}
              </div>
              <p className="source-note">
                The export names four entry models but leaves their rules and
                examples blank.
              </p>
            </Panel>
            <Panel className="plan-gap-panel">
              <div className="gap-icon">
                <CircleHelp size={17} />
              </div>
              <div>
                <strong>Risk parameters were left open</strong>
                <p>
                  No numeric max-loss or per-trade limit was specified. Add your
                  limits in Risk management.
                </p>
                <button
                  className="text-button"
                  onClick={() => setActive("risk")}
                >
                  Set risk limits <ArrowRight size={14} />
                </button>
              </div>
            </Panel>
          </div>
        </div>
      </>
    );
  }

  function renderBacktest() {
    return (
      <>
        <PageTitle
          eyebrow="STRATEGY RESEARCH"
          title="Backtest lab"
          subtitle={pageDescriptions.backtest}
          action={
            <button
              className="button button-secondary"
              onClick={exportBacktest}
            >
              <Download size={15} /> Export results
            </button>
          }
        />
        <Panel className="builder-panel">
          <div className="builder-label">
            <FlaskConical size={17} />
            <span>STRATEGY BUILDER</span>
            <i>DETERMINISTIC SAMPLE DATA · NO EXTERNAL FEED</i>
          </div>
          <div className="builder-controls">
            <label>
              <span>Strategy name</span>
              <input
                value={strategyName}
                onChange={(event) => setStrategyName(event.target.value)}
              />
            </label>
            <label>
              <span>Instrument</span>
              <select
                value={activeInstrument}
                onChange={(event) => setActiveInstrument(event.target.value)}
              >
                {instruments.map((item) => (
                  <option key={item.symbol}>{item.symbol}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Entry model</span>
              <select
                value={indicator}
                onChange={(event) =>
                  setIndicator(event.target.value as Indicator)
                }
              >
                {(
                  [
                    "MA crossover",
                    "RSI reversal",
                    "MACD crossover",
                    "Range breakout",
                  ] as Indicator[]
                ).map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Risk / trade</span>
              <div className="input-with-prefix">
                <span>$</span>
                <input
                  type="number"
                  min="1"
                  value={Math.round(
                    (riskSettings.balance * riskSettings.riskPct) / 100,
                  )}
                  onChange={(event) =>
                    setRiskSettings({
                      ...riskSettings,
                      riskPct:
                        (Number(event.target.value) / riskSettings.balance) *
                        100,
                    })
                  }
                />
              </div>
            </label>
            <button
              className="button button-primary run-button"
              onClick={runCurrentBacktest}
            >
              <Zap size={15} /> Run backtest
            </button>
          </div>
          <div className="builder-note">
            <span>
              <Check size={13} /> 184 daily OHLCV bars
            </span>
            <span>
              <Check size={13} /> 6-month window
            </span>
            <span>
              <Check size={13} /> Stop-based R sizing
            </span>
            <span className="builder-warning">
              <CircleHelp size={13} /> Synthetic data is for workflow
              demonstration, not market research.
            </span>
          </div>
        </Panel>
        <div className="metric-grid backtest-metrics">
          <MetricCard
            label="Net return"
            value={currency(backtest.summary.pnl, true)}
            detail="Fixed fractional risk per signal"
            icon={TrendingUp}
            color={backtest.summary.pnl >= 0 ? "green" : "red"}
          />
          <MetricCard
            label="Win rate"
            value={`${backtest.summary.winRate.toFixed(1)}%`}
            detail={`${backtest.summary.trades} closed signals`}
            icon={Activity}
            color="orange"
          />
          <MetricCard
            label="Profit factor"
            value={backtest.summary.profitFactor.toFixed(2)}
            detail="Gross wins / gross losses"
            icon={Zap}
            color="blue"
          />
          <MetricCard
            label="Max drawdown"
            value={`${backtest.summary.maxDrawdown.toFixed(1)}%`}
            detail={`Sharpe ${backtest.summary.sharpe.toFixed(2)} · avg ${backtest.summary.averageR.toFixed(2)}R`}
            icon={ShieldAlert}
            color="olive"
          />
        </div>
        <div className="backtest-grid">
          <Panel className="backtest-equity">
            <PanelHeading
              title="Strategy equity curve"
              subtitle={`${backtest.summary.name} · ${backtest.summary.instrument}`}
              action={
                <button
                  className="button button-secondary button-small"
                  onClick={saveBacktest}
                >
                  <Plus size={14} /> Save run
                </button>
              }
            />
            <div className="chart-wrap chart-large">
              {backtest.equity.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={backtest.equity}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="backtest-fill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#668675"
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="100%"
                          stopColor="#668675"
                          stopOpacity={0.01}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      vertical={false}
                      stroke="#eeeae2"
                      strokeDasharray="4 6"
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => format(parseISO(value), "MMM")}
                      minTickGap={28}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#9d9b92", fontSize: 10 }}
                    />
                    <YAxis
                      tickFormatter={(value) => currency(value, true)}
                      width={52}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#9d9b92", fontSize: 10 }}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      labelFormatter={(value) =>
                        format(parseISO(String(value)), "MMM d, yyyy")
                      }
                      formatter={(value) => [currency(Number(value)), "Equity"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke="#668675"
                      strokeWidth={2}
                      fill="url(#backtest-fill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmpty message="No signals found in this window. Try a different entry model." />
              )}
            </div>
          </Panel>
          <Panel className="backtest-compare">
            <PanelHeading
              title="Compare saved runs"
              subtitle="Your research shelf"
            />
            <div className="compare-current">
              <span className="compare-mark">
                <FlaskConical size={16} />
              </span>
              <div>
                <strong>{backtest.summary.name}</strong>
                <small>Current run · {backtest.summary.strategy}</small>
              </div>
              <b
                className={backtest.summary.pnl >= 0 ? "positive" : "negative"}
              >
                {currency(backtest.summary.pnl, true)}
              </b>
            </div>
            {savedRuns.length ? (
              savedRuns.slice(0, 4).map((run) => (
                <div className="compare-item" key={run.id}>
                  <div>
                    <strong>{run.name}</strong>
                    <small>
                      {run.instrument} · {run.trades} trades ·{" "}
                      {run.winRate.toFixed(0)}% win
                    </small>
                  </div>
                  <b className={run.pnl >= 0 ? "positive" : "negative"}>
                    {currency(run.pnl, true)}
                  </b>
                </div>
              ))
            ) : (
              <div className="empty-inline">
                <span>
                  Save this run to compare it with future strategy tests.
                </span>
                <button className="text-button" onClick={saveBacktest}>
                  Save current run <ArrowRight size={14} />
                </button>
              </div>
            )}
          </Panel>
          <Panel className="heatmap-panel">
            <PanelHeading
              title="Monthly return map"
              subtitle="Weekly buckets · realized backtest P&L"
            />
            <div className="heatmap-scroll">
              <div className="heatmap-grid">
                <div className="heatmap-labels">
                  <span>W1</span>
                  <span>W2</span>
                  <span>W3</span>
                  <span>W4</span>
                  <span>W5</span>
                </div>
                {["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((month) => (
                  <div className="heatmap-month" key={month}>
                    <strong>{month}</strong>
                    {[1, 2, 3, 4, 5].map((week) => {
                      const bucket = backtest.heatmap.find(
                        (item) => item.month === month && item.week === week,
                      );
                      const shade = bucket
                        ? Math.min(
                            0.82,
                            0.18 +
                              Math.abs(bucket.value) /
                                Math.max(
                                  1,
                                  Math.abs(backtest.summary.pnl) * 0.2,
                                ),
                          )
                        : 0.1;
                      return (
                        <span
                          key={week}
                          title={
                            bucket
                              ? `${month} week ${week}: ${currency(bucket.value)}`
                              : `${month} week ${week}`
                          }
                          style={{
                            background:
                              bucket && bucket.value >= 0
                                ? `rgba(94, 139, 110, ${shade})`
                                : bucket
                                  ? `rgba(197, 105, 84, ${shade})`
                                  : "#f0ede7",
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className="heatmap-legend">
              <span>Less</span>
              <i />
              <i />
              <i />
              <i />
              <span>More</span>
            </div>
          </Panel>
          <Panel className="backtest-trades">
            <PanelHeading
              title="Trade-by-trade breakdown"
              subtitle={`${backtest.trades.length} signals · next-bar execution, 6-bar hold`}
              action={
                <button className="text-button" onClick={exportBacktest}>
                  Export CSV <Download size={13} />
                </button>
              }
            />
            <BacktestTable
              rows={backtest.trades}
              instrument={backtest.summary.instrument}
            />
          </Panel>
        </div>
      </>
    );
  }

  function renderForward() {
    const openPnl = paper.reduce((sum, position) => {
      const movement =
        position.direction === "Long"
          ? position.currentPrice - position.entry
          : position.entry - position.currentPrice;
      return (
        sum +
        movement *
          position.size *
          (position.instrument === "EUR/USD" ? 100000 : 1)
      );
    }, 0);
    const closedPaper = trades.filter((trade) => trade.source === "Forward");
    return (
      <>
        <PageTitle
          eyebrow="SIMULATED EXECUTION"
          title="Forward test"
          subtitle={pageDescriptions.forward}
          action={
            <button
              className="button button-primary"
              onClick={() => setModal("paper")}
            >
              <Plus size={15} /> New paper trade
            </button>
          }
        />
        <div className="forward-banner">
          <div className="live-indicator">
            <span /> SIMULATION ACTIVE
          </div>
          <p>
            No broker connection · synthetic quotes · trades are journaled when
            closed
          </p>
          <button
            className="button button-cream button-small"
            onClick={() => {
              setMarketStep((step) => step + 1);
              setPaper((current) =>
                current.map((position) => ({
                  ...position,
                  currentPrice:
                    position.currentPrice *
                    (1 +
                      Math.sin((marketStep + position.entry) * 0.0003) *
                        (position.instrument === "EUR/USD" ? 0.0008 : 0.002)),
                })),
              );
              notify("Simulated market advanced");
            }}
          >
            <RefreshCw size={14} /> Advance market
          </button>
        </div>
        <div className="metric-grid">
          <MetricCard
            label="Open exposure"
            value={currency(openPnl)}
            detail={`${paper.length} simulated open positions`}
            icon={Activity}
            color={openPnl >= 0 ? "green" : "red"}
          />
          <MetricCard
            label="Forward trades"
            value={String(closedPaper.length)}
            detail="Closed positions sent to journal"
            icon={Radio}
            color="orange"
          />
          <MetricCard
            label="Forward win rate"
            value={`${metricsFor(closedPaper).winRate.toFixed(0)}%`}
            detail="Closed simulated trades only"
            icon={TrendingUp}
            color="blue"
          />
          <MetricCard
            label="Backtest reference"
            value={`${backtest.summary.winRate.toFixed(0)}%`}
            detail={`${backtest.summary.strategy} · ${backtest.summary.trades} signals`}
            icon={FlaskConical}
            color="olive"
          />
        </div>
        <div className="forward-grid">
          <Panel className="positions-panel">
            <PanelHeading
              title="Open positions"
              subtitle="Close a position to add notes and sync it to your journal"
              action={
                <span className="live-count">
                  <span />
                  {paper.length} OPEN
                </span>
              }
            />
            {paper.length ? (
              <div className="position-list">
                {paper.map((position) => {
                  const pnl =
                    (position.direction === "Long"
                      ? position.currentPrice - position.entry
                      : position.entry - position.currentPrice) *
                    position.size *
                    (position.instrument === "EUR/USD" ? 100000 : 1);
                  return (
                    <article className="position-row" key={position.id}>
                      <div
                        className={`direction-marker ${position.direction === "Long" ? "is-long" : "is-short"}`}
                      >
                        {position.direction === "Long" ? (
                          <ArrowUpRight size={17} />
                        ) : (
                          <ArrowDownRight size={17} />
                        )}
                      </div>
                      <div className="position-instrument">
                        <strong>{position.instrument}</strong>
                        <span>
                          {position.setup} · {position.session}
                        </span>
                      </div>
                      <div className="position-price">
                        <span>ENTRY</span>
                        <strong>
                          {formatPrice(position.instrument, position.entry)}
                        </strong>
                      </div>
                      <div className="position-price">
                        <span>MARK</span>
                        <strong>
                          {formatPrice(
                            position.instrument,
                            position.currentPrice,
                          )}
                        </strong>
                      </div>
                      <div
                        className={`position-pnl ${pnl >= 0 ? "positive" : "negative"}`}
                      >
                        {currency(pnl)}
                      </div>
                      <button
                        className="button button-secondary button-small"
                        onClick={() => {
                          setClosingId(position.id);
                          setModal("close");
                        }}
                      >
                        Close & review
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <Radio size={22} />
                <strong>No open paper positions</strong>
                <span>Place a simulated trade to start a forward test.</span>
              </div>
            )}
            <div className="position-footnote">
              <ShieldCheck size={14} /> Define the stop, target and model before
              the simulated order is placed.
            </div>
          </Panel>
          <Panel className="forward-reference">
            <PanelHeading
              title="Evidence comparison"
              subtitle="Closed forward sample against last backtest"
            />
            <div className="comparison-head">
              <span>METRIC</span>
              <span>FORWARD</span>
              <span>BACKTEST</span>
            </div>
            {[
              [
                "Win rate",
                `${metricsFor(closedPaper).winRate.toFixed(0)}%`,
                `${backtest.summary.winRate.toFixed(0)}%`,
              ],
              [
                "Trade count",
                `${closedPaper.length}`,
                `${backtest.summary.trades}`,
              ],
              [
                "Average R",
                `${metricsFor(closedPaper).averageR.toFixed(2)}R`,
                `${backtest.summary.averageR.toFixed(2)}R`,
              ],
              [
                "Profit factor",
                metricsFor(closedPaper).profitFactor.toFixed(2),
                backtest.summary.profitFactor.toFixed(2),
              ],
            ].map(([label, fwd, back]) => (
              <div className="comparison-row" key={label}>
                <span>{label}</span>
                <strong>{fwd}</strong>
                <strong>{back}</strong>
              </div>
            ))}
            <div className="comparison-callout">
              <Sparkles size={15} />
              <span>
                A useful comparison needs a meaningful sample size. Forward
                results are still early.
              </span>
            </div>
          </Panel>
        </div>
      </>
    );
  }

  function renderJournal() {
    const emotionRows = [
      "Focused",
      "Patient",
      "Confident",
      "Hesitant",
      "Tired",
    ].map((emotion) => ({
      emotion,
      pnl: trades
        .filter((trade) => trade.emotion === emotion)
        .reduce((sum, trade) => sum + trade.pnl, 0),
      count: trades.filter((trade) => trade.emotion === emotion).length,
    }));
    return (
      <>
        <PageTitle
          eyebrow="DECISION LOG"
          title="Trade journal"
          subtitle={pageDescriptions.journal}
          action={
            <button
              className="button button-primary"
              onClick={() => setModal("journal")}
            >
              <Plus size={15} /> Log a trade
            </button>
          }
        />
        <div className="metric-grid">
          <MetricCard
            label="Logged trades"
            value={String(stats.total)}
            detail={`${trades.filter((trade) => trade.source === "Forward").length} from forward tests`}
            icon={NotebookPen}
            color="orange"
          />
          <MetricCard
            label="Net realized"
            value={currency(stats.net, true)}
            detail={`${stats.averageR.toFixed(2)}R average per trade`}
            icon={TrendingUp}
            color={stats.net >= 0 ? "green" : "red"}
          />
          <MetricCard
            label="Win rate"
            value={`${stats.winRate.toFixed(1)}%`}
            detail={`${stats.total} trades · decisive outcomes`}
            icon={Activity}
            color="blue"
          />
          <MetricCard
            label="Rule exceptions"
            value={String(
              trades.reduce((sum, trade) => sum + trade.rulesBroken.length, 0),
            )}
            detail={`${stats.adherent}% of trades fully compliant`}
            icon={ShieldAlert}
            color="olive"
          />
        </div>
        <div className="journal-grid">
          <Panel className="journal-list-panel">
            <PanelHeading
              title="Trade log"
              subtitle="Filter by date, instrument, setup or note"
              action={
                <div className="table-toolbar">
                  <div className="search-input">
                    <Search size={14} />
                    <input
                      placeholder="Search journal"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                    />
                  </div>
                  <select
                    value={timeFilter}
                    onChange={(event) => setTimeFilter(event.target.value)}
                  >
                    <option>All trades</option>
                    <option>This month</option>
                    <option>This week</option>
                  </select>
                </div>
              }
            />
            <TradeTable
              trades={searchedTrades.slice(0, 16)}
              onClick={(trade) =>
                notify(`${trade.setup} · ${trade.notes || "No notes recorded"}`)
              }
            />
            <div className="journal-footer">
              <span>
                Showing {Math.min(searchedTrades.length, 16)} of{" "}
                {searchedTrades.length} trades
              </span>
              <button
                className="text-button"
                onClick={() => {
                  setSearchTerm("");
                  setTimeFilter("All trades");
                }}
              >
                Clear filters <X size={13} />
              </button>
            </div>
          </Panel>
          <Panel className="mood-panel">
            <PanelHeading
              title="Psychology & performance"
              subtitle="P&L grouped by recorded emotional state"
            />
            <div className="mood-bars">
              {emotionRows.map((item) => (
                <div className="mood-row" key={item.emotion}>
                  <div>
                    <span className="mood-dot" />
                    {item.emotion}
                  </div>
                  <div className="mood-track">
                    <span
                      className={
                        item.pnl >= 0 ? "mood-positive" : "mood-negative"
                      }
                      style={{
                        width: `${Math.max(5, Math.min(100, (Math.abs(item.pnl) / Math.max(1, ...emotionRows.map((row) => Math.abs(row.pnl)))) * 100))}%`,
                      }}
                    />
                  </div>
                  <strong className={item.pnl >= 0 ? "positive" : "negative"}>
                    {currency(item.pnl, true)}
                  </strong>
                  <small>{item.count} trades</small>
                </div>
              ))}
            </div>
            <div className="mood-insight">
              <Sparkles size={15} />
              <span>
                Use emotional notes to identify the conditions behind your best
                decisions.
              </span>
            </div>
          </Panel>
          <Panel className="setup-chart">
            <PanelHeading
              title="Setup win rate"
              subtitle="By entry model · sample count shown"
            />
            <div className="chart-wrap chart-small">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={setupPerformance}
                  margin={{ top: 6, right: 6, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="#eeeae2"
                    strokeDasharray="4 6"
                  />
                  <XAxis
                    dataKey="setup"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#929088", fontSize: 10 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#929088", fontSize: 10 }}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(value) => [`${value}%`, "Win rate"]}
                  />
                  <Bar dataKey="winRate" fill="#d77849" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="setup-rows">
              {setupPerformance.map((item) => (
                <div key={item.setup}>
                  <span>{item.setup}</span>
                  <span>{item.trades} trades</span>
                  <strong>{item.winRate}%</strong>
                </div>
              ))}
            </div>
          </Panel>
          <Panel className="mistakes-panel">
            <PanelHeading
              title="Mistake tracker"
              subtitle="Starter categories · add context in each trade note"
            />
            <div className="mistake-chip-list">
              {mistakeTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => {
                    setModal("journal");
                    notify(`Add ${tag} to the notes or tags on your trade`);
                  }}
                >
                  {tag}
                  <span>
                    {trades.filter((trade) => trade.tags.includes(tag)).length}
                  </span>
                </button>
              ))}
            </div>
            <p className="source-note">
              No explicit mistake taxonomy was present in the export. These are
              editable starter labels.
            </p>
          </Panel>
        </div>
      </>
    );
  }

  function renderGoals() {
    const categories: Goal["category"][] = [
      "Short-term",
      "Medium-term",
      "Long-term",
    ];
    return (
      <>
        <PageTitle
          eyebrow="INTENTIONAL PROGRESS"
          title="Goals & reviews"
          subtitle={pageDescriptions.goals}
          action={
            <button
              className="button button-primary"
              onClick={() => setModal("goal")}
            >
              <Plus size={15} /> Add a goal
            </button>
          }
        />
        <div className="goal-summary">
          <div>
            <span>ACTIVE GOALS</span>
            <strong>
              {
                goals.filter(
                  (goal) => !goal.achieved && metricForGoal(goal) < goal.target,
                ).length
              }
            </strong>
          </div>
          <div>
            <span>COMPLETED</span>
            <strong>
              {
                goals.filter(
                  (goal) => goal.achieved || metricForGoal(goal) >= goal.target,
                ).length
              }
            </strong>
          </div>
          <div>
            <span>WEEKLY REVIEWS</span>
            <strong>
              {reviews}
              <small> / 8</small>
            </strong>
          </div>
          <div className="goal-review-action">
            <span>NEXT REVIEW</span>
            <strong>
              Sunday <small>· 20 min</small>
            </strong>
            <button
              className="button button-secondary button-small"
              onClick={() => {
                setReviews((count) => count + 1);
                notify("Weekly review completed · goal progress updated");
              }}
            >
              <Check size={14} /> Complete review
            </button>
          </div>
        </div>
        {categories.map((category) => (
          <section className="goal-category" key={category}>
            <div className="section-label">
              <span>{category}</span>
              <i />
            </div>
            <div className="goal-card-grid">
              {goals
                .filter((goal) => goal.category === category)
                .map((goal) => {
                  const current = metricForGoal(goal);
                  const value = Math.min(current, goal.target);
                  const progress = Math.min(
                    100,
                    Math.round((current / Math.max(goal.target, 1)) * 100),
                  );
                  const complete = goal.achieved || current >= goal.target;
                  return (
                    <Panel
                      className={`goal-card ${complete ? "goal-complete" : ""}`}
                      key={goal.id}
                    >
                      <div className="goal-card-top">
                        <span className="goal-marker">
                          <Target size={16} />
                        </span>
                        <span
                          className={`goal-status ${complete ? "goal-status-done" : ""}`}
                        >
                          {complete ? "ACHIEVED" : "IN PROGRESS"}
                        </span>
                        <button
                          className="icon-button subtle"
                          title="Mark goal achieved"
                          onClick={() => {
                            setGoals((currentGoals) =>
                              currentGoals.map((item) =>
                                item.id === goal.id
                                  ? { ...item, achieved: !item.achieved }
                                  : item,
                              ),
                            );
                            notify(
                              complete
                                ? "Goal reopened"
                                : "Goal status updated",
                            );
                          }}
                        >
                          <Check size={16} />
                        </button>
                      </div>
                      <h3>{goal.title}</h3>
                      <p>{goal.description}</p>
                      <div className="goal-value">
                        <strong>
                          {goal.metric === "adherence" ||
                          goal.metric === "win-rate"
                            ? `${value}%`
                            : value}
                        </strong>
                        <span>
                          of {goal.target}
                          {goal.metric === "adherence" ||
                          goal.metric === "win-rate"
                            ? "%"
                            : ""}{" "}
                          {goal.metric === "trades"
                            ? "trades"
                            : goal.metric === "reviews"
                              ? "reviews"
                              : goal.metric === "win-rate"
                                ? "win rate"
                                : "adherence"}
                        </span>
                      </div>
                      <div className="mini-progress goal-progress">
                        <span style={{ width: `${progress}%` }} />
                      </div>
                      <div className="goal-card-foot">
                        <span>
                          <CalendarDays size={13} /> Due{" "}
                          {format(parseISO(goal.deadline), "MMM d, yyyy")}
                        </span>
                        <span>{progress}%</span>
                      </div>
                    </Panel>
                  );
                })}
            </div>
          </section>
        ))}
        <Panel className="weekly-review-panel">
          <PanelHeading
            title="Weekly review prompt"
            subtitle="Adapted from the Notion weekly planning & reflection template"
            action={
              <button
                className="button button-secondary button-small"
                onClick={() => {
                  setReviews((count) => count + 1);
                  notify("Review saved · weekly review goal updated");
                }}
              >
                Save review <Check size={14} />
              </button>
            }
          />
          <div className="review-prompts">
            <label>
              <span>01 · Rate the week</span>
              <select defaultValue="7">
                <option>1</option>
                <option>2</option>
                <option>3</option>
                <option>4</option>
                <option>5</option>
                <option>6</option>
                <option>7</option>
                <option>8</option>
                <option>9</option>
                <option>10</option>
              </select>
            </label>
            <label>
              <span>02 · Three wins</span>
              <textarea placeholder="What worked in your process?" />
            </label>
            <label>
              <span>03 · Lessons & blockers</span>
              <textarea placeholder="What will you take into next week?" />
            </label>
            <label>
              <span>04 · Next week milestones</span>
              <textarea placeholder="Choose up to three measurable actions." />
            </label>
          </div>
        </Panel>
        <p className="source-note goal-source-note">
          The export contained annual, quarterly and monthly goal templates, but
          no populated measurable targets. These starter targets are
          suggestions, not extracted goals.
        </p>
      </>
    );
  }

  function renderRules() {
    const groups = [...new Set(rules.map((rule) => rule.group))];
    return (
      <>
        <PageTitle
          eyebrow="PROCESS GUARDRAILS"
          title="Rules & checklist"
          subtitle={pageDescriptions.rules}
          action={
            <span className="rules-total">
              <ShieldCheck size={15} />
              {trades.reduce(
                (sum, trade) => sum + trade.rulesBroken.length,
                0,
              )}{" "}
              recorded exceptions
            </span>
          }
        />
        <div className="rules-layout">
          <Panel className="rules-checklist">
            <PanelHeading
              title="Before the next trade"
              subtitle="Mark each condition; unchecked rules are flagged when you journal."
              action={
                <div className="rule-heading-actions">
                  <button
                    className="text-button"
                    onClick={() => setRules((current) => [{
                      id: crypto.randomUUID(), title: "New trading rule", group: "Custom",
                      priority: "Standard", enabled: true, source: "Suggested guardrail",
                    }, ...current])}
                  >
                    <Plus size={13} /> Add rule
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setChecks(Object.fromEntries(enabledRules.map((rule) => [rule.id, true])))}
                  >
                    Check all <CheckCheck size={14} />
                  </button>
                </div>
              }
            />
            <div className="checklist-progress">
              <span>
                {enabledRules.filter((rule) => checks[rule.id]).length} of{" "}
                {enabledRules.length} complete
              </span>
              <div className="mini-progress">
                <span style={{ width: `${dailyCheckRate}%` }} />
              </div>
              <strong>{dailyCheckRate.toFixed(0)}%</strong>
            </div>
            {groups.map((group) => (
              <div className="rule-group" key={group}>
                <div className="section-label">
                  <span>{group}</span>
                  <i />
                </div>
                {rules
                  .filter((rule) => rule.group === group)
                  .map((rule) => (
                    <div
                      className={`rule-row ${checks[rule.id] ? "checked" : ""}`}
                      key={rule.id}
                    >
                      <label className="rule-check-control">
                        <input type="checkbox" checked={Boolean(checks[rule.id])} onChange={() => toggleCheck(rule.id)} />
                        <span className="custom-check"><Check size={12} /></span>
                      </label>
                      <div className="rule-copy">
                        <input
                          className="rule-title-input"
                          aria-label="Edit rule name"
                          value={rule.title}
                          onChange={(event) => setRules((current) => current.map((item) => item.id === rule.id ? { ...item, title: event.target.value } : item))}
                        />
                        <small>
                          {rule.source === "Notion plan"
                            ? "From your exported trading plan"
                            : "Suggested guardrail · editable"}
                        </small>
                      </div>
                      <select
                        className={`priority-select priority-${rule.priority.toLowerCase()}`}
                        aria-label="Rule priority"
                        value={rule.priority}
                        onChange={(event) => setRules((current) => current.map((item) => item.id === rule.id ? { ...item, priority: event.target.value as TradingRule["priority"] } : item))}
                      >
                        <option>Critical</option><option>Important</option><option>Standard</option>
                      </select>
                      <button
                        type="button"
                        className={`rule-enable ${rule.enabled ? "enabled" : ""}`}
                        title={
                          rule.enabled
                            ? "Disable rule tracking"
                            : "Enable rule tracking"
                        }
                        onClick={(event) => {
                          event.preventDefault();
                          setRules((current) =>
                            current.map((item) =>
                              item.id === rule.id
                                ? { ...item, enabled: !item.enabled }
                                : item,
                            ),
                          );
                        }}
                      >
                        <span />
                      </button>
                    </div>
                  ))}
              </div>
            ))}
          </Panel>
          <div className="rules-side">
            <Panel>
              <PanelHeading
                title="Adherence overview"
                subtitle="Journal entries + active checklist"
              />
              <div className="rules-ring-wrap">
                <ProgressRing value={adherence} size={126} label="adherence" />
                <div>
                  <strong>
                    {
                      trades.filter((trade) => trade.rulesBroken.length === 0)
                        .length
                    }
                  </strong>
                  <span>fully compliant trades</span>
                  <strong className="rule-broken-number">
                    {trades.reduce(
                      (sum, trade) => sum + trade.rulesBroken.length,
                      0,
                    )}
                  </strong>
                  <span>rules broken across trades</span>
                </div>
              </div>
              <button
                className="button button-secondary full-button"
                onClick={() => setActive("journal")}
              >
                Review flagged trades <ArrowRight size={14} />
              </button>
            </Panel>
            <Panel>
              <PanelHeading
                title="Plan-origin rules"
                subtitle="Directly represented in the Notion export"
              />
              <div className="source-rule-list">
                {rules
                  .filter((rule) => rule.source === "Notion plan")
                  .map((rule) => (
                    <div key={rule.id}>
                      <Check size={13} />
                      <span>{rule.title}</span>
                    </div>
                  ))}
              </div>
              <div className="source-note">
                Numeric stop and daily-loss limits were not provided in the
                source plan.
              </div>
            </Panel>
            <Panel className="rule-add-panel">
              <div>
                <strong>Need another guardrail?</strong>
                <p>
                  Personal risk limits and session rules can be edited in Risk
                  management.
                </p>
                <button
                  className="text-button"
                  onClick={() => setActive("risk")}
                >
                  Open risk settings <ArrowRight size={14} />
                </button>
              </div>
            </Panel>
          </div>
        </div>
      </>
    );
  }

  function renderRisk() {
    const riskDollars = (riskSettings.balance * riskSettings.riskPct) / 100;
    const calculatedPositionSize = riskDollars / (stopDistance * riskSettings.stopValue);
    const dailyPct = todaysLossLimit
      ? Math.min(100, (dailyRiskUsed / todaysLossLimit) * 100)
      : 0;
    return (
      <>
        <PageTitle
          eyebrow="CAPITAL PRESERVATION"
          title="Risk management"
          subtitle={pageDescriptions.risk}
          action={
            <span className="starter-assumption">
              <CircleHelp size={14} /> Editable starter assumptions
            </span>
          }
        />
        <div className="risk-grid">
          <Panel className="risk-settings-panel">
            <PanelHeading
              title="Account guardrails"
              subtitle="No numeric limits were included in the Notion export"
            />
            <div className="risk-fields">
              <label>
                <span>Account balance</span>
                <div className="input-with-prefix">
                  <span>$</span>
                  <input
                    type="number"
                    value={riskSettings.balance}
                    min="1"
                    onChange={(event) =>
                      setRiskSettings({
                        ...riskSettings,
                        balance: Number(event.target.value),
                      })
                    }
                  />
                </div>
              </label>
              <label>
                <span>Risk per trade</span>
                <div className="input-with-suffix">
                  <input
                    type="number"
                    value={riskSettings.riskPct}
                    step="0.1"
                    min="0.1"
                    max="10"
                    onChange={(event) =>
                      setRiskSettings({
                        ...riskSettings,
                        riskPct: Number(event.target.value),
                      })
                    }
                  />
                  <span>%</span>
                </div>
              </label>
              <label>
                <span>Max daily loss</span>
                <div className="input-with-suffix">
                  <input
                    type="number"
                    value={riskSettings.dailyLossPct}
                    step="0.25"
                    min="0.25"
                    max="20"
                    onChange={(event) =>
                      setRiskSettings({
                        ...riskSettings,
                        dailyLossPct: Number(event.target.value),
                      })
                    }
                  />
                  <span>%</span>
                </div>
              </label>
              <label>
                <span>Max open positions</span>
                <input
                  type="number"
                  value={riskSettings.maxPositions}
                  min="1"
                  onChange={(event) =>
                    setRiskSettings({
                      ...riskSettings,
                      maxPositions: Number(event.target.value),
                    })
                  }
                />
              </label>
            </div>
            <div className="risk-assumption-note">
              <CircleHelp size={15} />
              <span>
                Starter settings only: 0.5% trade risk, 2% daily loss and three
                open positions. Replace these with your own tested limits.
              </span>
            </div>
          </Panel>
          <Panel className="daily-risk-panel">
            <PanelHeading
              title="Today’s risk"
              subtitle={dayLabel}
              action={
                <span
                  className={`risk-state ${dailyPct > 70 ? "risk-state-warn" : ""}`}
                >
                  <span />
                  {dailyPct > 70 ? "APPROACHING LIMIT" : "WITHIN LIMIT"}
                </span>
              }
            />
            <div className="daily-risk-amount">
              <div>
                <span>Realized loss</span>
                <strong className={dailyPnl < 0 ? "negative" : "positive"}>
                  {currency(dailyRiskUsed)}
                </strong>
              </div>
              <div>
                <span>Loss limit</span>
                <strong>{currency(todaysLossLimit)}</strong>
              </div>
            </div>
            <div className="risk-track">
              <span
                className={dailyPct > 70 ? "risk-track-warn" : ""}
                style={{ width: `${dailyPct}%` }}
              />
            </div>
            <div className="risk-track-caption">
              <span>{dailyPct.toFixed(0)}% used</span>
              <strong>{currency(riskRemaining)} remaining</strong>
            </div>
            <div className="risk-alert">
              <ShieldCheck size={16} />
              <span>
                Daily P&L reads from journal entries logged today. Open paper
                P&L is shown separately.
              </span>
            </div>
          </Panel>
          <Panel className="size-calc-panel">
            <PanelHeading
              title="Position size calculator"
              subtitle="Size from account risk and stop distance"
            />
            <div className="calculator-fields">
              <label>
                <span>Account risk</span>
                <input
                  value={`${currency(riskDollars)} (${riskSettings.riskPct}%)`}
                  readOnly
                />
              </label>
              <label>
                <span>Stop distance (pips / points)</span>
                <input
                  id="stop-distance"
                  type="number"
                  value={stopDistance}
                  min="0.1"
                  onChange={(event) => setStopDistance(Math.max(0.1, Number(event.target.value)))}
                />
              </label>
              <label>
                <span>Value per pip / point</span>
                <div className="input-with-prefix">
                  <span>$</span>
                  <input
                    id="pip-value"
                    type="number"
                    value={riskSettings.stopValue}
                    min="0.01"
                    onChange={(event) => setRiskSettings({ ...riskSettings, stopValue: Math.max(0.01, Number(event.target.value)) })}
                  />
                </div>
              </label>
            </div>
            <div className="position-size-result">
              <span>CALCULATED POSITION SIZE</span>
              <strong>
                {calculatedPositionSize.toFixed(2)}{" "}
                <small>lots / contracts</small>
              </strong>
              <p>Risk ÷ (stop distance × value per point)</p>
            </div>
            <button
              className="button button-secondary full-button"
              onClick={() => notify(`Position size: ${calculatedPositionSize.toFixed(2)} lots / contracts`)}
            >
              Calculate size <ArrowRight size={14} />
            </button>
          </Panel>
          <Panel className="drawdown-panel">
            <PanelHeading
              title="Drawdown & exposure"
              subtitle="Journal equity and current open paper positions"
            />
            <div className="drawdown-stat">
              <div>
                <span>Peak-to-trough</span>
                <strong>{stats.drawdown.toFixed(1)}%</strong>
                <small>
                  {currency((Math.abs(stats.net) * stats.drawdown) / 100)}
                </small>
              </div>
              <div>
                <span>Open positions</span>
                <strong>
                  {paper.length} <small>/ {riskSettings.maxPositions}</small>
                </strong>
                <small>
                  {paper.length >= riskSettings.maxPositions
                    ? "Position cap reached"
                    : `${riskSettings.maxPositions - paper.length} slots available`}
                </small>
              </div>
            </div>
            <div className="drawdown-meter">
              <span
                style={{
                  width: `${Math.min(100, (stats.drawdown / 10) * 100)}%`,
                }}
              />
            </div>
            <div className="risk-track-caption">
              <span>Suggested alert at 8%</span>
              <strong>Current {stats.drawdown.toFixed(1)}%</strong>
            </div>
            <div className="source-note">
              Drawdown is based on the journal’s cumulative realized equity.
              Edit alert thresholds as part of your own plan.
            </div>
          </Panel>
        </div>
      </>
    );
  }

  function renderAnalytics() {
    const comparison = [
      {
        type: "Backtest",
        trades: backtest.summary.trades,
        winRate: backtest.summary.winRate,
        profitFactor: backtest.summary.profitFactor,
        averageR: backtest.summary.averageR,
        pnl: backtest.summary.pnl,
      },
      {
        type: "Forward test",
        trades: trades.filter((trade) => trade.source === "Forward").length,
        ...metricsFor(trades.filter((trade) => trade.source === "Forward")),
        pnl: trades
          .filter((trade) => trade.source === "Forward")
          .reduce((sum, trade) => sum + trade.pnl, 0),
      },
      {
        type: "Trade journal",
        trades: stats.total,
        winRate: stats.winRate,
        profitFactor: stats.profitFactor,
        averageR: stats.averageR,
        pnl: stats.net,
      },
    ];
    return (
      <>
        <PageTitle
          eyebrow="PERFORMANCE INTELLIGENCE"
          title="Analytics"
          subtitle={pageDescriptions.analytics}
          action={
            <button
              className="button button-secondary"
              onClick={() => {
                const report = {
                  generatedAt: new Date().toISOString(),
                  stats,
                  trades,
                  backtest: backtest.summary,
                  goals,
                };
                const link = document.createElement("a");
                link.href = URL.createObjectURL(
                  new Blob([JSON.stringify(report, null, 2)], {
                    type: "application/json",
                  }),
                );
                link.download = "trading-performance-report.json";
                link.click();
                notify("Analytics report exported");
              }}
            >
              <Download size={15} /> Export report
            </button>
          }
        />
        <div className="metric-grid">
          <MetricCard
            label="Total trades"
            value={String(stats.total)}
            detail={`${trades.filter((trade) => trade.result === "Win").length} wins · ${trades.filter((trade) => trade.result === "Loss").length} losses`}
            icon={NotebookPen}
            color="orange"
          />
          <MetricCard
            label="Average R"
            value={`${stats.averageR.toFixed(2)}R`}
            detail={`${stats.sharpe.toFixed(2)} risk-adjusted Sharpe`}
            icon={Activity}
            color="blue"
          />
          <MetricCard
            label="Max drawdown"
            value={`${stats.drawdown.toFixed(1)}%`}
            detail="Peak-to-trough realized equity"
            icon={ShieldAlert}
            color="red"
          />
          <MetricCard
            label="Goal completion"
            value={`${Math.round((goals.filter((goal) => goal.achieved || metricForGoal(goal) >= goal.target).length / Math.max(1, goals.length)) * 100)}%`}
            detail={`${goals.length} active progress markers`}
            icon={Target}
            color="olive"
          />
        </div>
        <div className="analytics-grid">
          <Panel className="analytics-equity">
            <PanelHeading
              title="Journal equity curve"
              subtitle="Cumulative realized P&L"
            />
            <div className="chart-wrap chart-large">
              {equity.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={equity}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="analytics-fill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#d77849"
                          stopOpacity={0.19}
                        />
                        <stop
                          offset="100%"
                          stopColor="#d77849"
                          stopOpacity={0.01}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      vertical={false}
                      stroke="#eeeae2"
                      strokeDasharray="4 6"
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) =>
                        format(parseISO(value), "MMM d")
                      }
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#9d9b92", fontSize: 10 }}
                      minTickGap={40}
                    />
                    <YAxis
                      tickFormatter={(value) =>
                        currency(value - riskSettings.balance, true)
                      }
                      width={50}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#9d9b92", fontSize: 10 }}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      labelFormatter={(value) =>
                        format(parseISO(String(value)), "MMM d, yyyy")
                      }
                      formatter={(value) => [
                        currency(Number(value) - riskSettings.balance),
                        "Net P&L",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke="#d77849"
                      strokeWidth={2}
                      fill="url(#analytics-fill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmpty message="Log trades to build your analytics." />
              )}
            </div>
          </Panel>
          <Panel className="setup-radar">
            <PanelHeading
              title="Setup performance"
              subtitle="Win rate by entry model"
            />
            <div className="chart-wrap radar-chart">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={setupPerformance} outerRadius="72%">
                  <PolarGrid stroke="#eae5dc" />
                  <PolarAngleAxis
                    dataKey="setup"
                    tick={{ fill: "#76766e", fontSize: 10 }}
                  />
                  <PolarRadiusAxis
                    domain={[0, 100]}
                    tick={false}
                    axisLine={false}
                  />
                  <Radar
                    dataKey="winRate"
                    stroke="#d77849"
                    fill="#d77849"
                    fillOpacity={0.22}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="radar-foot">
              Model sample sizes:{" "}
              {setupPerformance
                .map(
                  (item) =>
                    `${item.setup.replace("Model ", "M")}: ${item.trades}`,
                )
                .join(" · ")}
            </div>
          </Panel>
          <Panel className="session-analytics">
            <PanelHeading
              title="Session performance"
              subtitle="Realized P&L and win rate"
            />
            <SessionBars sessions={sessionPerformance} showWinRate />
          </Panel>
          <Panel className="comparison-panel">
            <PanelHeading
              title="Backtest → forward → journal"
              subtitle="Compare research, simulation and recorded execution"
              action={
                <span className="connection-chip">
                  <span /> SHARED DATA
                </span>
              }
            />
            <div className="comparison-table-wrap">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Trades</th>
                    <th>Win rate</th>
                    <th>Profit factor</th>
                    <th>Average R</th>
                    <th>Net P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((item) => (
                    <tr key={item.type}>
                      <td>
                        <span
                          className={`comparison-type type-${item.type.toLowerCase().replace(" ", "-")}`}
                        />
                        {item.type}
                      </td>
                      <td>{item.trades}</td>
                      <td>{item.winRate.toFixed(1)}%</td>
                      <td>{item.profitFactor.toFixed(2)}</td>
                      <td>{item.averageR.toFixed(2)}R</td>
                      <td className={item.pnl >= 0 ? "positive" : "negative"}>
                        {currency(item.pnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {savedRuns.length > 0 && (
              <div className="saved-run-strip">
                <span>Saved backtests included:</span>
                {savedRuns.slice(0, 3).map((run) => (
                  <span className="saved-run-chip" key={run.id}>
                    {run.name} <b>{currency(run.pnl, true)}</b>
                  </span>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </>
    );
  }

  function renderSessions() {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = sessionNow;
    const sessionDefinitions = [
      {
        name: "Asia",
        start: "00:00",
        end: "09:00",
        utc: "00:00–09:00 UTC",
        note: "Tokyo · Sydney handover",
        color: "#81958b",
      },
      {
        name: "London",
        start: "07:00",
        end: "16:00",
        utc: "07:00–16:00 UTC",
        note: "London cash open",
        color: "#d27648",
      },
      {
        name: "New York",
        start: "13:00",
        end: "22:00",
        utc: "13:00–22:00 UTC",
        note: "US cash open",
        color: "#506a80",
      },
      {
        name: "Overlap",
        start: "13:00",
        end: "16:00",
        utc: "13:00–16:00 UTC",
        note: "London × New York",
        color: "#bc9d55",
      },
    ];
    const clock = (utc: string) => {
      const [hour, minute] = utc.split(":").map(Number);
      const date = new Date();
      date.setUTCHours(hour, minute, 0, 0);
      return new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone,
      }).format(date);
    };
    const events = [
      {
        id: "event-1",
        date: format(subDays(now, -2), "yyyy-MM-dd"),
        time: "12:30",
        region: "US",
        event: "Nonfarm Payrolls",
        impact: "High",
      },
      {
        id: "event-2",
        date: format(subDays(now, -5), "yyyy-MM-dd"),
        time: "18:00",
        region: "US",
        event: "FOMC rate decision",
        impact: "High",
      },
      {
        id: "event-3",
        date: format(subDays(now, -8), "yyyy-MM-dd"),
        time: "12:30",
        region: "US",
        event: "CPI inflation",
        impact: "High",
      },
      {
        id: "event-4",
        date: format(subDays(now, -11), "yyyy-MM-dd"),
        time: "14:00",
        region: "US",
        event: "ISM services PMI",
        impact: "Medium",
      },
      {
        id: "event-5",
        date: format(subDays(now, -14), "yyyy-MM-dd"),
        time: "09:00",
        region: "EU",
        event: "ECB policy account",
        impact: "Medium",
      },
    ];
    const formatter = new Intl.DateTimeFormat(undefined, {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
    });
    return (
      <>
        <PageTitle
          eyebrow="TIME & CONTEXT"
          title="Sessions & calendar"
          subtitle={pageDescriptions.sessions}
          action={
            <span className="timezone-chip">
              <Clock3 size={14} /> {timeZone}
            </span>
          }
        />
        <div className="session-page-grid">
          <Panel className="session-clock-panel">
            <PanelHeading
              title="Market sessions"
              subtitle="Reference hours in UTC · converted to your local clock"
              action={
                <span className="market-now">
                  <span /> MARKET CLOCK
                </span>
              }
            />
            <div className="session-time-list">
              {sessionDefinitions.map((session) => {
                const activity = sessionPerformance.find(
                  (item) => item.session === session.name,
                );
                return (
                  <div className="session-time-row" key={session.name}>
                    <span
                      className="session-time-marker"
                      style={{ background: session.color }}
                    />
                    <div className="session-time-name">
                      <strong>{session.name}</strong>
                      <span>{session.note}</span>
                    </div>
                    <div className="session-time-local">
                      <span>YOUR TIME</span>
                      <strong>
                        {clock(session.start)} — {clock(session.end)}
                      </strong>
                      <small>{session.utc}</small>
                    </div>
                    <div className="session-time-stats">
                      <span>{activity?.trades ?? 0} trades</span>
                      <strong
                        className={
                          activity && activity.pnl >= 0
                            ? "positive"
                            : "negative"
                        }
                      >
                        {currency(activity?.pnl ?? 0, true)}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="session-timeline">
              <span>00</span>
              <i />
              <span>06</span>
              <i />
              <span>12</span>
              <i />
              <span>18</span>
              <i />
              <span>24 UTC</span>
            </div>
          </Panel>
          <Panel className="calendar-panel">
            <PanelHeading
              title="Economic calendar"
              subtitle="Preloaded key events · { no-feed }"
              action={<span className="calendar-badge">DEMO EVENTS</span>}
            />
            <div className="event-list">
              {events.map((event) => {
                const eventDate = parseISO(event.date);
                const isMarked = noTradeEvents.includes(event.id);
                const localTime = formatter.format(
                  new Date(`${event.date}T${event.time}:00Z`),
                );
                return (
                  <article
                    className={`event-row ${isMarked ? "event-marked" : ""}`}
                    key={event.id}
                  >
                    <div className="event-date">
                      <strong>{format(eventDate, "dd")}</strong>
                      <span>{format(eventDate, "MMM")}</span>
                    </div>
                    <div className="event-time">
                      {localTime}
                      <small>{event.region}</small>
                    </div>
                    <div className="event-copy">
                      <strong>{event.event}</strong>
                      <span
                        className={`impact impact-${event.impact.toLowerCase()}`}
                      >
                        <i />
                        {event.impact} impact
                      </span>
                    </div>
                    <button
                      className={`button ${isMarked ? "button-warning-active" : "button-secondary"} button-small`}
                      onClick={() =>
                        setNoTradeEvents((current) =>
                          isMarked
                            ? current.filter((id) => id !== event.id)
                            : [...current, event.id],
                        )
                      }
                    >
                      {isMarked ? (
                        <>
                          <Check size={13} /> No-trade set
                        </>
                      ) : (
                        "Set no-trade zone"
                      )}
                    </button>
                  </article>
                );
              })}
            </div>
            <div className="calendar-note">
              <ShieldAlert size={15} />
              <span>
                Event times are converted from UTC to {timeZone}. Verify dates
                with a live calendar before trading; this demo list is not a
                live feed.
              </span>
            </div>
          </Panel>
          <Panel className="session-performance-panel">
            <PanelHeading
              title="Session edge"
              subtitle="Historical journal performance by session"
            />
            <SessionBars sessions={sessionPerformance} showWinRate />
          </Panel>
          <Panel className="session-reminder-panel">
            <span className="reminder-icon">
              <Bell size={17} />
            </span>
            <div>
              <strong>Weekly review reminder</strong>
              <p>
                Record the session, setup and emotional state for every trade to
                make these comparisons useful.
              </p>
              <button
                className="text-button"
                onClick={() => setActive("journal")}
              >
                Open journal <ArrowRight size={14} />
              </button>
            </div>
          </Panel>
        </div>
      </>
    );
  }

  function renderPage() {
    if (active === "dashboard") return renderDashboard();
    if (active === "plan") return renderPlan();
    if (active === "backtest") return renderBacktest();
    if (active === "forward") return renderForward();
    if (active === "journal") return renderJournal();
    if (active === "goals") return renderGoals();
    if (active === "rules") return renderRules();
    if (active === "risk") return renderRisk();
    if (active === "analytics") return renderAnalytics();
    return renderSessions();
  }

  return (
    <div className={`app-shell ${darkMode ? "theme-dark" : ""}`}>
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand-lockup">
          <span className="brand-symbol">
            <span />
            <span />
            <span />
          </span>
          <div>
            <strong>aperture</strong>
            <small>TRADING WORKSPACE</small>
          </div>
          <button
            className="icon-button sidebar-close"
            title="Close menu"
            onClick={() => setMobileNav(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="workspace-select">
          <span className="workspace-avatar">
            {cloudUser ? traderName.slice(0, 1).toUpperCase() : "P"}
          </span>
          <div>
            <strong>{cloudUser ? `${traderName}’s workspace` : "Personal workspace"}</strong>
            <span>
              {cloudUser ? "Cloud workspace" : "Private desk"} <ChevronDown size={13} />
            </span>
          </div>
          <MoreHorizontal size={18} />
        </div>
        {["Workspace", "Review", "Control"].map((group) => (
          <div className="nav-group" key={group}>
            <span className="nav-label">{group}</span>
            {navItems
              .filter((item) => item.group === group)
              .map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  className={`nav-link ${active === id ? "nav-active" : ""}`}
                  onClick={() => {
                    setActive(id);
                    setMobileNav(false);
                  }}
                >
                  <Icon size={17} strokeWidth={1.8} />
                  <span>{label}</span>
                  {id === "journal" && (
                    <i className="nav-count">{trades.length}</i>
                  )}
                </button>
              ))}
          </div>
        ))}
        <div className="sidebar-spacer" />
        <div className="sidebar-progress">
          <div className="sidebar-progress-head">
            <span>WEEKLY PROCESS</span>
            <strong>{adherence}%</strong>
          </div>
          <div className="mini-progress">
            <span style={{ width: `${adherence}%` }} />
          </div>
          <button onClick={() => setActive("goals")}>
            Review goals <ArrowRight size={13} />
          </button>
        </div>
        <div className="sidebar-user">
          <span className="user-avatar">
            {cloudUser?.email?.slice(0, 1).toUpperCase() ?? "T"}
          </span>
          <div>
            <strong>{cloudUser?.email ?? "Local trader"}</strong>
            <span>
              {cloudUser
                ? "Cloud sync active"
                : hasSupabaseConfig
                  ? "Local · click to connect"
                  : "Local demo workspace"}
            </span>
          </div>
          <button
            className="icon-button subtle"
            title={cloudUser ? "Sign out of cloud sync" : "Connect Supabase"}
            onClick={() =>
              cloudUser ? void supabase?.auth.signOut() : setAuthOpen(true)
            }
          >
            {cloudUser ? (
              <LogOut size={15} />
            ) : hasSupabaseConfig ? (
              <Cloud size={16} />
            ) : (
              <CloudOff size={16} />
            )}
          </button>
          <button
            className="icon-button subtle"
            title="Switch theme"
            onClick={() => setDarkMode((value) => !value)}
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </aside>
      {mobileNav && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              title="Open navigation"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={19} />
            </button>
            <div className="breadcrumb">
              <span>Workspace</span>
              <span>/</span>
              <strong>{currentPage.label}</strong>
            </div>
          </div>
          <div className="topbar-right">
            <label className="trader-type">
              <span>STYLE</span>
              <select
                aria-label="Trading style"
                value={traderType}
                onChange={(event) => setTraderType(event.target.value)}
              >
                <option>Day trader</option>
                <option>Swing trader</option>
                <option>Position trader</option>
                <option>Scalper</option>
              </select>
              <ChevronDown size={12} />
            </label>
            <button className="icon-button topbar-icon" title="Notifications">
              <Bell size={17} />
              <i />
            </button>
            <span className="topbar-date">
              {topbarDateLabel}
            </span>
            <button
              className="button button-primary topbar-add"
              onClick={() => setModal("journal")}
            >
              <Plus size={15} />
              <span>Add trade</span>
            </button>
          </div>
        </header>
        <main className="main-content">
          <div className="view-transition" key={active}>
            {renderPage()}
          </div>
          <footer className="app-footer">
            <span>
              <span className="footer-dot" /> LOCAL DEMO DATA
            </span>
            <span>
              Plan-led trading workspace <i>·</i> Not financial advice
            </span>
            <button onClick={() => setActive("plan")}>
              Source plan <ArrowRight size={12} />
            </button>
          </footer>
        </main>
      </div>
      {modal && (
        <TradeModal
          type={modal}
          paper={paper.find((item) => item.id === closingId)}
          defaultDate={today}
          defaultTime={currentTime}
          goalDeadline={_goalDeadlineDefault}
          onClose={() => setModal(null)}
          onSubmit={handleModalSubmit}
        />
      )}
      {authOpen && (
        <AuthModal
          configured={hasSupabaseConfig}
          mode={authMode}
          onModeChange={setAuthMode}
          onClose={() => setAuthOpen(false)}
          onSubmit={handleAuthSubmit}
        />
      )}
      {toast && (
        <div className="toast">
          <span>
            <Check size={15} />
          </span>
          {toast}
          <button title="Dismiss notification" onClick={() => setToast("")}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function PageTitle({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title-row">
      <div>
        <div className="eyebrow">
          <span className="eyebrow-dot" />
          {eyebrow}
        </div>
        <h1>
          {title}
          <span className="heading-period">.</span>
        </h1>
        <p className="page-intro">{subtitle}</p>
      </div>
      {action && <div className="page-title-action">{action}</div>}
    </div>
  );
}

function TradeTable({
  trades,
  compact = false,
  onClick,
}: {
  trades: JournalTrade[];
  compact?: boolean;
  onClick?: (trade: JournalTrade) => void;
}) {
  return (
    <div className="table-overflow">
      <table className={`trade-table ${compact ? "trade-table-compact" : ""}`}>
        <thead>
          <tr>
            <th>DATE</th>
            <th>INSTRUMENT</th>
            <th>SETUP / SESSION</th>
            <th>RESULT</th>
            <th>R</th>
            <th>P&L</th>
            {!compact && <th>PLAN</th>}
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr
              key={trade.id}
              onClick={() => onClick?.(trade)}
              className={onClick ? "clickable-row" : ""}
            >
              <td>{format(parseISO(trade.date), "MMM d")}</td>
              <td>
                <span
                  className={`table-direction ${trade.direction === "Long" ? "is-long" : "is-short"}`}
                >
                  {trade.direction === "Long" ? "L" : "S"}
                </span>
                <strong>{trade.instrument}</strong>
              </td>
              <td>
                <strong>{trade.setup}</strong>
                <small>
                  {trade.session} · {trade.timeframe}
                </small>
              </td>
              <td>
                <span
                  className={`result-badge result-${trade.result.toLowerCase().replace(" ", "-")}`}
                >
                  <i />
                  {trade.result}
                </span>
              </td>
              <td className={trade.r >= 0 ? "positive" : "negative"}>
                {trade.r > 0 ? "+" : ""}
                {trade.r.toFixed(1)}R
              </td>
              <td className={trade.pnl >= 0 ? "positive" : "negative"}>
                {currency(trade.pnl)}
              </td>
              {!compact && (
                <td>
                  {trade.rulesBroken.length ? (
                    <span className="rule-exception">
                      <ShieldAlert size={13} />
                      {trade.rulesBroken.length} exception
                      {trade.rulesBroken.length > 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="rule-compliant">
                      <ShieldCheck size={13} /> Compliant
                    </span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!trades.length && (
        <div className="empty-state table-empty">
          <NotebookPen size={21} />
          <strong>No journal entries found</strong>
          <span>Try another filter or add your first trade.</span>
        </div>
      )}
    </div>
  );
}

function BacktestTable({
  rows,
  instrument,
}: {
  rows: BacktestTrade[];
  instrument: string;
}) {
  return (
    <div className="table-overflow backtest-table-overflow">
      <table className="trade-table">
        <thead>
          <tr>
            <th>DATE</th>
            <th>DIRECTION</th>
            <th>ENTRY</th>
            <th>EXIT</th>
            <th>R</th>
            <th>RESULT</th>
            <th>P&L</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 12).map((row, index) => (
            <tr key={`${row.date}-${index}`}>
              <td>{format(parseISO(row.date), "MMM d, yyyy")}</td>
              <td>
                <span
                  className={`table-direction ${row.direction === "Long" ? "is-long" : "is-short"}`}
                >
                  {row.direction === "Long" ? "L" : "S"}
                </span>
                {row.direction}
              </td>
              <td>{formatPrice(instrument, row.entry)}</td>
              <td>{formatPrice(instrument, row.exit)}</td>
              <td className={row.r >= 0 ? "positive" : "negative"}>
                {row.r >= 0 ? "+" : ""}
                {row.r.toFixed(2)}R
              </td>
              <td>
                <span
                  className={`result-badge result-${row.result.toLowerCase()}`}
                >
                  <i />
                  {row.result}
                </span>
              </td>
              <td className={row.pnl >= 0 ? "positive" : "negative"}>
                {currency(row.pnl)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SessionBars({
  sessions,
  showWinRate = false,
}: {
  sessions: { session: string; trades: number; pnl: number; winRate: number }[];
  showWinRate?: boolean;
}) {
  const max = Math.max(1, ...sessions.map((item) => Math.abs(item.pnl)));
  return (
    <div className="session-bars">
      {sessions.map((item) => (
        <div className="session-bar-row" key={item.session}>
          <div className="session-bar-name">
            <span style={{ background: sessionColors[item.session] }} />
            {item.session}
          </div>
          <div className="session-bar-track">
            <span
              className={item.pnl < 0 ? "bar-loss" : ""}
              style={{
                width: `${Math.max(8, (Math.abs(item.pnl) / max) * 100)}%`,
                background:
                  item.pnl >= 0 ? sessionColors[item.session] : undefined,
              }}
            />
          </div>
          <strong className={item.pnl >= 0 ? "positive" : "negative"}>
            {currency(item.pnl, true)}
          </strong>
          <small>
            {showWinRate ? `${item.winRate}% win` : `${item.trades} trades`}
          </small>
        </div>
      ))}
    </div>
  );
}

function TradeModal({
  type,
  paper,
  defaultDate,
  defaultTime,
  goalDeadline,
  onClose,
  onSubmit,
}: {
  type: Exclude<ModalType, null>;
  paper?: PaperPosition;
  defaultDate: string;
  defaultTime: string;
  goalDeadline: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const title =
    type === "journal"
      ? "Log a trade"
      : type === "paper"
        ? "Open paper position"
        : type === "close"
          ? "Close & review trade"
          : "Create a goal";
  const description =
    type === "journal"
      ? "Capture the setup, risk and decision context."
      : type === "paper"
        ? "Simulated only · the trade will enter your forward test."
        : type === "close"
          ? "Add the reflection now; this close will create a journal entry."
          : "Choose a metric that updates from workspace activity.";
  return (
    <div
      className="modal-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">
              <span className="eyebrow-dot" /> WORKSPACE ENTRY
            </span>
            <h2 id="modal-title">{title}</h2>
            <p>{description}</p>
          </div>
          <button
            className="icon-button"
            title="Close dialog"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={onSubmit} className="modal-form">
          {(type === "journal" || type === "paper") && (
            <>
              <div className="form-row">
                <label>
                  <span>Date</span>
                  <input
                    type="date"
                    name="date"
                    defaultValue={defaultDate}
                    required
                  />
                </label>
                {type === "journal" && (
                  <label>
                    <span>Time</span>
                    <input
                      type="time"
                      name="time"
                      defaultValue={defaultTime}
                      required
                    />
                  </label>
                )}
                <label>
                  <span>Instrument</span>
                  <select name="instrument" defaultValue="EUR/USD">
                    {instruments.map((item) => (
                      <option key={item.symbol}>{item.symbol}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>
                  <span>Direction</span>
                  <select name="direction">
                    <option>Long</option>
                    <option>Short</option>
                  </select>
                </label>
                <label>
                  <span>Setup</span>
                  <select name="setup">
                    {setupNames.map((setup) => (
                      <option key={setup}>{setup}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="form-row form-prices">
                <label>
                  <span>Entry</span>
                  <input
                    name="entry"
                    type="number"
                    step="any"
                    placeholder="1.08425"
                    required
                  />
                </label>
                <label>
                  <span>Stop loss</span>
                  <input
                    name="stopLoss"
                    type="number"
                    step="any"
                    placeholder="1.08160"
                    required
                  />
                </label>
                <label>
                  <span>Take profit</span>
                  <input
                    name="takeProfit"
                    type="number"
                    step="any"
                    placeholder="1.08955"
                    required
                  />
                </label>
              </div>
              {type === "journal" ? (
                <div className="form-row">
                  <label>
                    <span>Result</span>
                    <select name="result">
                      <option>Win</option>
                      <option>Loss</option>
                      <option>Break even</option>
                    </select>
                  </label>
                  <label>
                    <span>R multiple</span>
                    <input
                      name="r"
                      type="number"
                      step="0.1"
                      placeholder="1.5"
                      required
                    />
                  </label>
                  <label>
                    <span>P&L ($)</span>
                    <input
                      name="pnl"
                      type="number"
                      step="0.01"
                      placeholder="150"
                      required
                    />
                  </label>
                </div>
              ) : (
                <div className="form-row">
                  <label>
                    <span>Position size</span>
                    <input
                      name="size"
                      type="number"
                      step="any"
                      defaultValue="0.1"
                      min="0.01"
                      required
                    />
                  </label>
                  <label>
                    <span>Timeframe</span>
                    <select name="timeframe">
                      <option>M1</option>
                      <option>M5</option>
                      <option>M15</option>
                      <option>H1</option>
                      <option>H4</option>
                      <option>D1</option>
                    </select>
                  </label>
                  <label>
                    <span>Session</span>
                    <select name="session">
                      <option>London</option>
                      <option>New York</option>
                      <option>Asia</option>
                      <option>Overlap</option>
                    </select>
                  </label>
                </div>
              )}
              {type === "journal" && (
                <div className="form-row">
                  <label>
                    <span>Timeframe</span>
                    <select name="timeframe">
                      <option>M1</option>
                      <option>M5</option>
                      <option>M15</option>
                      <option>H1</option>
                      <option>H4</option>
                      <option>D1</option>
                    </select>
                  </label>
                  <label>
                    <span>Session</span>
                    <select name="session">
                      <option>London</option>
                      <option>New York</option>
                      <option>Asia</option>
                      <option>Overlap</option>
                    </select>
                  </label>
                  <label>
                    <span>Emotional state</span>
                    <select name="emotion">
                      <option>Focused</option>
                      <option>Patient</option>
                      <option>Confident</option>
                      <option>Hesitant</option>
                      <option>Tired</option>
                    </select>
                  </label>
                </div>
              )}
              <div className="form-row">
                <label>
                  <span>Confluence / setup tag</span>
                  <select name="tag">
                    <option value="">No tag</option>
                    {notionConfluences.map((tag) => (
                      <option key={tag}>{tag}</option>
                    ))}
                  </select>
                </label>
                {type === "journal" && (
                  <label>
                    <span>
                      Screenshot URL <small>optional</small>
                    </span>
                    <input
                      name="screenshotUrl"
                      type="url"
                      placeholder="https://…"
                    />
                  </label>
                )}
              </div>
              <label className="form-full">
                <span>Trade notes</span>
                <textarea
                  name="notes"
                  placeholder="What did you see? What would you repeat or change?"
                  rows={3}
                />
              </label>
            </>
          )}
          {type === "close" && paper && (
            <>
              <div className="close-summary">
                <div>
                  <span>
                    {paper.direction} · {paper.instrument}
                  </span>
                  <strong>{paper.setup}</strong>
                </div>
                <div>
                  <span>MARK</span>
                  <strong>
                    {formatPrice(paper.instrument, paper.currentPrice)}
                  </strong>
                </div>
              </div>
              <div className="form-row">
                <label>
                  <span>Outcome</span>
                  <select name="result">
                    <option>Win</option>
                    <option>Loss</option>
                    <option>Break even</option>
                  </select>
                </label>
                <label>
                  <span>Final R</span>
                  <input
                    name="r"
                    type="number"
                    step="0.1"
                    placeholder="1.2"
                    required
                  />
                </label>
                <label>
                  <span>Emotional state</span>
                  <select name="emotion">
                    <option>Focused</option>
                    <option>Patient</option>
                    <option>Confident</option>
                    <option>Hesitant</option>
                    <option>Tired</option>
                  </select>
                </label>
              </div>
              <label className="form-full">
                <span>
                  Reflection <b className="required-mark">· required</b>
                </span>
                <textarea
                  name="notes"
                  rows={4}
                  placeholder="What did you notice? How closely did the trade follow your plan?"
                  required
                />
              </label>
              <div className="auto-journal-note">
                <NotebookPen size={15} />
                <span>
                  Closing this position creates a linked trade journal entry
                  automatically.
                </span>
              </div>
            </>
          )}
          {type === "goal" && (
            <>
              <label className="form-full">
                <span>Goal title</span>
                <input
                  name="title"
                  placeholder="e.g. Follow the plan for 20 trades"
                  required
                />
              </label>
              <label className="form-full">
                <span>Description</span>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="What does success look like?"
                />
              </label>
              <div className="form-row">
                <label>
                  <span>Category</span>
                  <select name="category">
                    <option>Short-term</option>
                    <option>Medium-term</option>
                    <option>Long-term</option>
                  </select>
                </label>
                <label>
                  <span>Progress metric</span>
                  <select name="metric">
                    <option value="trades">Logged trades</option>
                    <option value="win-rate">Win rate</option>
                    <option value="adherence">Plan adherence</option>
                    <option value="reviews">Weekly reviews</option>
                  </select>
                </label>
                <label>
                  <span>Target</span>
                  <input
                    name="target"
                    type="number"
                    min="1"
                    defaultValue="20"
                    required
                  />
                </label>
              </div>
              <label>
                <span>Deadline</span>
                <input
                  name="deadline"
                  type="date"
                  defaultValue={goalDeadline}
                  required
                />
              </label>
            </>
          )}
          <div className="modal-footer">
            <button
              type="button"
              className="button button-quiet"
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="button button-primary" type="submit">
              {type === "journal" ? (
                <>
                  <Plus size={15} /> Save trade
                </>
              ) : type === "paper" ? (
                <>
                  <Radio size={15} /> Open position
                </>
              ) : type === "close" ? (
                <>
                  <Check size={15} /> Close & journal
                </>
              ) : (
                <>
                  <Target size={15} /> Add goal
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AuthModal({
  configured,
  mode,
  onModeChange,
  onClose,
  onSubmit,
}: {
  configured: boolean;
  mode: "sign-in" | "sign-up";
  onModeChange: (mode: "sign-in" | "sign-up") => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div
      className="modal-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="modal-panel auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">
              <span className="eyebrow-dot" /> WORKSPACE SYNC
            </span>
            <h2 id="auth-title">
              {configured
                ? mode === "sign-in"
                  ? "Connect your workspace"
                  : "Create a workspace account"
                : "Local workspace"}
            </h2>
            <p>
              {configured
                ? "Sign in to securely sync your journal, settings and goals."
                : "Your data is stored in this browser until Supabase is configured."}
            </p>
          </div>
          <button
            className="icon-button"
            title="Close dialog"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        {configured ? (
          <form className="modal-form" onSubmit={onSubmit}>
            <label>
              <span>Email</span>
              <input type="email" name="email" autoComplete="email" required />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                name="password"
                autoComplete={
                  mode === "sign-in" ? "current-password" : "new-password"
                }
                minLength={8}
                required
              />
            </label>
            <button className="button button-primary auth-submit" type="submit">
              {mode === "sign-in" ? "Sign in & sync" : "Create account"}
            </button>
            <button
              className="text-button auth-mode-toggle"
              type="button"
              onClick={() =>
                onModeChange(mode === "sign-in" ? "sign-up" : "sign-in")
              }
            >
              {mode === "sign-in"
                ? "New here? Create an account"
                : "Already have an account? Sign in"}
            </button>
          </form>
        ) : (
          <div className="local-mode-content">
            <div>
              <CloudOff size={19} />
              <span>
                No Supabase credentials detected. Create a local{" "}
                <code>.env.local</code> from <code>.env.example</code>, add your
                project URL and anon key, then restart the app.
              </span>
            </div>
            <button className="button button-secondary" onClick={onClose}>
              Continue locally
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

export default App;
