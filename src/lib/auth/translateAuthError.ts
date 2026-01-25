export function translateAuthError(message: string) {
  const original = String(message ?? "").trim();
  if (!original) return "Ocorreu um erro ao autenticar.";

  const lower = original.toLowerCase();

  if (lower.includes("password should be at least 6 characters")) {
    return "A senha deve ter pelo menos 6 caracteres.";
  }

  if (lower.includes("invalid login credentials")) {
    return "Telefone ou senha inválidos.";
  }

  if (lower.includes("email not confirmed")) {
    return "Seu acesso ainda não foi confirmado. Verifique seu email.";
  }

  if (lower.includes("user already registered")) {
    return "Usuário já cadastrado.";
  }

  if (lower.includes("invalid email")) {
    return "Email inválido.";
  }

  if (lower.includes("signup is disabled")) {
    return "Cadastro temporariamente desativado.";
  }

  return original;
}

