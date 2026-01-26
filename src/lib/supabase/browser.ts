import { createBrowserClient } from "@supabase/ssr";

import { getOptionalEnvAny } from "@/lib/env";

export function createSupabaseBrowserClient(input?: { url?: string; anonKey?: string }) {
  const url = input?.url ?? getOptionalEnvAny(["NEXT_PUBLIC_SUPABASE_URL"]);
  const anonKey = input?.anonKey ?? getOptionalEnvAny(["NEXT_PUBLIC_SUPABASE_ANON_KEY"]);

  if (!url || !anonKey) {
    throw new Error("Supabase não configurado no navegador.");
  }

  return createBrowserClient(url, anonKey);
}
