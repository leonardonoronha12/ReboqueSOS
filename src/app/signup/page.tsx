const cidades = ["São Gonçalo", "Niterói"] as const;

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-md p-6">
      <h1 className="text-2xl font-semibold">Cadastro de parceiro reboque</h1>
      {error ? (
        <p className="mt-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <form className="mt-6 space-y-4" action="/auth/signup" method="post">
        <input type="hidden" name="role" value="reboque" />
        <label className="block space-y-1">
          <span className="text-sm text-zinc-700">Nome</span>
          <input className="w-full rounded-md border px-3 py-2" name="nome" required />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-zinc-700">Telefone (WhatsApp)</span>
          <input className="w-full rounded-md border px-3 py-2" name="telefone" required />
        </label>
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
        <div className="space-y-4 rounded-md border p-4">
          <p className="text-sm font-medium">Dados do parceiro</p>
          <label className="block space-y-1">
            <span className="text-sm text-zinc-700">Empresa</span>
            <input className="w-full rounded-md border px-3 py-2" name="empresa_nome" required />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-zinc-700">Cidade</span>
            <select className="w-full rounded-md border px-3 py-2" name="cidade" defaultValue={cidades[0]}>
              {cidades.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-zinc-700">WhatsApp</span>
            <input className="w-full rounded-md border px-3 py-2" name="whatsapp_number" required />
          </label>
        </div>
        <button className="w-full rounded-md bg-black px-4 py-2 text-white" type="submit">
          Criar conta
        </button>
      </form>
      <p className="mt-4 text-sm text-zinc-600">
        Já tem conta?{" "}
        <a className="font-medium text-black underline" href="/login">
          Entrar
        </a>
      </p>
    </div>
  );
}
