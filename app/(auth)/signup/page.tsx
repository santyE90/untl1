import type { Metadata } from "next";

import { signup } from "@/features/auth/actions";
import { AuthForm } from "@/features/auth/auth-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <>
      <div className="mb-7 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Create your workspace</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Your information stays separated from every other account.</p>
      </div>
      <AuthForm action={signup} mode="signup" />
    </>
  );
}
