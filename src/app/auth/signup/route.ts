import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const nome = String(formData.get("nome") ?? "");
  const telefone = String(formData.get("telefone") ?? "");
  const role = "reboque" as UserRole;

  const supabaseServer = await createSupabaseServerClient();
  const { data, error } = await supabaseServer.auth.signUp({ email, password });

  if (error || !data.user) {
    return NextResponse.redirect(new URL(`/signup?error=${encodeURIComponent(error?.message ?? "Falha no cadastro")}`, request.url), 303);
  }

  const supabaseAdmin = createSupabaseAdminClient();
  await supabaseAdmin.from("users").upsert({
    id: data.user.id,
    nome,
    telefone: telefone || null,
    role,
  });

  const empresaNome = String(formData.get("empresa_nome") ?? nome);
  const cidade = String(formData.get("cidade") ?? "São Gonçalo");
  const whatsappNumber = String(formData.get("whatsapp_number") ?? telefone);
  await supabaseAdmin.from("tow_partners").upsert({
    id: data.user.id,
    empresa_nome: empresaNome,
    cidade,
    whatsapp_number: whatsappNumber || null,
    ativo: true,
  });

  return NextResponse.redirect(new URL("/", request.url), 303);
}
