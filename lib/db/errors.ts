/** Postgres SQLSTATE helpers shared by services and the ingestion pipeline. */

export function sqlState(err: unknown): string | undefined {
  const candidate = err as { code?: string; cause?: { code?: string } };
  return candidate?.cause?.code ?? candidate?.code;
}

export function isUniqueViolation(err: unknown): boolean {
  return sqlState(err) === "23505";
}
