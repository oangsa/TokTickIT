import { randomUUID } from "node:crypto";

import { ApiError } from "../http/errors.js";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import { IdempotencyService, PrismaTransaction } from "./idempotencyService.js";
import { MAX_ATTACHMENTS, CreateTicketPayload } from "./ticketCreateRequest.js";
import { generateTicketNumber } from "./ticketNumber.js";

/* BR-03: at most three Ticket-creation attempts for Ticket Number collisions. */
export const TICKET_NUMBER_ATTEMPTS = 3;

/* Fixed identifier: savepoint names cannot be bound parameters. */
const TICKET_NUMBER_SAVEPOINT = "ticket_number_attempt";

/* BR-54: a Pending Attachment is cleanup-eligible 24 hours after creation. */
export const PENDING_ATTACHMENT_TTL_HOURS = 24;

/*
 * Everything the full TicketDTO needs in one query (api-spec Section 5.5).
 * Category and Related System are loaded by relation rather than re-validated,
 * because Ticket metadata is historical: a Ticket keeps resolving its names
 * after the master row goes inactive or is logically deleted (BR-72-73).
 *
 * `data` is omitted: the Attachment DTO carries `sizeBytes`, never the bytes.
 * Without this, every create, replay, and detail read pulls up to five
 * 5,000,000-byte blobs (MAX_ATTACHMENT_BYTES) into memory only to discard them.
 */
const TICKET_DTO_INCLUDE = {
  requester: true,
  category: true,
  relatedSystem: true,
  attachments: { orderBy: { id: "asc" }, omit: { data: true } },
} satisfies Prisma.TicketInclude;

type TicketWithRelations = Prisma.TicketGetPayload<{ include: typeof TICKET_DTO_INCLUDE }>;

type AttachmentRow = TicketWithRelations["attachments"][number];

export interface AttachmentDTO {
  attachmentId: string;
  ticketPublicId: string | null;
  originalName: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  removalReason: string | null;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  deleted: boolean;
}

export interface TicketDTO {
  publicId: string;
  ticketNumber: string;
  requesterId: number;
  requesterName: string;
  requesterEmail: string;
  categoryId: number;
  categoryName: string;
  relatedSystemId: number;
  relatedSystemName: string;
  summary: string;
  description: string;
  requestedPriority: "LOW" | "MEDIUM" | "HIGH";
  currentStatus: "NEW";
  attachments: AttachmentDTO[];
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  deleted: boolean;
}

/*
 * The public Attachment identifier is the opaque storageKey, never the row id.
 *
 * Exported for `attachmentService.ts`, which answers the same DTO from the
 * standalone Attachment endpoints. One mapper, so a field can never be spelled
 * one way inside a Ticket and another way beside it.
 */
export function toAttachmentDTO(row: AttachmentRow, ticketPublicId: string | null): AttachmentDTO {
  return {
    attachmentId: row.storageKey,
    ticketPublicId: row.ticketId === null ? null : ticketPublicId,
    originalName: row.originalName,
    extension: row.extension,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    removalReason: row.removalReason,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt.toISOString(),
    deleted: row.deleted,
  };
}

export function toTicketDTO(ticket: TicketWithRelations): TicketDTO {
  return {
    publicId: ticket.publicId,
    ticketNumber: ticket.ticketNumber,
    requesterId: ticket.requesterId,
    requesterName: ticket.requester.name,
    requesterEmail: ticket.requester.email,
    categoryId: ticket.categoryId,
    categoryName: ticket.category.name,
    relatedSystemId: ticket.relatedSystemId,
    relatedSystemName: ticket.relatedSystem.name,
    summary: ticket.summary,
    description: ticket.description,
    requestedPriority: ticket.requestedPriority,
    currentStatus: ticket.currentStatus,
    attachments: ticket.attachments.map((row) => toAttachmentDTO(row, ticket.publicId)),
    createdBy: ticket.createdBy,
    createdAt: ticket.createdAt.toISOString(),
    updatedBy: ticket.updatedBy,
    updatedAt: ticket.updatedAt.toISOString(),
    deleted: ticket.deleted,
  };
}

/*
 * The public route identifier for Ticket Detail (api-spec Section 8.6).
 *
 * `ticketCreateRequest.ts` and `transport.ts` keep their own copies for the
 * same reason they do not share with each other: one guards a body field, one a
 * header, and this one guards a route parameter. Three contracts that happen to
 * agree on a shape today are not one contract.
 */
const PUBLIC_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/*
 * Ticket Detail read (api-spec Section 8.6). Ownership and the soft-delete flag
 * are part of the `where`, not a check on the result, so there is no route,
 * header, or hand-made request that reaches a Ticket this Requester does not
 * own. A miss of any kind returns null and the route answers the one
 * centralized 404, so cross-owner existence is never distinguishable from
 * absence (BR-17a, AC-22).
 */
export async function findTicketForRequester(
  prisma: PrismaClient,
  requesterId: number,
  publicId: string,
): Promise<TicketDTO | null> {
  /*
   * The route reads `req.requesterId`, which is optional on the Express type
   * and arrives here through an `as number` cast. Prisma reads `undefined` in a
   * `where` as "predicate not supplied", so an unresolved Requester would drop
   * the ownership predicate and answer 200 with another Requester's Ticket.
   * `requireRequesterContext` covers this route today; this makes a future gap
   * in that cover a loud 500 instead of a scope leak.
   */
  if (!Number.isSafeInteger(requesterId) || requesterId <= 0) {
    throw new Error("findTicketForRequester requires a resolved Requester.");
  }

  /*
   * A malformed identifier is the same 404 as a missing one (api-spec Section
   * 4.4). It must not reach Prisma to get there: `publicId` is `@db.Uuid`, and
   * a failed cast is a 500 that also names the column.
   */
  if (!PUBLIC_ID_PATTERN.test(publicId)) {
    return null;
  }

  const ticket = await prisma.ticket.findFirst({
    where: { publicId, requesterId, deleted: false },
    include: TICKET_DTO_INCLUDE,
  });

  return ticket === null ? null : toTicketDTO(ticket);
}

function isTicketNumberCollision(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  const { code, meta } = error as { code?: unknown; meta?: { target?: unknown } };
  const target = meta?.target;

  return (
    code === "P2002" &&
    (typeof target === "string"
      ? target.includes("ticket_number")
      : Array.isArray(target) && target.some((name) => String(name).includes("ticket_number")))
  );
}

/*
 * Thrown when `IDEMPOTENCY-FENCING-A` rejects the caller: a stale retry
 * reclaimed the lease while this owner was working. The transaction rolls back
 * with no Ticket or Attachment mutation and the route resumes normal
 * wait/replay resolution (api-spec Section 8.5.1).
 */
export class FencedOutError extends Error {
  constructor() {
    super("The idempotency claim was reclaimed by another attempt.");
    this.name = "FencedOutError";
  }
}

export interface CreateTicketInput {
  requesterId: number;
  actor: string;
  key: string;
  requestHash: string;
  recordId: number;
  processingStartedAt: Date;
  payload: CreateTicketPayload;
  now: Date;
}

export class TicketService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly idempotency: IdempotencyService,
  ) {}

  findForDto(ticketId: number): Promise<TicketWithRelations | null> {
    return this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: TICKET_DTO_INCLUDE,
    });
  }

  /*
   * api-spec Section 8.2.1 step 8. One transaction: fence the claim, run the
   * final mutable validation, create the Ticket, bind every referenced Pending
   * Attachment, and complete the claim. A rollback anywhere leaves no Ticket and
   * no partial binding, and the referenced rows stay Pending (BR-52).
   *
   * Nothing here runs before `lockAndVerify` returns true, which is what makes
   * an abandoned PROCESSING claim safe: it can have no committed mutation.
   */
  async create(input: CreateTicketInput): Promise<TicketDTO> {
    const ticketId = await this.prisma.$transaction(async (tx) => {
      const owns = await this.idempotency.lockAndVerify(tx, {
        requesterId: input.requesterId,
        key: input.key,
        requestHash: input.requestHash,
        processingStartedAt: input.processingStartedAt,
      });

      if (!owns) {
        throw new FencedOutError();
      }

      await this.validateMutableReferences(tx, input);
      const attachments = await this.lockPendingAttachments(tx, input);

      const ticket = await this.insertTicket(tx, input);

      if (attachments.length > 0) {
        /*
         * The `ticketId`/`deleted` predicate is the binding guard, not a
         * repetition of the read above. The read is not locking, so a
         * concurrent create can bind the same row between the two statements;
         * under READ COMMITTED this UPDATE then blocks on that row lock and
         * re-evaluates its `WHERE` after the winner commits. Matching on `id`
         * alone would silently rebind the row and move it off the other Ticket.
         */
        const { count } = await tx.attachment.updateMany({
          where: {
            id: { in: attachments.map((row) => row.id) },
            ticketId: null,
            deleted: false,
          },
          data: { ticketId: ticket.id, updatedBy: input.actor },
        });

        if (count !== attachments.length) {
          throw new ApiError("CONFLICT");
        }
      }

      await this.idempotency.complete(tx, {
        recordId: input.recordId,
        ticketId: ticket.id,
        now: input.now,
        actor: input.actor,
      });

      return ticket.id;
    });

    /*
     * Read back outside the transaction so the response carries the same
     * committed representation a later GET would return, relations included.
     */
    const created = await this.findForDto(ticketId);

    if (created === null) {
      throw new ApiError("INTERNAL_SERVER_ERROR");
    }

    return toTicketDTO(created);
  }

  /*
   * The final mutable check (Section 7.3): the master rows must be active and
   * non-deleted *now*, not when the request was parsed. A completed replay
   * deliberately never reaches this method.
   */
  private async validateMutableReferences(
    tx: PrismaTransaction,
    input: CreateTicketInput,
  ): Promise<void> {
    const [category, relatedSystem] = await Promise.all([
      tx.category.findFirst({
        where: { id: input.payload.categoryId, deleted: false, isActive: true },
      }),
      tx.relatedSystem.findFirst({
        where: { id: input.payload.relatedSystemId, deleted: false, isActive: true },
      }),
    ]);

    const details = [];

    if (category === null) {
      details.push({ field: "categoryId", message: "Select an available Category." });
    }

    if (relatedSystem === null) {
      details.push({ field: "relatedSystemId", message: "Select an available Related System." });
    }

    if (details.length > 0) {
      throw new ApiError("VALIDATION_ERROR", details);
    }
  }

  /*
   * BR-51. Each referenced Attachment must be owned, Pending (`ticketId = null`,
   * `deleted = false`), and unexpired. This read does not lock: it exists to
   * produce the safe 404/409 split below, and the binding UPDATE in `create`
   * re-checks Pending state under the row lock. Rows are ordered by id so
   * concurrent creates queue on them in the same order (Section 7.3); that
   * reduces deadlocks and is not claimed to prevent every one.
   *
   * A row that is missing or belongs to another Requester is the same safe
   * `404` as unavailable, so the response never reveals cross-owner existence.
   * An owned row that is no longer bindable is a `409`.
   */
  private async lockPendingAttachments(
    tx: PrismaTransaction,
    input: CreateTicketInput,
  ): Promise<{ id: number }[]> {
    const storageKeys = input.payload.attachmentIds;

    if (storageKeys.length === 0) {
      return [];
    }

    if (storageKeys.length > MAX_ATTACHMENTS) {
      throw new ApiError("CONFLICT");
    }

    const owned = await tx.attachment.findMany({
      where: { storageKey: { in: storageKeys }, uploadedByRequesterId: input.requesterId },
      orderBy: { id: "asc" },
    });

    if (owned.length !== storageKeys.length) {
      throw new ApiError("NOT_FOUND");
    }

    const expiryCutoff = new Date(
      input.now.getTime() - PENDING_ATTACHMENT_TTL_HOURS * 3600 * 1000,
    );

    for (const row of owned) {
      const bindable =
        row.ticketId === null && !row.deleted && row.createdAt.getTime() > expiryCutoff.getTime();

      if (!bindable) {
        throw new ApiError("CONFLICT");
      }
    }

    return owned.map((row) => ({ id: row.id }));
  }

  /*
   * BR-01-03. The Ticket Number is generated, not read from the request, and a
   * unique-constraint collision is retried a bounded number of times. Every
   * other field the client is forbidden to send -- requester, publicId, status,
   * audit actors, deletion flag -- is derived here.
   *
   * Each attempt runs inside its own savepoint. A unique violation puts the
   * whole PostgreSQL transaction into the aborted state (SQLSTATE `25P02`), in
   * which every later statement fails; without the rollback below the retry
   * would take down the create transaction it is meant to save. The savepoint
   * name is a fixed literal, never interpolated input.
   */
  private async insertTicket(tx: PrismaTransaction, input: CreateTicketInput) {
    for (let attempt = 1; attempt <= TICKET_NUMBER_ATTEMPTS; attempt += 1) {
      await tx.$executeRawUnsafe(`SAVEPOINT ${TICKET_NUMBER_SAVEPOINT}`);

      try {
        const ticket = await tx.ticket.create({
          data: {
            /* The schema has no database default: publicId is generated here. */
            publicId: randomUUID(),
            ticketNumber: generateTicketNumber(input.now),
            requesterId: input.requesterId,
            categoryId: input.payload.categoryId,
            relatedSystemId: input.payload.relatedSystemId,
            summary: input.payload.summary,
            requestedPriority: input.payload.requestedPriority,
            description: input.payload.description,
            currentStatus: "NEW",
            deleted: false,
            createdBy: input.actor,
            updatedBy: input.actor,
          },
        });

        await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${TICKET_NUMBER_SAVEPOINT}`);
        return ticket;
      } catch (error) {
        await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${TICKET_NUMBER_SAVEPOINT}`);

        if (!isTicketNumberCollision(error) || attempt === TICKET_NUMBER_ATTEMPTS) {
          throw error;
        }
      }
    }

    /* Unreachable: the loop either returns or rethrows on its last attempt. */
    throw new ApiError("INTERNAL_SERVER_ERROR");
  }
}
