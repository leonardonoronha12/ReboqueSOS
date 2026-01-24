import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Client } from "pg";

const tablesToCheck = [
  "users",
  "tow_partners",
  "tow_requests",
  "tow_proposals",
  "tow_trips",
  "tow_live_location",
  "payments",
  "tow_ratings",
] as const;

function buildDbUrl(input: { dbUrl?: string; projectRef?: string; dbPassword?: string }) {
  const direct = input.dbUrl?.trim() || "";
  if (direct) return direct;

  const ref = input.projectRef?.trim() || "";
  const password = input.dbPassword || "";
  if (!ref || !password) return "";

  const encoded = encodeURIComponent(password);
  return `postgresql://postgres:${encoded}@db.${ref}.supabase.co:5432/postgres`;
}

async function handleCheck(input?: { dbUrl?: string; projectRef?: string; dbPassword?: string }) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Disponível apenas em desenvolvimento." }, { status: 403 });
  }

  const rawDirectDbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "";
  const safeDirectDbUrl =
    rawDirectDbUrl.startsWith("http://") || rawDirectDbUrl.startsWith("https://") ? "" : rawDirectDbUrl;
  const serverProjectRef = process.env.SUPABASE_PROJECT_REF || "";
  const serverDbPassword = process.env.SUPABASE_DB_PASSWORD || "";

  const inputDbUrl = input?.dbUrl?.trim() || "";
  const inputProjectRef = input?.projectRef?.trim() || "";
  const inputDbPassword = input?.dbPassword || "";

  const dbUrl = buildDbUrl({
    dbUrl: inputDbUrl || safeDirectDbUrl,
    projectRef: inputProjectRef || serverProjectRef,
    dbPassword: inputDbPassword || serverDbPassword,
  });

  const env = {
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    SUPABASE_DB_URL: Boolean(dbUrl),
    SUPABASE_PROJECT_REF: Boolean(inputProjectRef || serverProjectRef),
    SUPABASE_DB_PASSWORD: Boolean(inputDbPassword || serverDbPassword),
  };

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        ok: false,
        env,
        tables: [],
        error: "Faltam env do Supabase no servidor. Se você preencheu no formulário, clique em \"Escrever .env.local\".",
      },
      { status: 200 },
    );
  }

  if (dbUrl) {
    const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      const { rows } = await client.query<{ table_name: string }>(
        `
        select table_name
        from information_schema.tables
        where table_schema = 'public'
      `,
      );
      const names = new Set(rows.map((r) => r.table_name));
      const results = tablesToCheck.map((table) => ({
        table,
        ok: names.has(table),
        error: names.has(table) ? null : `Tabela public.${table} não encontrada.`,
      }));
      const ok = results.every((r) => r.ok);
      return NextResponse.json({ ok, env, tables: results }, { status: 200 });
    } catch (e) {
      return NextResponse.json(
        { ok: false, env, tables: [], error: e instanceof Error ? e.message : "Falha ao checar banco." },
        { status: 200 },
      );
    } finally {
      await client.end().catch(() => null);
    }
  }

  const supabaseAdmin = createSupabaseAdminClient();

  const results = await Promise.all(
    tablesToCheck.map(async (table) => {
      const { error } = await supabaseAdmin.from(table).select("*").limit(1);
      return {
        table,
        ok: !error,
        error: error?.message ?? null,
      };
    }),
  );

  const ok = results.every((r) => r.ok);

  return NextResponse.json({ ok, env, tables: results }, { status: 200 });
}

export async function GET() {
  return handleCheck();
}

export async function POST(request: Request) {
  let body: { dbUrl?: string; projectRef?: string; dbPassword?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  return handleCheck(body);
}
