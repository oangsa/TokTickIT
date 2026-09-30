import type { Prisma, PrismaClient } from "../generated/prisma/client.js";

import { canonicalResourcePath } from "./idempotencyRequest.js";

/* api-spec Section 8.5. */
export const PROCESSING_LEASE_SECONDS = 300;

/* api-spec Section 8.7. */
export const COMPLETED_RETENTION_HOURS = 24;

export type PrismaTransaction = Prisma.TransactionClient;

/*
 * The outcome of Section 8.2.1 steps 5-6. Only `OWNED` may continue to mutable
 * validation and mutation, and only while its exact `processingStartedAt`
 * still matches the stored claim (`IDEMPOTENCY-FENCING-A`).
 */
export type ClaimResolution =
  | { kind: "OWNED"; recordId: number; processingStartedAt: Date }
  | { kind: "REPLAY_TICKET"; ticketId: number }
  | { kind: "REPLAY_ACTION"; actionTakenId: number }
  | { kind: "CONFLICT" }
  | { kind: "WAIT" };

export interface ClaimInput {
  userId: number;
  method: string;
  resourcePath: string;
  key: string;
  requestHash: string;
  legacyRequestHash?: string;
  actor: string;
  now: Date;
}

export function staleCutoff(processingStartedAt: Date): Date {
  return new Date(processingStartedAt.getTime() + PROCESSING_LEASE_SECONDS * 1000);
}

/* Fresh is `now < STALE_CUTOFF`, so exactly 5m 00.000s is already stale. */
export function isFresh(processingStartedAt: Date, now: Date): boolean {
  return now.getTime() < staleCutoff(processingStartedAt).getTime();
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function matchesRequestHash(storedHash: string, input: ClaimInput): boolean {
  return storedHash === input.requestHash || storedHash === input.legacyRequestHash;
}

function acceptedRequestHashes(input: ClaimInput): string[] {
  return [...new Set([input.requestHash, input.legacyRequestHash].filter((hash): hash is string => hash !== undefined))];
}

export class IdempotencyService {
  constructor(private readonly prisma: PrismaClient) {}

  /*
   * api-spec Section 8.2.1. Resolves, establishes, or atomically reclaims the
   * unique `(userId, method, resourcePath, key)` claim. It never touches a Ticket or an
   * Attachment: mutation is gated behind an `OWNED` result and the fencing
   * check below.
   *
   * `attempt` bounds the re-resolution recursion. Each branch that loses a race
   * (a concurrent insert, a lost reclaim, a concurrently removed expired row)
   * refetches authoritative state instead of guessing, and every one of those
   * races is resolved by another request making progress -- so a small bound is
   * enough and a runaway loop is not possible.
   */
  async resolve(input: ClaimInput, attempt = 1): Promise<ClaimResolution> {
    if (attempt > 3) {
      /*
       * ponytail: three refetches is plenty for the races above; raise it only
       * if a real workload shows losers starving.
       */
      return { kind: "WAIT" };
    }

    const record = await this.prisma.idempotencyRecord.findUnique({
      where: { userId_method_resourcePath_key: this.identity(input) },
    });

    if (record === null) {
      return this.establish(input, attempt);
    }

    if (record.status === "COMPLETED") {
      /*
       * Logical expiry is `now >= expiresAt` (Section 8.7): at exact equality
       * the row is already expired even though cleanup has not deleted it.
       */
      if (record.expiresAt !== null && input.now.getTime() >= record.expiresAt.getTime()) {
        await this.prisma.idempotencyRecord.deleteMany({
          where: { id: record.id, status: "COMPLETED", expiresAt: { lte: input.now } },
        });

        return this.resolve(input, attempt + 1);
      }

      if (!matchesRequestHash(record.requestHash, input)) {
        return { kind: "CONFLICT" };
      }

      if (record.ticketId !== null) return { kind: "REPLAY_TICKET", ticketId: record.ticketId };
      if (record.actionTakenId !== null) return { kind: "REPLAY_ACTION", actionTakenId: record.actionTakenId };
      throw new Error("Completed idempotency record has no result");
    }

    /* PROCESSING. A different payload conflicts whether the claim is fresh or stale. */
    if (!matchesRequestHash(record.requestHash, input)) {
      return { kind: "CONFLICT" };
    }

    if (isFresh(record.processingStartedAt, input.now)) {
      return { kind: "WAIT" };
    }

    return this.reclaim(input, attempt);
  }

  private async establish(input: ClaimInput, attempt: number): Promise<ClaimResolution> {
    try {
      const created = await this.prisma.idempotencyRecord.create({
        data: {
          ...this.identity(input),
          key: input.key,
          requestHash: input.requestHash,
          status: "PROCESSING",
          processingStartedAt: input.now,
          createdBy: input.actor,
          updatedBy: input.actor,
        },
      });

      return {
        kind: "OWNED",
        recordId: created.id,
        processingStartedAt: created.processingStartedAt,
      };
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }

      /* Another request won the four-part identity race. */
      return this.resolve(input, attempt + 1);
    }
  }

  /*
   * api-spec Section 8.5. One atomic conditional update: the `WHERE` re-checks
   * identity, status, hash, and staleness, so two concurrent retries cannot both reclaim
   * -- the loser updates zero rows and refetches. The row is updated in place
   * and never deleted, which is what stops a different payload from taking over
   * the key.
   */
  private async reclaim(input: ClaimInput, attempt: number): Promise<ClaimResolution> {
    const cutoff = new Date(input.now.getTime() - PROCESSING_LEASE_SECONDS * 1000);

    const { count } = await this.prisma.idempotencyRecord.updateMany({
      where: {
        ...this.identity(input),
        key: input.key,
        status: "PROCESSING",
        requestHash: input.legacyRequestHash === undefined
          ? input.requestHash
          : { in: acceptedRequestHashes(input) },
        processingStartedAt: { lte: cutoff },
      },
      data: {
        processingStartedAt: input.now,
        updatedBy: input.actor,
        ...(input.legacyRequestHash === undefined ? {} : { requestHash: input.requestHash }),
      },
    });

    if (count === 0) {
      return this.resolve(input, attempt + 1);
    }

    const reclaimed = await this.prisma.idempotencyRecord.findUnique({
      where: { userId_method_resourcePath_key: this.identity(input) },
    });

    if (reclaimed === null) {
      return this.resolve(input, attempt + 1);
    }

    return {
      kind: "OWNED",
      recordId: reclaimed.id,
      processingStartedAt: reclaimed.processingStartedAt,
    };
  }

  /*
   * `IDEMPOTENCY-FENCING-A` (api-spec Section 8.5.1). Takes an exclusive row
   * lock and verifies the full identity, request hash, and fencing timestamp. The lock is held until the
   * surrounding transaction commits or rolls back, which is what blocks a
   * concurrent stale reclaim while the real owner is mutating.
   *
   * Raw SQL because `FOR UPDATE` has no Prisma query-builder equivalent; the
   * values are still bound parameters.
   */
  async lockAndVerify(
    tx: PrismaTransaction,
    input: Pick<ClaimInput, "userId" | "method" | "resourcePath" | "key" | "requestHash"> & { processingStartedAt: Date },
  ): Promise<boolean> {
    const identity = this.identity(input);
    const rows = await tx.$queryRaw<{ id: number }[]>`
      SELECT id
      FROM idempotency_record
      WHERE user_id = ${input.userId}
        AND method = ${identity.method}
        AND resource_path = ${identity.resourcePath}
        AND key = ${input.key}::uuid
        AND status = 'PROCESSING'
        AND request_hash = ${input.requestHash}
        AND processing_started_at = ${input.processingStartedAt}
      FOR UPDATE
    `;

    return rows.length === 1;
  }

  /* Section 8.7: `expiresAt = completedAt + 24 hours`. */
  async complete(
    tx: PrismaTransaction,
    input: { recordId: number; result: { ticketId: number } | { actionTakenId: number }; now: Date; actor: string },
  ): Promise<void> {
    await tx.idempotencyRecord.update({
      where: { id: input.recordId },
      data: {
        status: "COMPLETED",
        ...input.result,
        completedAt: input.now,
        expiresAt: new Date(input.now.getTime() + COMPLETED_RETENTION_HOURS * 3600 * 1000),
        updatedBy: input.actor,
      },
    });
  }

  /*
   * Section 8.6. A controlled failure removes the owned claim rather than
   * storing a FAILED state, so an unchanged retry may run again with the same
   * key. The `processingStartedAt` predicate makes this safe after a reclaim:
   * an old owner cleaning up cannot delete the new owner's claim.
   */
  async release(input: Pick<ClaimInput, "userId" | "method" | "resourcePath" | "key"> & { processingStartedAt: Date }): Promise<void> {
    await this.prisma.idempotencyRecord.deleteMany({
      where: {
        ...this.identity(input),
        status: "PROCESSING",
        processingStartedAt: input.processingStartedAt,
      },
    });
  }

  private identity(input: Pick<ClaimInput, "userId" | "method" | "resourcePath" | "key">) {
    return {
      userId: input.userId,
      method: input.method.toUpperCase(),
      resourcePath: canonicalResourcePath(input.resourcePath),
      key: input.key,
    };
  }
}
