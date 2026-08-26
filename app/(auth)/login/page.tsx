import type { Metadata } from "next";

import { login } from "@/features/auth/actions";
import { AuthForm } from "@/features/auth/auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const params = await searchParams;
  return (
    <>
      <div className="mb-7 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Sign in to open your private workspace.</p>
      </div>
      {params.error === "confirmation" ? <p className="mb-5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">That confirmation link is invalid or expired. Please sign up again or request a new link.</p> : null}
      <AuthForm action={login} mode="login" next={params.next} />
    </>
  );
}
