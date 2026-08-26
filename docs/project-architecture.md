# Life Organizer: Product and Architecture Foundation

Status: approved foundation; authentication shell implemented locally  
Last reviewed: 2026-08-26  
Current phase: Phase 1 — hosted migration and browser verification pending

This document is the durable source of truth for the Life Organizer project. It records the current repository state, architectural boundaries, proposed data model, security model, design system, and staged delivery plan. Update it when a decision changes; do not treat the original chat brief as the only project record.

## 1. Product direction

Life Organizer is a responsive, web-based personal life-management platform. Its value comes from connecting finance, calendar, school, tasks, goals, notifications, analytics, and—later—a controlled AI assistant.

The modules are separate domains, but not isolated mini-apps. A bill, assignment, payday, or task remains owned by its source module while being projected into shared experiences such as the calendar, dashboard, reminders, analytics, and assistant tools.

### Near-term principles

- Build one useful vertical slice at a time.
- Keep one authoritative owner for each piece of data.
- Prefer deterministic code for dates, money, grades, recurrence, and forecasting.
- Use Server Components by default and add client boundaries only for interaction.
- Enforce authorization in PostgreSQL RLS and again at server entry points.
- Keep secrets and privileged credentials out of browser bundles.
- Optimize for a polished mobile and desktop experience from the first shell.
- Defer AI API calls, external integrations, Python services, and ML until their phases.

## 2. Repository audit

The actual Git/application root is the nested `untl1/` directory inside the outer workspace folder. The repository is a minimal Create Next App project with a new shadcn/ui installation.

### Installed stack

The following are the versions installed locally at the time of this audit. `package.json` uses exact versions for Next.js and React and compatible ranges for most other packages.

| Area | Installed package/version |
| --- | --- |
| Framework | `next@16.3.3` |
| UI runtime | `react@19.2.8`, `react-dom@19.2.8` |
| Language | `typescript@5.9.3` |
| Styling | `tailwindcss@4.3.3`, `@tailwindcss/postcss@4.3.3` |
| Component system | `shadcn@4.19.0`, Vega (`base-vega`) style, Base UI primitives |
| Supabase | `@supabase/supabase-js@2.112.4`, `@supabase/ssr@0.12.5` |
| Validation | `zod@4.4.3` |
| AI SDK | `openai@7.5.0` |
| Charts/icons | `recharts@3.10.1`, `lucide-react@1.34.0` |
| Linting | `eslint@9.39.5`, `eslint-config-next@16.3.3` |

Baseline verification on 2026-08-26:

- `npm run lint`: passes.
- `npm run build`: passes; only `/` and `/_not-found` exist.
- `npm audit --omit=dev`: zero reported vulnerabilities.
- `.env.local`: exists, is ignored by `.env*`, and is not tracked. Its contents were not opened during the audit.

### Current configuration

- App Router is enabled through the `app/` directory.
- TypeScript strict mode is enabled and `@/*` maps to the repository root.
- Tailwind CSS 4 is configured through PostCSS and `app/globals.css`; a separate `tailwind.config` file is not required for this setup.
- `components.json` correctly targets `app/globals.css`, React Server Components, Lucide, CSS variables, and the Vega style.
- `next.config.ts` is intentionally empty.
- One shadcn component, `components/ui/button.tsx`, and `lib/utils.ts` exist.
- The home page, metadata, README, public SVGs, and much of the styling are still starter content.

### Gaps and inconsistencies

These are foundation tasks, not evidence that the setup is broken:

1. The provided brand palette has not replaced shadcn's neutral starter tokens.
2. The root layout loads Inter, Geist Sans, and Geist Mono even though only one body family is needed. The font strategy should be simplified during the shell milestone.
3. Metadata and the landing page still identify the Create Next App starter.
4. Supabase packages are installed, but browser/server client factories, session refresh proxy, auth routes, and generated database types do not exist.
5. There is no `supabase/` migration structure or committed schema history.
6. There are no automated tests or test scripts yet.
7. The README is generic and does not explain local setup or architecture.
8. `.gitignore` correctly excludes `.env.local`, but `.env*` also excludes a future `.env.example`. Add an explicit `!.env.example` before committing a redacted environment template.
9. The working tree already contained uncommitted shadcn/setup changes when this audit began. Preserve and commit them intentionally rather than assuming they are generated noise.
10. `npm ls` reports three extraneous WASM-related packages in local `node_modules`. They are not declared application dependencies and do not affect the clean build; reassess after a clean install rather than adding them to `package.json`.

## 3. Application architecture

Use a modular monolith: one Next.js application and one Supabase Postgres database, with explicit feature boundaries. This is enough separation for a portfolio-quality system without premature services.

```text
Browser
  -> Next.js App Router
       -> Server Components (reads and composition)
       -> Server Actions (first-party mutations)
       -> Route Handlers (webhooks, streaming, external/API boundaries only)
       -> feature application services
            -> Supabase client carrying the user's session
                 -> PostgreSQL + RLS

Later only:
  feature application services -> controlled OpenAI tool layer
  feature application services -> external integrations / Python analytics
```

### Proposed repository layout

Keep the existing root-level `app/` layout rather than moving to `src/` without a concrete benefit.

```text
app/
  (public)/                  # landing page
  (auth)/                    # login, sign-up, recovery
  (app)/                     # authenticated application shell
    dashboard/
    finance/
    calendar/
    school/
    tasks/
    goals/
    analytics/
    assistant/
    settings/
  auth/callback/             # auth code exchange route
  api/                       # only true HTTP/integration boundaries
components/
  ui/                        # shadcn primitives; minimally modified
  shared/                    # cross-feature composed UI
features/
  finance/
  calendar/
  school/
  tasks/
  goals/
  notifications/
  analytics/
  assistant/
    components/
    actions/
    queries/
    schemas/
    services/
    types.ts
lib/
  auth/
  supabase/                  # client.ts, server.ts, proxy helper
  env/                       # server/client-safe validated environment access
  dates/
  money/
  recurrence/
  utils.ts
supabase/
  migrations/
  seed.sql                   # development-safe reference/seed data only
  tests/                     # SQL/RLS tests when introduced
types/
  database.ts                # generated Supabase types
docs/
  project-architecture.md
```

The repeated folders under each feature are optional: create one only when the feature needs it. Do not create empty scaffolding for every future module.

### Runtime and data-access rules

- Pages and layouts are Server Components unless browser state or event handlers require a Client Component.
- Fetch user data on the server and pass the smallest required serializable shape to clients.
- Mutations go through small Server Actions that authenticate, validate with Zod, call a feature service, and invalidate the affected view.
- Treat every Server Action and Route Handler as a public, untrusted entry point.
- Use Route Handlers for auth callbacks, webhooks, file/download responses, external consumers, or future streamed AI responses—not as an internal REST layer for Server Components.
- Keep raw Supabase queries inside feature query/service modules. UI components should not encode database access rules.
- Create a Supabase client per request/context; do not use a mutable global server client.
- Use the browser client only for browser-required auth interactions, uploads, realtime, or optimistic experiences. RLS remains mandatory either way.
- Generate `types/database.ts` from the schema and use typed query results. Do not hand-maintain a competing copy of database row types.
- Validate money as decimal strings at input boundaries and store it in PostgreSQL `numeric`, never JavaScript floating-point arithmetic for authoritative totals.
- Store instants as `timestamptz`, dates without a time as `date`, and the user's IANA timezone in `profiles`.

## 4. Proposed relational model

The following is the target relational shape, not a request to create every table in the first migration. Add tables in the milestone that first uses them.

### Shared identity and preferences

| Table | Purpose and important fields |
| --- | --- |
| `profiles` | One-to-one with `auth.users`; `id` UUID PK/FK, display name, timezone, locale, default currency, timestamps. |
| `user_preferences` | One-to-one settings that grow independently: week start, notification defaults, dashboard preferences, appearance. Can remain in `profiles` until justified. |

### Finance

| Table | Purpose and important fields |
| --- | --- |
| `accounts` | `user_id`, name, type, currency, opening/current balance strategy, optional institution/credit limit, include-in-net-worth, archived timestamp. |
| `transaction_categories` | User-owned categories; name, kind, icon/color, archived timestamp. Seed defaults per user so ownership remains simple. |
| `transactions` | `user_id`, account, optional category, kind, amount (`numeric(14,2)` initially), transaction date, merchant, description, notes, optional recurring source, timestamps. Amount sign semantics must be documented once and enforced by checks. |
| `transfers` | Links the two account movements representing one transfer; avoids treating transfers as income/expense and permits atomic creation. |
| `recurring_bills` | Name, amount, currency, category/account, recurrence rule, next due date, autopay, reminder lead time, active state. This row owns its calendar timing. |
| `income_sources` | Name, expected amount/range, account, recurrence rule, next payday, active state. This row owns its calendar timing. |
| `budgets` | Named period with start/end dates, currency, optional rollover behavior. |
| `budget_allocations` | Budget/category join with allocated amount; unique per budget/category. |

Account balances will be auditable and derived: each account stores an `opening_balance` and `opening_balance_date`, and its current balance is the opening balance plus subsequent posted transaction entries. A transfer will be one transactional operation that creates two linked account entries—an outflow from the source and an inflow to the destination—under a shared `transfers` record. Transfers never count as income or spending. Same-currency transfers must balance exactly; cross-currency transfer semantics and exchange-rate fields must be designed explicitly before they are supported.

### Calendar and scheduling

| Table | Purpose and important fields |
| --- | --- |
| `calendar_events` | User-created/native events only: title, description, start/end, all-day flag, timezone, location, recurrence rule, color, status. |
| `event_exceptions` | Later: cancellations or overrides for individual occurrences of a recurring native event. |
| `reminder_rules` | Later: user-owned rule attached to a supported source, lead interval, channel, enabled flag. Implement only when reminders enter scope. |

Finance, school, and task dates are not copied into `calendar_events`; see the projection model below.

### School

| Table | Purpose and important fields |
| --- | --- |
| `semesters` | Name, start/end dates, status; unique user/name or user/date range as appropriate. |
| `courses` | Semester, code, name, professor, color, location/links/notes. |
| `course_meetings` | Course, meeting type, start/end time, weekday or recurrence rule, room, valid date range. |
| `assessments` | Course, type, name, due instant, weight (`numeric`), score/max score, status, notes. |

Grade calculations use completed weighted scores in deterministic code. Database checks keep weight and scores in valid ranges; scenarios such as “required final grade” remain pure tested functions.

### Tasks and goals

| Table | Purpose and important fields |
| --- | --- |
| `tasks` | Title, description, status, priority, due instant, estimated minutes, recurrence rule, optional course/goal relationship, completion timestamp. |
| `subtasks` | Parent task, title, ordering, completion timestamp. |
| `goals` | Title, description, category, target/current decimal value, unit, deadline, status; optional financial account/category relationship only when needed. |
| `goal_milestones` | Goal, title, target/date, ordering, completion timestamp. |

### Notifications and derived data

| Table | Purpose and important fields |
| --- | --- |
| `notifications` | A delivered/generated in-app item: kind, title/body, occurrence time, read timestamp, optional internal deep link, deduplication key. |
| `integration_connections` | Later: encrypted/provider-managed connection metadata, never raw secrets in browser-readable columns. |

Dashboard cards, balances, grades, calendar items, cash-flow forecasts, and analytics are derived query results initially. Do not persist aggregates until measurement demonstrates a need.

### Relationship and integrity conventions

- Every user-owned table has `user_id uuid not null references auth.users(id) on delete cascade` unless its primary key is itself the auth user ID.
- Child tables also carry `user_id` even when ownership is inferable through a parent. This makes RLS direct and indexable.
- Prevent cross-user parent references with composite ownership foreign keys: parent tables expose `unique (id, user_id)` and children reference `(parent_id, user_id)`.
- Use UUID primary keys, `created_at timestamptz`, and `updated_at timestamptz` consistently.
- Prefer archival/status fields for financial records that should remain in history; use hard delete only where history is not meaningful.
- Add checks for positive monetary amounts, valid date ranges, percentages, account pairs in transfers, and enum/domain values.
- Index every `user_id`, foreign key used for joins, date used in upcoming/range queries, and columns used by RLS. Start with evidence-based composite indexes such as `(user_id, due_at)`.
- Use database enums only for stable, closed concepts. Use text/check constraints or reference tables where user customization is expected.

## 5. Cross-module calendar model

Use a projection model rather than copying source records into `calendar_events`.

```text
recurring_bills.next_due_date ----\
income_sources.next_payday -------+
assessments.due_at ---------------+--> calendar query service --> CalendarItem[]
tasks.due_at ---------------------+
goals.deadline -------------------+
calendar_events.start_at --------/
```

Each module owns its authoritative temporal fields. The calendar query service asks each relevant feature for items in a bounded date range, expands supported recurrence rules deterministically, and maps results to a discriminated DTO:

```ts
type CalendarItem = {
  id: string
  sourceType: "event" | "bill" | "payday" | "course" | "assessment" | "task" | "goal"
  sourceId: string
  title: string
  startsAt: string
  endsAt?: string
  allDay: boolean
  color?: string
  href: string
}
```

The `id` for a projected occurrence should be stable and deterministic, for example `bill:<source-id>:<occurrence-date>`. `sourceId` links directly back to the authoritative domain object.

Why this model:

- Updating a bill due date updates one row; there is no second calendar copy to synchronize.
- Deleting or archiving a source immediately removes it from future projections.
- Every source keeps its own relational constraints and RLS.
- The calendar gets a uniform read contract without a weak polymorphic foreign key.

Start by composing queries in the server application layer. If scale later warrants it, introduce a SQL `calendar_items` view or a generated occurrence cache as an optimization, with the source rows still authoritative. Do not store an unbounded occurrence row for every recurring item.

Recurrence should support a documented subset first (for example weekly course meetings and monthly bills). Use one tested recurrence utility and an RFC 5545-compatible rule representation only when the UI can safely create and edit those rules. Store timezone explicitly to avoid daylight-saving errors.

## 6. Authentication and authorization

### Session architecture

1. Use Supabase Auth with cookie-based SSR through `@supabase/ssr`.
2. Provide separate browser and server client factories under `lib/supabase/`.
3. Add Next.js 16 `proxy.ts` for token refresh and optimistic redirects. Proxy is not the authorization boundary.
4. Validate the authenticated identity in every Server Action, Route Handler, and data-access operation. Use verified claims/user lookup according to the installed Supabase SSR guidance; never trust a display-only cookie value.
5. Derive `user_id` from the authenticated session. Mutations must not accept ownership from form data or JSON.
6. Keep `OPENAI_API_KEY` and any future Supabase secret/service key in server-only modules. The publishable Supabase key is expected in the browser and gains safety from Auth + grants + RLS.

### RLS policy template

For every exposed user-owned table:

- Enable RLS in the same migration that creates the table.
- Revoke broad defaults from `anon` and `authenticated`, then grant only intended operations.
- Grant no private application-table access to `anon` initially.
- Scope policies explicitly `to authenticated`.
- `select`/`delete`: `using ((select auth.uid()) = user_id)`.
- `insert`: `with check ((select auth.uid()) = user_id)`.
- `update`: both `using` and `with check` with the same ownership condition.
- Add a matching `user_id` index.

Application filters such as `.eq("user_id", user.id)` improve query intent/performance but never replace RLS.

Views must be reviewed explicitly because view security behavior can bypass underlying expectations if created incorrectly. Prefer `security_invoker = true` where supported, or keep sensitive aggregation behind carefully reviewed functions/services. Put any `security definer` function in a non-exposed schema, pin `search_path`, schema-qualify references, and revoke unintended execute permissions.

Do not introduce a service-role/secret client for ordinary user requests. If background jobs later require one, isolate it in a server-only module and make its authorization/query scope explicit.

### Security verification

Each migration should include or be accompanied by tests with at least:

- unauthenticated user denied;
- user A can perform the intended operations on user A rows;
- user A cannot select, insert for, update, or delete user B rows;
- child rows cannot reference a parent belonging to another user;
- attempts to change `user_id` are rejected;
- privileged functions/views do not leak cross-user data.

## 7. Design-token proposal

The supplied palette remains the visual foundation, but interaction tokens must also meet accessible contrast. In particular, white text on `#9865a9` is approximately 4.40:1, just below WCAG AA for normal text. Use a darker interactive derivative for primary buttons and retain the supplied color as a brand/data-visualization token.

| Token | Proposed value | Use |
| --- | --- | --- |
| `--brand-text` / `--foreground` | `#0a090a` | Primary text |
| `--brand-background` / `--background` | `#f7f4f8` | App canvas |
| `--brand-primary` | `#9865a9` | Brand marks, larger display accents, charts |
| `--primary` | `#7f4e91` | Accessible primary controls with white text |
| `--primary-hover` | `#6f407f` | Primary hover/pressed state |
| `--brand-secondary` | `#c297d0` | Decorative and chart use |
| `--secondary` | `#eee4f1` | Quiet secondary surfaces |
| `--brand-accent` | `#b976ce` | Highlight/chart accent with dark text where text is required |
| `--accent` | `#eadcf0` | shadcn hover/selection surface, not a saturated fill everywhere |
| `--card` / `--popover` | `#ffffff` | Elevated content surfaces |
| `--muted` | `#f0ebf2` | Subtle sections and skeletons |
| `--muted-foreground` | `#655f68` | Secondary text |
| `--border` / `--input` | `#ded6e1` | Boundaries and controls |
| `--ring` | `#9865a9` | Focus indication, paired with visible outline/ring thickness |
| `--success` / `--financial-positive` | `#16794b` | Success and positive money |
| `--warning` | `#9a5b13` | Upcoming risk/warning |
| `--destructive` / `--financial-negative` | `#b4233c` | Errors, destructive actions, negative money |

Keep shadcn semantic tokens (`primary`, `secondary`, `accent`, `muted`) separate from raw brand swatches. Charts should use the purple family plus blue/teal/amber companions so categories remain distinguishable; never encode status by color alone. Maintain the existing CSS-variable architecture so a later `.dark` token set can be introduced without rewriting components.

## 8. Refined delivery roadmap

### Phase 0 — foundation (current)

- Preserve this architecture document and convert agreed decisions into small ADRs when necessary.
- Establish brand tokens, metadata, formatting conventions, test tooling, redacted `.env.example`, and Supabase migration/type-generation workflow.
- Implement auth architecture and the responsive application shell only after this foundation is accepted.

### Phase 1 — authentication and daily shell

- Sign up, sign in, callback/recovery, sign out, protected `(app)` routes, profile/timezone onboarding.
- Responsive desktop sidebar and mobile navigation.
- Dashboard with honest empty states; no hard-coded personal financial data.
- RLS isolation tests for `profiles` and any initial preference data.

### Phase 2A — finance ledger

- Accounts, user-owned categories, transactions, transfers, validation, and basic balances.
- Start with accessible tables/cards and mobile entry flows.

### Phase 2B — recurring finance and budgets

- Bills, income/paydays, category budgets, deterministic recurrence, upcoming finance query.
- Project bills/paydays into the shared calendar contract.

### Phase 3 — calendar foundation

- Native events, month/agenda views first, bounded range queries, cross-module projections.
- Add week/day views and recurrence exceptions only after core behavior is solid.

### Phase 4 — school

- Semesters, courses, meetings, assessments, deterministic grades/forecasting, calendar projections.

### Phase 5 — tasks and goals

- Tasks/subtasks/priorities, goals/milestones, source relationships, calendar projections.

### Phase 6 — notifications and analytics

- In-app reminder generation and read state before email/push.
- Deterministic finance, school, productivity, and cross-module dashboard analytics.

### Phase 7 — AI assistant

- Begin only after API billing is intentionally enabled and core data/services are reliable.
- Server-only OpenAI client, Zod-validated controlled tools, structured results, read tools first.
- Confirm consequential writes; never give the model raw database or service-key access.

### Phase 8+ — integrations and data science

- Add receipt OCR, calendar/bank integrations, push/email, PWA, intelligent scheduling, and a Python analytics service only in response to validated needs and sufficient data.

## 9. Foundation + Authentication Shell implementation

The **Foundation + Authentication Shell** was implemented locally on 2026-08-26. The hosted Supabase migration and browser-level authentication verification remain owner actions before the milestone is accepted.

Deliverables:

1. Apply the light-mode design tokens, simplify fonts, and replace starter metadata.
2. Add `.env.example` with names/placeholders only and adjust `.gitignore` so it can be committed.
3. Add Supabase browser/server clients and Next.js 16 auth refresh proxy using the installed package APIs.
4. Create the first migration for `profiles`, least-privilege grants, RLS policies, ownership index, and profile creation behavior.
5. Add auth pages/actions, callback flow, sign out, and protected application route group.
6. Build a responsive navigation shell and a dashboard empty state.
7. Add a minimal automated test setup plus auth/RLS verification instructions or executable database tests.
8. Replace the starter README with setup, commands, environment names, and migration workflow.

Acceptance criteria:

- A user can sign up, authenticate, refresh, sign out, and reach only protected pages while authenticated.
- Two test users cannot access or mutate each other's profile data.
- No secret is exposed, logged, or committed.
- The shell is keyboard accessible and usable at phone and desktop widths.
- Lint, type/build, and the introduced tests pass.
- No finance/calendar/school feature tables are created before their milestone.

## 10. Confirmed product decisions

1. **Account access:** public registration with strict per-user isolation.
2. **Authentication methods:** email/password only initially; magic links and social providers remain future additions.
3. **Initial locale defaults:** CAD, `America/Toronto`, and Sunday as the first day of the week. These remain per-user preferences.
4. **Finance balance semantics:** derived from an account opening balance plus posted transaction entries. Transfers use an atomic, linked double-entry-style pair and do not affect income/expense reporting.

## 11. External implementation references

- Next.js 16 bundled documentation in `node_modules/next/dist/docs/` is authoritative for this installed version. In particular, use `proxy.ts` rather than the old Middleware name and treat Proxy as an optimistic routing layer, not authorization.
- Supabase SSR for Next.js: <https://supabase.com/docs/guides/auth/server-side/creating-a-client>
- Supabase Row Level Security: <https://supabase.com/docs/guides/database/postgres/row-level-security>
- Supabase API security: <https://supabase.com/docs/guides/api/securing-your-api>
