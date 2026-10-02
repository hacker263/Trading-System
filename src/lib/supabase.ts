import { createClient, type User } from "@supabase/supabase-js";
import type {
  BacktestSummary,
  Goal,
  JournalTrade,
  PaperPosition,
  TradingRule,
} from "../tradingData";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
export type CloudUser = User;

export interface CloudWorkspace {
  trades: JournalTrade[];
  paper: PaperPosition[];
  rules: TradingRule[];
  goals: Goal[];
  backtests: BacktestSummary[];
  riskSettings: {
    balance: number;
    riskPct: number;
    dailyLossPct: number;
    maxPositions: number;
    stopValue: number;
  };
  planNotes: string[];
  checks: Record<string, boolean>;
  traderType: string;
  reviews: number;
}

export async function loadCloudWorkspace(
  userId: string,
): Promise<CloudWorkspace | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("user_settings")
    .select("workspace")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.workspace as CloudWorkspace | undefined) ?? null;
}

type WorkspaceTable =
  | "trades"
  | "journal_entries"
  | "goals"
  | "strategies"
  | "backtest_results"
  | "rules";

async function assertActiveUser(userId: string): Promise<void> {
  if (!supabase) return;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session?.user.id !== userId) {
    throw new Error("Cloud sync canceled because the active account changed.");
  }
}

async function deleteMissingRows(
  userId: string,
  table: WorkspaceTable,
  currentIds: string[],
): Promise<void> {
  if (!supabase) return;
  await assertActiveUser(userId);
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("user_id", userId);
  if (error) throw error;
  const currentIdSet = new Set(currentIds);
  const staleIds = data
    .map((row) => row.id)
    .filter((id) => !currentIdSet.has(id));
  if (!staleIds.length) return;
  await assertActiveUser(userId);
  const { error: deleteError } = await supabase
    .from(table)
    .delete()
    .eq("user_id", userId)
    .in("id", staleIds);
  if (deleteError) throw deleteError;
}

export async function syncCloudWorkspace(
  userId: string,
  workspace: CloudWorkspace,
): Promise<void> {
  if (!supabase) return;
  await assertActiveUser(userId);

  const tradeRows = workspace.trades.map((trade) => ({
    user_id: userId,
    id: trade.id,
    occurred_at: trade.date,
    instrument: trade.instrument,
    direction: trade.direction,
    pnl: trade.pnl,
    r_multiple: trade.r,
    data: trade,
  }));
  const journalRows = workspace.trades.map((trade) => ({
    user_id: userId,
    id: trade.id,
    trade_id: trade.id,
    occurred_at: trade.date,
    notes: trade.notes,
    emotional_state: trade.emotion,
    tags: trade.tags,
    data: trade,
  }));
  const goalRows = workspace.goals.map((goal) => ({
    user_id: userId,
    id: goal.id,
    title: goal.title,
    metric: goal.metric,
    target: goal.target,
    deadline: goal.deadline || null,
    achieved: goal.achieved,
    data: goal,
  }));
  const ruleRows = workspace.rules.map((rule) => ({
    user_id: userId,
    id: rule.id,
    title: rule.title,
    priority: rule.priority,
    enabled: rule.enabled,
    data: rule,
  }));
  const backtestRows = workspace.backtests.map((result) => ({
    user_id: userId,
    id: result.id,
    name: result.name,
    instrument: result.instrument,
    metrics: result,
    data: result,
  }));
  const strategyRows = workspace.backtests.map((result) => ({
    user_id: userId,
    id: result.id,
    name: result.name,
    instrument: result.instrument,
    indicator: result.strategy,
    data: result,
  }));

  await deleteMissingRows(userId, "trades", tradeRows.map((row) => row.id));
  await deleteMissingRows(userId, "journal_entries", journalRows.map((row) => row.id));
  await deleteMissingRows(userId, "goals", goalRows.map((row) => row.id));
  await deleteMissingRows(userId, "rules", ruleRows.map((row) => row.id));
  await deleteMissingRows(userId, "backtest_results", backtestRows.map((row) => row.id));
  await deleteMissingRows(userId, "strategies", strategyRows.map((row) => row.id));
  await assertActiveUser(userId);

  if (tradeRows.length) {
    await assertActiveUser(userId);
    const { error } = await supabase
      .from("trades")
      .upsert(tradeRows, { onConflict: "user_id,id" });
    if (error) throw error;
  }
  if (journalRows.length) {
    await assertActiveUser(userId);
    const { error } = await supabase
      .from("journal_entries")
      .upsert(journalRows, { onConflict: "user_id,id" });
    if (error) throw error;
  }
  if (goalRows.length) {
    await assertActiveUser(userId);
    const { error } = await supabase
      .from("goals")
      .upsert(goalRows, { onConflict: "user_id,id" });
    if (error) throw error;
  }
  if (ruleRows.length) {
    await assertActiveUser(userId);
    const { error } = await supabase
      .from("rules")
      .upsert(ruleRows, { onConflict: "user_id,id" });
    if (error) throw error;
  }
  if (backtestRows.length) {
    await assertActiveUser(userId);
    const { error } = await supabase
      .from("backtest_results")
      .upsert(backtestRows, { onConflict: "user_id,id" });
    if (error) throw error;
  }
  if (strategyRows.length) {
    await assertActiveUser(userId);
    const { error } = await supabase
      .from("strategies")
      .upsert(strategyRows, { onConflict: "user_id,id" });
    if (error) throw error;
  }

  await assertActiveUser(userId);
  const { error: settingsError } = await supabase
    .from("user_settings")
    .upsert({
      user_id: userId,
      workspace,
      updated_at: new Date().toISOString(),
    });
  if (settingsError) throw settingsError;
}
