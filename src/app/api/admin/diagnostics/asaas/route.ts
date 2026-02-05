import { NextResponse } from "next/server";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";

function digitsOnly(value: string) {
  return value.replace(/\D+/g, "");
}

function extractAsaasErrors(input: unknown) {
  const errors = (input as { errors?: Array<{ code?: unknown; description?: unknown }> } | null)?.errors;
  const list = Array.isArray(errors) ? errors : [];
  return list
    .map((e) => ({
      code: typeof e?.code === "string" ? e.code.trim() : null,
      description: typeof e?.description === "string" ? e.description.trim() : null,
    }))
    .slice(0, 12);
}

function getAsaasEnv() {
  return process.env.ASAAS_ENV ? String(process.env.ASAAS_ENV).trim().toLowerCase() : "";
}

function getAsaasBaseUrl() {
  const env = getAsaasEnv();
  if (process.env.ASAAS_BASE_URL) return String(process.env.ASAAS_BASE_URL);
  if (env === "sandbox") return "https://api-sandbox.asaas.com";
  return "https://api.asaas.com";
}

function getAsaasApiKey() {
  return process.env.ASAAS_API_KEY ? String(process.env.ASAAS_API_KEY).trim() : "";
}

async function asaasFetch(path: string, init?: RequestInit) {
  const apiKey = getAsaasApiKey();
  if (!apiKey) return { ok: false as const, status: 500, json: null as unknown, text: "Asaas não configurado." };
  const base = getAsaasBaseUrl();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      access_token: apiKey,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json, text };
}

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const url = new URL(request.url);
  const cpfCnpj = digitsOnly(url.searchParams.get("cpfCnpj") ?? "");

  const base_url_used = getAsaasBaseUrl();
  const env = getAsaasEnv() || null;
  const api_key_configured = Boolean(getAsaasApiKey());

  const myAccountRes = await asaasFetch("/v3/myAccount", { method: "GET" });

  const customerProbeRes =
    cpfCnpj.length === 11 || cpfCnpj.length === 14
      ? await asaasFetch("/v3/customers", {
          method: "POST",
          body: JSON.stringify({
            name: "ReboqueSOS Diagnóstico",
            cpfCnpj,
            externalReference: `diag-${Date.now()}`,
          }),
        })
      : null;

  return NextResponse.json(
    {
      asaas: {
        api_key_configured,
        env,
        base_url_used,
      },
      myAccount: {
        ok: myAccountRes.ok,
        status: myAccountRes.status,
        errors: extractAsaasErrors(myAccountRes.json),
        raw: myAccountRes.ok ? myAccountRes.json : null,
        text: myAccountRes.ok ? null : myAccountRes.text?.slice?.(0, 500) ?? null,
      },
      customerProbe: customerProbeRes
        ? {
            ok: customerProbeRes.ok,
            status: customerProbeRes.status,
            errors: extractAsaasErrors(customerProbeRes.json),
            raw: customerProbeRes.ok ? customerProbeRes.json : null,
            text: customerProbeRes.ok ? null : customerProbeRes.text?.slice?.(0, 500) ?? null,
          }
        : null,
    },
    { status: 200 },
  );
}

