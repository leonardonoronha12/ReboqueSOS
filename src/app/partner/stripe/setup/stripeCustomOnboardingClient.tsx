"use client";

import { useEffect, useMemo, useState } from "react";

type StatusResponse = {
  ok?: boolean;
  account?: {
    id?: string;
    type?: string;
    charges_enabled?: boolean;
    payouts_enabled?: boolean;
    disabled_reason?: string | null;
    requirements?: {
      currently_due?: string[];
      eventually_due?: string[];
      past_due?: string[];
    };
  };
  error?: string;
};

type SubmitResponse = {
  ok?: boolean;
  account_id?: string;
  error?: string;
};

function digitsOnly(value: string) {
  return value.replace(/\D+/g, "");
}

function formatDue(list: string[] | undefined) {
  const items = (list ?? []).slice(0, 10);
  return items.length ? items.join(", ") : null;
}

export function StripeCustomOnboardingClient(props: {
  initial: { cpf: string | null; email: string | null; fullName: string; phone: string | null; stripe_account_id: string | null };
}) {
  const [fullName, setFullName] = useState(props.initial.fullName);
  const [cpf, setCpf] = useState(props.initial.cpf ?? "");
  const [email, setEmail] = useState(props.initial.email ?? "");
  const [phone, setPhone] = useState(props.initial.phone ?? "");

  const [dobDay, setDobDay] = useState("");
  const [dobMonth, setDobMonth] = useState("");
  const [dobYear, setDobYear] = useState("");

  const [addrLine1, setAddrLine1] = useState("");
  const [addrLine2, setAddrLine2] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("RJ");
  const [addrPostal, setAddrPostal] = useState("");

  const [bankCode, setBankCode] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  const [acceptTos, setAcceptTos] = useState(false);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const existingAccountId = props.initial.stripe_account_id;

  const canSubmit = useMemo(() => {
    if (!fullName.trim()) return false;
    if (!digitsOnly(cpf).trim()) return false;
    if (!email.trim()) return false;
    if (!digitsOnly(phone).trim()) return false;
    if (!digitsOnly(dobDay) || !digitsOnly(dobMonth) || !digitsOnly(dobYear)) return false;
    if (!addrLine1.trim() || !addrCity.trim() || !addrState.trim() || !digitsOnly(addrPostal).trim()) return false;
    if (!digitsOnly(bankCode).trim() || !digitsOnly(branchCode).trim() || !digitsOnly(accountNumber).trim()) return false;
    if (!acceptTos) return false;
    return true;
  }, [acceptTos, accountNumber, addrCity, addrLine1, addrPostal, addrState, bankCode, branchCode, cpf, dobDay, dobMonth, dobYear, email, fullName, phone]);

  async function loadStatus() {
    setIsLoadingStatus(true);
    setError(null);
    try {
      const res = await fetch("/api/partner/stripe/custom/status");
      const json = (await res.json()) as StatusResponse;
      if (!res.ok) throw new Error(json.error || "Falha ao carregar status.");
      setStatus(json);
    } catch (e) {
      setStatus(null);
      setError(e instanceof Error ? e.message : "Falha ao carregar status.");
    } finally {
      setIsLoadingStatus(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function submit() {
    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/partner/stripe/custom/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          cpf: digitsOnly(cpf),
          email: email.trim(),
          phone: digitsOnly(phone),
          dob: { day: Number(dobDay), month: Number(dobMonth), year: Number(dobYear) },
          address: {
            line1: addrLine1.trim(),
            line2: addrLine2.trim() || null,
            city: addrCity.trim(),
            state: addrState.trim(),
            postal_code: digitsOnly(addrPostal),
            country: "BR",
          },
          bank: {
            country: "BR",
            currency: "brl",
            bank_code: digitsOnly(bankCode),
            branch_code: digitsOnly(branchCode),
            account_number: digitsOnly(accountNumber),
          },
          accept_tos: acceptTos,
        }),
      });
      const json = (await res.json()) as SubmitResponse;
      if (!res.ok) throw new Error(json.error || "Falha ao enviar dados.");
      setMessage("Dados enviados. Verificando status...");
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar dados.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const due = status?.account?.requirements?.currently_due ?? [];
  const pastDue = status?.account?.requirements?.past_due ?? [];
  const disabledReason = status?.account?.disabled_reason ?? null;
  const dueText = formatDue(due);
  const pastDueText = formatDue(pastDue);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="rounded-xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Configurar pagamentos (Stripe Connect)</h1>
        <p className="mt-2 text-sm text-zinc-700">
          Preencha os dados para criar e configurar sua conta conectada.
        </p>
        {existingAccountId ? (
          <div className="mt-2 text-xs text-zinc-600">Conta atual: {existingAccountId}</div>
        ) : null}
      </div>

      <div className="rounded-xl border bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">Status</div>
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-xs font-semibold"
            disabled={isLoadingStatus}
            onClick={() => void loadStatus()}
          >
            {isLoadingStatus ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
        {error ? (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        ) : null}
        {message ? (
          <div className="mt-3 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</div>
        ) : null}
        {status?.account ? (
          <div className="mt-3 space-y-2 text-sm text-zinc-700">
            <div>ID: {status.account.id ?? "-"}</div>
            <div>Tipo: {status.account.type ?? "-"}</div>
            <div>Charges enabled: {String(Boolean(status.account.charges_enabled))}</div>
            <div>Payouts enabled: {String(Boolean(status.account.payouts_enabled))}</div>
            <div>Disabled reason: {disabledReason ?? "-"}</div>
            {pastDueText ? <div>Past due: {pastDueText}</div> : null}
            {dueText ? <div>Currently due: {dueText}</div> : null}
          </div>
        ) : (
          <div className="mt-3 text-sm text-zinc-700">Nenhuma conta conectada ainda.</div>
        )}
      </div>

      <div className="rounded-xl border bg-white p-6">
        <h2 className="text-base font-semibold">Dados pessoais</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <div className="text-sm font-medium">Nome completo</div>
            <input className="w-full rounded-md border px-3 py-2" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
          <label className="space-y-1">
            <div className="text-sm font-medium">CPF</div>
            <input className="w-full rounded-md border px-3 py-2" value={cpf} onChange={(e) => setCpf(e.target.value)} inputMode="numeric" placeholder="Somente números" />
          </label>
          <label className="space-y-1">
            <div className="text-sm font-medium">E-mail</div>
            <input className="w-full rounded-md border px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" />
          </label>
          <label className="space-y-1">
            <div className="text-sm font-medium">Telefone</div>
            <input className="w-full rounded-md border px-3 py-2" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="DDD + número" />
          </label>
          <div className="sm:col-span-2">
            <div className="text-sm font-medium">Data de nascimento</div>
            <div className="mt-1 grid grid-cols-3 gap-2">
              <input className="w-full rounded-md border px-3 py-2" value={dobDay} onChange={(e) => setDobDay(e.target.value)} inputMode="numeric" placeholder="Dia" />
              <input className="w-full rounded-md border px-3 py-2" value={dobMonth} onChange={(e) => setDobMonth(e.target.value)} inputMode="numeric" placeholder="Mês" />
              <input className="w-full rounded-md border px-3 py-2" value={dobYear} onChange={(e) => setDobYear(e.target.value)} inputMode="numeric" placeholder="Ano" />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6">
        <h2 className="text-base font-semibold">Endereço</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 sm:col-span-2">
            <div className="text-sm font-medium">Endereço</div>
            <input className="w-full rounded-md border px-3 py-2" value={addrLine1} onChange={(e) => setAddrLine1(e.target.value)} placeholder="Rua, número" />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <div className="text-sm font-medium">Complemento</div>
            <input className="w-full rounded-md border px-3 py-2" value={addrLine2} onChange={(e) => setAddrLine2(e.target.value)} placeholder="Apto, bloco, etc (opcional)" />
          </label>
          <label className="space-y-1">
            <div className="text-sm font-medium">Cidade</div>
            <input className="w-full rounded-md border px-3 py-2" value={addrCity} onChange={(e) => setAddrCity(e.target.value)} />
          </label>
          <label className="space-y-1">
            <div className="text-sm font-medium">Estado</div>
            <input className="w-full rounded-md border px-3 py-2" value={addrState} onChange={(e) => setAddrState(e.target.value)} />
          </label>
          <label className="space-y-1">
            <div className="text-sm font-medium">CEP</div>
            <input className="w-full rounded-md border px-3 py-2" value={addrPostal} onChange={(e) => setAddrPostal(e.target.value)} inputMode="numeric" placeholder="Somente números" />
          </label>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6">
        <h2 className="text-base font-semibold">Conta bancária</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <div className="text-sm font-medium">Código do banco</div>
            <input className="w-full rounded-md border px-3 py-2" value={bankCode} onChange={(e) => setBankCode(e.target.value)} inputMode="numeric" placeholder="Ex: 260" />
          </label>
          <label className="space-y-1">
            <div className="text-sm font-medium">Agência</div>
            <input className="w-full rounded-md border px-3 py-2" value={branchCode} onChange={(e) => setBranchCode(e.target.value)} inputMode="numeric" placeholder="Ex: 0001" />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <div className="text-sm font-medium">Conta (com dígito)</div>
            <input className="w-full rounded-md border px-3 py-2" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} inputMode="numeric" placeholder="Somente números" />
          </label>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6">
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1" checked={acceptTos} onChange={(e) => setAcceptTos(e.target.checked)} />
          <div className="text-sm text-zinc-700">
            Eu li e aceito os termos para criar minha conta conectada e receber pagamentos.
          </div>
        </label>

        <button
          type="button"
          className="mt-4 w-full rounded-md bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          disabled={!canSubmit || isSubmitting}
          onClick={() => void submit()}
        >
          {isSubmitting ? "Enviando..." : "Enviar e configurar"}
        </button>
      </div>
    </div>
  );
}

