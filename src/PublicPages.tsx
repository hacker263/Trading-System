import { useState, type FormEvent } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  FlaskConical,
  LockKeyhole,
  Mail,
  ShieldCheck,
  TrendingUp,
  UserRound,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import {
  currency,
  makeSampleTrades,
  type JournalTrade,
} from "./tradingData";

const sampleTrades = makeSampleTrades();
const decisiveTrades = sampleTrades.filter((trade) => trade.result !== "Break even");
const sampleWins = sampleTrades.filter((trade) => trade.result === "Win");
const grossWins = sampleWins.reduce((sum, trade) => sum + Math.max(0, trade.pnl), 0);
const grossLosses = Math.abs(
  sampleTrades.reduce((sum, trade) => sum + Math.min(0, trade.pnl), 0),
);
const sampleWinRate = decisiveTrades.length
  ? Math.round((sampleWins.length / decisiveTrades.length) * 100)
  : 0;
const sampleProfitFactor = grossLosses ? grossWins / grossLosses : 0;
const sampleNet = sampleTrades.reduce((sum, trade) => sum + trade.pnl, 0);
const equityPreview = [...sampleTrades]
  .sort((left, right) => left.date.localeCompare(right.date))
  .reduce<{ date: string; balance: number }[]>((curve, trade) => {
    const previous = curve.at(-1)?.balance ?? 25000;
    curve.push({ date: trade.date, balance: previous + trade.pnl });
    return curve;
  }, []);
const recentPreview = [...sampleTrades]
  .sort((left, right) => right.date.localeCompare(left.date))
  .slice(0, 3);

export interface AccountResult {
  error?: string;
  message?: string;
}

export type AuthMode = "sign-in" | "sign-up" | "reset-request" | "new-password";

export interface AccountProfile {
  displayName: string;
  traderType: string;
  balance: number;
  riskPct: number;
  dailyLossPct: number;
  importGuestWorkspace: boolean;
}

export function LandingPage({ configured }: { configured: boolean }) {
  return (
    <div className="public-site">
      <header className="public-nav">
        <Link className="public-brand" to="/" aria-label="Aperture home">
          <span><TrendingUp size={18} /></span>
          <strong>Aperture</strong>
        </Link>
        <nav aria-label="Main navigation">
          <a href="#workflow">Workflow</a>
          <a href="#principles">Principles</a>
          <Link to="/auth">Sign in</Link>
          <Link className="button button-primary public-nav-cta" to="/auth?mode=sign-up">
            Create account <ArrowRight size={14} />
          </Link>
        </nav>
      </header>

      <main>
        <section className="public-hero">
          <div className="public-hero-copy">
            <span className="public-kicker"><i /> PLAN-LED TRADING WORKSPACE</span>
            <h1>Aperture<span>.</span></h1>
            <p className="public-hero-lede">A clearer record of every trading decision.</p>
            <p className="public-hero-description">
              Keep your plan, risk limits, journal, and performance review in one private workspace.
              Built to help you follow your process, not chase someone else’s signals.
            </p>
            <div className="public-hero-actions">
              <Link className="button button-primary" to="/auth?mode=sign-up">
                {configured ? "Create your account" : "Set up an account"}
                <ArrowRight size={15} />
              </Link>
              <Link className="button button-secondary" to="/demo">
                Explore the sample workspace <ChevronRight size={15} />
              </Link>
            </div>
            <div className="public-trust-line">
              <span><LockKeyhole size={13} /> Individual account</span>
              <span><ShieldCheck size={13} /> Account-scoped data</span>
              <span><CircleHelp size={13} /> No broker connection</span>
            </div>
          </div>

          <LandingPreview />
        </section>

        <section className="public-workflow" id="workflow">
          <div className="public-section-heading">
            <span className="public-kicker">FROM PREPARATION TO REVIEW</span>
            <h2>One process. One private record.</h2>
            <p>Move from a documented idea to a reviewable outcome without losing the reasoning in between.</p>
          </div>
          <div className="workflow-steps">
            <article>
              <span className="workflow-index">01</span>
              <BookOpen size={19} />
              <h3>Define the plan</h3>
              <p>Keep your trading stages, entry models, and process rules close to the work.</p>
            </article>
            <article>
              <span className="workflow-index">02</span>
              <Activity size={19} />
              <h3>Record the decision</h3>
              <p>Capture setup, execution, result, context, and rule exceptions in your journal.</p>
            </article>
            <article>
              <span className="workflow-index">03</span>
              <BarChart3 size={19} />
              <h3>Review the evidence</h3>
              <p>Compare outcomes across setups and sessions, then adjust your process deliberately.</p>
            </article>
            <article>
              <span className="workflow-index">04</span>
              <FlaskConical size={19} />
              <h3>Test before scaling</h3>
              <p>Explore a strategy against clearly labeled sample market data before using real capital.</p>
            </article>
          </div>
        </section>

        <section className="public-principles" id="principles">
          <div>
            <span className="public-kicker">BUILT AROUND YOUR PROCESS</span>
            <h2>Less noise around the trade. More clarity after it.</h2>
          </div>
          <p>
            Aperture brings together planning, simulated risk checks, journaling, and analysis.
            Market quotes and calendar entries in the sample workspace are demonstrations, not live feeds.
          </p>
          <Link className="text-button" to="/auth?mode=sign-up">
            Start with your own workspace <ArrowRight size={14} />
          </Link>
        </section>
      </main>

      <footer className="public-footer">
        <Link className="public-brand" to="/">
          <span><TrendingUp size={16} /></span>
          <strong>Aperture</strong>
        </Link>
        <p>Trading journal and research workspace. Not financial advice.</p>
        <Link to="/demo">Open sample workspace</Link>
      </footer>
    </div>
  );
}

function LandingPreview() {
  return (
    <div className="landing-preview" aria-label="Sample Aperture dashboard preview">
      <div className="preview-topbar">
        <div className="preview-brand"><span><TrendingUp size={13} /></span> aperture <i>/</i> dashboard</div>
        <div className="preview-account"><span /> SAMPLE WORKSPACE</div>
      </div>
      <div className="preview-layout">
        <aside className="preview-sidebar" aria-hidden="true">
          <strong>WORKSPACE</strong>
          <span className="selected"><BarChart3 size={13} /> Dashboard</span>
          <span><BookOpen size={13} /> Trading plan</span>
          <span><Activity size={13} /> Trade journal</span>
          <span><ShieldCheck size={13} /> Risk management</span>
          <span><FlaskConical size={13} /> Backtest lab</span>
          <div className="preview-sidebar-foot"><i /> PRIVATE DEMO DATA</div>
        </aside>
        <div className="preview-main">
          <div className="preview-heading">
            <div><span>PERFORMANCE OVERVIEW</span><h2>Process before outcome.</h2></div>
            <span className="preview-period">SAMPLE JOURNAL</span>
          </div>
          <div className="preview-metrics">
            <PreviewMetric label="NET P&L" value={currency(sampleNet)} positive={sampleNet >= 0} />
            <PreviewMetric label="WIN RATE" value={`${sampleWinRate}%`} />
            <PreviewMetric label="PROFIT FACTOR" value={sampleProfitFactor.toFixed(2)} />
            <PreviewMetric label="TRADES LOGGED" value={String(sampleTrades.length)} />
          </div>
          <div className="preview-chart-panel">
            <div className="preview-chart-heading"><strong>Equity curve</strong><span>CUMULATIVE JOURNAL P&L</span></div>
            <div className="preview-chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={equityPreview} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="landing-equity-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#d77849" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#d77849" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#3a3b35" strokeDasharray="3 5" />
                  <XAxis dataKey="date" tickFormatter={(value) => format(parseISO(value), "MMM d")} tickLine={false} axisLine={false} tick={{ fill: "#8f9087", fontSize: 9 }} minTickGap={35} />
                  <YAxis hide domain={["dataMin - 300", "dataMax + 300"]} />
                  <Tooltip contentStyle={{ background: "#242620", border: "1px solid #41423a", borderRadius: 5, fontSize: 10 }} formatter={(value) => [currency(Number(value)), "Sample equity"]} />
                  <Area type="monotone" dataKey="balance" stroke="#d77849" strokeWidth={2} fill="url(#landing-equity-fill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="preview-recent">
            <div className="preview-recent-title"><strong>Recent journal</strong><span>DEMONSTRATION RECORDS</span></div>
            {recentPreview.map((trade) => <PreviewTrade key={trade.id} trade={trade} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewMetric({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="preview-metric">
      <span>{label}</span>
      <strong className={positive === undefined ? "" : positive ? "is-positive" : "is-negative"}>{value}</strong>
      <small>FROM SAMPLE JOURNAL</small>
    </div>
  );
}

function PreviewTrade({ trade }: { trade: JournalTrade }) {
  return (
    <div className="preview-trade">
      <span className="preview-trade-symbol">{trade.direction === "Long" ? "L" : "S"}</span>
      <strong>{trade.instrument}</strong>
      <span>{trade.setup.replace("Entry ", "")}</span>
      <span>{format(parseISO(trade.date), "MMM d")}</span>
      <b className={trade.pnl >= 0 ? "is-positive" : "is-negative"}>{currency(trade.pnl)}</b>
    </div>
  );
}

export function AuthPage({
  configured,
  initialMode = "sign-in",
  onSignIn,
  onSignUp,
  onRequestPasswordReset,
  onUpdatePassword,
}: {
  configured: boolean;
  initialMode?: AuthMode;
  onSignIn: (email: string, password: string) => Promise<AccountResult>;
  onSignUp: (name: string, email: string, password: string) => Promise<AccountResult>;
  onRequestPasswordReset: (email: string) => Promise<AccountResult>;
  onUpdatePassword: (password: string) => Promise<AccountResult>;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const isRecovery = mode === "reset-request" || mode === "new-password";
  const title = mode === "sign-up"
    ? "Create your account"
    : mode === "reset-request"
      ? "Reset your password"
      : mode === "new-password"
        ? "Choose a new password"
        : "Welcome back";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    let result: AccountResult;
    try {
      if (mode === "sign-up") {
        result = await onSignUp(displayName.trim(), email.trim(), password);
      } else if (mode === "sign-in") {
        result = await onSignIn(email.trim(), password);
      } else if (mode === "reset-request") {
        result = await onRequestPasswordReset(email.trim());
      } else {
        if (password !== confirmPassword) {
          setError("Your passwords do not match.");
          setBusy(false);
          return;
        }
        result = await onUpdatePassword(password);
      }
      if (result.error) setError(result.error);
      if (result.message) setNotice(result.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function changeMode(next: AuthMode) {
    setError("");
    setNotice("");
    setMode(next);
  }

  return (
    <main className="account-page">
      <section className="account-showcase">
        <Link className="public-brand account-brand" to="/">
          <span><TrendingUp size={18} /></span><strong>Aperture</strong>
        </Link>
        <div className="account-showcase-copy">
          <span className="public-kicker">A PRIVATE RECORD OF YOUR PROCESS</span>
          <h1>Make each decision<br />worth reviewing.</h1>
          <p>Keep your plan, risk, and journal connected in one focused trading workspace.</p>
          <div className="account-proof-list">
            <span><Check size={14} /> Private individual accounts</span>
            <span><Check size={14} /> Local demo stays separate</span>
            <span><Check size={14} /> No broker execution</span>
          </div>
        </div>
        <p className="account-showcase-foot">APERTURE <i>·</i> PLAN-LED TRADING WORKSPACE</p>
      </section>

      <section className="account-form-side">
        <div className="account-form-wrap">
          <Link className="account-back" to="/"><ArrowRight size={14} /> Back to Aperture</Link>
          <div className="account-form-heading">
            <span className="public-kicker">{isRecovery ? "ACCOUNT RECOVERY" : "YOUR PRIVATE WORKSPACE"}</span>
            <h2>{title}</h2>
            <p>{mode === "sign-up" ? "Create an individual account for your trading records." : mode === "reset-request" ? "We’ll email you a secure link to reset your password." : mode === "new-password" ? "Use a new password you have not used before." : "Sign in to continue to your personal trading workspace."}</p>
          </div>

          {!configured ? (
            <div className="account-config-note">
              <ShieldCheck size={19} />
              <div><strong>Account service not configured</strong><p>Add your Supabase project URL and public anon key to enable individual accounts. The sample workspace remains available without them.</p></div>
              <Link className="button button-secondary" to="/demo">Open sample workspace <ArrowRight size={14} /></Link>
            </div>
          ) : (
            <>
              {mode === "sign-in" || mode === "sign-up" ? (
                <div className="account-mode-switch" role="tablist" aria-label="Account action">
                  <button type="button" role="tab" aria-selected={mode === "sign-in"} className={mode === "sign-in" ? "active" : ""} onClick={() => changeMode("sign-in")}>Sign in</button>
                  <button type="button" role="tab" aria-selected={mode === "sign-up"} className={mode === "sign-up" ? "active" : ""} onClick={() => changeMode("sign-up")}>Create account</button>
                </div>
              ) : null}

              <form className="account-form" onSubmit={handleSubmit}>
                {mode === "sign-up" && (
                  <label><span>Display name</span><div className="account-input"><UserRound size={15} /><input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={80} placeholder="How should we address you?" /></div></label>
                )}
                {mode !== "new-password" && (
                  <label><span>Email address</span><div className="account-input"><Mail size={15} /><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com" /></div></label>
                )}
                {mode !== "reset-request" && (
                  <label><span>{mode === "new-password" ? "New password" : "Password"}</span><div className="account-input"><LockKeyhole size={15} /><input type={showPassword ? "text" : "password"} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required placeholder="At least 8 characters" /><button className="password-visibility" type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Hide" : "Show"}</button></div></label>
                )}
                {mode === "new-password" && (
                  <label><span>Confirm new password</span><div className="account-input"><LockKeyhole size={15} /><input type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required placeholder="Enter the password again" /></div></label>
                )}
                {error && <p className="account-message account-message-error" role="alert">{error}</p>}
                {notice && <p className="account-message account-message-success" role="status">{notice}</p>}
                <button className="button button-primary account-submit" type="submit" disabled={busy}>
                  {busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : mode === "sign-up" ? "Create account" : mode === "reset-request" ? "Send reset link" : "Save new password"}
                  {!busy && <ArrowRight size={15} />}
                </button>
              </form>
              {mode === "sign-in" && <button className="account-text-link" type="button" onClick={() => changeMode("reset-request")}>Forgot your password?</button>}
              {mode === "reset-request" && <button className="account-text-link" type="button" onClick={() => changeMode("sign-in")}>Return to sign in</button>}
              {mode === "new-password" && <Link className="account-text-link" to="/auth">Return to sign in</Link>}
            </>
          )}
          <p className="account-privacy"><LockKeyhole size={13} /> Your account is private. Sample data is never copied without your choice.</p>
        </div>
      </section>
    </main>
  );
}

export function OnboardingPage({
  initialName,
  initialTraderType,
  initialBalance,
  initialRiskPct,
  initialDailyLossPct,
  hasGuestWorkspace,
  onComplete,
}: {
  initialName: string;
  initialTraderType: string;
  initialBalance: number;
  initialRiskPct: number;
  initialDailyLossPct: number;
  hasGuestWorkspace: boolean;
  onComplete: (profile: AccountProfile) => Promise<AccountResult>;
}) {
  const [displayName, setDisplayName] = useState(initialName);
  const [traderType, setTraderType] = useState(initialTraderType);
  const [balance, setBalance] = useState(String(initialBalance));
  const [riskPct, setRiskPct] = useState(String(initialRiskPct));
  const [dailyLossPct, setDailyLossPct] = useState(String(initialDailyLossPct));
  const [importGuestWorkspace, setImportGuestWorkspace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const profile: AccountProfile = {
      displayName: displayName.trim(),
      traderType,
      balance: Number(balance),
      riskPct: Number(riskPct),
      dailyLossPct: Number(dailyLossPct),
      importGuestWorkspace,
    };
    if (!profile.displayName || profile.balance <= 0 || profile.riskPct <= 0 || profile.dailyLossPct <= 0) {
      setError("Enter a name and positive account and risk limits.");
      setBusy(false);
      return;
    }
    try {
      const result = await onComplete(profile);
      if (result.error) setError(result.error);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your setup could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="onboarding-page">
      <header className="onboarding-topbar"><Link className="public-brand" to="/"><span><TrendingUp size={17} /></span><strong>Aperture</strong></Link><span>PRIVATE ACCOUNT SETUP <i>01 / 01</i></span></header>
      <div className="onboarding-content">
        <div className="onboarding-intro">
          <span className="public-kicker">YOUR ACCOUNT, YOUR PROCESS</span>
          <h1>Set up your desk<span>.</span></h1>
          <p>Choose the profile and guardrails Aperture should use for your personal workspace. You can change them later.</p>
        </div>
        <form className="onboarding-form" onSubmit={handleSubmit}>
          <section className="onboarding-section">
            <div className="onboarding-section-title"><span>01</span><div><h2>Trader profile</h2><p>Personalize your workspace.</p></div></div>
            <div className="onboarding-fields">
              <label><span>Display name</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" maxLength={80} required /></label>
              <label><span>Trading style</span><select value={traderType} onChange={(event) => setTraderType(event.target.value)}><option>Swing trader</option><option>Day trader</option><option>Position trader</option><option>Scalper</option></select></label>
            </div>
          </section>
          <section className="onboarding-section">
            <div className="onboarding-section-title"><span>02</span><div><h2>Risk assumptions</h2><p>Starter limits for planning only, not order enforcement.</p></div></div>
            <div className="onboarding-fields onboarding-risk-fields">
              <label><span>Starting balance (USD)</span><div className="onboarding-number"><b>$</b><input type="number" min="1" step="100" value={balance} onChange={(event) => setBalance(event.target.value)} required /></div></label>
              <label><span>Risk per trade</span><div className="onboarding-number"><input type="number" min="0.1" max="10" step="0.1" value={riskPct} onChange={(event) => setRiskPct(event.target.value)} required /><b>%</b></div></label>
              <label><span>Daily loss limit</span><div className="onboarding-number"><input type="number" min="0.25" max="20" step="0.25" value={dailyLossPct} onChange={(event) => setDailyLossPct(event.target.value)} required /><b>%</b></div></label>
            </div>
          </section>
          {hasGuestWorkspace && (
            <label className="onboarding-import">
              <input type="checkbox" checked={importGuestWorkspace} onChange={(event) => setImportGuestWorkspace(event.target.checked)} />
              <span className="onboarding-checkbox"><Check size={12} /></span>
              <span><strong>Copy this browser’s sample workspace into my account</strong><small>Optional. This copies the local journal, plan, goals, and settings. Nothing is moved or deleted from this browser.</small></span>
            </label>
          )}
          {error && <p className="account-message account-message-error" role="alert">{error}</p>}
          <div className="onboarding-submit-row"><span><ShieldCheck size={14} /> Private account <i>·</i> Editable assumptions</span><button className="button button-primary" type="submit" disabled={busy}>{busy ? "Saving setup…" : "Open my workspace"}<ArrowRight size={15} /></button></div>
        </form>
      </div>
    </main>
  );
}
