import { SetupFormClient } from "./setupFormClient";
import { MigrationSqlClient } from "./migrationSqlClient";

import { readFile } from "node:fs/promises";
import path from "node:path";

function EnvStatusRow(props: { name: string; isSet: boolean; note?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm">
        <div className="font-medium">{props.name}</div>
        {props.note ? <div className="text-xs text-zinc-600">{props.note}</div> : null}
      </div>
      <span
        className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${
          props.isSet ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700"
        }`}
      >
        {props.isSet ? "OK" : "PENDENTE"}
      </span>
    </div>
  );
}

function isEnvSet(name: string) {
  return Boolean(process.env[name]);
}

export default async function SetupPage() {
  const sqlPath = path.join(process.cwd(), "supabase", "migrations", "0001_init.sql");
  const migrationSql = await readFile(sqlPath, { encoding: "utf8" });

  return (
    <div className="space-y-8">
      <div className="rounded-xl border bg-white p-6">
        <h1 className="text-2xl font-semibold">Setup</h1>
        <p className="mt-2 text-sm text-zinc-700">
          Página de configuração do ReboqueSOS: variáveis de ambiente, integrações e checklist do MVP.
        </p>
        <div className="mt-4 rounded-lg border bg-zinc-50 p-4 text-sm text-zinc-700">
          <div className="font-medium">Onde colocar as env</div>
          <div className="mt-2">
            Crie um arquivo <span className="font-medium">.env.local</span> na raiz do projeto{" "}
            <span className="font-medium">reboquesos/</span>.
          </div>
          <div className="mt-2">
            Nunca coloque chaves secretas em variáveis que começam com{" "}
            <span className="font-medium">NEXT_PUBLIC_</span>.
          </div>
        </div>
      </div>

      <SetupFormClient />

      <div className="rounded-xl border bg-white p-6">
        <h2 className="text-lg font-semibold">Checklist rápido</h2>
        <div className="mt-4 grid gap-3">
          <EnvStatusRow name="NEXT_PUBLIC_SUPABASE_URL" isSet={isEnvSet("NEXT_PUBLIC_SUPABASE_URL")} />
          <EnvStatusRow name="NEXT_PUBLIC_SUPABASE_ANON_KEY" isSet={isEnvSet("NEXT_PUBLIC_SUPABASE_ANON_KEY")} />
          <EnvStatusRow
            name="SUPABASE_SERVICE_ROLE_KEY"
            isSet={isEnvSet("SUPABASE_SERVICE_ROLE_KEY")}
            note="Somente servidor. Necessário para APIs e admin."
          />
          <EnvStatusRow
            name="NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"
            isSet={isEnvSet("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY")}
            note="Habilita mapa e geocoding."
          />
          <EnvStatusRow
            name="STRIPE_SECRET_KEY"
            isSet={isEnvSet("STRIPE_SECRET_KEY")}
            note="Somente servidor. Necessário para criar PaymentIntent e webhook."
          />
          <EnvStatusRow
            name="NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
            isSet={isEnvSet("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")}
            note="Usado no checkout embutido."
          />
          <EnvStatusRow
            name="STRIPE_WEBHOOK_SECRET"
            isSet={isEnvSet("STRIPE_WEBHOOK_SECRET")}
            note="Somente servidor. Usado para validar assinatura do webhook."
          />
          <EnvStatusRow
            name="WHATSAPP_PROVIDER"
            isSet={isEnvSet("WHATSAPP_PROVIDER")}
            note="twilio | zapi | custom"
          />
          <EnvStatusRow
            name="WHATSAPP_WEBHOOK_URL"
            isSet={isEnvSet("WHATSAPP_WEBHOOK_URL")}
            note="Obrigatório se WHATSAPP_PROVIDER=custom."
          />
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6">
        <h2 className="text-lg font-semibold">Template .env.local</h2>
        <p className="mt-2 text-sm text-zinc-700">Copie e preencha com seus valores.</p>
        <pre className="mt-4 overflow-auto rounded-lg border bg-zinc-50 p-4 text-xs leading-5">
{`NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=

STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

WHATSAPP_PROVIDER=custom
WHATSAPP_WEBHOOK_URL=
WHATSAPP_WEBHOOK_BEARER=

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=

ZAPI_BASE_URL=
ZAPI_TOKEN=
ZAPI_INSTANCE_ID=
ZAPI_CLIENT_TOKEN=
`}
        </pre>
      </div>

      <div id="sql">
        <MigrationSqlClient sql={migrationSql} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-6">
          <h2 className="text-lg font-semibold">Supabase</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-700">
            <li>
              Crie um projeto no Supabase e copie <span className="font-medium">Project URL</span> e{" "}
              <span className="font-medium">anon key</span>.
            </li>
            <li>
              Gere a <span className="font-medium">service role key</span> e configure em{" "}
              <span className="font-medium">SUPABASE_SERVICE_ROLE_KEY</span>.
            </li>
            <li>
              Execute a migração SQL do MVP:{" "}
              <a className="underline" href="/setup#sql">
                ver SQL
              </a>
              .
            </li>
          </ul>
        </div>

        <div className="rounded-xl border bg-white p-6">
          <h2 className="text-lg font-semibold">Google Maps</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-700">
            <li>
              Crie uma key no Google Cloud e habilite as APIs:{" "}
              <span className="font-medium">Maps JavaScript</span> e{" "}
              <span className="font-medium">Geocoding</span>.
            </li>
            <li>
              Configure <span className="font-medium">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</span>.
            </li>
            <li>
              Sem essa key, o app ainda funciona, mas o mapa fica desabilitado e o endereço precisa vir via GPS.
            </li>
          </ul>
        </div>

        <div className="rounded-xl border bg-white p-6">
          <h2 className="text-lg font-semibold">Stripe (Connect + Checkout)</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-700">
            <li>
              Configure <span className="font-medium">STRIPE_SECRET_KEY</span> e{" "}
              <span className="font-medium">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</span>.
            </li>
            <li>
              Crie um webhook para <span className="font-medium">/api/webhooks/stripe</span> e copie o{" "}
              <span className="font-medium">STRIPE_WEBHOOK_SECRET</span>.
            </li>
            <li>
              Cada parceiro precisa ter um Connected Account no Stripe e você deve preencher{" "}
              <span className="font-medium">tow_partners.stripe_account_id</span>.
            </li>
          </ul>
          <div className="mt-4 rounded-lg border bg-zinc-50 p-4 text-xs text-zinc-700">
            <div className="font-medium">Exemplo (SQL) para preencher stripe_account_id</div>
            <pre className="mt-2 overflow-auto leading-5">{`update public.tow_partners
set stripe_account_id = 'acct_XXXXXXXXXXXX'
where id = 'UUID_DO_PARCEIRO';`}</pre>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6">
          <h2 className="text-lg font-semibold">WhatsApp (3 opções)</h2>
          <div className="mt-3 space-y-4 text-sm text-zinc-700">
            <div className="rounded-lg border p-4">
              <div className="font-medium">Custom (recomendado para MVP)</div>
              <div className="mt-1">
                Configure <span className="font-medium">WHATSAPP_WEBHOOK_URL</span>. O app envia{" "}
                <span className="font-medium">{"{ to, body }"}</span> via POST.
              </div>
              <div className="mt-1">
                Opcional: <span className="font-medium">WHATSAPP_WEBHOOK_BEARER</span>.
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="font-medium">Twilio</div>
              <div className="mt-1">
                Configure <span className="font-medium">TWILIO_ACCOUNT_SID</span>,{" "}
                <span className="font-medium">TWILIO_AUTH_TOKEN</span>,{" "}
                <span className="font-medium">TWILIO_WHATSAPP_FROM</span> e{" "}
                <span className="font-medium">WHATSAPP_PROVIDER=twilio</span>.
              </div>
              <div className="mt-1 text-xs text-zinc-600">
                Exemplo: TWILIO_WHATSAPP_FROM = whatsapp:+14155238886
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="font-medium">Z-API</div>
              <div className="mt-1">
                Configure <span className="font-medium">ZAPI_BASE_URL</span>,{" "}
                <span className="font-medium">ZAPI_TOKEN</span>,{" "}
                <span className="font-medium">ZAPI_INSTANCE_ID</span> (e opcional{" "}
                <span className="font-medium">ZAPI_CLIENT_TOKEN</span>) e{" "}
                <span className="font-medium">WHATSAPP_PROVIDER=zapi</span>.
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
