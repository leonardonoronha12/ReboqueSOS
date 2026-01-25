import { NextResponse } from "next/server";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

function stripSslMode(dbUrl: string) {
  try {
    const url = new URL(dbUrl);
    url.searchParams.delete("sslmode");
    return url.toString();
  } catch {
    return dbUrl;
  }
}

function buildDbUrl(input: { dbUrl?: string; projectRef?: string; dbPassword?: string }) {
  const direct = input.dbUrl?.trim() || "";
  if (direct) return stripSslMode(direct);

  const ref = input.projectRef?.trim() || "";
  const password = input.dbPassword || "";
  if (!ref || !password) return "";

  const encoded = encodeURIComponent(password);
  return `postgresql://postgres:${encoded}@db.${ref}.supabase.co:5432/postgres`;
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Disponível apenas em desenvolvimento." }, { status: 403 });
  }

  let body: { dbUrl?: string; projectRef?: string; dbPassword?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const dbUrl = buildDbUrl({
    dbUrl: body.dbUrl || process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "",
    projectRef: body.projectRef || process.env.SUPABASE_PROJECT_REF || "",
    dbPassword: body.dbPassword || process.env.SUPABASE_DB_PASSWORD || "",
  });

  if (!dbUrl) {
    return NextResponse.json(
      {
        error:
          "Configure SUPABASE_DB_URL ou (SUPABASE_PROJECT_REF + SUPABASE_DB_PASSWORD) para eu aplicar a migração automaticamente.",
      },
      { status: 400 },
    );
  }

  const sqlPath = path.join(process.cwd(), "supabase", "migrations", "0004_partner_kyc.sql");
  const sql = await readFile(sqlPath, { encoding: "utf8" });

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.query(sql);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao aplicar migração." }, { status: 500 });
  } finally {
    await client.end().catch(() => null);
  }
}

