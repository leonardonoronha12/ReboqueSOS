export const TOW_REQUEST_TTL_MS = 3 * 60 * 1000;

export function getTowRequestExpiresAtMs(createdAt: string | null | undefined) {
  if (!createdAt) return null;
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return null;
  return t + TOW_REQUEST_TTL_MS;
}

export function isTowRequestExpired(input: { createdAt: string | null | undefined; status?: string | null; acceptedProposalId?: string | null }) {
  const status = String(input.status ?? "");
  if (status !== "PENDENTE" && status !== "PROPOSTA_RECEBIDA") return false;
  if (input.acceptedProposalId) return false;
  const exp = getTowRequestExpiresAtMs(input.createdAt);
  if (exp == null) return false;
  return Date.now() > exp;
}

