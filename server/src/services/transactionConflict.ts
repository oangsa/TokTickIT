import { ApiError } from "../http/errors.js";

const CONFLICT_CODES = new Set([
  "P2034", "40001", "40P01", "TransactionWriteConflict", "TransactionDeadlock",
]);

// Prisma and the PostgreSQL adapter wrap SQLSTATE in different nested fields.
export function isTransactionConflict(error: unknown, seen = new Set<unknown>()): boolean {
  if (error instanceof ApiError || typeof error !== "object" || error === null || seen.has(error)) return false;
  seen.add(error);
  const source = error as Record<string, unknown>;
  if ([source.code, source.originalCode, source.kind].some((value) => typeof value === "string" && CONFLICT_CODES.has(value))) return true;
  if (typeof source.message === "string" && /\b(TransactionWriteConflict|TransactionDeadlock)\b/.test(source.message)) return true;
  return [source.cause, source.meta, source.driverAdapterError].some((nested) => isTransactionConflict(nested, seen));
}
