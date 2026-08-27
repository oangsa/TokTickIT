import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import { PENDING_ATTACHMENT_TTL_HOURS } from "./ticketService.js";

/* BR-81: at most 100 rows per cleanup transaction. */
export const CLEANUP_BATCH_SIZE = 100;

export interface CleanupSummary {
  pendingAttachments: number;
  idempotencyRecords: number;
}

interface LockedRow {
  id: number;
}

/*
 * Operational maintenance (api-spec Section 17.1, BR-80/81).
 *
 * Two jobs, both idempotent, both bounded: expired Pending Attachments and
 * logically expired COMPLETED Idempotency Records. Neither has an HTTP route and
 * neither runs on an in-process timer -- production scheduling is external, and
 * a cleanup endpoint would be a destructive operation reachable from a browser.
 *
 * `PROCESSING` records are never selected, deleted, or reclaimed here. Stale
 * reclaim is request-time behavior owned by `IdempotencyService.reclaim`, where
 * the fencing rules that make it safe already live; a background job with no
 * request to fence against would race the owner it is trying to replace.
 */
export class MaintenanceService {
  constructor(private readonly prisma: PrismaClient) {}

  async run(now: Date = new Date()): Promise<CleanupSummary> {
    return {
      pendingAttachments: await this.cleanupExpiredPendingAttachments(now),
      idempotencyRecords: await this.cleanupExpiredIdempotencyRecords(now),
    };
  }

  /*
   * BR-54: a Pending Attachment unbound for 24 hours is an orphan. The cutoff is
   * captured once for the whole run, so a job that takes a while does not widen
   * its own window batch by batch.
   *
   * The `ticket_id IS NULL AND deleted = false` predicate is repeated on the
   * delete, not just on the selection: `FOR UPDATE` already blocks a concurrent
   * binding, and `SKIP LOCKED` steps over a row another transaction is binding
   * right now, but the guard is what makes "never delete an Attachment after it
   * becomes Active" true of the statement itself.
   */
  async cleanupExpiredPendingAttachments(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - PENDING_ATTACHMENT_TTL_HOURS * 60 * 60 * 1000);

    return this.drain(async (tx) => {
      const locked = await tx.$queryRaw<LockedRow[]>`
        SELECT id FROM attachment
        WHERE ticket_id IS NULL AND deleted = false AND created_at <= ${cutoff}
        ORDER BY created_at, id
        LIMIT ${CLEANUP_BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      `;

      if (locked.length === 0) {
        return 0;
      }

      const { count } = await tx.attachment.deleteMany({
        where: { id: { in: locked.map((row) => row.id) }, ticketId: null, deleted: false },
      });

      return count;
    });
  }

  /*
   * BR-82. `expires_at` is written as `completed_at + 24 hours` and the CHECK
   * enforces it, so the logical-expiry test is a plain comparison against the
   * captured instant -- a record expiring exactly now is eligible.
   */
  async cleanupExpiredIdempotencyRecords(now: Date = new Date()): Promise<number> {
    return this.drain(async (tx) => {
      const locked = await tx.$queryRaw<LockedRow[]>`
        SELECT id FROM idempotency_record
        WHERE status = 'COMPLETED'::"IdempotencyStatus" AND expires_at <= ${now}
        ORDER BY expires_at, id
        LIMIT ${CLEANUP_BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      `;

      if (locked.length === 0) {
        return 0;
      }

      const { count } = await tx.idempotencyRecord.deleteMany({
        where: {
          id: { in: locked.map((row) => row.id) },
          status: "COMPLETED",
          expiresAt: { lte: now },
        },
      });

      return count;
    });
  }

  /*
   * Repeat-until-empty. Each batch is its own transaction, so a long backlog is
   * cleared without one transaction holding locks over all of it, and an
   * interrupted run leaves every completed batch committed. A batch that selects
   * nothing ends the loop: rows skipped because another transaction holds them
   * are simply not this run's work.
   */
  private async drain(
    batch: (tx: Prisma.TransactionClient) => Promise<number>,
  ): Promise<number> {
    let total = 0;

    for (;;) {
      const removed = await this.prisma.$transaction(batch);

      if (removed === 0) {
        return total;
      }

      total += removed;
    }
  }
}
