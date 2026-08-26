import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type AuthenticatedUser = {
  id: string;
  email: string | null;
  displayName: string | null;
};

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) {
    return null;
  }

  const metadata =
    claims.user_metadata && typeof claims.user_metadata === "object"
      ? claims.user_metadata
      : null;
  const displayName =
    metadata &&
    "display_name" in metadata &&
    typeof metadata.display_name === "string"
      ? metadata.display_name
      : null;

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    displayName,
  };
}

export async function requireAuthenticatedUser() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
