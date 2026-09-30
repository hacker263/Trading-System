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

export async function syncCloudWorkspace(
  userId: string,
  workspace: CloudWorkspace,
): Promise<void> {
  if (!supabase) return;
  const settings = await supabase
    .from("user_settings")
    .upsert({
      user_id: userId,
      workspace,
      updated_at: new Date().toISOString(),
    });
  if (settings.error) throw settings.error;
  if (workspace.trades.length) {
    const trades = await supabase.from("trades").upsert(
      workspace.trades.map((trade) => ({
        user_id: userId,
        id: trade.id,
        occurred_at: trade.date,
        instrument: trade.instrument,
        direction: trade.direction,
        pnl: trade.pnl,
        r_multiple: trade.r,
        data: trade,
      })),
      { onConflict: "user_id,id" },
    );
    if (trades.error) throw trades.error;
    const entries = await supabase.from("journal_entries").upsert(
      workspace.trades.map((trade) => ({
        user_id: userId,
        id: trade.id,
        trade_id: trade.id,
        occurred_at: trade.date,
        notes: trade.notes,
        emotional_state: trade.emotion,
        tags: trade.tags,
        data: trade,
      })),
      { onConflict: "user_id,id" },
    );
    if (entries.error) throw entries.error;
  }
  if (workspace.goals.length) {
    const goals = await supabase.from("goals").upsert(
      workspace.goals.map((goal) => ({
        user_id: userId,
        id: goal.id,
        title: goal.title,
        metric: goal.metric,
        target: goal.target,
        deadline: goal.deadline || null,
        achieved: goal.achieved,
        data: goal,
      })),
      { onConflict: "user_id,id" },
    );
    if (goals.error) throw goals.error;
  }
  if (workspace.rules.length) {
    const rules = await supabase.from("rules").upsert(
      workspace.rules.map((rule) => ({
        user_id: userId,
        id: rule.id,
        title: rule.title,
        priority: rule.priority,
        enabled: rule.enabled,
        data: rule,
      })),
      { onConflict: "user_id,id" },
    );
    if (rules.error) throw rules.error;
  }
  if (workspace.backtests.length) {
    const backtests = await supabase.from("backtest_results").upsert(
      workspace.backtests.map((result) => ({
        user_id: userId,
        id: result.id,
        name: result.name,
        instrument: result.instrument,
        metrics: result,
        data: result,
      })),
      { onConflict: "user_id,id" },
    );
    if (backtests.error) throw backtests.error;
    const strategies = await supabase.from("strategies").upsert(
      workspace.backtests.map((result) => ({
        user_id: userId,
        id: result.id,
        name: result.name,
        instrument: result.instrument,
        indicator: result.strategy,
        data: result,
      })),
      { onConflict: "user_id,id" },
    );
    if (strategies.error) throw strategies.error;
  }
}
