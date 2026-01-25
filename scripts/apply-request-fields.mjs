import { Client } from "pg";

function buildDbUrl() {
  const direct = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "";
  if (direct) return direct;

  const ref = process.env.SUPABASE_PROJECT_REF || "";
  const pw = process.env.SUPABASE_DB_PASSWORD || "";
  if (!ref || !pw) return "";

  return `postgresql://postgres:${encodeURIComponent(pw)}@db.${ref}.supabase.co:5432/postgres`;
}

async function main() {
  const dbUrl = buildDbUrl();
  if (!dbUrl) throw new Error("Missing DB env");

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query("alter table public.tow_requests add column if not exists telefone_cliente text;");
    await client.query("alter table public.tow_requests add column if not exists modelo_veiculo text;");
    const r = await client.query(
      "select column_name from information_schema.columns where table_schema='public' and table_name='tow_requests' and column_name in ('telefone_cliente','modelo_veiculo') order by column_name;",
    );
    const cols = r.rows.map((x) => x.column_name).join(", ");
    process.stdout.write(`OK columns: ${cols}\n`);
  } finally {
    await client.end().catch(() => null);
  }
}

main().catch((e) => {
  const code = typeof e === "object" && e && "code" in e ? String(e.code) : "";
  const msg = e instanceof Error ? e.message : "unknown";
  process.stdout.write(`ERR${code ? ` (${code})` : ""}: ${msg}\n`);
  process.exit(1);
});
