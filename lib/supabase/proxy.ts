import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { isAuthPath, isProtectedPath } from "@/lib/auth/paths";
import { getSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabasePublicEnv();
  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headersToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });

        Object.entries(headersToSet).forEach(([name, value]) => {
          response.headers.set(name, value);
        });
      },
    },
  });

  // Keep this immediately after client creation. It verifies the JWT and lets
  // the SSR client refresh session cookies when needed.
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);
  const pathname = request.nextUrl.pathname;

  if (!isAuthenticated && isProtectedPath(pathname)) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/login";
    destination.search = "";
    destination.searchParams.set("next", pathname);
    return NextResponse.redirect(destination);
  }

  if (isAuthenticated && isAuthPath(pathname)) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/dashboard";
    destination.search = "";
    return NextResponse.redirect(destination);
  }

  return response;
}
