"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type EnvState = {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_DB_URL: string;
  SUPABASE_PROJECT_REF: string;
  SUPABASE_DB_PASSWORD: string;
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: string;
  STRIPE_SECRET_KEY: string;
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  WHATSAPP_PROVIDER: "twilio" | "zapi" | "custom";
  WHATSAPP_WEBHOOK_URL: string;
  WHATSAPP_WEBHOOK_BEARER: string;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_WHATSAPP_FROM: string;
  ZAPI_BASE_URL: string;
  ZAPI_TOKEN: string;
  ZAPI_INSTANCE_ID: string;
  ZAPI_CLIENT_TOKEN: string;
};

const defaultState: EnvState = {
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  SUPABASE_DB_URL: "",
  SUPABASE_PROJECT_REF: "",
  SUPABASE_DB_PASSWORD: "",
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "",
  STRIPE_SECRET_KEY: "",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "",
  STRIPE_WEBHOOK_SECRET: "",
  WHATSAPP_PROVIDER: "custom",
  WHATSAPP_WEBHOOK_URL: "",
  WHATSAPP_WEBHOOK_BEARER: "",
  TWILIO_ACCOUNT_SID: "",
  TWILIO_AUTH_TOKEN: "",
  TWILIO_WHATSAPP_FROM: "",
  ZAPI_BASE_URL: "",
  ZAPI_TOKEN: "",
  ZAPI_INSTANCE_ID: "",
  ZAPI_CLIENT_TOKEN: "",
};

const storageKey = "reboquesos.setup.env.v1";

function HowToDetails(props: { summary?: string; children: React.ReactNode }) {
  return (
    <details className="rounded-md border bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
      <summary className="cursor-pointer select-none font-medium">
        {props.summary ?? "Como pegar esse valor"}
      </summary>
      <div className="mt-2 space-y-2">{props.children}</div>
    </details>
  );
}

function extractProjectRefFromSupabaseUrl(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname;
    if (!host.endsWith(".supabase.co")) return null;
    const ref = host.replace(".supabase.co", "");
    return ref || null;
  } catch {
    return null;
  }
}

function mask(value: string) {
  if (!value) return "";
  if (value.length <= 6) return "••••••";
  return `${value.slice(0, 3)}••••••${value.slice(-3)}`;
}

function buildEnvFile(state: EnvState) {
  const lines: string[] = [];
  const push = (k: keyof EnvState, v: string) => lines.push(`${k}=${v ?? ""}`);

  push("NEXT_PUBLIC_SUPABASE_URL", state.NEXT_PUBLIC_SUPABASE_URL);
  push("NEXT_PUBLIC_SUPABASE_ANON_KEY", state.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  push("SUPABASE_SERVICE_ROLE_KEY", state.SUPABASE_SERVICE_ROLE_KEY);
  push("SUPABASE_DB_URL", state.SUPABASE_DB_URL);
  push("SUPABASE_PROJECT_REF", state.SUPABASE_PROJECT_REF);
  push("SUPABASE_DB_PASSWORD", state.SUPABASE_DB_PASSWORD);
  lines.push("");

  push("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", state.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
  lines.push("");

  push("STRIPE_SECRET_KEY", state.STRIPE_SECRET_KEY);
  push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", state.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  push("STRIPE_WEBHOOK_SECRET", state.STRIPE_WEBHOOK_SECRET);
  lines.push("");

  push("WHATSAPP_PROVIDER", state.WHATSAPP_PROVIDER);
  push("WHATSAPP_WEBHOOK_URL", state.WHATSAPP_WEBHOOK_URL);
  push("WHATSAPP_WEBHOOK_BEARER", state.WHATSAPP_WEBHOOK_BEARER);
  lines.push("");

  push("TWILIO_ACCOUNT_SID", state.TWILIO_ACCOUNT_SID);
  push("TWILIO_AUTH_TOKEN", state.TWILIO_AUTH_TOKEN);
  push("TWILIO_WHATSAPP_FROM", state.TWILIO_WHATSAPP_FROM);
  lines.push("");

  push("ZAPI_BASE_URL", state.ZAPI_BASE_URL);
  push("ZAPI_TOKEN", state.ZAPI_TOKEN);
  push("ZAPI_INSTANCE_ID", state.ZAPI_INSTANCE_ID);
  push("ZAPI_CLIENT_TOKEN", state.ZAPI_CLIENT_TOKEN);

  return `${lines.join("\n").trimEnd()}\n`;
}

function buildMaskedEnvFile(state: EnvState) {
  const masked: EnvState = {
    ...state,
    SUPABASE_SERVICE_ROLE_KEY: mask(state.SUPABASE_SERVICE_ROLE_KEY),
    SUPABASE_DB_URL: mask(state.SUPABASE_DB_URL),
    SUPABASE_DB_PASSWORD: mask(state.SUPABASE_DB_PASSWORD),
    STRIPE_SECRET_KEY: mask(state.STRIPE_SECRET_KEY),
    STRIPE_WEBHOOK_SECRET: mask(state.STRIPE_WEBHOOK_SECRET),
    TWILIO_AUTH_TOKEN: mask(state.TWILIO_AUTH_TOKEN),
    WHATSAPP_WEBHOOK_BEARER: mask(state.WHATSAPP_WEBHOOK_BEARER),
    ZAPI_TOKEN: mask(state.ZAPI_TOKEN),
    ZAPI_CLIENT_TOKEN: mask(state.ZAPI_CLIENT_TOKEN),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: state.NEXT_PUBLIC_SUPABASE_ANON_KEY ? mask(state.NEXT_PUBLIC_SUPABASE_ANON_KEY) : "",
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: state.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? mask(state.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) : "",
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: state.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? mask(state.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) : "",
  };
  return buildEnvFile(masked);
}

function InputRow(props: {
  label: string;
  name: keyof EnvState;
  value: string;
  type?: "text" | "password";
  placeholder?: string;
  onChange: (name: keyof EnvState, value: string) => void;
  hint?: string;
  howTo?: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{props.label}</span>
        {props.hint ? <span className="text-xs text-zinc-600">{props.hint}</span> : null}
      </div>
      <input
        className="w-full rounded-md border px-3 py-2 text-sm"
        value={props.value}
        type={props.type ?? "text"}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(props.name, e.target.value)}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {props.howTo ? <div className="pt-1">{props.howTo}</div> : null}
    </label>
  );
}

export function SetupFormClient() {
  const [state, setState] = useState<EnvState>(defaultState);
  const [showSecrets, setShowSecrets] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingSupabase, setIsCheckingSupabase] = useState(false);
  const [isAutoApplying, setIsAutoApplying] = useState(false);
  const [didAutoApply, setDidAutoApply] = useState(false);
  const [isApplyingMigration, setIsApplyingMigration] = useState(false);
  const [migrationMessage, setMigrationMessage] = useState<string | null>(null);
  const [didAutoMigrate, setDidAutoMigrate] = useState(false);
  const [supabaseCheck, setSupabaseCheck] = useState<{
    ok: boolean;
    env: Record<string, boolean>;
    tables: Array<{ table: string; ok: boolean; error: string | null }>;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSupabaseDbUrlWrong =
    Boolean(state.SUPABASE_DB_URL) && (state.SUPABASE_DB_URL.startsWith("http://") || state.SUPABASE_DB_URL.startsWith("https://"));

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<EnvState>;
      setState((prev) => ({ ...prev, ...parsed }));
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    if (state.SUPABASE_PROJECT_REF) return;
    const ref = extractProjectRefFromSupabaseUrl(state.NEXT_PUBLIC_SUPABASE_URL);
    if (!ref) return;
    setState((prev) => ({ ...prev, SUPABASE_PROJECT_REF: ref }));
  }, [state.NEXT_PUBLIC_SUPABASE_URL, state.SUPABASE_PROJECT_REF]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      return;
    }
  }, [state]);

  const envFile = useMemo(() => buildEnvFile(state), [state]);
  const maskedEnvFile = useMemo(() => buildMaskedEnvFile(state), [state]);

  function update<K extends keyof EnvState>(name: K, value: string) {
    setState((prev) => ({ ...prev, [name]: value }));
  }

  async function copy(content: string) {
    setMessage(null);
    setError(null);
    try {
      await navigator.clipboard.writeText(content);
      setMessage("Copiado.");
    } catch {
      setError("Não foi possível copiar.");
    }
  }

  async function writeEnvLocal() {
    setIsSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/setup/env", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error || "Falha ao escrever .env.local.");
      setMessage("Arquivo .env.local criado/atualizado. Reinicie o servidor (npm run dev).");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao escrever .env.local.");
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    if (didAutoApply) return;
    if (!state.NEXT_PUBLIC_SUPABASE_URL || !state.NEXT_PUBLIC_SUPABASE_ANON_KEY || !state.SUPABASE_SERVICE_ROLE_KEY) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsAutoApplying(true);
      fetch("/api/setup/env", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      })
        .then(() => setDidAutoApply(true))
        .finally(() => setIsAutoApplying(false));
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [didAutoApply, state]);

  const checkSupabase = useCallback(async () => {
    setIsCheckingSupabase(true);
    setMessage(null);
    setError(null);
    try {
      const hasDbInput =
        (!isSupabaseDbUrlWrong && Boolean(state.SUPABASE_DB_URL)) ||
        (Boolean(state.SUPABASE_PROJECT_REF) && Boolean(state.SUPABASE_DB_PASSWORD));

      const res = await fetch("/api/setup/supabase-check", {
        method: hasDbInput ? "POST" : "GET",
        headers: hasDbInput ? { "Content-Type": "application/json" } : undefined,
        body: hasDbInput
          ? JSON.stringify({
              dbUrl: state.SUPABASE_DB_URL,
              projectRef: state.SUPABASE_PROJECT_REF,
              dbPassword: state.SUPABASE_DB_PASSWORD,
            })
          : undefined,
      });
      const json = (await res.json()) as {
        ok?: boolean;
        env?: Record<string, boolean>;
        tables?: Array<{ table: string; ok: boolean; error: string | null }>;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Falha ao testar Supabase.");
      setSupabaseCheck({
        ok: Boolean(json.ok),
        env: json.env ?? {},
        tables: json.tables ?? [],
      });
      setMessage(
        json.ok
          ? "Supabase OK. Tabelas do MVP encontradas."
          : "Supabase conectado, mas faltam tabelas do MVP. Rode o SQL da migração no Supabase.",
      );
    } catch (e) {
      setSupabaseCheck(null);
      setError(e instanceof Error ? e.message : "Falha ao testar Supabase.");
    } finally {
      setIsCheckingSupabase(false);
    }
  }, [
    isSupabaseDbUrlWrong,
    state.SUPABASE_DB_PASSWORD,
    state.SUPABASE_DB_URL,
    state.SUPABASE_PROJECT_REF,
  ]);

  const applyMigration = useCallback(async () => {
    setIsApplyingMigration(true);
    setMigrationMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/setup/apply-migration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dbUrl: state.SUPABASE_DB_URL,
          projectRef: state.SUPABASE_PROJECT_REF,
          dbPassword: state.SUPABASE_DB_PASSWORD,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error || "Falha ao aplicar migração.");
      setMigrationMessage("Migração aplicada. Agora clique em “Testar Supabase”.");
      await checkSupabase();
    } catch (e) {
      setMigrationMessage(null);
      setError(e instanceof Error ? e.message : "Falha ao aplicar migração.");
    } finally {
      setIsApplyingMigration(false);
    }
  }, [checkSupabase, state.SUPABASE_DB_PASSWORD, state.SUPABASE_DB_URL, state.SUPABASE_PROJECT_REF]);

  useEffect(() => {
    if (didAutoMigrate) return;
    if (!state.SUPABASE_PROJECT_REF || !state.SUPABASE_DB_PASSWORD) return;
    if (!supabaseCheck) return;
    if (supabaseCheck.ok) return;
    setDidAutoMigrate(true);
    const timeoutId = window.setTimeout(() => {
      applyMigration().catch(() => null);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [applyMigration, didAutoMigrate, state.SUPABASE_PROJECT_REF, state.SUPABASE_DB_PASSWORD, supabaseCheck]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Preencher e gerar .env.local</h2>
            <p className="mt-1 text-sm text-zinc-700">
              Preencha abaixo e clique em “Escrever .env.local”. Os valores ficam salvos no seu navegador.
            </p>
          </div>
          <button
            className="rounded-md border px-3 py-2 text-sm font-semibold"
            type="button"
            onClick={() => setShowSecrets((v) => !v)}
          >
            {showSecrets ? "Ocultar segredos" : "Mostrar segredos"}
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {message}
          </div>
        ) : null}

        {isAutoApplying ? (
          <div className="mt-4 rounded-md border bg-zinc-50 p-3 text-sm text-zinc-700">
            Aplicando configurações do Supabase automaticamente...
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="rounded-md border px-3 py-2 text-sm font-semibold disabled:opacity-50"
            type="button"
            disabled={isCheckingSupabase}
            onClick={checkSupabase}
          >
            {isCheckingSupabase ? "Testando..." : "Testar Supabase"}
          </button>
        </div>

        {supabaseCheck ? (
          <div className="mt-4 rounded-lg border bg-white p-4 text-sm">
            <div className="font-semibold">Resultado</div>
            <div className="mt-2 grid gap-2">
              {Object.entries(supabaseCheck.env).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 rounded-md border p-3">
                  <div className="text-xs font-medium">{k}</div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      v ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700"
                    }`}
                  >
                    {v ? "OK" : "PENDENTE"}
                  </span>
                </div>
              ))}
              <div className="mt-2 text-xs font-medium text-zinc-700">Tabelas do MVP</div>
              {supabaseCheck.tables.map((t) => (
                <div key={t.table} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-xs font-medium">{t.table}</div>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        t.ok
                          ? "border-green-200 bg-green-50 text-green-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                      }`}
                    >
                      {t.ok ? "OK" : "FALTOU"}
                    </span>
                  </div>
                  {!t.ok && t.error ? <div className="mt-2 text-xs text-zinc-600">{t.error}</div> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-6">
          <h3 className="text-base font-semibold">Supabase</h3>
          <div className="mt-4 space-y-4">
            <InputRow
              label="NEXT_PUBLIC_SUPABASE_URL"
              name="NEXT_PUBLIC_SUPABASE_URL"
              value={state.NEXT_PUBLIC_SUPABASE_URL}
              placeholder="https://xxxx.supabase.co"
              onChange={update}
              howTo={
                <HowToDetails>
                  <div>
                    Abra o Supabase → selecione seu projeto →{" "}
                    <span className="font-medium">Project Settings</span> →{" "}
                    <span className="font-medium">API</span> → copie{" "}
                    <span className="font-medium">Project URL</span>.
                  </div>
                  <a
                    className="underline"
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir Supabase Dashboard
                  </a>
                </HowToDetails>
              }
            />
            <InputRow
              label="NEXT_PUBLIC_SUPABASE_ANON_KEY"
              name="NEXT_PUBLIC_SUPABASE_ANON_KEY"
              value={state.NEXT_PUBLIC_SUPABASE_ANON_KEY}
              type={showSecrets ? "text" : "password"}
              placeholder="eyJhbGciOi..."
              onChange={update}
              howTo={
                <HowToDetails>
                  <div>
                    Supabase → <span className="font-medium">Project Settings</span> →{" "}
                    <span className="font-medium">API</span> →{" "}
                    <span className="font-medium">Project API keys</span> → copie{" "}
                    <span className="font-medium">anon public</span>.
                  </div>
                </HowToDetails>
              }
            />
            <InputRow
              label="SUPABASE_SERVICE_ROLE_KEY"
              name="SUPABASE_SERVICE_ROLE_KEY"
              value={state.SUPABASE_SERVICE_ROLE_KEY}
              type={showSecrets ? "text" : "password"}
              placeholder="eyJhbGciOi..."
              onChange={update}
              hint="Somente servidor"
              howTo={
                <HowToDetails>
                  <div>
                    Supabase → <span className="font-medium">Project Settings</span> →{" "}
                    <span className="font-medium">API</span> →{" "}
                    <span className="font-medium">Project API keys</span> → copie{" "}
                    <span className="font-medium">service_role</span>.
                  </div>
                  <div className="text-zinc-600">
                    Atenção: essa chave é secreta. Nunca exponha no frontend.
                  </div>
                </HowToDetails>
              }
            />

            <InputRow
              label="SUPABASE_DB_URL (opcional, para eu rodar o SQL automaticamente)"
              name="SUPABASE_DB_URL"
              value={state.SUPABASE_DB_URL}
              type={showSecrets ? "text" : "password"}
              placeholder="postgresql://postgres:*****@db.XXXX.supabase.co:5432/postgres?sslmode=require"
              onChange={update}
              hint="Somente servidor"
              howTo={
                <HowToDetails>
                  <div>
                    Supabase → <span className="font-medium">Project Settings</span> →{" "}
                    <span className="font-medium">Database</span> →{" "}
                    <span className="font-medium">Connection string</span> → escolha{" "}
                    <span className="font-medium">URI</span> e copie.
                  </div>
                  <div className="text-zinc-600">
                    Precisa conter usuário/senha do Postgres. Não é a Service Role.
                  </div>
                </HowToDetails>
              }
            />
            {isSupabaseDbUrlWrong ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Esse valor <span className="font-medium">não</span> é o DB URL. Isso parece o Project URL (https://...).
                Aqui precisa ser a connection string do Postgres (postgresql://...).
              </div>
            ) : null}

            <div className="rounded-lg border bg-zinc-50 p-4 text-sm text-zinc-700">
              <div className="font-medium">Alternativa: preencher só Ref + Senha</div>
              <div className="mt-1">
                Se você preferir, pode deixar o <span className="font-medium">SUPABASE_DB_URL</span> vazio e preencher
                apenas <span className="font-medium">SUPABASE_PROJECT_REF</span> e{" "}
                <span className="font-medium">SUPABASE_DB_PASSWORD</span>.
              </div>
              <div className="mt-4 grid gap-4">
                <InputRow
                  label="SUPABASE_PROJECT_REF"
                  name="SUPABASE_PROJECT_REF"
                  value={state.SUPABASE_PROJECT_REF}
                  placeholder="lstypjsokhxbqybnwwik"
                  onChange={update}
                  hint="Id do projeto"
                  howTo={
                    <HowToDetails>
                      <div>
                        É o “ref” do seu projeto. Você vê ele na URL do Supabase:{" "}
                        <span className="font-medium">https://REF.supabase.co</span> ou no dashboard.
                      </div>
                    </HowToDetails>
                  }
                />
                <InputRow
                  label="SUPABASE_DB_PASSWORD"
                  name="SUPABASE_DB_PASSWORD"
                  value={state.SUPABASE_DB_PASSWORD}
                  type={showSecrets ? "text" : "password"}
                  placeholder="senha do postgres"
                  onChange={update}
                  hint="Senha do Postgres"
                  howTo={
                    <HowToDetails>
                      <div>
                        É a senha do usuário <span className="font-medium">postgres</span> (definida na criação do
                        projeto ou nas configurações de Database).
                      </div>
                    </HowToDetails>
                  }
                />
              </div>
            </div>

            <div className="rounded-lg border bg-zinc-50 p-4 text-sm text-zinc-700">
              <div className="font-medium">Criar tabelas do MVP automaticamente</div>
              <div className="mt-1">
                Se você preencher <span className="font-medium">SUPABASE_DB_URL</span>, eu consigo aplicar a migração SQL
                aqui mesmo.
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  className="rounded-md bg-black px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  type="button"
                  disabled={
                    isApplyingMigration ||
                    isSupabaseDbUrlWrong ||
                    (!state.SUPABASE_DB_URL && (!state.SUPABASE_PROJECT_REF || !state.SUPABASE_DB_PASSWORD))
                  }
                  onClick={applyMigration}
                >
                  {isApplyingMigration ? "Aplicando..." : "Aplicar migração"}
                </button>
                {migrationMessage ? <span className="text-xs text-zinc-600">{migrationMessage}</span> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6">
          <h3 className="text-base font-semibold">Google Maps</h3>
          <div className="mt-4 space-y-4">
            <InputRow
              label="NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"
              name="NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"
              value={state.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
              type={showSecrets ? "text" : "password"}
              placeholder="AIzaSy..."
              onChange={update}
              hint="Mapa + geocoding"
              howTo={
                <HowToDetails>
                  <div>
                    Google Cloud Console → <span className="font-medium">APIs & Services</span> →{" "}
                    <span className="font-medium">Credentials</span> →{" "}
                    <span className="font-medium">Create credentials</span> →{" "}
                    <span className="font-medium">API key</span>.
                  </div>
                  <div>
                    Habilite também as APIs:{" "}
                    <span className="font-medium">Maps JavaScript API</span> e{" "}
                    <span className="font-medium">Geocoding API</span>.
                  </div>
                  <a
                    className="underline"
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir Credenciais (Google Cloud)
                  </a>
                </HowToDetails>
              }
            />
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6">
          <h3 className="text-base font-semibold">Stripe</h3>
          <div className="mt-4 space-y-4">
            <InputRow
              label="STRIPE_SECRET_KEY"
              name="STRIPE_SECRET_KEY"
              value={state.STRIPE_SECRET_KEY}
              type={showSecrets ? "text" : "password"}
              placeholder="sk_live_..."
              onChange={update}
              hint="Somente servidor"
              howTo={
                <HowToDetails>
                  <div>
                    Stripe Dashboard → <span className="font-medium">Developers</span> →{" "}
                    <span className="font-medium">API keys</span> → copie{" "}
                    <span className="font-medium">Secret key</span> (sk_...).
                  </div>
                  <a
                    className="underline"
                    href="https://dashboard.stripe.com/apikeys"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir API keys (Stripe)
                  </a>
                </HowToDetails>
              }
            />
            <InputRow
              label="NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
              name="NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
              value={state.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
              type={showSecrets ? "text" : "password"}
              placeholder="pk_live_..."
              onChange={update}
              howTo={
                <HowToDetails>
                  <div>
                    Stripe Dashboard → <span className="font-medium">Developers</span> →{" "}
                    <span className="font-medium">API keys</span> → copie{" "}
                    <span className="font-medium">Publishable key</span> (pk_...).
                  </div>
                </HowToDetails>
              }
            />
            <InputRow
              label="STRIPE_WEBHOOK_SECRET"
              name="STRIPE_WEBHOOK_SECRET"
              value={state.STRIPE_WEBHOOK_SECRET}
              type={showSecrets ? "text" : "password"}
              placeholder="whsec_..."
              onChange={update}
              hint="/api/webhooks/stripe"
              howTo={
                <HowToDetails>
                  <div>
                    Stripe Dashboard → <span className="font-medium">Developers</span> →{" "}
                    <span className="font-medium">Webhooks</span> →{" "}
                    <span className="font-medium">Add endpoint</span>.
                  </div>
                  <div>
                    Endpoint: <span className="font-medium">https://SEU_DOMINIO/api/webhooks/stripe</span>
                  </div>
                  <div>
                    Depois abra o endpoint criado e copie{" "}
                    <span className="font-medium">Signing secret</span> (whsec_...).
                  </div>
                  <div className="rounded-md border bg-white p-2 font-mono text-[11px] leading-4">
                    stripe listen --forward-to localhost:3000/api/webhooks/stripe
                  </div>
                </HowToDetails>
              }
            />
            <div className="rounded-lg border bg-zinc-50 p-4 text-sm text-zinc-700">
              Preencha também <span className="font-medium">tow_partners.stripe_account_id</span> no Supabase para cada
              parceiro (Connected Account).
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6">
          <h3 className="text-base font-semibold">WhatsApp</h3>
          <div className="mt-4 space-y-4">
            <label className="block space-y-1">
              <div className="text-sm font-medium">WHATSAPP_PROVIDER</div>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={state.WHATSAPP_PROVIDER}
                onChange={(e) => update("WHATSAPP_PROVIDER", e.target.value as EnvState["WHATSAPP_PROVIDER"])}
              >
                <option value="custom">custom</option>
                <option value="twilio">twilio</option>
                <option value="zapi">zapi</option>
              </select>
            </label>
            <HowToDetails summary="Como escolher o provider">
              <div>
                <span className="font-medium">custom</span>: você fornece uma URL que dispara mensagem (ideal para n8n/Make/servidor próprio).
              </div>
              <div>
                <span className="font-medium">twilio</span>: usa Twilio WhatsApp API.
              </div>
              <div>
                <span className="font-medium">zapi</span>: usa Z-API.
              </div>
            </HowToDetails>

            {state.WHATSAPP_PROVIDER === "custom" ? (
              <>
                <InputRow
                  label="WHATSAPP_WEBHOOK_URL"
                  name="WHATSAPP_WEBHOOK_URL"
                  value={state.WHATSAPP_WEBHOOK_URL}
                  placeholder="https://seu-servidor.com/whatsapp"
                  onChange={update}
                  howTo={
                    <HowToDetails>
                      <div>
                        É a URL do seu endpoint (ex.: n8n webhook, Make, Cloud Function, servidor próprio) que vai enviar a
                        mensagem no WhatsApp.
                      </div>
                      <div>
                        O app faz POST com JSON:{" "}
                        <span className="font-medium">{"{ to, body }"}</span>.
                      </div>
                    </HowToDetails>
                  }
                />
                <InputRow
                  label="WHATSAPP_WEBHOOK_BEARER (opcional)"
                  name="WHATSAPP_WEBHOOK_BEARER"
                  value={state.WHATSAPP_WEBHOOK_BEARER}
                  type={showSecrets ? "text" : "password"}
                  placeholder="token..."
                  onChange={update}
                  howTo={
                    <HowToDetails>
                      <div>
                        Se seu endpoint exigir autenticação, informe aqui um token. Ele será enviado como header{" "}
                        <span className="font-medium">Authorization: Bearer SEU_TOKEN</span>.
                      </div>
                    </HowToDetails>
                  }
                />
              </>
            ) : null}

            {state.WHATSAPP_PROVIDER === "twilio" ? (
              <>
                <InputRow
                  label="TWILIO_ACCOUNT_SID"
                  name="TWILIO_ACCOUNT_SID"
                  value={state.TWILIO_ACCOUNT_SID}
                  placeholder="AC..."
                  onChange={update}
                  howTo={
                    <HowToDetails>
                      <div>
                        Twilio Console → <span className="font-medium">Account</span> →{" "}
                        <span className="font-medium">Account Info</span> → copie{" "}
                        <span className="font-medium">Account SID</span> (AC...).
                      </div>
                      <a
                        className="underline"
                        href="https://console.twilio.com/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir Twilio Console
                      </a>
                    </HowToDetails>
                  }
                />
                <InputRow
                  label="TWILIO_AUTH_TOKEN"
                  name="TWILIO_AUTH_TOKEN"
                  value={state.TWILIO_AUTH_TOKEN}
                  type={showSecrets ? "text" : "password"}
                  placeholder="..."
                  onChange={update}
                  howTo={
                    <HowToDetails>
                      <div>
                        Mesmo local do SID: Twilio Console →{" "}
                        <span className="font-medium">Account Info</span> → copie{" "}
                        <span className="font-medium">Auth Token</span>.
                      </div>
                    </HowToDetails>
                  }
                />
                <InputRow
                  label="TWILIO_WHATSAPP_FROM"
                  name="TWILIO_WHATSAPP_FROM"
                  value={state.TWILIO_WHATSAPP_FROM}
                  placeholder="whatsapp:+14155238886"
                  onChange={update}
                  howTo={
                    <HowToDetails>
                      <div>
                        Em dev você pode usar o{" "}
                        <span className="font-medium">WhatsApp Sandbox</span> do Twilio. Pegue o número “From” no Sandbox.
                      </div>
                      <div className="text-zinc-600">
                        Formato obrigatório: <span className="font-medium">whatsapp:+E164</span>
                      </div>
                    </HowToDetails>
                  }
                />
              </>
            ) : null}

            {state.WHATSAPP_PROVIDER === "zapi" ? (
              <>
                <InputRow
                  label="ZAPI_BASE_URL"
                  name="ZAPI_BASE_URL"
                  value={state.ZAPI_BASE_URL}
                  placeholder="https://api.z-api.io"
                  onChange={update}
                  howTo={
                    <HowToDetails>
                      <div>
                        Normalmente é <span className="font-medium">https://api.z-api.io</span> (confirme na sua conta/instância).
                      </div>
                    </HowToDetails>
                  }
                />
                <InputRow
                  label="ZAPI_TOKEN"
                  name="ZAPI_TOKEN"
                  value={state.ZAPI_TOKEN}
                  type={showSecrets ? "text" : "password"}
                  placeholder="..."
                  onChange={update}
                  howTo={
                    <HowToDetails>
                      <div>
                        No painel da Z-API, copie o <span className="font-medium">Token</span> da sua instância.
                      </div>
                    </HowToDetails>
                  }
                />
                <InputRow
                  label="ZAPI_INSTANCE_ID"
                  name="ZAPI_INSTANCE_ID"
                  value={state.ZAPI_INSTANCE_ID}
                  placeholder="..."
                  onChange={update}
                  howTo={
                    <HowToDetails>
                      <div>
                        No painel da Z-API, copie o <span className="font-medium">Instance ID</span>.
                      </div>
                    </HowToDetails>
                  }
                />
                <InputRow
                  label="ZAPI_CLIENT_TOKEN (opcional)"
                  name="ZAPI_CLIENT_TOKEN"
                  value={state.ZAPI_CLIENT_TOKEN}
                  type={showSecrets ? "text" : "password"}
                  placeholder="..."
                  onChange={update}
                  howTo={
                    <HowToDetails>
                      <div>
                        Se sua conta exigir <span className="font-medium">Client-Token</span>, copie do painel da Z-API.
                      </div>
                    </HowToDetails>
                  }
                />
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold">Preview do .env.local</h3>
            <p className="mt-1 text-sm text-zinc-700">
              Por segurança, o preview abaixo aparece mascarado (os segredos continuam salvos normalmente).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-md border px-3 py-2 text-sm font-semibold"
              type="button"
              onClick={() => copy(envFile)}
            >
              Copiar real
            </button>
            <button
              className="rounded-md border px-3 py-2 text-sm font-semibold"
              type="button"
              onClick={() => copy(maskedEnvFile)}
            >
              Copiar mascarado
            </button>
            <button
              className="rounded-md bg-black px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              type="button"
              disabled={isSaving}
              onClick={writeEnvLocal}
            >
              {isSaving ? "Salvando..." : "Escrever .env.local"}
            </button>
          </div>
        </div>
        <pre className="mt-4 overflow-auto rounded-lg border bg-zinc-50 p-4 text-xs leading-5">
          {maskedEnvFile}
        </pre>
      </div>
    </div>
  );
}
