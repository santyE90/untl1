import { ArrowRight, CalendarDays, CheckCircle2, WalletCards } from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

const pillars = [
  { icon: CalendarDays, title: "One connected timeline", description: "Bring schedules, deadlines, bills, and tasks into one calm daily view." },
  { icon: WalletCards, title: "Clear financial context", description: "Build an auditable picture of accounts, spending, budgets, and upcoming costs." },
  { icon: CheckCircle2, title: "Focus on what matters", description: "See the next useful action without being buried under every metric at once." },
];

export default function Home() {
  return (
    <main className="min-h-svh overflow-hidden">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <Link className="flex items-center gap-3" href="/">
          <BrandMark className="size-9 rounded-lg" />
          <span className="font-semibold tracking-tight">LifeStack</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button render={<Link href="/login">Sign in</Link>} variant="ghost" />
          <Button render={<Link href="/signup">Get started</Link>} />
        </div>
      </header>

      <section className="relative mx-auto grid w-full max-w-6xl gap-14 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-24">
        <div className="absolute left-1/2 top-0 -z-10 h-96 w-[50rem] -translate-x-1/2 rounded-full bg-brand-secondary/25 blur-3xl" />
        <div>
          <p className="mb-5 inline-flex rounded-full border bg-card/80 px-3 py-1 text-sm font-medium text-primary shadow-sm">Your day, connected</p>
          <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-0.035em] sm:text-6xl">A calmer way to organize the moving parts of life.</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">LifeStack is becoming one secure home for finances, schedules, school, tasks, and goals—with each part designed to work together.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button className="h-11 px-5" render={<Link href="/signup">Create your account <ArrowRight /></Link>} />
            <Button className="h-11 px-5" render={<Link href="/login">I already have an account</Link>} variant="outline" />
          </div>
        </div>

        <div className="rounded-3xl border bg-card/90 p-4 shadow-[0_28px_90px_rgba(76,44,88,0.14)] backdrop-blur sm:p-6">
          <div className="rounded-2xl bg-background p-5 sm:p-7">
            <p className="text-sm font-medium text-primary">Your daily command centre</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Good morning.</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Start with what matters today, then move into the detail when you need it.</p>
            <div className="mt-6 space-y-3">
              {pillars.map(({ icon: Icon, title, description }) => (
                <div className="flex gap-4 rounded-xl border bg-card p-4" key={title}>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary"><Icon className="size-5" /></span>
                  <div>
                    <h3 className="text-sm font-semibold">{title}</h3>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
