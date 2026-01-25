import { NextResponse } from "next/server";

import { translateAuthError } from "@/lib/auth/translateAuthError";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

function normalizeCpf(raw: string) {
  const digits = raw.replace(/\D/g, "");
  return digits;
}

function normalizeBrPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  return digits;
}

function guessExtension(file: File) {
  const name = file.name || "";
  const dot = name.lastIndexOf(".");
  if (dot > -1 && dot < name.length - 1) {
    const ext = name.slice(dot + 1).toLowerCase();
    if (/^[a-z0-9]+$/.test(ext) && ext.length <= 5) return ext;
  }
  const type = file.type || "";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const nome = String(formData.get("nome") ?? "");
  const telefone = normalizeBrPhone(String(formData.get("telefone") ?? ""));
  const role = "reboque" as UserRole;
  const cpf = normalizeCpf(String(formData.get("cpf") ?? ""));
  const caminhaoModelo = String(formData.get("caminhao_modelo") ?? "");
  const caminhaoPlaca = String(formData.get("caminhao_placa") ?? "");
  const caminhaoTipo = String(formData.get("caminhao_tipo") ?? "");
  const fotoParceiro = formData.get("foto_parceiro");
  const fotoCaminhao = formData.get("foto_caminhao");

  if (!cpf || cpf.length !== 11) {
    return NextResponse.redirect(
      new URL(`/signup?error=${encodeURIComponent("CPF inválido.")}`, request.url),
      303,
    );
  }

  if (!caminhaoModelo || !caminhaoPlaca || !caminhaoTipo) {
    return NextResponse.redirect(
      new URL(`/signup?error=${encodeURIComponent("Preencha as informações do caminhão.")}`, request.url),
      303,
    );
  }

  if (!(fotoParceiro instanceof File) || fotoParceiro.size === 0) {
    return NextResponse.redirect(
      new URL(`/signup?error=${encodeURIComponent("Envie a foto do parceiro.")}`, request.url),
      303,
    );
  }

  if (!(fotoCaminhao instanceof File) || fotoCaminhao.size === 0) {
    return NextResponse.redirect(
      new URL(`/signup?error=${encodeURIComponent("Envie a foto do caminhão.")}`, request.url),
      303,
    );
  }

  if (!fotoParceiro.type.startsWith("image/") || !fotoCaminhao.type.startsWith("image/")) {
    return NextResponse.redirect(
      new URL(`/signup?error=${encodeURIComponent("As fotos precisam ser imagens.")}`, request.url),
      303,
    );
  }

  const maxBytes = 8 * 1024 * 1024;
  if (fotoParceiro.size > maxBytes || fotoCaminhao.size > maxBytes) {
    return NextResponse.redirect(
      new URL(`/signup?error=${encodeURIComponent("As fotos devem ter até 8MB.")}`, request.url),
      303,
    );
  }

  const supabaseServer = await createSupabaseServerClient();
  const { data, error } = await supabaseServer.auth.signUp({ email, password });

  if (error || !data.user) {
    return NextResponse.redirect(
      new URL(`/signup?error=${encodeURIComponent(translateAuthError(error?.message ?? "Falha no cadastro"))}`, request.url),
      303,
    );
  }

  const supabaseAdmin = createSupabaseAdminClient();
  await supabaseAdmin.from("users").upsert({
    id: data.user.id,
    nome,
    telefone: telefone || null,
    role,
  });

  const empresaNomeRaw = String(formData.get("empresa_nome") ?? "");
  const empresaNome = empresaNomeRaw.trim() ? empresaNomeRaw.trim() : nome;
  const cidade = String(formData.get("cidade") ?? "São Gonçalo");
  const whatsappNumber = normalizeBrPhone(String(formData.get("whatsapp_number") ?? telefone));

  const bucket = "partner-assets";
  const { error: bucketErr } = await supabaseAdmin.storage.getBucket(bucket);
  if (bucketErr) {
    await supabaseAdmin.storage.createBucket(bucket, { public: false }).catch(() => null);
  }

  const now = Date.now();
  const parceiroExt = guessExtension(fotoParceiro);
  const caminhaoExt = guessExtension(fotoCaminhao);
  const parceiroPath = `partners/${data.user.id}/parceiro-${now}.${parceiroExt}`;
  const caminhaoPath = `partners/${data.user.id}/caminhao-${now}.${caminhaoExt}`;

  try {
    const parceiroBuf = Buffer.from(await fotoParceiro.arrayBuffer());
    const caminhaoBuf = Buffer.from(await fotoCaminhao.arrayBuffer());

    const up1 = await supabaseAdmin.storage.from(bucket).upload(parceiroPath, parceiroBuf, {
      contentType: fotoParceiro.type || "image/jpeg",
      upsert: true,
    });
    if (up1.error) throw new Error(up1.error.message);

    const up2 = await supabaseAdmin.storage.from(bucket).upload(caminhaoPath, caminhaoBuf, {
      contentType: fotoCaminhao.type || "image/jpeg",
      upsert: true,
    });
    if (up2.error) throw new Error(up2.error.message);
  } catch (e) {
    await supabaseAdmin.auth.admin.deleteUser(data.user.id).catch(() => null);
    return NextResponse.redirect(
      new URL(`/signup?error=${encodeURIComponent(e instanceof Error ? e.message : "Falha ao enviar fotos.")}`, request.url),
      303,
    );
  }

  await supabaseAdmin.from("tow_partners").upsert({
    id: data.user.id,
    empresa_nome: empresaNome,
    cidade,
    whatsapp_number: whatsappNumber || null,
    ativo: true,
    cpf,
    caminhao_modelo: caminhaoModelo,
    caminhao_placa: caminhaoPlaca,
    caminhao_tipo: caminhaoTipo,
    foto_parceiro_path: parceiroPath,
    foto_caminhao_path: caminhaoPath,
  });

  return NextResponse.redirect(new URL("/", request.url), 303);
}
