"use client";

import { useState } from "react";

export function MigrationSqlClient(props: { sql: string }) {
  const [message, setMessage] = useState<string | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(props.sql);
      setMessage("SQL copiado.");
      window.setTimeout(() => setMessage(null), 2000);
    } catch {
      setMessage("Não foi possível copiar.");
      window.setTimeout(() => setMessage(null), 2000);
    }
  }

  return (
    <div className="rounded-xl border bg-white p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">SQL da migração (copiar/colar)</h2>
          <p className="mt-1 text-sm text-zinc-700">
            Cole no Supabase SQL Editor e execute. Depois clique em “Testar Supabase” acima.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {message ? <span className="text-xs text-zinc-600">{message}</span> : null}
          <button className="rounded-md bg-black px-3 py-2 text-sm font-semibold text-white" type="button" onClick={copy}>
            Copiar SQL
          </button>
        </div>
      </div>
      <pre className="mt-4 max-h-[520px] overflow-auto rounded-lg border bg-zinc-50 p-4 text-xs leading-5">
        {props.sql}
      </pre>
    </div>
  );
}

