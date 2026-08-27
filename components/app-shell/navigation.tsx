"use client";

import {
  BarChart3,
  Bot,
  CalendarDays,
  CheckSquare2,
  CircleUserRound,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Target,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { logout } from "@/features/auth/actions";
import { cn } from "@/lib/utils";

const navigationItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, ready: true },
  { href: "/finance", label: "Finance", icon: WalletCards, ready: true },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, ready: true },
  { href: "/school", label: "School", icon: GraduationCap, ready: true },
  { href: "/tasks", label: "Tasks", icon: CheckSquare2, ready: true },
  { href: "/goals", label: "Goals", icon: Target, ready: true },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/assistant", label: "AI Assistant", icon: Bot, ready: true },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

const mobileItems = navigationItems.filter(({ href }) =>
  ["/dashboard", "/finance", "/calendar", "/school", "/tasks", "/goals"].includes(href),
);

function NavLink({ item, compact = false }: { item: (typeof navigationItems)[number]; compact?: boolean }) {
  const pathname = usePathname();
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={cn(
        compact
          ? "flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[0.625rem] font-medium"
          : "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      href={item.href}
    >
      <Icon className={compact ? "size-5" : "size-4"} />
      <span>{item.label}</span>
      {!compact && !("ready" in item && item.ready) ? (
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[0.625rem] font-medium text-muted-foreground">Soon</span>
      ) : null}
    </Link>
  );
}

export function DesktopSidebar({ email, displayName }: { email: string | null; displayName: string | null }) {
  const initial = (displayName ?? email ?? "U").trim().charAt(0).toUpperCase();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-sidebar md:flex">
      <div className="flex h-18 items-center gap-3 border-b px-5">
        <BrandMark className="size-9 rounded-lg" />
        <span className="font-semibold tracking-tight">LifeStack</span>
      </div>
      <nav aria-label="Primary navigation" className="flex-1 space-y-1 overflow-y-auto p-3">
        {navigationItems.map((item) => <NavLink item={item} key={item.href} />)}
      </nav>
      <div className="border-t p-3">
        <div className="mb-2 flex min-w-0 items-center gap-3 rounded-lg px-2 py-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">{initial}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{displayName ?? "Your account"}</p>
            <p className="truncate text-xs text-muted-foreground">{email ?? "Signed in"}</p>
          </div>
        </div>
        <form action={logout}>
          <Button className="w-full justify-start" type="submit" variant="ghost"><LogOut /> Sign out</Button>
        </form>
      </div>
    </aside>
  );
}

export function MobileHeader({ displayName }: { displayName: string | null }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur md:hidden">
      <Link className="flex items-center gap-2.5" href="/dashboard">
        <BrandMark className="size-8 rounded-lg" />
        <span className="font-semibold tracking-tight">LifeStack</span>
      </Link>
      <details className="group relative">
        <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-lg hover:bg-muted [&::-webkit-details-marker]:hidden">
          <Menu className="size-5 group-open:hidden" />
          <CircleUserRound className="hidden size-5 group-open:block" />
          <span className="sr-only">Open account menu</span>
        </summary>
        <div className="absolute right-0 top-12 w-64 rounded-xl border bg-popover p-2 shadow-xl">
          <p className="px-3 py-2 text-sm font-medium">{displayName ?? "Your account"}</p>
          <div className="my-1 border-t" />
          {navigationItems.slice(3, 8).map((item) => <NavLink item={item} key={item.href} />)}
          <form action={logout} className="mt-1 border-t pt-1">
            <Button className="w-full justify-start" type="submit" variant="ghost"><LogOut /> Sign out</Button>
          </form>
        </div>
      </details>
    </header>
  );
}

export function MobileBottomNav() {
  return (
    <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t bg-card/95 px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur md:hidden">
      {mobileItems.map((item) => <NavLink compact item={item} key={item.href} />)}
    </nav>
  );
}
