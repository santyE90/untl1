import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-12 sm:px-6">
      <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_top,var(--brand-secondary),transparent_70%)] opacity-35" />
      <div className="w-full max-w-md">
        <Link className="mb-8 flex items-center justify-center gap-3" href="/">
          <BrandMark />
          <span className="text-lg font-semibold tracking-tight">Life Organizer</span>
        </Link>
        <section className="rounded-2xl border bg-card p-6 shadow-[0_18px_60px_rgba(70,45,78,0.10)] sm:p-8">{children}</section>
      </div>
    </main>
  );
}
