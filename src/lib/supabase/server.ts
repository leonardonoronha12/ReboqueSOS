import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

import { getRequiredEnvAny } from "@/lib/env";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    getRequiredEnvAny(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]),
    getRequiredEnvAny(["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"]),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const cookie of cookiesToSet) {
            try {
              cookieStore.set(cookie);
            } catch {
              return;
            }
          }
        },
      },
    },
  );
}
