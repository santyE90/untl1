"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  type AuthActionState,
  initialAuthActionState,
} from "@/features/auth/schemas";

import { FormSubmitButton } from "./form-submit-button";

type AuthFormProps = {
  action: (state: AuthActionState, formData: FormData) => Promise<AuthActionState>;
  mode: "login" | "signup";
  next?: string;
};

const inputClassName =
  "h-11 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/20";

function FieldErrors({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="mt-1.5 text-sm text-destructive" role="alert">{errors[0]}</p>;
}

export function AuthForm({ action, mode, next }: AuthFormProps) {
  const [state, formAction] = useActionState(action, initialAuthActionState);
  const isSignup = mode === "signup";

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {next ? <input name="next" type="hidden" value={next} /> : null}
      {isSignup ? (
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="displayName">Name</label>
          <input aria-describedby="displayName-error" autoComplete="name" className={inputClassName} id="displayName" maxLength={80} name="displayName" placeholder="Your name" required />
          <div id="displayName-error"><FieldErrors errors={state.errors?.displayName} /></div>
        </div>
      ) : null}
      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="email">Email</label>
        <input aria-describedby="email-error" autoCapitalize="none" autoComplete="email" className={inputClassName} id="email" inputMode="email" maxLength={254} name="email" placeholder="you@example.com" required type="email" />
        <div id="email-error"><FieldErrors errors={state.errors?.email} /></div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="password">Password</label>
        <input aria-describedby="password-help password-error" autoComplete={isSignup ? "new-password" : "current-password"} className={inputClassName} id="password" maxLength={72} minLength={8} name="password" required type="password" />
        {isSignup ? <p className="mt-1.5 text-xs text-muted-foreground" id="password-help">Use at least 8 characters.</p> : null}
        <div id="password-error"><FieldErrors errors={state.errors?.password} /></div>
      </div>
      {state.message ? (
        <div className={state.status === "success" ? "rounded-lg bg-success/10 p-3 text-sm text-success" : "rounded-lg bg-destructive/10 p-3 text-sm text-destructive"} role={state.status === "error" ? "alert" : "status"}>
          {state.message}
        </div>
      ) : null}
      <FormSubmitButton>{isSignup ? "Create account" : "Sign in"}</FormSubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        {isSignup ? "Already have an account?" : "New to LifeStack?"}{" "}
        <Button className="h-auto p-0" render={<Link href={isSignup ? "/login" : "/signup"}>{isSignup ? "Sign in" : "Create an account"}</Link>} variant="link" />
      </p>
    </form>
  );
}
