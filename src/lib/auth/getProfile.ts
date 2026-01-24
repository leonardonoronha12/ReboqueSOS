import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types";

export type UserProfile = {
  id: string;
  nome: string;
  telefone: string | null;
  role: UserRole;
};

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id,nome,telefone,role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    nome: data.nome,
    telefone: data.telefone,
    role: data.role as UserRole,
  };
}

