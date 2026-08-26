# Life Organizer

Life Organizer is a responsive personal-management application built with Next.js 16 and Supabase. The working application includes public email/password authentication, private profiles, a responsive app shell, and Finance Core: accounts, exact derived balances, categorized transactions, atomic transfers, and recurring bill/payday schedules.

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

Hosted migrations are never applied automatically. The linked CLI should show the accepted profiles migration and the pending Finance migration:

```text
supabase/migrations/20260826000100_create_profiles.sql
supabase/migrations/20260826000200_finance_core.sql
```

For Finance Phase 2A, inspect the pending migration and run:

```bash
npm run db:push
npm run db:types:linked
```

Confirm the push prompt lists only `20260826000200_finance_core.sql`. The second command replaces `types/database.ts` with hosted generated types after the schema exists. No additional Supabase dashboard settings are required for Finance.

If SQL Editor is preferred, run the entire Finance migration there, then repair/confirm CLI migration history before a future `db:push`; do not let the CLI reapply the same SQL.

The Finance migration creates:

- owned accounts and per-user seeded categories;
- auditable signed transactions and soft-void behavior;
- an immutable transfer header plus authenticated atomic transfer function;
- recurring bill and income templates;
- the security-invoker derived-balance view;
- composite ownership constraints, indexes, least-privilege grants, and RLS.

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
features/finance/    Finance actions, queries, validation, exact money, recurrence, UI
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
- Transfers can only be created by one narrowly scoped atomic database function.
- Financial records are archived, paused, or voided instead of destructively deleted.
- The browser receives no service-role or OpenAI secret.

## Scope

Implemented through Finance Core Phase 2A:

- signup, email confirmation, login/logout, protected sessions, and profiles;
- responsive desktop/mobile application shell;
- accounts, default/custom categories, transaction create/read/update/void;
- atomic same-currency transfers and exact derived balances;
- recurring bill and income/payday templates;
- application unit tests and database RLS test files.

Deferred until later approval: budgeting, advanced analytics, forecasting, receipt OCR, bank imports, Calendar, School, Tasks, Goals, AI, Python/ML, and notification delivery.
