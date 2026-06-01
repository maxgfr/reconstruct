export function getSessionSecret(): string {
  return process.env.NEXTAUTH_SECRET ?? "";
}

export function databaseUrl(): string {
  return process.env.DATABASE_URL ?? "";
}
