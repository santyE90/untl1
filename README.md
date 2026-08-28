# LifeStack

LifeStack is a responsive personal-management application built with Next.js 16 and Supabase. It includes authentication, Finance, a source-aware Calendar, deterministic academic planning, Tasks, measurable Goals, and an authenticated Assistant with bounded reads and confirmation-gated Task, native Calendar, and Goal changes.

[docs/project-architecture.md](docs/project-architecture.md) is the detailed source of truth for schema decisions, ledger semantics, security boundaries, and roadmap.

## Stack

- Next.js 16 App Router, React 19, strict TypeScript
- Tailwind CSS 4 and shadcn/Base UI
- Supabase Auth and PostgreSQL with RLS
- Zod, Vitest, Supabase migrations, and pgTAP tests

Assistant Phase 7E preserves 14 bounded reads plus Task and native Calendar writes, then adds confirmation-gated Goal creation, editing, lifecycle, and exact progress updates. Model calls create proposals; a separate authenticated one-shot confirmation executes through shared domain services. Conversations are not persisted; see [docs/assistant-tool-design.md](docs/assistant-tool-design.md).

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

Hosted migrations are never applied automatically. Migrations through Goals Phase 5B are accepted on hosted Supabase:

```text
supabase/migrations/20260826000100_create_profiles.sql
supabase/migrations/20260826000200_finance_core.sql
supabase/migrations/20260827000100_budgeting_analytics.sql
supabase/migrations/20260827000200_cash_flow_planning.sql
supabase/migrations/20260827000300_calendar_core.sql
supabase/migrations/20260827000400_calendar_recurrence_reminders.sql
supabase/migrations/20260827000500_school_core.sql
supabase/migrations/20260827000600_school_planning.sql
supabase/migrations/20260827000700_tasks_core.sql
supabase/migrations/20260827000800_goals_core.sql
```

Assistant Phase 7E has no schema changes and no pending migration. Before a future schema push, inspect the linked dry-run:

```bash
npm run db:push -- --dry-run
```

After any future migration is applied, run `npm run db:types:linked`. No Supabase Dashboard changes are required for Phase 7E.

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

`db:test` runs profile, Finance, Calendar, School, Tasks, and Goals pgTAP isolation tests. A local reset affects only the local Supabase stack, never the hosted database.

## Repository map

```text
app/                 routes, layouts, and HTTP boundaries
components/          app shell and shared UI
features/finance/    Finance actions, queries, exact calculations, charts, validation, UI
features/calendar/   Calendar projection, timezone, CRUD, validation, queries, and UI
features/school/     School actions, exact grade calculations, projections, validation, queries, and UI
features/tasks/      Task actions, lifecycle/date services, projections, validation, queries, and UI
features/goals/      Goal progress, milestones, actions, queries, validation, projections, and UI
features/overview/   authenticated Today, Upcoming, and Dashboard composition
features/shared/     shared request context, date ranges, exact-decimal primitives, result contracts
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

Implemented through Assistant Phase 7E:

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
- task create/edit/complete/reopen/archive workflows with deterministic filters and sorting;
- optional School assessment linking and explicit create-task prefilling;
- source-aware Task Calendar projections and concise Dashboard task summaries.
- goal create/edit/complete/reopen/archive workflows and date-only deadlines;
- exact manual percentage or numeric-target progress with unclamped over-target values;
- lightweight milestones and optional owned Task-to-Goal links;
- source-aware Goal Calendar projections and concise Dashboard Goal summaries.
- explicit Native, Finance, School, Tasks, and Goals Calendar source providers;
- one request-scoped authenticated context and profile-timezone boundary;
- shared local-date ranges, low-level exact-decimal primitives, and lightweight service results;
- reusable cross-module Today/Upcoming and concise Dashboard aggregation;
- authenticated Assistant chat backed by a server-only OpenAI request boundary;
- 14 bounded tools spanning Today, Calendar, Finance, School, Tasks, and Goals;
- defensive tool iteration/call limits, strict inputs, concise structured results, and untrusted-data instructions;
- session-local conversation state with no Assistant database tables or memory.
- streamed answer/tool-continuation events with stop, retry, New chat, and restrained auto-scroll UX;
- trusted same-origin LifeStack reference chips, centralized cost limits, payload truncation metadata, lightweight per-user throttling, and privacy-safe execution summaries;
- deterministic Assistant stream/security tests and a selective read-tool evaluation catalog.
- confirmation-gated `create_task`, `update_task`, and `set_task_status` proposals using shared authenticated Task mutation services;
- opaque ten-minute, user-bound, one-shot confirmation tokens with cancel/New chat invalidation and stale-update protection.
- confirmation-gated `create_calendar_event` and `update_calendar_event` proposals for owned native non-recurring timed and all-day events using shared Calendar services;
- trusted Calendar previews/references, profile-timezone conversion, projected-source rejection, and optimistic Calendar update protection.
- confirmation-gated `create_goal`, `update_goal`, `set_goal_status`, and `update_goal_progress` proposals using shared authenticated Goal services;
- exact decimal-string Goal progress, independent lifecycle semantics, trusted Goal references, and optimistic Goal update protection.

Deferred until later approval: Task archive/delete/recurrence/batches; Calendar recurrence/reminders/archive/delete/occurrence edits; Goal archive/delete/milestones/batches/automatic cross-domain progress; School and Finance Assistant writes; persistent chat history/memory; recurring-task occurrence completion; intelligent scheduling; analytics; notifications; external integrations; and Python/ML.
