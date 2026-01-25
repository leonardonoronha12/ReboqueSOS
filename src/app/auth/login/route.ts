import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserProfile } from "@/lib/auth/getProfile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { translateAuthError } from "@/lib/auth/translateAuthError";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "");
  const telefone = String(formData.get("telefone") ?? "");
  const password = String(formData.get("password") ?? "");

  const identifier = (telefone || email).trim();
  const looksLikeEmail = identifier.includes("@");

  let emailToUse = looksLikeEmail ? identifier : "";

  if (!emailToUse) {
    const digits = identifier.replace(/\D/g, "");
    if (!digits) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("Informe seu telefone.")}`, request.url), 303);
    }

    const supabaseAdmin = createSupabaseAdminClient();

    const { data: rows1, error: e1 } = await supabaseAdmin.from("users").select("id").eq("telefone", digits).limit(2);
    if (e1) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(e1.message)}`, request.url), 303);
    }

    let rows = rows1 ?? [];
    if (rows.length === 0 && identifier) {
      const { data: rows2, error: e2 } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("telefone", identifier)
        .limit(2);
      if (e2) {
        return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(e2.message)}`, request.url), 303);
      }
      rows = rows2 ?? [];
    }

    if (rows.length !== 1) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent("Telefone não encontrado.")}`, request.url),
        303,
      );
    }

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.getUserById(rows[0].id);
    if (userErr || !userRes.user?.email) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent("Não foi possível localizar seu email de login.")}`, request.url),
        303,
      );
    }

    emailToUse = userRes.user.email;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: emailToUse, password });

  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(translateAuthError(error.message))}`, request.url), 303);
  }

  const userId = data.user?.id;
  if (userId) {
    const profile = await getUserProfile(userId);
    if (profile?.role === "admin") {
      return NextResponse.redirect(new URL("/admin", request.url), 303);
    }
    if (profile?.role === "reboque") {
      return NextResponse.redirect(new URL("/partner", request.url), 303);
    }
  }

  return NextResponse.redirect(new URL("/", request.url), 303);
}
