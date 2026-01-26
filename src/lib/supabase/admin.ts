import { createClient } from "@supabase/supabase-js";

import { getRequiredEnvAny } from "@/lib/env";

export function createSupabaseAdminClient() {
  return createClient(
    getRequiredEnvAny(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]),
    getRequiredEnvAny(["SUPABASE_SERVICE_ROLE_KEY"]),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
