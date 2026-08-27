# LifeStack

LifeStack is a responsive personal-management application built with Next.js 16 and Supabase. It includes authentication, Finance, a source-aware Calendar, and deterministic academic planning with School-owned schedule and assessment projections.

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

Hosted migrations are never applied automatically. Migrations through School Phase 4A are accepted on hosted Supabase; School Phase 4B adds one pending migration:

```text
supabase/migrations/20260826000100_create_profiles.sql
supabase/migrations/20260826000200_finance_core.sql
supabase/migrations/20260827000100_budgeting_analytics.sql
supabase/migrations/20260827000200_cash_flow_planning.sql
supabase/migrations/20260827000300_calendar_core.sql
supabase/migrations/20260827000400_calendar_recurrence_reminders.sql
supabase/migrations/20260827000500_school_core.sql
supabase/migrations/20260827000600_school_planning.sql
```

For the pending School migration, inspect it and run:

```bash
npm run db:push
npm run db:types:linked
```

Confirm the push prompt lists only `20260827000600_school_planning.sql`. The second command replaces the provisional `types/database.ts` additions with hosted generated types after the schema exists. No additional Supabase dashboard settings are required.

If SQL Editor is preferred, run the entire pending migration there, then repair/confirm CLI migration history before a future `db:push`; do not let the CLI reapply the same SQL.

The Phase 4B School migration:

- adds optional user-entered assessment effort estimates;
- adds owned, soft-archived course resource links;
- enforces parent-first term/course/assessment restoration;
- retains School as the source of truth without persisting derived workload or scenarios.

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

`db:test` runs profile, Finance, Calendar, and School pgTAP isolation tests. A local reset affects only the local Supabase stack, never the hosted database.

## Repository map

```text
app/                 routes, layouts, and HTTP boundaries
components/          app shell and shared UI
features/finance/    Finance actions, queries, exact calculations, charts, validation, UI
features/calendar/   Calendar projection, timezone, CRUD, validation, queries, and UI
features/school/     School actions, exact grade calculations, projections, validation, queries, and UI
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

Implemented through School Phase 4B:

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
- native all-day/timed event create, view, edit, and archive workflows;
- responsive month and agenda Calendar views;
- bounded, source-aware Finance bill/payday projections with no duplicate rows;
- a shared Calendar query used by Calendar and the Dashboard upcoming section.
- native daily/weekly/monthly/yearly series with bounded DST-aware projection;
- responsive Month, Week, Day, and 90-day Agenda views with overlap layout;
- series-level reminder configuration, archive restoration, and default-view preference.
- academic terms, courses, weekly multi-day meeting schedules, and assessments;
- exact completed-work grades, earned course points, weighting warnings, required-grade and what-if scenarios;
- read-only School meeting/assessment projections in Calendar and concise School context on Dashboard.
- target standing, required remaining averages, and ephemeral multi-assessment scenarios;
- cross-course workload ranges, major-assessment views, semester progress, and timezone-correct days-until labels;
- archive restoration, grouped schedules, course resource links, and optional effort summaries.

Deferred until later approval: syllabus parsing/import, LMS integrations, occurrence exceptions, external calendar sync, notification delivery/workers/channels, drag-and-drop rescheduling, Tasks, Goals, AI, and Python/ML.
