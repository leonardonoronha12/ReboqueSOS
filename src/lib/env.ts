export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

export function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value || undefined;
}

export function getRequiredEnvAny(names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(`Missing env: ${names.join(" | ")}`);
}

export function getOptionalEnvAny(names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}
