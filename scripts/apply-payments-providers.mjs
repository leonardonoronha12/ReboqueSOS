import fs from "node:fs";
import path from "node:path";

import { Client } from "pg";

function readEnvLocal(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  const content = fs.readFileSync(filePath, { encoding: "utf8" });
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    out[k] = v;
  }
  return out;
}

function buildDbUrl(env) {
  const direct = String(env.SUPABASE_DB_URL || env.DATABASE_URL || "").trim();
  if (direct && !direct.startsWith("http://") && !direct.startsWith("https://")) return direct;

  const ref = String(env.SUPABASE_PROJECT_REF || "").trim();
  const password = String(env.SUPABASE_DB_PASSWORD || "").trim();
  if (!ref || !password) return "";
  return `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;
}

const root = process.cwd();
const envPath = path.join(root, ".env.local");
const env = readEnvLocal(envPath);
const dbUrl = buildDbUrl(env);

if (!dbUrl) {
  console.error("Missing SUPABASE_DB_URL or (SUPABASE_PROJECT_REF + SUPABASE_DB_PASSWORD) in .env.local");
  process.exit(1);
}

const sqlPath = path.join(root, "supabase", "migrations", "0008_payments_providers.sql");
const sql = fs.readFileSync(sqlPath, { encoding: "utf8" });

const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  await client.query("begin");
  await client.query(sql);
  await client.query("notify pgrst, 'reload schema';");
  await client.query("notify pgrst, 'reload config';");
  await client.query("commit");

  const q = `
    select column_name, is_nullable
    from information_schema.columns
    where table_schema='public'
      and table_name='payments'
      and column_name in ('stripe_intent_id','provider','provider_payment_id','method','status')
    order by column_name;
  `;
  const { rows } = await client.query(q);
  console.log("payments columns:", rows);
} catch (e) {
  await client.query("rollback").catch(() => null);
  console.error("Migration failed:", e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => null);
}

