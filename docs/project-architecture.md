# Life Organizer: Project Architecture

Status: Finance through Phase 2B accepted; Finance Phase 2C implemented locally

Last reviewed: 2026-08-27

Current boundary: Do not begin Calendar, School, Tasks, Goals, AI, integrations, OCR, Python, or ML until the next milestone is approved.

This is the durable architectural source of truth for Life Organizer. It records decisions that future implementation sessions must preserve.

## 1. Product and engineering direction

Life Organizer is a responsive personal life-management application. Finance, Calendar, School, Tasks, Goals, Notifications, Analytics, and the eventual AI Assistant are distinct domains in one modular Next.js monolith. A source module owns its data; shared experiences project it rather than create competing copies.

Core rules:

- Build one useful vertical slice at a time.
- Prefer deterministic, tested code for money, recurrence, grades, and forecasting.
- Use Next.js Server Components for reads/composition and small Server Actions for first-party mutations.
- Authenticate every server entry point and enforce ownership again with PostgreSQL grants, RLS, and foreign keys.
- Derive `user_id` from the verified session. Never trust ownership sent by a browser.
- Keep service-role and OpenAI secrets out of browser bundles. No OpenAI calls exist yet.
- Keep business queries in feature modules so UI, future Analytics, and controlled AI tools share the same rules.
- Maintain useful phone and desktop layouts from the beginning.

## 2. Stack and repository

- Next.js 16 App Router, React 19, strict TypeScript
- Tailwind CSS 4 and shadcn/Base UI primitives
- Supabase Auth, PostgreSQL, cookie-based SSR, RLS
- Zod validation and Vitest
- Supabase CLI migrations, generated database types, and pgTAP security tests

The Git/application root is the nested `untl1/` directory. Important boundaries:

```text
app/                     routes and layouts
components/              shared shell and UI primitives
features/<domain>/       actions, validation, queries, services, domain UI
lib/auth/                verified session helpers
lib/supabase/            browser/server clients and proxy session refresh
supabase/migrations/     ordered schema history
supabase/tests/database/ pgTAP isolation tests
types/database.ts        generated linked schema types
docs/                    durable decisions
```

Next.js 16 uses root `proxy.ts` for session refresh and optimistic redirects. Proxy is not the authorization boundary. The protected app layout and every Server Action independently verify authentication.

## 3. Identity and authentication

Registration is public. Authentication is email/password only for now, with clean boundaries for later magic-link or social providers. Every Auth user receives one private `profiles` row with defaults:

- currency: CAD
- timezone: `America/Toronto`
- week start: Sunday (`0`)

The profile trigger sanitizes display metadata, creates the profile, and the Finance migration then seeds that user's default categories. No privileged application client is used for normal requests.

## 4. Security model

All private tables use RLS and least-privilege column grants. General conventions:

- UUID primary keys and `user_id uuid not null` ownership.
- Parent tables expose `unique (id, user_id)`; children use composite foreign keys `(parent_id, user_id)`. This rejects cross-user references even if application validation has a defect.
- Policies are scoped to `authenticated` and compare `(select auth.uid())` to `user_id`.
- Ownership and immutable audit columns are omitted from update grants.
- Financial history has no client delete grant. Accounts/categories archive, schedules pause, and transactions void.
- Sensitive views use `security_invoker = true` so underlying RLS still applies.
- The one exposed `security definer` finance function pins an empty `search_path`, fully qualifies tables, obtains `auth.uid()` internally, validates every account, and grants execution only to `authenticated`.
- Anonymous users receive no private table access.

SQL tests use two users to verify own-row access, cross-user invisibility, ownership immutability, composite-parent isolation, transfer restrictions, category seeding, recurring isolation, and view behavior.

## 5. Finance Core Phase 2A

### 5.1 Tables

| Table | Role |
| --- | --- |
| `finance_accounts` | Account identity and immutable opening point; supports chequing, savings, credit card, cash, investment, and custom/other. |
| `finance_categories` | Per-user default and custom expense/income/both categories. Defaults are copied per user to keep ownership and customization simple. |
| `finance_transactions` | Auditable signed effects on one account. Posted rows affect balance; pending and void rows do not. |
| `finance_transfers` | Immutable transfer header linking source, destination, date, currency, and the two ledger effects. |
| `recurring_bills` | Authoritative bill template with expected amount, account/category, cadence, next due date, reminder lead, autopay, and active state. |
| `recurring_income` | Authoritative income/payday template with destination, cadence, next payday, reminder lead, and active state. |
| `finance_account_balances` | RLS-aware derived-balance view consumed by services and UI. |

All stored monetary values are PostgreSQL `numeric(19,4)`. Input crosses the TypeScript boundary as a validated decimal string. Application arithmetic uses scaled `bigint`; authoritative aggregation happens in PostgreSQL. Currency is an ISO-shaped three-letter field, default CAD. Phase 2A permits no conversion.

### 5.2 Ledger semantics

`finance_transactions.amount` is the signed effect on its account:

- income: positive
- expense: negative
- transfer source: negative
- transfer destination: positive
- adjustment: either sign (reserved in the schema, no Phase 2A UI)

`kind` is `expense`, `income`, `transfer`, or `adjustment`. Database checks enforce non-zero amounts, expected direction, category requirements, and transfer shape. Only `status = 'posted'` contributes to balances. `pending` is supported by the schema but manual entry posts immediately. `void` preserves the row and its timestamps while removing its balance effect.

A credit card uses the same rule as every account: money owed is a negative balance. A $100 card purchase creates a -$100 expense. A $40 payment from chequing creates a transfer with -$40 in chequing and +$40 on the card, leaving $60 owed (`-60`). This avoids special-case balance arithmetic.

### 5.3 Opening and current balances

An account stores `opening_balance` and `opening_balance_date`. Both are intentionally immutable through authenticated column grants after creation. Manual transactions and transfers cannot predate the opening date.

```text
current balance = opening balance + SUM(posted signed transaction effects)
```

The `finance_account_balances` security-invoker view is the canonical database query. `features/finance/queries.ts` exposes reusable application functions such as `getAccountBalances`, `getUpcomingBills`, `getNextPayday`, and `getMonthlySpending`. Pages do not reimplement ledger rules. Archived accounts remain in the view with their historical balance; overview totals exclude archived accounts and accounts opted out of net worth.

Balances are grouped by currency in the UI. They are never added across currencies because conversion is out of scope.

### 5.4 Transfer model

Clients cannot insert, update, or delete `finance_transfers`, and RLS prevents updating transfer-kind transactions. `public.create_finance_transfer` is the only creation path. In one PostgreSQL statement/transaction it:

1. derives the owner from `auth.uid()`;
2. requires two distinct active accounts owned by that user;
3. requires equal currencies, a positive four-decimal amount, and a valid date;
4. inserts one immutable transfer header;
5. inserts exactly two posted transaction effects with the same transfer ID: negative source and positive destination.

If either insert fails, PostgreSQL rolls back everything. A same-currency transfer sums to zero across owned accounts and has `kind = 'transfer'`, so spending/income queries exclude it.

### 5.5 Categories

The migration seeds 16 categories for every existing profile and attaches a trigger for future profiles: Rent, Groceries, Restaurants, Utilities, Internet, Phone, Transportation, Gas, Entertainment, Shopping, School, Subscriptions, Health, Travel, Salary / Income, and Other. They are user-owned rows, not global rows, so RLS and composite foreign keys remain simple. `is_default` and `default_key` cannot be supplied or reassigned by authenticated users. Custom category names are unique among active categories per user.

### 5.6 Recurring finance

Bills and income use a deliberately small cadence set: weekly, biweekly, monthly, yearly. Each template stores an anchor plus its next authoritative date. No future transaction rows are generated. Pausing a schedule changes `is_active`; it does not erase the schedule.

The pure recurrence helper clamps end-of-month dates and is tested for weekly, biweekly, monthly, yearly, and leap-date behavior. It is a foundation for later advancement workflows, not an automatic scheduler in Phase 2A.

## 6. Integration boundaries

### Calendar

Finance remains authoritative for `recurring_bills.next_due_date` and `recurring_income.next_payday`. A future Calendar query will project bounded occurrences into a shared DTO. It must not duplicate bills/paydays into calendar tables.

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

### Analytics

Finance analytics query posted income/expense by date range and category, the account-balance view, monthly budgets, and active recurring obligations. Transfers are excluded by `kind`, not merchant/category guessing. Forecasting and stored aggregates remain deferred.

### AI

No OpenAI request is permitted yet. A later controlled tool layer may call reviewed application services (`getAccountBalances`, `getUpcomingBills`, `getMonthlySpending`, `getNextPayday`, later `getBudgetRemaining`). It must not expose arbitrary database access or a service-role key to a model.

## 7. Design system

The supplied palette is retained as raw brand tokens:

- text `#0a090a`
- background `#f7f4f8`
- primary brand `#9865a9`
- secondary brand `#c297d0`
- accent brand `#b976ce`

Semantic controls use an accessible darker primary (`#7f4e91`) with white text. Success/positive money is `#16794b`; destructive/negative money is `#b4233c`. Components use semantic tokens rather than hard-coded module colors. The authenticated shell has a desktop sidebar and phone header/bottom navigation.

## 8. Migration and type workflow

Migration history:

1. `20260826000100_create_profiles.sql` - applied to hosted Supabase and accepted.
2. `20260826000200_finance_core.sql` - Phase 2A schema; applied to hosted Supabase and accepted.
3. `20260827000100_budgeting_analytics.sql` - Phase 2B budget schema and atomic save function; applied and accepted.
4. `20260827000200_cash_flow_planning.sql` - Phase 2C account-optional schedules and occurrence-reconciliation constraints; pending owner application.

The CLI is linked. After review, apply pending migrations with `npm run db:push`, inspect the output before confirming, then run `npm run db:types:linked`. `types/database.ts` carries the last hosted generated schema plus the pending local budget shape so the application can compile before the migration exists remotely; linked generation becomes authoritative immediately after push.

Docker is optional for application development but required by the local Supabase stack and `npm run db:test`. Never assume a local reset has changed hosted infrastructure.

## 9. Roadmap

- Phase 0/1: Foundation, authentication, responsive shell - accepted.
- Phase 2A: Finance ledger, accounts, categories, transactions, transfers, recurring templates - accepted.
- Phase 2B: Monthly budgeting and deterministic Finance analytics - accepted.
- Phase 2C: Account-optional schedules and deterministic known cash-flow planning - implemented locally, awaiting hosted migration and browser acceptance.
- Future Finance: mark-paid reconciliation workflow, recurrence advancement, discretionary estimation, import/reconciliation, and richer planning - blocked pending review.
- Later: Calendar, School, Tasks/Goals, notifications/analytics, controlled AI, integrations/data science.

Deferred finance decisions include currency conversion, import/deduplication, receipt storage/OCR, automatic recurring transaction generation, richer recurrence rules, editing/voiding an entire transfer, discretionary estimation, and subscription detection.

## 10. Finance Phase 2B: Budgeting and analytics

### 10.1 Budget schema and persistence

`finance_budgets` stores one overall spending limit per `(user_id, budget_month, currency)`. `budget_month` is always the first date of a calendar month. `finance_budget_categories` stores only optional category limits and uses composite ownership foreign keys to both its budget and category. Both limits use `numeric(19,4)`.

Budgets never store actual spending, utilization, or remaining amounts. Those values are derived from the authoritative transaction ledger, so editing or voiding a transaction immediately changes budget usage without a synchronization job. Historical months remain queryable as independent budget rows.

Authenticated clients receive read-only table grants. `public.save_monthly_finance_budget` is the only mutation path. This pinned-search-path security-definer function:

1. derives the owner from `auth.uid()`;
2. validates month, currency, notes, overall limit, and the JSON category-limit set;
3. verifies every category is an owned expense-compatible category;
4. upserts the monthly budget and replaces its category limits in one database transaction.

Omitting a category from the submitted set removes its limit. It does not remove the category or any historical transaction. An archived category already attached to a historical budget can be preserved when that budget is edited.

### 10.2 Budget calculations

Budget usage counts only `status = 'posted'` and `kind = 'expense'` transactions in the selected inclusive date range. Income, transfers, pending transactions, and voided transactions do not count. Expense ledger values are negative, but reporting uses their positive magnitude.

```text
remaining           = limit - actual spending
over amount         = max(actual spending - limit, 0)
utilization         = actual spending / limit
unbudgeted spending = expense totals whose category has no limit
```

An overall budget and its category limits are independent planning controls; category limits are not required to sum to the overall limit. Categories without a limit still appear in spending analytics. Categories with a limit and no spending report zero actual usage.

### 10.3 Analytics architecture

`features/finance/analytics.ts` contains pure exact-money calculations. `analytics-queries.ts` is the RLS-bound server data layer. Pages receive prepared domain results; Recharts client components receive only small serializable visualization arrays. Future controlled AI tools may call the same query/service layer rather than reimplement calculations.

Supported deterministic results include:

- posted income, spending, and net cash flow by currency and date range;
- spending by category and day, average daily spending, and largest expenses;
- current/previous month comparisons with `null` percentage change when the prior denominator is zero;
- overall/category budget usage, overage, remaining, and unbudgeted spending;
- net worth by currency;
- normalized recurring bill totals by currency, category, and account;
- upcoming obligations and historical monthly budgets.

The UI labels `income - expenses` as **net cash flow**, not invested savings. The optional rate is `(income - expenses) / income`; it is unavailable when income is zero.

### 10.4 Date ranges and comparisons

Transactions use PostgreSQL `date`, so ranges are inclusive date strings without timestamp conversion. Month utilities create exact first/last dates using UTC calendar arithmetic. The current month/date is selected using the profile IANA timezone (default `America/Toronto`) before querying date columns. Previous and arbitrary months use `YYYY-MM` keys.

Current-month versus previous-month comparisons are explicitly labelled as partial until the current month closes. Percentage change is not shown when previous spending is zero, because an infinite/undefined percentage would be misleading.

### 10.5 Recurring cost normalization

Recurring bills remain templates; analytics does not create future transactions. Expected annual cost uses:

- weekly: amount x 52;
- biweekly: amount x 26;
- monthly: amount x 12;
- yearly: amount x 1.

Expected monthly cost is the normalized annual result divided by 12 with four-decimal rounding. These are planning estimates, not predictive forecasts or proof that a payment occurred.

### 10.6 Net worth and currencies

Net worth sums current derived balances only for active accounts with `include_in_net_worth = true`. Negative credit-card balances reduce net worth. Archived accounts retain their history and balance but remain excluded from the current net-worth presentation, matching Phase 2A overview semantics.

All budgets and analytics remain currency-scoped. CAD and USD values are shown separately and are never combined without an exchange-rate model.

### 10.7 Scheduling boundary carried into Phase 2C

Phase 2B retained required schedule accounts. Phase 2C implements the approved nullable-account design described below. Actual transactions remain account-required.

## 11. Finance Phase 2C: deterministic cash-flow planning

### 11.1 Optional recurring accounts

`recurring_bills.account_id` and `recurring_income.destination_account_id` are nullable. Schedules keep their own currency, amount, recurrence, and authoritative next date, so they remain useful without an account. Users can assign or unassign a compatible active account later. Composite foreign keys still prevent cross-user assignments, and database triggers require an assigned account to use the schedule currency.

No placeholder account is created. `finance_transactions.account_id` remains non-null: recording an actual paid bill or received payday always requires a real owned account.

### 11.2 Recurrence expansion

`features/finance/recurrence-expansion.ts` expands active schedules into bounded in-memory occurrences. It never creates future transaction rows. Supported cadences are weekly, biweekly, monthly, and yearly.

The authoritative `next_due_date` or `next_payday` is the first candidate. Subsequent monthly/yearly occurrences use the original anchor day/month and clamp only when the target calendar period is shorter. A January 31 schedule therefore produces February 28 and then March 31 rather than drifting permanently to the 28th. A February 29 yearly anchor clamps to February 28 in non-leap years and returns to February 29 in leap years.

Expansion is inclusive of the selected start/end dates and capped defensively. Stable occurrence IDs use `bill:<source-id>:<date>` or `income:<source-id>:<date>`, which is also the Finance-to-Calendar projection identity contract.

### 11.3 Known cash-flow model

The planning timeline contains only explainable structured events:

```text
date, bill|income, name, signed amount, currency,
account_id|null, source_id, source_type, occurrence_id
```

Bills have negative account effects and income has positive effects. Entries sort by date; bills sort before income on the same date as a conservative deterministic display convention, not a claim about actual bank posting order. Currencies are never combined.

Known planning is deliberately separate from:

- actual ledger balance: opening balance plus posted transactions;
- budgets: spending intentions, never subtracted as scheduled bills;
- estimated discretionary spending: deferred because reliable recurring-transaction matching does not yet exist.

### 11.4 Assigned and unassigned projections

Assigned occurrences update only their selected account's projected path:

```text
known projected balance = current derived balance + assigned projected effects
```

Unassigned occurrences remain in the overall timeline and income/bill totals, with separate unassigned totals and visible warnings. They do not change any account or liquid-cash projection. This prevents the application from inventing routing assumptions.

Account projection starts from the current derived balance. Archived accounts retain data but are omitted from the current planning chart presentation. Account assignment can be changed from the Finance recurring-schedule list.

### 11.5 Liquidity and shortfall semantics

The current liquid-cash view includes active `chequing`, `savings`, and `cash` accounts. Credit cards are liabilities, investments are not assumed to be everyday cash, and other/custom accounts are excluded until an explicit configurability requirement exists. This does not alter Phase 2B net-worth rules.

Assigned schedule effects change liquid projections only when their account is in that liquid set. A potential shortfall warning is emitted when a liquid account's known projected balance first falls below zero. It is labelled as a schedule-based possibility, not an overdraft guarantee. Credit-card negative balances do not trigger cash shortfall warnings.

### 11.6 Forecast horizons

The planning UI supports inclusive 7-, 30-, 60-, and 90-day horizons, the end of the current month, and a custom through-date bounded to one year. The starting date is the user's current calendar date in their profile timezone. Transaction and schedule dates remain date-only values.

### 11.7 Actual occurrence reconciliation

The migration adds partial unique indexes so each recurring source/date may have at most one non-void actual transaction. It also enforces that bill-linked transactions are expenses and income-linked transactions are income.

Planning suppresses a projected occurrence when a posted transaction already carries the same recurring source and date. A full **Mark paid/Mark received** workflow is deferred because it must atomically choose an account, create the linked actual, advance the authoritative next date, and handle late/early occurrences. Ordinary unlinked manual transactions cannot be matched reliably and may still overlap a schedule; the UI documents this limitation rather than guessing by amount or merchant.

### 11.8 Calendar and service boundaries

Finance remains authoritative for recurrence, projected dates, amounts, account assignment, and stable occurrence IDs. The future Calendar module will consume bounded Finance projections and will not duplicate rows.

Reusable service entry points include `getCashFlowForecast`, `getUpcomingBills`, `getNextPayday`, `getProjectedAccountBalance`, `getFinancialWarnings`, and `getUnassignedObligations`. No OpenAI requests or arbitrary model database access are introduced.
