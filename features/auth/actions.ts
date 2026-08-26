"use server";

import { redirect } from "next/navigation";

import { getSafeNextPath } from "@/lib/auth/paths";
import { getSiteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

import {
  type AuthActionState,
  loginSchema,
  signupSchema,
} from "./schemas";

function validationError(error: { flatten: () => { fieldErrors: Record<string, string[]> } }) {
  return {
    status: "error" as const,
    message: "Check the highlighted fields and try again.",
    errors: error.flatten().fieldErrors,
  };
}

export async function login(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return {
      status: "error",
      message: "Email or password is incorrect, or the email is not confirmed.",
    };
  }

  redirect(getSafeNextPath(formData.get("next")));
}

export async function signup(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${getSiteUrl()}/auth/confirm`,
    },
  });

  if (error) {
    return {
      status: "error",
      message: "We could not create the account. Please try again shortly.",
    };
  }

  if (data.session) redirect("/dashboard");

  return {
    status: "success",
    message: "Check your email to confirm your account, then sign in.",
  };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
