import { useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  FileText,
  Plus,
  Search,
  Target,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import { format, parseISO, subDays } from "date-fns";
import {
  currency,
  setupNames,
  type BacktestSummary,
  type Goal,
  type JournalTrade,
  type TradingRule,
} from "./tradingData";

export type LocalModuleId =
  | "insights"
  | "setups"
  | "strategy-tests"
  | "resources"
  | "notes"
  | "study"
  | "account-tools"
  | "weekly-reviews";

type RecordBase = { id: string; createdAt: string };

export interface SetupRecord extends RecordBase {
  name: string;
  category: string;
  description: string;
  marketConditions: string;
  timeframes: string;
  entryCriteria: string;
  exitCriteria: string;
  active: boolean;
}

export interface TestTrade extends RecordBase {
  direction: "Long" | "Short";
  outcome: "Win" | "Loss" | "Break even";
  pnl: number;
  r: number;
  notes: string;
}

export interface TestSession extends RecordBase {
  name: string;
  testType: "Backtest" | "Forward test";
  strategy: string;
  instrument: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  initialBalance: number;
  notes: string;
  trades: TestTrade[];
}

export interface ResourceRecord extends RecordBase {
  title: string;
  category: string;
  url: string;
  description: string;
  tags: string[];
}

export interface NoteRecord extends RecordBase {
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  updatedAt: string;
}

export interface StudyRecord extends RecordBase {
  title: string;
  type: string;
  status: "Not started" | "In progress" | "Completed";
  totalUnits: number;
  completedUnits: number;
  progressPercent: number;
  url: string;
  notes: string;
}

export interface BrokerRecord extends RecordBase {
  name: string;
  accountType: string;
  accountLabel: string;
  leverage: string;
  commission: string;
  spread: string;
  fundingMethod: string;
  url: string;
  notes: string;
  active: boolean;
}

export interface ChartingRecord extends RecordBase {
  name: string;
  status: "Active" | "Trial" | "Cancelled";
  renewalDate: string;
  price: number;
  features: string;
  url: string;
  notes: string;
}

export interface WeeklyReview extends RecordBase {
  weekStart: string;
  weekEnd: string;
  rating: number;
  tradesTaken: number;
  tradesPlanned: number;
  pnl: number;
  wentWell: string;
  wentWrong: string;
  lessons: string;
  nextFocus: string;
  psychology: string;
}

export interface LocalModuleState {
  setups: SetupRecord[];
  testSessions: TestSession[];
  resources: ResourceRecord[];
  notes: NoteRecord[];
  studyItems: StudyRecord[];
  brokers: BrokerRecord[];
  chartingTools: ChartingRecord[];
  weeklyReviews: WeeklyReview[];
}

export interface LocalModuleProps {
  page: LocalModuleId;
  data: LocalModuleState;
  trades: JournalTrade[];
  backtests: BacktestSummary[];
  goals: Goal[];
  rules: TradingRule[];
  onChange: (update: (current: LocalModuleState) => LocalModuleState) => void;
  onNavigate: (page: "journal" | "risk" | "rules" | "plan" | "analytics" | "backtest") => void;
}

const pageContent: Record<LocalModuleId, { label: string; title: string; description: string }> = {
  insights: { label: "REVIEW INTELLIGENCE", title: "Pattern insights", description: "Evidence-led observations from your journal. All analysis runs locally; no external AI service is connected." },
  setups: { label: "PLAYBOOK LIBRARY", title: "Trading setups", description: "Document the conditions, entry criteria, and management rules behind each repeatable setup." },
  "strategy-tests": { label: "RESEARCH WORKBENCH", title: "Strategy testing", description: "Organize manual backtest and forward-test sessions with a consistent trade log." },
  resources: { label: "RESEARCH LIBRARY", title: "Resources", description: "Keep useful books, courses, market references, and tools organized with your plan." },
  notes: { label: "TRADER NOTEBOOK", title: "Notes", description: "Capture research thoughts, session observations, and lessons worth revisiting." },
  study: { label: "DEVELOPMENT TRACKER", title: "Study materials", description: "Track learning progress alongside the trading process you are building." },
  "account-tools": { label: "ACCOUNT INVENTORY", title: "Brokers & charting", description: "Keep a private reference list of platforms and subscriptions. Do not store passwords or secret credentials here." },
  "weekly-reviews": { label: "PROCESS REVIEW", title: "Weekly reviews", description: "Use journal results and structured reflection to set the next week’s process focus." },
};

const reviewPrompts = [
  ["Went well", "What did I execute well this week?"],
  ["Went wrong", "Where did I depart from the plan?"],
  ["Lessons", "What did the evidence teach me?"],
  ["Next focus", "What is one process focus for next week?"],
  ["Psychology", "What emotional patterns affected decisions?"],
] as const;

function id(): string {
  return crypto.randomUUID();
}

function field(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

function numberField(form: FormData, name: string, fallback = 0): number {
  const value = Number(form.get(name));
  return Number.isFinite(value) ? value : fallback;
}

function tagsFrom(value: string): string[] {
  return [...new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean))];
}

function safeExternalUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function panelTitle(title: string, subtitle?: string, action?: ReactNode) {
  return (
    <div className="panel-heading">
      <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
      {action}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="local-stat"><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div>;
}

function LocalBadge() {
  return <span className="local-storage-badge"><span /> PRIVATE · BROWSER SAVED</span>;
}

function EmptyModule({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="local-empty">
      <FileText size={19} />
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  );
}

function LocalDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="local-dialog-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="local-dialog" role="dialog" aria-modal="true" aria-labelledby="local-dialog-title">
        <header><div><span className="eyebrow"><span className="eyebrow-dot" /> WORKSPACE ENTRY</span><h2 id="local-dialog-title">{title}</h2></div><button className="icon-button" onClick={onClose} title="Close"><span aria-hidden="true">×</span></button></header>
        {children}
      </section>
    </div>
  );
}

function FormField({ label, name, type = "text", required = false, placeholder, defaultValue, options, min, max, step, rows }: {
  label: string; name: string; type?: string; required?: boolean; placeholder?: string; defaultValue?: string | number; options?: string[]; min?: number; max?: number; step?: number; rows?: number;
}) {
  return (
    <label className="local-form-field">
      <span>{label}</span>
      {options ? (
        <select name={name} defaultValue={String(defaultValue ?? options[0])} required={required}>
          {options.map((option) => <option key={option}>{option}</option>)}
        </select>
      ) : type === "textarea" ? (
        <textarea name={name} rows={rows ?? 3} defaultValue={defaultValue} placeholder={placeholder} required={required} />
      ) : (
        <input name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} required={required} min={min} max={max} step={step} />
      )}
    </label>
  );
}

function DialogActions({ onCancel, submit = "Save record" }: { onCancel: () => void; submit?: string }) {
  return <div className="local-dialog-actions"><button type="button" className="button button-secondary" onClick={onCancel}>Cancel</button><button type="submit" className="button button-primary">{submit}<ArrowRight size={14} /></button></div>;
}

function ModuleHeading({ page, action }: { page: LocalModuleId; action?: ReactNode }) {
  const content = pageContent[page];
  return (
    <div className="page-title-row local-module-title">
      <div><div className="eyebrow"><span className="eyebrow-dot" />{content.label}</div><h1>{content.title}<span className="heading-period">.</span></h1><p className="page-intro">{content.description}</p></div>
      <div className="local-module-actions"><LocalBadge />{action}</div>
    </div>
  );
}

function getTradeSummary(trades: JournalTrade[]) {
  const wins = trades.filter((trade) => trade.result === "Win");
  const decisive = trades.filter((trade) => trade.result !== "Break even");
  const grossWins = wins.reduce((total, trade) => total + Math.max(0, trade.pnl), 0);
  const grossLosses = Math.abs(trades.reduce((total, trade) => total + Math.min(0, trade.pnl), 0));
  return {
    count: trades.length,
    net: trades.reduce((total, trade) => total + trade.pnl, 0),
    winRate: decisive.length ? Math.round((wins.length / decisive.length) * 100) : 0,
    profitFactor: grossLosses ? grossWins / grossLosses : grossWins ? Infinity : 0,
    averageR: trades.length ? trades.reduce((total, trade) => total + trade.r, 0) / trades.length : 0,
  };
}

function LocalInsightModule({ trades, backtests, goals, rules, onNavigate }: Pick<LocalModuleProps, "trades" | "backtests" | "goals" | "rules" | "onNavigate">) {
  const [period, setPeriod] = useState("All journal history");
  const [today] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const periodEnd = parseISO(today);
  const cutoff = period === "30 days" ? format(subDays(periodEnd, 30), "yyyy-MM-dd") : period === "90 days" ? format(subDays(periodEnd, 90), "yyyy-MM-dd") : "0000-00-00";
  const periodTrades = trades.filter((trade) => trade.date >= cutoff);
  const stats = getTradeSummary(periodTrades);
  const bySetup = [...new Set(periodTrades.map((trade) => trade.setup))]
    .map((setup) => ({ setup, ...getTradeSummary(periodTrades.filter((trade) => trade.setup === setup)) }))
    .filter((row) => row.count >= 3)
    .sort((left, right) => right.averageR - left.averageR);
  const bySession = [...new Set(periodTrades.map((trade) => trade.session))]
    .map((session) => ({ session, ...getTradeSummary(periodTrades.filter((trade) => trade.session === session)) }))
    .filter((row) => row.count >= 3)
    .sort((left, right) => right.averageR - left.averageR);
  const ruleCompliance = periodTrades.length
    ? Math.round((periodTrades.filter((trade) => !trade.rulesBroken.length).length / periodTrades.length) * 100)
    : 0;
  const activeRuleCount = rules.filter((rule) => rule.enabled).length;
  const bestSetup = bySetup[0];
  const worstSetup = bySetup.at(-1);
  const insightCards = [
    { title: "Setup sample", value: bestSetup ? `${bestSetup.setup} · ${bestSetup.averageR.toFixed(2)}R avg` : "Build a 3-trade sample", detail: "Setup observations are shown after at least three journal records." },
    { title: "Session sample", value: bySession[0] ? `${bySession[0].session} · ${bySession[0].averageR.toFixed(2)}R avg` : "More session data needed", detail: "Session comparisons use your logged outcomes, not live market data." },
    { title: "Plan adherence", value: periodTrades.length ? `${ruleCompliance}% of trades unflagged` : "No journal records", detail: "A trade without rule exceptions is treated as plan-adherent." },
    { title: "Active guardrails", value: String(activeRuleCount), detail: "Enabled rules configured in your trading workspace." },
  ];
  const suggestions = [
    periodTrades.length < 10 ? "Keep collecting a consistent sample before changing the plan based on a short run." : null,
    stats.averageR <= 0 && periodTrades.length >= 5 ? "Review entries with negative R expectancy and compare them against your documented invalidation." : null,
    ruleCompliance < 80 && periodTrades.length >= 5 ? "Check whether repeated rule exceptions cluster around a specific session or setup." : null,
    worstSetup && worstSetup.setup !== bestSetup?.setup ? `Review ${worstSetup.setup}: it has the lowest average R among setups with at least three records.` : null,
    !backtests.length ? "Save a backtest to compare a tested hypothesis with journal execution." : null,
    goals.filter((goal) => !goal.achieved).length ? `${goals.filter((goal) => !goal.achieved).length} active process goals can provide a more useful review target than short-term P&L.` : null,
  ].filter((suggestion): suggestion is string => Boolean(suggestion));

  return (
    <>
      <ModuleHeading page="insights" action={<label className="local-period-select"><span>PERIOD</span><select value={period} onChange={(event) => setPeriod(event.target.value)}><option>All journal history</option><option>90 days</option><option>30 days</option></select><ChevronDown size={12} /></label>} />
      <div className="local-stat-grid">
        <Stat label="Trades reviewed" value={String(stats.count)} />
        <Stat label="Net journal P&L" value={currency(stats.net)} />
        <Stat label="Average R" value={`${stats.averageR.toFixed(2)}R`} />
        <Stat label="Profit factor" value={Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "∞"} />
      </div>
      <div className="local-insight-grid">
        <section className="panel local-module-panel">
          {panelTitle("Observed patterns", "Local analysis of your saved journal records")}
          <div className="local-pattern-list">{insightCards.map((card) => <article key={card.title}><span className="local-pattern-icon"><Activity size={15} /></span><div><strong>{card.title}</strong><p>{card.detail}</p></div><b>{card.value}</b></article>)}</div>
        </section>
        <section className="panel local-module-panel">
          {panelTitle("Review prompts", "Evidence first, interpretation second")}
          <div className="local-suggestion-list">{suggestions.map((suggestion, index) => <div key={suggestion}><span>{String(index + 1).padStart(2, "0")}</span><p>{suggestion}</p></div>)}</div>
          <div className="local-module-links"><button className="text-button" onClick={() => onNavigate("journal")}>Open journal <ArrowRight size={13} /></button><button className="text-button" onClick={() => onNavigate("analytics")}>Compare analytics <ArrowRight size={13} /></button></div>
        </section>
      </div>
      {bySetup.length > 0 && <section className="panel local-module-panel local-table-panel">{panelTitle("Setup comparison", "Minimum sample: 3 journal records")}<div className="local-table-wrap"><table className="trade-table"><thead><tr><th>Setup</th><th>Trades</th><th>Win rate</th><th>Average R</th><th>Net P&L</th></tr></thead><tbody>{bySetup.map((row) => <tr key={row.setup}><td><strong>{row.setup}</strong></td><td>{row.count}</td><td>{row.winRate}%</td><td>{row.averageR.toFixed(2)}R</td><td className={row.net >= 0 ? "positive" : "negative"}>{currency(row.net)}</td></tr>)}</tbody></table></div></section>}
      <p className="local-disclaimer"><CircleHelp size={13} /> These are descriptive statistics and rule-based prompts, not AI-generated financial advice or a prediction of future results.</p>
    </>
  );
}

type DialogType = "setup" | "session" | "test-trade" | "resource" | "note" | "study" | "broker" | "charting" | "review";
type DialogState = { type: DialogType; sessionId?: string } | null;

export function LocalModulePage({ page, data, trades, backtests, goals, rules, onChange, onNavigate }: LocalModuleProps) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [studyFilter, setStudyFilter] = useState("All");
  const [today] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const dateAnchor = parseISO(today);

  if (page === "insights") return <LocalInsightModule trades={trades} backtests={backtests} goals={goals} rules={rules} onNavigate={onNavigate} />;

  function addRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog) return;
    const form = new FormData(event.currentTarget);
    const createdAt = new Date().toISOString();
    const recordId = id();
    onChange((current) => {
      if (dialog.type === "setup") {
        const record: SetupRecord = { id: recordId, createdAt, name: field(form, "name"), category: field(form, "category"), description: field(form, "description"), marketConditions: field(form, "marketConditions"), timeframes: field(form, "timeframes"), entryCriteria: field(form, "entryCriteria"), exitCriteria: field(form, "exitCriteria"), active: true };
        return { ...current, setups: [record, ...current.setups] };
      }
      if (dialog.type === "session") {
        const record: TestSession = { id: recordId, createdAt, name: field(form, "name"), testType: field(form, "testType") as TestSession["testType"], strategy: field(form, "strategy"), instrument: field(form, "instrument"), timeframe: field(form, "timeframe"), startDate: field(form, "startDate"), endDate: field(form, "endDate"), initialBalance: numberField(form, "initialBalance"), notes: field(form, "notes"), trades: [] };
        return { ...current, testSessions: [record, ...current.testSessions] };
      }
      if (dialog.type === "test-trade" && dialog.sessionId) {
        const trade: TestTrade = { id: recordId, createdAt, direction: field(form, "direction") as TestTrade["direction"], outcome: field(form, "outcome") as TestTrade["outcome"], pnl: numberField(form, "pnl"), r: numberField(form, "r"), notes: field(form, "notes") };
        return { ...current, testSessions: current.testSessions.map((session) => session.id === dialog.sessionId ? { ...session, trades: [trade, ...session.trades] } : session) };
      }
      if (dialog.type === "resource") {
        const record: ResourceRecord = { id: recordId, createdAt, title: field(form, "title"), category: field(form, "category"), url: field(form, "url"), description: field(form, "description"), tags: tagsFrom(field(form, "tags")) };
        return { ...current, resources: [record, ...current.resources] };
      }
      if (dialog.type === "note") {
        const record: NoteRecord = { id: recordId, createdAt, updatedAt: createdAt, title: field(form, "title"), content: field(form, "content"), tags: tagsFrom(field(form, "tags")), pinned: form.get("pinned") === "on" };
        return { ...current, notes: [record, ...current.notes] };
      }
      if (dialog.type === "study") {
        const totalUnits = numberField(form, "totalUnits");
        const progressPercent = Math.min(100, Math.max(0, numberField(form, "progressPercent")));
        const record: StudyRecord = { id: recordId, createdAt, title: field(form, "title"), type: field(form, "type"), status: field(form, "status") as StudyRecord["status"], totalUnits, completedUnits: Math.min(totalUnits, numberField(form, "completedUnits")), progressPercent, url: field(form, "url"), notes: field(form, "notes") };
        return { ...current, studyItems: [record, ...current.studyItems] };
      }
      if (dialog.type === "broker") {
        const record: BrokerRecord = { id: recordId, createdAt, name: field(form, "name"), accountType: field(form, "accountType"), accountLabel: field(form, "accountLabel"), leverage: field(form, "leverage"), commission: field(form, "commission"), spread: field(form, "spread"), fundingMethod: field(form, "fundingMethod"), url: field(form, "url"), notes: field(form, "notes"), active: true };
        return { ...current, brokers: [record, ...current.brokers] };
      }
      if (dialog.type === "charting") {
        const record: ChartingRecord = { id: recordId, createdAt, name: field(form, "name"), status: field(form, "status") as ChartingRecord["status"], renewalDate: field(form, "renewalDate"), price: numberField(form, "price"), features: field(form, "features"), url: field(form, "url"), notes: field(form, "notes") };
        return { ...current, chartingTools: [record, ...current.chartingTools] };
      }
      const weekStart = field(form, "weekStart");
      const weekEnd = field(form, "weekEnd");
      const weekTrades = trades.filter((trade) => trade.date >= weekStart && trade.date <= weekEnd);
      const record: WeeklyReview = { id: recordId, createdAt, weekStart, weekEnd, rating: numberField(form, "rating", 5), tradesTaken: weekTrades.length, tradesPlanned: numberField(form, "tradesPlanned"), pnl: weekTrades.reduce((sum, trade) => sum + trade.pnl, 0), wentWell: field(form, "wentWell"), wentWrong: field(form, "wentWrong"), lessons: field(form, "lessons"), nextFocus: field(form, "nextFocus"), psychology: field(form, "psychology") };
      return { ...current, weeklyReviews: [record, ...current.weeklyReviews] };
    });
    setDialog(null);
  }

  function deleteRecord(collection: keyof LocalModuleState, recordId: string) {
    onChange((current) => ({ ...current, [collection]: (current[collection] as RecordBase[]).filter((record) => record.id !== recordId) }));
  }

  const filtered = <T extends { name?: string; title?: string; category?: string; description?: string; tags?: string[] }>(items: T[]): T[] => items.filter((item) => {
    const text = `${item.name ?? ""} ${item.title ?? ""} ${item.category ?? ""} ${item.description ?? ""} ${(item.tags ?? []).join(" ")}`.toLowerCase();
    return text.includes(search.toLowerCase()) && (categoryFilter === "All" || item.category === categoryFilter);
  });
  const headingAction = (type: DialogType, label = "Add record") => <button className="button button-primary" onClick={() => setDialog({ type })}><Plus size={14} />{label}</button>;
  const localEmptyAction = (type: DialogType, label: string) => <button className="button button-secondary button-small" onClick={() => setDialog({ type })}><Plus size={13} />{label}</button>;
  const dialogTitle: Record<DialogType, string> = {
    setup: "Document a setup", session: "Create a test session", "test-trade": "Log a test trade", resource: "Add a resource", note: "Write a note", study: "Track study material", broker: "Add a broker reference", charting: "Add a charting tool", review: "Complete a weekly review",
  };

  function renderDialogForm() {
    if (!dialog) return null;
    if (dialog.type === "setup") return <><div className="local-form-grid"><FormField label="Setup name" name="name" required /><FormField label="Category" name="category" options={["Breakout", "Reversal", "Trend following", "Range", "Scalping", "Swing", "Other"]} /><FormField label="Timeframes" name="timeframes" placeholder="e.g. H4 / M15" /><FormField label="Market conditions" name="marketConditions" placeholder="Conditions where this setup is valid" /><FormField label="Entry criteria" name="entryCriteria" type="textarea" required /><FormField label="Exit criteria" name="exitCriteria" type="textarea" /><FormField label="Description" name="description" type="textarea" /></div><DialogActions onCancel={() => setDialog(null)} /></>;
    if (dialog.type === "session") return <><div className="local-form-grid"><FormField label="Session name" name="name" required /><FormField label="Test type" name="testType" options={["Backtest", "Forward test"]} /><FormField label="Strategy / setup" name="strategy" required /><FormField label="Instrument" name="instrument" defaultValue="EUR/USD" required /><FormField label="Timeframe" name="timeframe" defaultValue="M15" /><FormField label="Initial balance" name="initialBalance" type="number" min={1} defaultValue={10000} required /><FormField label="Start date" name="startDate" type="date" /><FormField label="End date" name="endDate" type="date" /><FormField label="Notes" name="notes" type="textarea" /></div><DialogActions onCancel={() => setDialog(null)} submit="Create session" /></>;
    if (dialog.type === "test-trade") return <><div className="local-form-grid"><FormField label="Direction" name="direction" options={["Long", "Short"]} /><FormField label="Outcome" name="outcome" options={["Win", "Loss", "Break even"]} /><FormField label="P&L" name="pnl" type="number" step={0.01} defaultValue={0} /><FormField label="R multiple" name="r" type="number" step={0.1} defaultValue={0} /><FormField label="Notes" name="notes" type="textarea" /></div><DialogActions onCancel={() => setDialog(null)} submit="Log test trade" /></>;
    if (dialog.type === "resource") return <><div className="local-form-grid"><FormField label="Title" name="title" required /><FormField label="Category" name="category" options={["Book", "Course", "Video", "Article", "Podcast", "Tool", "Other"]} /><FormField label="URL" name="url" type="url" /><FormField label="Tags" name="tags" placeholder="Comma separated" /><FormField label="Description" name="description" type="textarea" /></div><DialogActions onCancel={() => setDialog(null)} /></>;
    if (dialog.type === "note") return <><div className="local-form-grid"><FormField label="Title" name="title" required /><FormField label="Tags" name="tags" placeholder="Comma separated" /><FormField label="Note" name="content" type="textarea" rows={6} required /><label className="local-checkbox-field"><input type="checkbox" name="pinned" /><span>Pin to the top of my notebook</span></label></div><DialogActions onCancel={() => setDialog(null)} submit="Save note" /></>;
    if (dialog.type === "study") return <><div className="local-form-grid"><FormField label="Title" name="title" required /><FormField label="Type" name="type" options={["Book", "Course", "Video series", "Article", "Podcast", "Other"]} /><FormField label="Status" name="status" options={["Not started", "In progress", "Completed"]} /><FormField label="Units completed" name="completedUnits" type="number" min={0} defaultValue={0} /><FormField label="Total units" name="totalUnits" type="number" min={0} defaultValue={0} /><FormField label="Progress % (if no unit total)" name="progressPercent" type="number" min={0} max={100} defaultValue={0} /><FormField label="URL" name="url" type="url" /><FormField label="Notes" name="notes" type="textarea" /></div><DialogActions onCancel={() => setDialog(null)} /></>;
    if (dialog.type === "broker") return <><div className="local-form-grid"><FormField label="Broker / platform" name="name" required /><FormField label="Account type" name="accountType" options={["Personal", "Evaluation", "Funded", "Demo", "Other"]} /><FormField label="Account label (no secrets)" name="accountLabel" placeholder="e.g. Main USD account" /><FormField label="Leverage" name="leverage" placeholder="e.g. 1:30" /><FormField label="Commission / lot" name="commission" /><FormField label="Typical spread" name="spread" /><FormField label="Funding method" name="fundingMethod" /><FormField label="Platform URL" name="url" type="url" /><FormField label="Notes" name="notes" type="textarea" /></div><DialogActions onCancel={() => setDialog(null)} /></>;
    if (dialog.type === "charting") return <><div className="local-form-grid"><FormField label="Tool name" name="name" required /><FormField label="Subscription" name="status" options={["Active", "Trial", "Cancelled"]} /><FormField label="Renewal date" name="renewalDate" type="date" /><FormField label="Price per billing period" name="price" type="number" min={0} step={0.01} defaultValue={0} /><FormField label="Features" name="features" placeholder="Comma separated" /><FormField label="URL" name="url" type="url" /><FormField label="Notes" name="notes" type="textarea" /></div><DialogActions onCancel={() => setDialog(null)} /></>;
    const weekStart = format(subDays(dateAnchor, (dateAnchor.getDay() + 6) % 7), "yyyy-MM-dd");
    const weekEnd = today;
    return <><div className="local-form-grid"><FormField label="Week start" name="weekStart" type="date" defaultValue={weekStart} required /><FormField label="Week end" name="weekEnd" type="date" defaultValue={weekEnd} required /><FormField label="Process rating" name="rating" type="number" min={1} max={10} defaultValue={7} required /><FormField label="Trades planned" name="tradesPlanned" type="number" min={0} defaultValue={0} /><FormField label={reviewPrompts[0][1]} name="wentWell" type="textarea" /><FormField label={reviewPrompts[1][1]} name="wentWrong" type="textarea" /><FormField label={reviewPrompts[2][1]} name="lessons" type="textarea" /><FormField label={reviewPrompts[3][1]} name="nextFocus" type="textarea" /><FormField label={reviewPrompts[4][1]} name="psychology" type="textarea" /></div><p className="local-form-hint">Trade count and realized P&L are calculated from your journal for these dates.</p><DialogActions onCancel={() => setDialog(null)} submit="Save weekly review" /></>;
  }

  let content: ReactNode;
  let action: ReactNode;
  if (page === "setups") {
    const core: (SetupRecord & { isCore: boolean })[] = setupNames.map((name, index) => ({ id: `plan-${index}`, createdAt: "", name, category: "Plan entry model", description: "Imported from the Notion plan. Document its specific entry and exit rules below.", marketConditions: "", timeframes: "", entryCriteria: "", exitCriteria: "", active: true, isCore: true }));
    const setups: (SetupRecord & { isCore: boolean })[] = [...core, ...data.setups.map((setup) => ({ ...setup, isCore: false }))];
    const visible = filtered(setups);
    action = headingAction("setup", "Add setup");
    content = <><div className="local-filter-row"><label className="search-input"><Activity size={13} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a setup…" /></label><label className="local-filter-select"><span>Category</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option>All</option>{[...new Set(setups.map((setup) => setup.category))].map((category) => <option key={category}>{category}</option>)}</select></label><span className="local-result-count">{visible.length} setups</span></div><div className="local-record-grid">{visible.map((setup) => { const sample = trades.filter((trade) => trade.setup === setup.name); const summary = getTradeSummary(sample); return <article className="panel local-record-card" key={setup.id}><header><span className="local-record-kind">{setup.category}</span><div className="local-card-actions">{setup.isCore ? <span className="muted-label">PLAN</span> : <button className="icon-button subtle" title="Delete setup" onClick={() => deleteRecord("setups", setup.id)}><Trash2 size={14} /></button>}</div></header><h2>{setup.name}</h2><p>{setup.description}</p><div className="local-card-stats"><span>{sample.length} journal trades</span><strong className={summary.net >= 0 ? "positive" : "negative"}>{currency(summary.net)}</strong><span>{summary.winRate}% win rate</span><span>{summary.averageR.toFixed(2)}R avg</span></div>{setup.entryCriteria && <div className="local-detail"><strong>Entry</strong><p>{setup.entryCriteria}</p></div>}{setup.exitCriteria && <div className="local-detail"><strong>Exit</strong><p>{setup.exitCriteria}</p></div>}</article>; })}</div></>;
  } else if (page === "strategy-tests") {
    action = headingAction("session", "New test session");
    const tradesCount = data.testSessions.reduce((sum, session) => sum + session.trades.length, 0);
    content = <><div className="local-stat-grid"><Stat label="Test sessions" value={String(data.testSessions.length)} /><Stat label="Logged test trades" value={String(tradesCount)} /><Stat label="Backtests saved" value={String(backtests.length)} /></div>{data.testSessions.length ? <div className="local-session-list">{data.testSessions.map((session) => { const summary = getTradeSummary(session.trades.map((trade) => ({ id: trade.id, date: trade.createdAt.slice(0, 10), time: "00:00", instrument: session.instrument, direction: trade.direction, entry: 0, stopLoss: 0, takeProfit: 0, result: trade.outcome, pnl: trade.pnl, r: trade.r, setup: session.strategy, timeframe: session.timeframe, session: "London" as const, emotion: "Focused", notes: trade.notes, tags: [], rulesBroken: [], source: "Journal" as const }))); return <article className="panel local-session-card" key={session.id}><header>{panelTitle(session.name, `${session.testType} · ${session.strategy}`, <button className="icon-button subtle" title="Delete session" onClick={() => deleteRecord("testSessions", session.id)}><Trash2 size={14} /></button>)}</header><div className="local-card-stats"><span>{session.instrument} · {session.timeframe}</span><span>{session.startDate || "Start date not set"} → {session.endDate || "Open-ended"}</span><span>{session.trades.length} trades</span><strong className={summary.net >= 0 ? "positive" : "negative"}>{currency(summary.net)}</strong></div>{session.notes && <p className="local-session-note">{session.notes}</p>}<div className="local-session-trades">{session.trades.length ? session.trades.map((trade) => <div key={trade.id}><span>{trade.direction}</span><span>{trade.outcome}</span><strong className={trade.pnl >= 0 ? "positive" : "negative"}>{currency(trade.pnl)}</strong><span>{trade.r.toFixed(1)}R</span>{trade.notes && <small>{trade.notes}</small>}</div>) : <span className="muted-label">No test trades logged.</span>}</div><button className="button button-secondary button-small" onClick={() => setDialog({ type: "test-trade", sessionId: session.id })}><Plus size={13} />Log test trade</button></article>; })}</div> : <section className="panel local-module-panel"><EmptyModule title="Start a structured test" description="Create a backtest or forward-test session, then log outcomes against the same strategy and timeframe." action={localEmptyAction("session", "Create test session")} /></section>}</>;
  } else if (page === "resources") {
    const categories = ["All", ...new Set(data.resources.map((resource) => resource.category))];
    const visible = filtered(data.resources);
    action = headingAction("resource", "Add resource");
    content = <><div className="local-filter-row"><label className="search-input"><SearchIcon /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search resources and tags…" /></label><label className="local-filter-select"><span>TYPE</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><span className="local-result-count">{visible.length} resources</span></div>{visible.length ? <div className="local-record-grid">{visible.map((resource) => <article key={resource.id} className="panel local-record-card"><header><span className="local-record-kind">{resource.category}</span><button className="icon-button subtle" title="Delete resource" onClick={() => deleteRecord("resources", resource.id)}><Trash2 size={14} /></button></header><h2>{resource.title}</h2><p>{resource.description || "No description added."}</p><div className="local-tags">{resource.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>{safeExternalUrl(resource.url) && <a className="text-button" href={safeExternalUrl(resource.url)} target="_blank" rel="noreferrer">Open resource <ExternalLink size={13} /></a>}</article>)}</div> : <section className="panel local-module-panel"><EmptyModule title="Your research library is empty" description="Save references you trust and add a few tags to make them searchable." action={localEmptyAction("resource", "Add a resource")} /></section>}</>;
  } else if (page === "notes") {
    const visible = [...data.notes].filter((note) => `${note.title} ${note.content} ${note.tags.join(" ")}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
    action = headingAction("note", "New note");
    content = <><div className="local-filter-row"><label className="search-input"><SearchIcon /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notes…" /></label><span className="local-result-count">{data.notes.length} notes · {data.notes.filter((note) => note.pinned).length} pinned</span></div>{visible.length ? <div className="local-record-grid">{visible.map((note) => <article className={`panel local-record-card ${note.pinned ? "is-pinned" : ""}`} key={note.id}><header><span className="local-record-kind">{note.pinned ? "PINNED NOTE" : "NOTE"}</span><div className="local-card-actions"><button className="icon-button subtle" title={note.pinned ? "Unpin note" : "Pin note"} onClick={() => onChange((current) => ({ ...current, notes: current.notes.map((item) => item.id === note.id ? { ...item, pinned: !item.pinned, updatedAt: new Date().toISOString() } : item) }))}><Target size={14} /></button><button className="icon-button subtle" title="Delete note" onClick={() => deleteRecord("notes", note.id)}><Trash2 size={14} /></button></div></header><h2>{note.title}</h2><p className="local-note-content">{note.content}</p><div className="local-tags">{note.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><small className="muted-label">UPDATED {format(parseISO(note.updatedAt), "MMM d, yyyy")}</small></article>)}</div> : <section className="panel local-module-panel"><EmptyModule title="Start your private notebook" description="Capture observations, lessons, and research notes with searchable tags." action={localEmptyAction("note", "Write a note")} /></section>}</>;
  } else if (page === "study") {
    const visible = data.studyItems.filter((item) => studyFilter === "All" || item.type === studyFilter);
    const completed = data.studyItems.filter((item) => item.status === "Completed").length;
    const percent = data.studyItems.length ? Math.round(data.studyItems.reduce((sum, item) => sum + (item.totalUnits ? item.completedUnits / item.totalUnits : item.progressPercent / 100), 0) / data.studyItems.length * 100) : 0;
    action = headingAction("study", "Add material");
    content = <><div className="local-stat-grid"><Stat label="Materials" value={String(data.studyItems.length)} /><Stat label="Completed" value={String(completed)} /><Stat label="Average progress" value={`${percent}%`} /></div><div className="local-filter-row"><label className="local-filter-select"><span>TYPE</span><select value={studyFilter} onChange={(event) => setStudyFilter(event.target.value)}><option>All</option>{[...new Set(data.studyItems.map((item) => item.type))].map((type) => <option key={type}>{type}</option>)}</select></label><span className="local-result-count">{visible.length} materials</span></div>{visible.length ? <div className="local-record-grid">{visible.map((item) => { const progress = item.totalUnits ? Math.min(100, Math.round(item.completedUnits / item.totalUnits * 100)) : item.status === "Completed" ? 100 : (item.progressPercent ?? 0); return <article className="panel local-record-card" key={item.id}><header><span className="local-record-kind">{item.type}</span><div className="local-card-actions"><select aria-label={`Study status for ${item.title}`} value={item.status} onChange={(event) => onChange((current) => ({ ...current, studyItems: current.studyItems.map((record) => record.id === item.id ? { ...record, status: event.target.value as StudyRecord["status"], progressPercent: event.target.value === "Completed" ? 100 : event.target.value === "Not started" ? 0 : record.progressPercent, completedUnits: event.target.value === "Completed" ? record.totalUnits : event.target.value === "Not started" ? 0 : record.completedUnits } : record) }))}><option>Not started</option><option>In progress</option><option>Completed</option></select><button className="icon-button subtle" title="Delete study material" onClick={() => deleteRecord("studyItems", item.id)}><Trash2 size={14} /></button></div></header><h2>{item.title}</h2><div className="local-progress-track"><span style={{ width: `${progress}%` }} /></div><div className="local-progress-caption"><span>{item.totalUnits ? `${item.completedUnits} / ${item.totalUnits} units` : "Progress"}</span><strong>{progress}%</strong></div><label className="local-progress-input"><span>Update progress</span><input aria-label={`Progress for ${item.title}`} type="range" min="0" max="100" step="1" value={progress} onChange={(event) => { const progressPercent = Number(event.target.value); onChange((current) => ({ ...current, studyItems: current.studyItems.map((record) => record.id === item.id ? { ...record, progressPercent, completedUnits: record.totalUnits ? Math.round(record.totalUnits * progressPercent / 100) : record.completedUnits, status: progressPercent === 100 ? "Completed" : progressPercent > 0 ? "In progress" : "Not started" } : record) })); }} /></label>{item.notes && <p>{item.notes}</p>}{safeExternalUrl(item.url) && <a className="text-button" href={safeExternalUrl(item.url)} target="_blank" rel="noreferrer">Open material <ExternalLink size={13} /></a>}</article>; })}</div> : <section className="panel local-module-panel"><EmptyModule title="No study materials yet" description="Add a book, course, or video series and track progress in units." action={localEmptyAction("study", "Add material")} /></section>}</>;
  } else if (page === "account-tools") {
    action = headingAction("broker", "Add broker");
    const renewalCutoff = format(subDays(dateAnchor, -30), "yyyy-MM-dd");
    content = <><div className="local-stat-grid"><Stat label="Active references" value={String(data.brokers.filter((broker) => broker.active).length)} /><Stat label="Charting tools" value={String(data.chartingTools.length)} /><Stat label="Renewals this month" value={String(data.chartingTools.filter((tool) => tool.renewalDate && tool.renewalDate >= today && tool.renewalDate <= renewalCutoff).length)} /></div><div className="local-section-heading"><div><h2>Broker references</h2><p>Names, masked labels, and non-secret account details only.</p></div><button className="button button-secondary button-small" onClick={() => setDialog({ type: "broker" })}><Plus size={13} />Add broker</button></div>{data.brokers.length ? <div className="local-record-grid">{data.brokers.map((broker) => <article className="panel local-record-card" key={broker.id}><header><span className={`local-state-chip ${broker.active ? "state-active" : ""}`}>{broker.active ? "ACTIVE" : "ARCHIVED"}</span><div className="local-card-actions"><button className="icon-button subtle" title={broker.active ? "Archive broker" : "Activate broker"} onClick={() => onChange((current) => ({ ...current, brokers: current.brokers.map((item) => item.id === broker.id ? { ...item, active: !item.active } : item) }))}><Check size={14} /></button><button className="icon-button subtle" title="Delete broker" onClick={() => deleteRecord("brokers", broker.id)}><Trash2 size={14} /></button></div></header><h2>{broker.name}</h2><p>{broker.accountType}{broker.accountLabel ? ` · ${broker.accountLabel}` : ""}</p><div className="local-card-stats"><span>Leverage {broker.leverage || "—"}</span><span>Commission {broker.commission || "—"}</span><span>Spread {broker.spread || "—"}</span></div>{broker.fundingMethod && <p className="local-session-note">Funding: {broker.fundingMethod}</p>}{safeExternalUrl(broker.url) && <a className="text-button" href={safeExternalUrl(broker.url)} target="_blank" rel="noreferrer">Platform site <ExternalLink size={13} /></a>}</article>)}</div> : <section className="panel local-module-panel"><EmptyModule title="No broker references" description="Store platform and account labels for your own reference. Never enter passwords, API keys, or full financial credentials." action={localEmptyAction("broker", "Add broker reference")} /></section>}<div className="local-section-heading local-section-heading-spaced"><div><h2>Charting subscriptions</h2><p>Track billing dates and tools used during research.</p></div><button className="button button-secondary button-small" onClick={() => setDialog({ type: "charting" })}><Plus size={13} />Add tool</button></div>{data.chartingTools.length ? <div className="local-record-grid">{data.chartingTools.map((tool) => <article className="panel local-record-card" key={tool.id}><header><span className="local-record-kind">{tool.status}</span><button className="icon-button subtle" title="Delete charting tool" onClick={() => deleteRecord("chartingTools", tool.id)}><Trash2 size={14} /></button></header><h2>{tool.name}</h2><div className="local-card-stats"><span>Renewal {tool.renewalDate || "not set"}</span><strong>{currency(tool.price)}</strong></div>{tool.features && <p>{tool.features}</p>}{safeExternalUrl(tool.url) && <a className="text-button" href={safeExternalUrl(tool.url)} target="_blank" rel="noreferrer">Open website <ExternalLink size={13} /></a>}</article>)}</div> : <section className="panel local-module-panel"><EmptyModule title="No charting tools tracked" description="Add a platform or subscription and record its renewal date." action={localEmptyAction("charting", "Add charting tool")} /></section>}<p className="local-disclaimer"><ShieldCheck size={13} /> References are saved only in this browser account namespace; sensitive credentials are intentionally not supported.</p></>;
  } else {
    action = headingAction("review", "New review");
    const totalPnl = data.weeklyReviews.reduce((sum, review) => sum + review.pnl, 0);
    const averageRating = data.weeklyReviews.length ? data.weeklyReviews.reduce((sum, review) => sum + review.rating, 0) / data.weeklyReviews.length : 0;
    content = <><div className="local-stat-grid"><Stat label="Reviews completed" value={String(data.weeklyReviews.length)} /><Stat label="Average process rating" value={data.weeklyReviews.length ? `${averageRating.toFixed(1)} / 10` : "—"} /><Stat label="Reviewed journal P&L" value={currency(totalPnl)} /></div>{data.weeklyReviews.length ? <div className="local-review-list">{[...data.weeklyReviews].sort((a, b) => b.weekStart.localeCompare(a.weekStart)).map((review) => <article className="panel local-review-card" key={review.id}><header>{panelTitle(`${format(parseISO(review.weekStart), "MMM d")} — ${format(parseISO(review.weekEnd), "MMM d, yyyy")}`, `${review.tradesTaken} journal trades · ${review.tradesPlanned} planned`, <button className="icon-button subtle" title="Delete weekly review" onClick={() => deleteRecord("weeklyReviews", review.id)}><Trash2 size={14} /></button>)}</header><div className="local-review-summary"><strong>{review.rating}<small> / 10 process rating</small></strong><b className={review.pnl >= 0 ? "positive" : "negative"}>{currency(review.pnl)}</b></div><div className="local-review-prompts">{reviewPrompts.map(([key, label]) => { const value = review[key as keyof WeeklyReview]; return typeof value === "string" && value ? <div key={key}><span>{label}</span><p>{value}</p></div> : null; })}</div></article>)}</div> : <section className="panel local-module-panel"><EmptyModule title="No weekly reviews yet" description="Journal trade count and realized P&L are calculated automatically for each review period." action={localEmptyAction("review", "Start a weekly review")} /></section>}</>;
  }

  return (
    <>
      <ModuleHeading page={page} action={action} />
      {content}
      {dialog && <LocalDialog title={dialogTitle[dialog.type]} onClose={() => setDialog(null)}><form className="local-record-form" onSubmit={addRecord}>{renderDialogForm()}</form></LocalDialog>}
    </>
  );
}

function SearchIcon() {
  return <Search size={13} />;
}
