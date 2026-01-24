export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-md p-6">
      <h1 className="text-2xl font-semibold">Entrar</h1>
      {error ? (
        <p className="mt-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <form className="mt-6 space-y-4" action="/auth/login" method="post">
        <label className="block space-y-1">
          <span className="text-sm text-zinc-700">Email</span>
          <input
            className="w-full rounded-md border px-3 py-2"
            name="email"
            type="email"
            required
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-zinc-700">Senha</span>
          <input
            className="w-full rounded-md border px-3 py-2"
            name="password"
            type="password"
            required
          />
        </label>
        <button
          className="w-full rounded-md bg-black px-4 py-2 text-white"
          type="submit"
        >
          Entrar
        </button>
      </form>
      <p className="mt-4 text-sm text-zinc-600">
        Não tem conta?{" "}
        <a className="font-medium text-black underline" href="/signup">
          Criar conta
        </a>
      </p>
    </div>
  );
}

