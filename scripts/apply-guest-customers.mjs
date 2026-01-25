import { readFile } from "node:fs/promises";
import path from "node:path";

import { Client } from "pg";

function parseEnvLines(text) {
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

async function loadDotEnv() {
  const candidates = [".env.local", ".env"];
  for (const file of candidates) {
    try {
      const content = await readFile(path.join(process.cwd(), file), { encoding: "utf8" });
      const parsed = parseEnvLines(content);
      for (const [k, v] of Object.entries(parsed)) {
        if (process.env[k] == null || process.env[k] === "") process.env[k] = v;
      }
    } catch {
      continue;
    }
  }
}

function buildDbUrl() {
  const direct = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "";
  if (direct) return direct;

  const ref = process.env.SUPABASE_PROJECT_REF || "";
  const pw = process.env.SUPABASE_DB_PASSWORD || "";
  if (!ref || !pw) return "";

  return `postgresql://postgres:${encodeURIComponent(pw)}@db.${ref}.supabase.co:5432/postgres`;
}

async function main() {
  await loadDotEnv();
  const dbUrl = buildDbUrl();
  if (!dbUrl) throw new Error("Missing DB env (SUPABASE_DB_URL or SUPABASE_PROJECT_REF + SUPABASE_DB_PASSWORD).");

  const sqlPath = path.join(process.cwd(), "supabase", "migrations", "0003_guest_customers.sql");
  const sql = await readFile(sqlPath, { encoding: "utf8" });

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query(sql);
    const r = await client.query(
      "select column_name, is_nullable from information_schema.columns where table_schema='public' and table_name='tow_requests' and column_name in ('cliente_id','cliente_nome') order by column_name;",
    );
    process.stdout.write(`OK: ${r.rows.map((x) => `${x.column_name} nullable=${x.is_nullable}`).join(" | ")}\n`);
  } finally {
    await client.end().catch(() => null);
  }
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : "unknown";
  process.stdout.write(`ERR: ${msg}\n`);
  process.exit(1);
});

