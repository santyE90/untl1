import { Suspense } from "react";
import { DesktopSidebar, MobileBottomNav, MobileHeader } from "@/components/app-shell/navigation";
import { ThemeSync } from "@/components/theme-sync";
import { MutationToasts } from "@/components/ui/mutation-toasts";
import { getAuthenticatedAppContext } from "@/features/shared/server-context";

export default async function ApplicationLayout({ children }: { children: React.ReactNode }) {
  const context = await getAuthenticatedAppContext();
  const user = context.user;

  return (
    <div className="min-h-svh bg-background">
      <ThemeSync preference={context.profile.theme_preference as "system" | "light" | "dark"} />
      <Suspense><MutationToasts /></Suspense>
      <DesktopSidebar displayName={user.displayName} email={user.email} />
      <MobileHeader displayName={user.displayName} />
      <div className="md:pl-64">
        <main className="mx-auto min-h-svh w-full max-w-7xl px-4 pb-24 pt-6 sm:px-6 md:px-8 md:pb-10 md:pt-8">{children}</main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
