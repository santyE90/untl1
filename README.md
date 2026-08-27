# Life Organizer

Life Organizer is a responsive personal-management application built with Next.js 16 and Supabase. The working application includes public email/password authentication, private profiles, a responsive app shell, and Finance: accounts, exact derived balances, categorized transactions, atomic transfers, account-optional recurring schedules, monthly budgets, deterministic analytics, and known cash-flow planning.

[docs/project-architecture.md](docs/project-architecture.md) is the detailed source of truth for schema decisions, ledger semantics, security boundaries, and roadmap.

## Stack

- Next.js 16 App Router, React 19, strict TypeScript
- Tailwind CSS 4 and shadcn/Base UI
- Supabase Auth and PostgreSQL with RLS
- Zod, Vitest, Supabase migrations, and pgTAP tests

No OpenAI requests are made. The AI SDK/key remain reserved for a later approved milestone.

## Local setup

Requirements: Node.js supported by Next.js 16, npm, and a Supabase project. Docker Desktop is required only for the optional local Supabase stack/database tests.

```bash
npm install
```

Copy `.env.example` to `.env.local` and set:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
OPENAI_API_KEY=
```

The Supabase URL must be the project origin only, with no `/rest/v1` suffix. Never commit `.env.local` or real credentials.

```bash
npm run dev
```

Open <http://localhost:3000>.

## Hosted Supabase migrations

Hosted migrations are never applied automatically. The linked CLI should show the accepted migrations and the pending Phase 2C migration:

```text
supabase/migrations/20260826000100_create_profiles.sql
supabase/migrations/20260826000200_finance_core.sql
supabase/migrations/20260827000100_budgeting_analytics.sql
supabase/migrations/20260827000200_cash_flow_planning.sql
```

For the pending Finance Phase 2C migration, inspect it and run:

```bash
npm run db:push
npm run db:types:linked
```

Confirm the push prompt lists only `20260827000200_cash_flow_planning.sql`. The second command replaces `types/database.ts` with hosted generated types after the schema exists. No additional Supabase dashboard settings are required for Finance.

If SQL Editor is preferred, run the entire Phase 2C migration there, then repair/confirm CLI migration history before a future `db:push`; do not let the CLI reapply the same SQL.

The Phase 2C migration:

- makes recurring bill and income account associations optional;
- preserves composite ownership checks for later assignment;
- keeps actual ledger transactions account-required;
- adds recurring-source/type checks and duplicate-occurrence indexes.

## Quality commands

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run check
```

With Docker Desktop running, the optional local database workflow is:

```bash
npm run db:start
npm run db:reset
npm run db:test
npm run db:types:local
npm run db:stop
```

`db:test` runs profile and Finance pgTAP isolation tests. A local reset affects only the local Supabase stack, never the hosted database.

## Repository map

```text
app/                 routes, layouts, and HTTP boundaries
components/          app shell and shared UI
features/finance/    Finance actions, queries, exact calculations, charts, validation, UI
lib/                 authentication and Supabase infrastructure
supabase/migrations/ ordered schema history
supabase/tests/      pgTAP security/isolation suites
types/database.ts    generated database types
docs/                durable architecture and project decisions
```

## Current security boundaries

- Every protected route and Server Action verifies the session.
- Server Actions validate untrusted input and derive ownership from the session.
- RLS and composite ownership foreign keys prevent cross-user reads and references.
- Authenticated column grants protect owner IDs, audit fields, and opening balances.
- Transfers and budgets can only be saved through narrowly scoped atomic database functions.
- Financial records are archived, paused, or voided instead of destructively deleted.
- The browser receives no service-role or OpenAI secret.

## Scope

Implemented through Finance Phase 2C:

- signup, email confirmation, login/logout, protected sessions, and profiles;
- responsive desktop/mobile application shell;
- accounts, default/custom categories, transaction create/read/update/void;
- atomic same-currency transfers and exact derived balances;
- recurring bill and income/payday templates;
- monthly overall/category budgets with historical navigation;
- income, expense, cash-flow, category, month-comparison, recurring-cost, and net-worth analytics;
- focused responsive Recharts visualizations;
- bounded anchored recurrence expansion without generated future rows;
- known scheduled cash-flow timelines, account projections, liquidity, unassigned totals, and shortfall warnings;
- 7/30/60/90-day, month-end, and custom planning horizons;
- application unit tests and database RLS test files.

Deferred until later approval: discretionary estimates, mark-paid/received workflow, predictive or ML forecasting, receipt OCR, bank imports, Calendar, School, Tasks, Goals, AI, Python/ML, and notification delivery.
