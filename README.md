# Life Organizer

Life Organizer is a responsive personal life-management platform that will connect finances, calendar events, school, tasks, goals, analytics, notifications, and a controlled AI assistant.

The current milestone provides the visual foundation, public email/password registration, Supabase cookie-based sessions, protected application routes, a responsive navigation shell, and an honest empty-state dashboard. Finance and the other product modules are intentionally not implemented yet.

See [docs/project-architecture.md](docs/project-architecture.md) for the detailed product direction, architecture, schema plan, security model, and roadmap.

## Technology

- Next.js 16 App Router, React 19, and TypeScript
- Tailwind CSS 4 and shadcn/ui Vega components
- Supabase Auth and PostgreSQL with Row Level Security
- Zod validation and Vitest
- Recharts, Lucide, and the OpenAI SDK for later milestones

No OpenAI request is made by the current application.

## Requirements

- Node.js compatible with Next.js 16
- npm
- A Supabase project
- Docker Desktop only if using the optional local Supabase stack

## Environment setup

Copy `.env.example` to `.env.local` and replace the placeholders:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
OPENAI_API_KEY=
```

`NEXT_PUBLIC_SUPABASE_URL` and the publishable key are intentionally browser-visible. Database grants and RLS protect private data. `OPENAI_API_KEY` is server-only and should remain blank until the AI milestone.

Never commit `.env.local` or real credentials.

## Hosted Supabase setup

The repository contains the migration, but it is not automatically applied to the hosted project.

### Apply the migration

Choose one method:

1. Open the Supabase SQL Editor and run the complete contents of `supabase/migrations/20260826000100_create_profiles.sql`.
2. Or link the CLI and push the migration:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npm run db:push
```

The migration creates the private `profiles` table, fixed defaults, signup trigger, least-privilege grants, RLS policies, and audit timestamp behavior. Existing Auth users are backfilled.

### Configure authentication

In the Supabase dashboard:

1. Under Authentication → Providers → Email, keep email/password enabled and public signup enabled.
2. Keep email confirmation enabled for the hosted project.
3. Under Authentication → URL Configuration:
   - Set the development Site URL to `http://localhost:3000`.
   - Add `http://localhost:3000/auth/confirm` to Redirect URLs.
   - When deployed, add the production origin and `https://your-domain/auth/confirm` as well.
4. The default confirmation template works with the `/auth/confirm` code-exchange endpoint. If the project uses custom SMTP and you want a direct token-hash link, you may optionally change Authentication → Email Templates → Confirm signup to:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Confirm your email</a>
```

The default hosted email service is suitable only for limited development testing. Configure production SMTP before inviting real users broadly. Custom template editing may require custom SMTP depending on the Supabase plan.

After applying the hosted migration and linking the CLI, regenerate committed database types:

```bash
npm run db:types:linked
```

## Run the application

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Quality commands

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Run the complete application check with:

```bash
npm run check
```

## Local Supabase workflow

With Docker Desktop running:

```bash
npm run db:start
npm run db:reset
npm run db:test
npm run db:types:local
npm run db:stop
```

`db:reset` recreates the local database from migrations. `db:test` runs the pgTAP isolation suite under `supabase/tests/database`. Local Auth emails are captured by Mailpit; `npx supabase status` prints its URL and the local API credentials.

Do not assume local migrations have affected the hosted project. Hosted changes require `db:push` after linking or an explicit SQL Editor run.

## Repository map

```text
app/                 routes, layouts, and HTTP boundaries
components/          shared and shadcn UI
features/            feature-owned actions, schemas, services, and UI
lib/                 auth, environment, and Supabase infrastructure
supabase/migrations/ versioned database changes
supabase/tests/      pgTAP database and RLS tests
types/database.ts    generated Supabase database types
docs/                durable architecture and project decisions
```

## Current security boundaries

- The Next.js proxy refreshes sessions and performs optimistic redirects.
- Protected layouts and every mutation independently verify identity.
- Server Actions validate untrusted form inputs with Zod.
- Post-login redirect values are restricted to known internal protected routes.
- PostgreSQL grants and RLS enforce profile ownership.
- The browser never receives a service-role key or OpenAI key.

## Current scope

Implemented:

- Landing, signup, login, email confirmation, logout, and protected sessions
- Responsive desktop and mobile authenticated navigation
- Dashboard and honest upcoming-module placeholders
- Profiles migration, RLS policies, database isolation tests, and type workflow
- Semantic light-theme tokens with a future dark-theme contract

Not implemented:

- Finance, calendar, school, tasks, goals, analytics, notifications, or AI behavior
- Password reset, magic links, social login, or MFA
- Production email delivery
