import { PartnerSignupFormClient } from "./partnerSignupFormClient";
import { RIO_DE_JANEIRO_CITIES } from "@/lib/geo/rjCities";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-xl p-4 sm:p-6">
      <PartnerSignupFormClient cidades={[...RIO_DE_JANEIRO_CITIES]} initialError={error ?? null} />
      <p className="mt-4 text-center text-sm text-brand-black/70">
        Já tem conta?{" "}
        <a className="font-semibold text-brand-black underline" href="/login">
          Entrar
        </a>
      </p>
    </div>
  );
}
