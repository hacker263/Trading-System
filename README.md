# Aperture Trading Workspace

A plan-led journal for trading preparation, paper risk review, backtesting, and performance analysis. The public landing and sample workspace work without an account service. Quotes and calendar events are demo content; the app does not connect to a broker or enforce live trading limits.

## Run locally

```sh
npm install
npm run dev
```

The sample workspace is available at `/demo`. The public landing is `/`, and account routes include `/auth`, `/auth/reset`, and `/auth/new-password`.

## Enable individual accounts

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the project API settings. Never place a service-role key in frontend environment variables.
3. Run `supabase/schema.sql` in the Supabase SQL editor. The schema enables row-level security and scopes the current records to their owning `auth.users` ID.
4. In Supabase Authentication URL Configuration, set the local Site URL (normally `http://localhost:5173`) and allow these redirect URLs:
   - `http://localhost:5173/onboarding`
   - `http://localhost:5173/auth/new-password`
5. Configure email confirmation and password recovery email delivery, then restart Vite.

Each authenticated user has a separate browser-storage namespace and cloud workspace. The sample/guest workspace uses its existing local keys and is never copied into an account automatically. New-account onboarding offers an explicit opt-in copy; it does not delete the sample data. Signing out returns to the public entry flow.

Cloud workspace snapshots are reconciled to the account-owned normalized tables, including removal of records deleted from the workspace. RLS remains the server-side access boundary; browser-side account checks are additional safeguards, not a replacement for database policies.

## Verification

```sh
npm test
npm run lint
npm run build
```

Tests currently cover guest/account storage separation and route access policy. Real signup, confirmation, reset, account switching, and cloud sync require valid Supabase credentials and configured redirect/email settings.