import { LoginFormClient } from "./loginFormClient";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-xl p-4 sm:p-6">
      <LoginFormClient initialError={error ?? null} />
      <p className="mt-4 text-center text-sm text-brand-black/70">
        É parceiro reboque?{" "}
        <a className="font-semibold text-brand-black underline" href="/signup">
          Cadastrar
        </a>
      </p>
    </div>
  );
}
