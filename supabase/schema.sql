create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  workspace jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.trades (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  occurred_at date not null,
  instrument text not null,
  direction text not null check (direction in ('Long', 'Short')),
  pnl numeric not null default 0,
  r_multiple numeric not null default 0,
  data jsonb not null default '{}'::jsonb,
  primary key (user_id, id)
);

create table if not exists public.journal_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  trade_id text not null,
  occurred_at date not null,
  notes text not null default '',
  emotional_state text not null default '',
  tags text[] not null default '{}',
  data jsonb not null default '{}'::jsonb,
  primary key (user_id, id),
  foreign key (user_id, trade_id) references public.trades(user_id, id) on delete cascade
);

create table if not exists public.goals (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  title text not null,
  metric text not null,
  target numeric not null,
  deadline date,
  achieved boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  primary key (user_id, id)
);

create table if not exists public.strategies (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  instrument text not null,
  indicator text not null,
  data jsonb not null default '{}'::jsonb,
  primary key (user_id, id)
);

create table if not exists public.backtest_results (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  instrument text not null,
  metrics jsonb not null default '{}'::jsonb,
  data jsonb not null default '{}'::jsonb,
  primary key (user_id, id)
);

create table if not exists public.rules (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  title text not null,
  priority text not null,
  enabled boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  primary key (user_id, id)
);

alter table public.user_settings enable row level security;
alter table public.trades enable row level security;
alter table public.journal_entries enable row level security;
alter table public.goals enable row level security;
alter table public.strategies enable row level security;
alter table public.backtest_results enable row level security;
alter table public.rules enable row level security;

create policy "Users manage their own settings" on public.user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage their own trades" on public.trades for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage their own journal" on public.journal_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage their own goals" on public.goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage their own strategies" on public.strategies for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage their own backtests" on public.backtest_results for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage their own rules" on public.rules for all using (auth.uid() = user_id) with check (auth.uid() = user_id);