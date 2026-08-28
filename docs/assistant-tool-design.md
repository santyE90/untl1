# LifeStack Assistant tool design

Status: Phase 7D confirmed Task and native Calendar mutations implemented. The 14 read tools remain active; `create_task`, `update_task`, `set_task_status`, `create_calendar_event`, and `update_calendar_event` are proposal-only model capabilities. Assistant persistence does not exist.

## Phase 7B runtime

The responsive `/assistant` interface keeps conversation state only in the browser and sends a bounded recent context to authenticated `POST /api/assistant`. The server uses one `AuthenticatedAppContext`, the ordinary RLS-bound Supabase client, and the fixed read-tool registry in `features/assistant/server/tools.ts`. It uses `gpt-5-mini` with low reasoning effort, a 900-token output ceiling, at most four tool-result iterations and eight total calls. OpenAI Responses events are translated to a validated NDJSON stream; tool results remain server-side and only answer text plus trusted structured references reaches the UI. `store: false` is set and LifeStack creates no conversation rows.

Central safeguards are defined in `features/assistant/limits.ts`: 8,000 characters per user message, 12 messages/32,000 characters of context, 48 KB per serialized tool result, eight references, and conservative per-domain item caps. Every capped list reports `truncated` and `totalAvailable`. The process-local throttle allows one active turn per user, at least 1.5 seconds between starts, and six starts per minute; it resets across instances and deployments and is not a distributed security control.

References never come from generated Markdown. Tool adapters derive them from owned records or trusted Calendar provider routes, validate them against an approved same-origin route allowlist, and return them separately in the completion event. Assistant text is rendered as escaped plain text. Logs contain only request/correlation IDs, model, tool names/count, duration, and outcome—not messages, tool payloads, private domain values, credentials, or provider details.

Every general upcoming range is 1–90 days starting on the user's current local date. Cash-flow projection is limited to 7/30/60/90 days or current month-end. Tool results omit descriptions, notes, audit columns, and unrelated internal fields where unnecessary. There are no directly executing model tools, web, file, computer, SQL, or service-role tools.

## Non-negotiable boundary

Every tool executes server-side with a verified Supabase session and the ordinary RLS-bound client. Authenticated context supplies ownership; no tool accepts `userId`. Entity IDs are references, not proof of access, and every service revalidates them through RLS and domain ownership constraints. Tools return structured serializable values, retaining authoritative dates, timezones, exact decimal strings/scaled values, currencies, statuses, and IDs separately from presentation labels.

Reads require an intentional user request. Low-risk reversible writes require unambiguous intent. Destructive, batch, or sensitive financial writes require an explicit confirmation containing the proposed effect. Errors use the compact `ServiceResult` categories: validation, not found, unauthorized, conflict, and unexpected. A tool must not turn an RLS-hidden row into evidence that another user's row exists.

## Proposed read tools

### `get_today_overview`

- Purpose: Return today's native events and dated obligations from Finance, School, Tasks, and Goals in the user's local timezone.
- Arguments: none.
- Ownership: authenticated context and provider RLS only.
- Service: `getTodayOverview`.
- Confirmation: none after intentional read request.
- Result: `{ date, timeZone, items[], countsBySource }`, using normalized Calendar items.
- Errors: unauthenticated session, unavailable profile, unexpected provider failure.

### `get_upcoming_calendar`

- Purpose: Return the user's normalized cross-module Calendar items in a requested inclusive range.
- Arguments: `days` from 1 through 90, starting on the user's profile-local date.
- Ownership: authenticated Calendar providers and RLS.
- Service: `getUpcomingOverview` / `getCalendarItems`.
- Confirmation: none.
- Result: `{ range, timeZone, items[], countsBySource }`.
- Errors: invalid/reversed/excessive range, unauthenticated session, provider failure.

### `get_finance_summary`

- Purpose: Return account balances and concise current Finance overview values.
- Arguments: none; an optional future currency filter must not imply conversion.
- Ownership: Finance queries use authenticated RLS context.
- Service: `getFinanceOverview` and `getAccountBalances`; the Assistant adapter selects a compact serializable subset.
- Confirmation: none.
- Result: accounts with exact balance decimal and currency, net-worth groupings by currency, recent transaction references, and schedule counts.
- Errors: unauthenticated session, unsupported currency aggregation, unexpected query failure.

### `get_upcoming_bills`

- Purpose: Return active bill occurrences within a supported planning horizon, including unassigned schedules.
- Arguments: `days` from 1 through 90.
- Ownership: authenticated Finance schedule queries and RLS.
- Service: `getUpcomingBills` in `features/finance/planning-queries.ts`.
- Confirmation: none.
- Result: source/occurrence IDs, name, date, exact amount, currency, optional owned account, and reconciliation state.
- Errors: invalid horizon/date, unauthenticated session, unsupported request range.

### `get_cash_flow_projection`

- Purpose: Return deterministic known scheduled cash flow and warnings over a bounded horizon.
- Arguments: `horizon`: `7`, `30`, `60`, `90`, or `month`. Account-focused projection is deferred.
- Ownership: authenticated Finance services revalidate any account reference.
- Service: `getCashFlowForecast`, `getProjectedAccountBalance`, `getFinancialWarnings`, and `getUnassignedObligations`.
- Confirmation: none.
- Result: range, starting/projected exact balances, occurrences, unassigned totals, and deterministic warnings; values remain separated by currency.
- Errors: invalid range/account, hidden or archived account as applicable, unsupported cross-currency total.

### `get_courses`

- Purpose: Return the user's active academic terms and courses with concise standing context.
- Arguments: none. Term filtering is deferred.
- Ownership: School RLS and owned-term validation.
- Service: `getSchoolOverview`; the Assistant adapter exposes only the compact standing fields needed for explanation.
- Confirmation: none.
- Result: term and course IDs, codes, names, dates, colors, and deterministic standing summaries.
- Errors: invalid/hidden term, unauthenticated session.

### `get_upcoming_assessments`

- Purpose: Return open School assessments within an inclusive local-date range.
- Arguments: `days` from 1 through 90. Term filtering is deferred.
- Ownership: School query and RLS.
- Service: `getUpcomingAssessments`.
- Confirmation: none.
- Result: assessment/course references, timing shape, exact weight/score inputs, status, and user-entered effort.
- Errors: invalid/excessive range, invalid term, unauthenticated session.

### `get_course_standing`

- Purpose: Return one owned course and deterministic current/target standing calculations.
- Arguments: `courseId`.
- Ownership: `getCourseDetail` loads through RLS; the ID is revalidated.
- Service: `getCourseDetail` plus School grade calculators.
- Confirmation: none.
- Result: course identity, exact earned/graded weights, current standing, warnings, target, and required remaining average where defined.
- Errors: invalid or inaccessible course, incomplete grades, mathematically undefined target, unauthenticated session.

### `get_tasks`

- Purpose: Return owned Tasks under a simple filter.
- Arguments: required `filter` (`all`, `active`, `today`, `upcoming`, `overdue`, `completed`); results are capped at 40 with explicit truncation metadata.
- Ownership: authenticated Tasks query; linked Assessment and Goal data remain RLS-bound.
- Service: `getTasks` and `filterTasks`.
- Confirmation: none.
- Result: Task IDs, title, status, priority, exact due shape, timezone, effort, and optional owned relationship references.
- Errors: invalid filter, unauthenticated session.

### `get_tasks_due_today` / `get_overdue_tasks`

- Purpose: Return active Tasks due on the current profile-local date, or before it.
- Arguments: none.
- Ownership: authenticated Tasks query and RLS.
- Service: `getTasksDueToday` / `getOverdueTasks`.
- Confirmation: none.
- Result: structured Task records plus the local date/timezone used for classification.
- Errors: unauthenticated session, unavailable timezone/profile.

### `get_goals`

- Purpose: Return owned Goals with optional lifecycle filtering and concise related Task/milestone summaries.
- Arguments: required `status` (`all`, `active`, or `completed`); results are capped at 40 with explicit truncation metadata. Category filtering is deferred.
- Ownership: authenticated Goals RLS.
- Service: `getGoals`, `getActiveGoals`, and `sortGoals`.
- Confirmation: none.
- Result: Goal IDs, title, category, status, date-only deadline, exact progress inputs, and relation summaries.
- Errors: invalid filter, unauthenticated session.

### `get_goal_progress`

- Purpose: Return one owned Goal's authoritative manual progress and deterministic summary.
- Arguments: `goalId`.
- Ownership: `getGoal` revalidates access through RLS.
- Service: `getGoal` plus `getGoalProgress` / `summarizeGoal`.
- Confirmation: none.
- Result: progress mode, exact current/target values, unit, percentage where defined, milestone and Task summaries.
- Errors: invalid or inaccessible Goal, unavailable/undefined progress.

### `get_upcoming_goal_deadlines`

- Purpose: Return active dated Goals in deterministic deadline order.
- Arguments: `days` from 1 through 90.
- Ownership: authenticated Goals query and RLS.
- Service: `getUpcomingGoalDeadlines` plus date-only filtering.
- Confirmation: none.
- Result: Goal IDs, titles, date-only deadlines, categories, status, and exact progress summaries.
- Errors: invalid range, unauthenticated session.

## Confirmed Task mutation proposals

These three functions are model-callable in Phase 7C, but calls only create a validated ten-minute confirmation proposal. Exact arguments remain in a bounded process-local server registry behind an opaque random token. A distinct authenticated confirmation request on the Assistant endpoint consumes that token once and calls the shared Task mutation service. The model never executes the service directly.

### `create_task`

- Purpose/arguments: create a Task from `title`, optional description, priority, due-date-or-instant shape, effort minutes, owned `assessmentId`, and owned `goalId`.
- Ownership/service: `createTask` derives ownership from authenticated context and validates optional owned Goal and Assessment links.
- Confirmation: always required; ambiguity is resolved before proposal. Recurrence and batches are refused.
- Result: created Task ID and normalized fields.
- Errors: validation, invalid date shape, inaccessible relationship ID, conflict, unexpected failure.

### `update_task` / `set_task_status`

- Purpose/arguments: update explicitly supplied fields for `taskId`, or set completed/reopened state.
- Ownership/service: the exact owned active Task ID is revalidated; shared `updateTask` and `setTaskStatus` services apply an `updated_at` stale-write precondition. The database trigger owns completion timestamps.
- Confirmation: always required. Todo, In progress, Completed, and reopen-to-Todo are supported; ambiguous duplicate titles produce no proposal.
- Result: updated Task ID, status, completion timestamp, and changed fields.
- Errors: validation, inaccessible/not-found Task, invalid relationship, conflict.

## Confirmed native Calendar mutation proposals

`create_calendar_event` and `update_calendar_event` use the same ten-minute, opaque, user-bound, one-shot confirmation registry as Task mutations. They never execute inside the model loop. The trusted proposal layer validates exact inputs, stores them server-side, and builds previews from validated values plus authoritative current data.

### `create_calendar_event`

- Purpose/arguments: create one native non-recurring event with title, optional type/description/location, and either inclusive date-only start/end dates or explicit local start/end wall times.
- Ownership/service: `createNativeCalendarEvent` derives the owner from `AuthenticatedAppContext`, uses ordinary RLS-bound access, and reuses Calendar validation and timezone conversion. No `userId`, recurrence, reminder, archive, or delete input exists.
- Confirmation: always required. Timed requests without an end time or duration must be clarified; no default duration is invented.
- Result: normalized native event fields plus a server-derived trusted Calendar reference.
- Errors: invalid or nonexistent local time, invalid ordering/date shape, authentication/RLS failure, or unexpected storage failure.

### `update_calendar_event`

- Purpose/arguments: edit explicitly supplied supported fields on exactly one owned, active, native, non-recurring event.
- Ownership/service: proposal lookup constrains `calendar_events` by event ID, authenticated owner, and non-archived state. `updateNativeCalendarEvent` repeats ownership checks and applies proposal-time `updated_at` optimistically. Existing reminders are preserved because reminder editing is outside Assistant scope.
- Confirmation: always required. Preview before/after values come from authoritative current data and validated normalized arguments. A stale row requires a new proposal.
- Result: normalized event fields plus a trusted `/calendar/events/{id}` reference.
- Errors: hidden/missing/foreign/projected event, recurring event, invalid time/date transition, stale conflict, or unexpected storage failure.

Finance, School, Task, and Goal Calendar items are projections rather than native `calendar_events` rows. Their source IDs cannot authorize native writes and must be edited in their owning domains. Recurring native series and individual occurrences are also rejected. Shared Calendar aggregation and Dashboard queries require no Assistant-specific path.

## Future mutation designs — unavailable

### `create_goal` / `update_goal`

- Purpose/arguments: create or update title, description, category, date-only deadline, status, and exact manual progress fields.
- Ownership/service: session ownership; adapters over `saveGoal` validation/mutation.
- Confirmation: explicit intent; confirm completion, archival, large/batch edits, or ambiguous progress replacement.
- Result: Goal ID, normalized lifecycle, deadline, and exact progress values.
- Errors: invalid progress-mode shape, invalid date/category, inaccessible Goal, conflict.

### `create_finance_transaction`

- Purpose/arguments: record one transaction using owned `accountId`, direction, positive exact `amount`, currency/account semantics, date, optional owned category, payee, description, and notes.
- Ownership/service: account/category IDs are revalidated; adapter over `createTransaction` and Finance validation. The model never supplies ownership or a signed ledger amount directly.
- Confirmation: always require an explicit final summary of account, direction, exact amount/currency, date, and payee before execution.
- Result: transaction ID and authoritative signed effect plus affected account-balance result.
- Errors: invalid/zero amount, currency mismatch, inaccessible/archive account/category, invalid date, conflict.

### Later sensitive Finance tools

`create_transfer` and `change_budget` are deliberately not part of the minimum V1 mutation surface. If approved later, both require stronger confirmation. A transfer confirmation must name both owned accounts, same currency, exact amount, and date and must call the existing atomic transfer boundary. A budget confirmation must identify month, category/overall scope, exact limit, and replacement effect. Neither operation may be decomposed into arbitrary table writes.

## Untrusted data and OpenAI boundary

Task and Goal descriptions, School notes/resources, Calendar descriptions, merchant/payee text, and all future imported email, web, LMS, syllabus, or document content are data. They may contain text that resembles instructions, but cannot alter system policy, enabled tools, confirmation requirements, or tool arguments. Tool responses should label and delimit stored/external content and keep trusted IDs and authoritative values in separate fields.

OpenAI code lives in `features/assistant/server/` behind the narrow authenticated `POST /api/assistant` Route Handler. One server configuration module owns model choice, reasoning level, output limits, and enabled tools. `OPENAI_API_KEY` stays server-only and is never named with `NEXT_PUBLIC_`. Tool handlers call the services above and never accept SQL, use a service-role key, or expose arbitrary database access.

Context is fetched just in time through targeted tools with bounded ranges and compact results. The Assistant must not preload the full database. Domain services remain authoritative for money, grades, recurrence, overdue classification, and Goal progress; the model explains results rather than recalculating them. Conversation persistence (`assistant_threads` / `assistant_messages`) remains deferred until retention, deletion/export, tool-call metadata, memory semantics, and RLS requirements are deliberately designed.
