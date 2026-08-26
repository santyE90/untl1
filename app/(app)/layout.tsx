import { DesktopSidebar, MobileBottomNav, MobileHeader } from "@/components/app-shell/navigation";
import { requireAuthenticatedUser } from "@/lib/auth/user";

export default async function ApplicationLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuthenticatedUser();

  return (
    <div className="min-h-svh bg-background">
      <DesktopSidebar displayName={user.displayName} email={user.email} />
      <MobileHeader displayName={user.displayName} />
      <div className="md:pl-64">
        <main className="mx-auto min-h-svh w-full max-w-7xl px-4 pb-24 pt-6 sm:px-6 md:px-8 md:pb-10 md:pt-8">{children}</main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
