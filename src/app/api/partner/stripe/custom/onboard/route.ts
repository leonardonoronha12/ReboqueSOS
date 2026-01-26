import { NextResponse } from "next/server";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripeServer } from "@/lib/stripe/server";

function digitsOnly(value: string) {
  return value.replace(/\D+/g, "");
}

function normalizeBankCode(raw: string) {
  const digits = digitsOnly(raw);
  if (!digits) return "";
  const last3 = digits.slice(-3);
  return last3.padStart(3, "0");
}

function normalizeBranchCode(raw: string) {
  const digits = digitsOnly(raw);
  if (!digits) return "";
  const last4 = digits.slice(-4);
  return last4.padStart(4, "0");
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/g).filter(Boolean);
  const first = parts[0] ?? "";
  const last = parts.length > 1 ? parts.slice(1).join(" ") : "";
  return { first, last };
}

function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

function isStripeTestMode() {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  return key.startsWith("sk_test_");
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const profile = await getUserProfile(user.id);
    if (!profile || (profile.role !== "reboque" && profile.role !== "admin")) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as null | {
      full_name?: string;
      cpf?: string;
      email?: string;
      phone?: string;
      dob?: { day?: number; month?: number; year?: number };
      address?: { line1?: string; line2?: string | null; city?: string; state?: string; postal_code?: string; country?: string };
      bank?: { country?: string; currency?: string; bank_code?: string; branch_code?: string; account_number?: string };
      accept_tos?: boolean;
    };

    if (!body) return NextResponse.json({ error: "JSON inválido." }, { status: 400 });

    const fullName = String(body.full_name ?? "").trim();
    const cpf = digitsOnly(String(body.cpf ?? ""));
    const email = String(body.email ?? "").trim();
    const phone = digitsOnly(String(body.phone ?? ""));
    const dobDay = Number(body.dob?.day);
    const dobMonth = Number(body.dob?.month);
    const dobYear = Number(body.dob?.year);

    const line1 = String(body.address?.line1 ?? "").trim();
    const line2 = body.address?.line2 != null ? String(body.address?.line2).trim() : null;
    const city = String(body.address?.city ?? "").trim();
    const state = String(body.address?.state ?? "").trim();
    const postal = digitsOnly(String(body.address?.postal_code ?? ""));
    const country = String(body.address?.country ?? "BR").trim() || "BR";

    const bankCountry = String(body.bank?.country ?? "BR").trim() || "BR";
    const currency = String(body.bank?.currency ?? "brl").trim().toLowerCase() || "brl";
    const bankCode = normalizeBankCode(String(body.bank?.bank_code ?? ""));
    const branchCode = normalizeBranchCode(String(body.bank?.branch_code ?? ""));
    const accountNumber = digitsOnly(String(body.bank?.account_number ?? ""));
    const stripeTestMode = isStripeTestMode();

    const acceptTos = Boolean(body.accept_tos);
    if (!acceptTos) return NextResponse.json({ error: "Aceite os termos para continuar." }, { status: 400 });

    if (!fullName) return NextResponse.json({ error: "Nome inválido." }, { status: 400 });
    if (cpf.length !== 11) return NextResponse.json({ error: "CPF inválido." }, { status: 400 });
    if (!email) return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
    if (phone.length < 10) return NextResponse.json({ error: "Telefone inválido." }, { status: 400 });
    if (!Number.isInteger(dobDay) || dobDay < 1 || dobDay > 31) return NextResponse.json({ error: "Data de nascimento inválida." }, { status: 400 });
    if (!Number.isInteger(dobMonth) || dobMonth < 1 || dobMonth > 12) return NextResponse.json({ error: "Data de nascimento inválida." }, { status: 400 });
    if (!Number.isInteger(dobYear) || dobYear < 1900) return NextResponse.json({ error: "Data de nascimento inválida." }, { status: 400 });

    if (!line1 || !city || !state || postal.length < 8) return NextResponse.json({ error: "Endereço inválido." }, { status: 400 });
    if (!stripeTestMode && (!bankCode || !branchCode || !accountNumber)) {
      return NextResponse.json({ error: "Conta bancária inválida." }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const { data: partner, error: partnerErr } = await supabaseAdmin
      .from("tow_partners")
      .select("stripe_account_id")
      .eq("id", user.id)
      .maybeSingle();
    if (partnerErr) return NextResponse.json({ error: partnerErr.message }, { status: 500 });

    const stripe = getStripeServer();
    let accountId = partner?.stripe_account_id ?? null;
    if (accountId) {
      const existing = await stripe.accounts.retrieve(accountId);
      const type = (existing as { type?: string }).type ?? null;
      if (type && type !== "custom") {
        accountId = null;
      }
    }

    const { first, last } = splitName(fullName);
    if (!first || !last) return NextResponse.json({ error: "Informe nome e sobrenome." }, { status: 400 });

    if (!accountId) {
      const created = await stripe.accounts.create({
        type: "custom",
        country: "BR",
        business_type: "individual",
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
        metadata: { user_id: user.id, app: "reboqueSOS" },
      });
      accountId = created.id;
      await supabaseAdmin
        .from("tow_partners")
        .update({ stripe_account_id: accountId, updated_at: new Date().toISOString() })
        .eq("id", user.id);
    }

    const ip = getClientIp(request);
    const now = Math.floor(Date.now() / 1000);

    await stripe.accounts.update(accountId, {
      email,
      business_profile: { product_description: "Serviço de reboque sob demanda", mcc: "7549" },
      individual: {
        first_name: first,
        last_name: last,
        email,
        phone: phone.startsWith("55") && phone.length > 10 ? `+${phone}` : `+55${phone}`,
        dob: { day: dobDay, month: dobMonth, year: dobYear },
        address: {
          line1,
          line2: line2 || undefined,
          city,
          state,
          postal_code: postal,
          country,
        },
        id_number: cpf,
        political_exposure: "none",
      },
      tos_acceptance: ip ? { date: now, ip } : { date: now },
    });

    const routingNumber = `${bankCode}${branchCode}`;
    const accountNumberFinal = stripeTestMode ? "000123456789" : accountNumber;
    const bankTok = await stripe.tokens.create({
      bank_account: {
        country: bankCountry,
        currency,
        account_holder_name: fullName,
        account_holder_type: "individual",
        routing_number: routingNumber,
        account_number: accountNumberFinal,
      },
    });

    await stripe.accounts.createExternalAccount(accountId, {
      external_account: bankTok.id,
      default_for_currency: true,
    });

    return NextResponse.json({ ok: true, account_id: accountId }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao configurar Stripe.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
