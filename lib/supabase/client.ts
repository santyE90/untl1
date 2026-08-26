import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export function createClient() {
  const { url, publishableKey } = getSupabasePublicEnv();

  return createBrowserClient<Database>(url, publishableKey);
}
