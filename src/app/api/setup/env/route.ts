import { NextResponse } from "next/server";

import { writeFile } from "node:fs/promises";
import path from "node:path";

const allowedKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_URL",
  "SUPABASE_PROJECT_REF",
  "SUPABASE_DB_PASSWORD",
  "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "ASAAS_API_KEY",
  "ASAAS_ENV",
  "ASAAS_WEBHOOK_TOKEN",
  "WHATSAPP_PROVIDER",
  "WHATSAPP_WEBHOOK_URL",
  "WHATSAPP_WEBHOOK_BEARER",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_WHATSAPP_FROM",
  "ZAPI_BASE_URL",
  "ZAPI_TOKEN",
  "ZAPI_INSTANCE_ID",
  "ZAPI_CLIENT_TOKEN",
] as const;

type AllowedKey = (typeof allowedKeys)[number];

function sanitizeEnvValue(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/\r?\n/g, "").trim();
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Disponível apenas em desenvolvimento." }, { status: 403 });
  }

  const body = (await request.json()) as Record<string, unknown>;

  const pairs: Array<[AllowedKey, string]> = [];
  for (const key of allowedKeys) {
    const value = sanitizeEnvValue(body[key]);
    if (value) pairs.push([key, value]);
  }

  const lines: string[] = [];
  const addGroup = (groupKeys: AllowedKey[]) => {
    let groupHasAny = false;
    for (const k of groupKeys) {
      const pair = pairs.find(([key]) => key === k);
      if (pair) {
        lines.push(`${pair[0]}=${pair[1]}`);
        groupHasAny = true;
      } else {
        lines.push(`${k}=`);
      }
    }
    if (groupHasAny) lines.push("");
  };

  addGroup([
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_DB_URL",
    "SUPABASE_PROJECT_REF",
    "SUPABASE_DB_PASSWORD",
  ]);
  addGroup(["NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"]);
  addGroup(["STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET"]);
  addGroup(["ASAAS_API_KEY", "ASAAS_ENV", "ASAAS_WEBHOOK_TOKEN"]);
  addGroup(["WHATSAPP_PROVIDER", "WHATSAPP_WEBHOOK_URL", "WHATSAPP_WEBHOOK_BEARER"]);
  addGroup(["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_FROM"]);
  addGroup(["ZAPI_BASE_URL", "ZAPI_TOKEN", "ZAPI_INSTANCE_ID", "ZAPI_CLIENT_TOKEN"]);

  const content = `${lines.join("\n").trimEnd()}\n`;

  const envPath = path.join(process.cwd(), ".env.local");
  await writeFile(envPath, content, { encoding: "utf8" });

  return NextResponse.json({ ok: true }, { status: 200 });
}
