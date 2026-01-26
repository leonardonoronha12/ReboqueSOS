"use client";

import Link from "next/link";

export default function ErrorPage(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="rounded-xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Ocorreu um erro</h1>
        <p className="mt-2 text-sm text-zinc-700">
          Tente recarregar a página. Se continuar, tente novamente em alguns minutos.
        </p>
        <div className="mt-4 flex gap-3">
          <button
            className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white"
            onClick={() => props.reset()}
          >
            Tentar novamente
          </button>
          <Link className="rounded-md border px-4 py-2 text-sm font-semibold" href="/">
            Ir para início
          </Link>
        </div>
        {props.error?.digest ? (
          <div className="mt-4 text-xs text-zinc-500">Código: {props.error.digest}</div>
        ) : null}
      </div>
    </div>
  );
}
