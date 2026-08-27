import { randomUUID } from "node:crypto";

import { ApiError, ErrorDetail } from "../http/errors.js";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import {
  MAX_ATTACHMENT_BYTES,
  payloadTooLargeError,
  removalReasonError,
  resolveUploadName,
} from "./attachmentRules.js";
import { MAX_ATTACHMENTS } from "./ticketCreateRequest.js";
import { AttachmentDTO, toAttachmentDTO } from "./ticketService.js";

/* BR-76: three transaction attempts in total, the first one included. */
const TRANSACTION_ATTEMPTS = 3;

/*
 * The retry delay is deliberately small and randomized. api-spec Section 11.5
 * leaves the exact milliseconds outside the wire contract, and the tests assert
 * the observable outcome (one 201, one 409, three attempts at most) rather than
 * a sleep duration -- so this number can change without changing behavior.
 */
const RETRY_DELAY_MS = 20;

/*
 * PostgreSQL serialization failure (`40001`) and deadlock (`40P01`).
 *
 * One failure wears several names on the way up. Prisma raises `P2034` when it
 * recognises the class; the pg driver adapter raises a `DriverAdapterError`
 * whose message is only `TransactionWriteConflict` and whose SQLSTATE is buried
 * in `cause.originalCode`. Matching just one spelling means a losing upload
 * escapes as a 500 instead of retrying into its 409, which is what the
 * concurrent PostgreSQL test caught.
 */
const TRANSIENT_CODES = new Set([
  "P2034",
  "40001",
  "40P01",
  "TransactionWriteConflict",
  "TransactionDeadlock",
]);

/*
 * The public Attachment identifier (api-spec Section 12.1). Matched before the
 * value reaches Prisma for the same reason `ticketService` matches its Ticket
 * identifier: `storage_key` is `@db.Uuid`, and a failed cast would be a 500 that
 * also names the column, where the contract requires the centralized 404.
 */
const STORAGE_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/*
 * A full 100-item batch is one read plus up to 100 guarded single-row
 * statements, each a round trip. Prisma's default interactive-transaction
 * budget is 5,000 ms, which a maximum batch can exhaust on any link slower than
 * a loopback -- and the failure is a `P2028` the error handler can only publish
 * as a 500.
 *
 * The statements stay one per row rather than being collapsed into two bulk
 * ones: the sorted single-row order below is what gives concurrent batches a
 * consistent lock order (Section 13.7), and a bulk `IN` would hand that order
 * back to the query planner. Buying headroom is the cheaper half of the trade.
 */
const COLLECTION_TRANSACTION_TIMEOUT_MS = 20_000;

export interface UploadedFileInput {
  filename: string;
  data: Buffer;
}

export interface CreatePendingInput {
  requesterId: number;
  actor: string;
  file: UploadedFileInput;
}

export interface CreateForTicketInput extends CreatePendingInput {
  publicId: string;
}

export interface AttachmentDeleteItem {
  attachmentId: string;
  reason: string;
}

export interface DeleteCollectionInput {
  requesterId: number;
  actor: string;
  items: AttachmentDeleteItem[];
}

export interface AttachmentBinary {
  data: Buffer;
  mimeType: string;
  originalName: string;
  sizeBytes: number;
}

interface ValidatedFile {
  originalName: string;
  extension: string;
  mimeType: string;
  /* Prisma types a `Bytes` column as `Uint8Array` over a plain `ArrayBuffer`,
   * which a Node `Buffer` is not, so the copy happens once here rather than at
   * both insert sites. */
  data: Uint8Array<ArrayBuffer>;
}

/*
 * Collects every code-shaped value on an error and everything it wraps. The
 * nesting is the driver adapter's, not ours: the SQLSTATE that decides whether a
 * failure is retryable sits two levels down, under a different property name
 * than the one Prisma's own errors use.
 */
function walkErrorCodes(error: unknown, seen = new Set<unknown>()): string[] {
  if (typeof error !== "object" || error === null || seen.has(error)) {
    return [];
  }

  seen.add(error);

  const source = error as {
    code?: unknown;
    originalCode?: unknown;
    kind?: unknown;
    cause?: unknown;
    meta?: unknown;
    driverAdapterError?: unknown;
  };

  const codes = [source.code, source.originalCode, source.kind].filter(
    (value): value is string => typeof value === "string",
  );

  return [
    ...codes,
    ...walkErrorCodes(source.cause, seen),
    ...walkErrorCodes(source.meta, seen),
    ...walkErrorCodes(source.driverAdapterError, seen),
  ];
}

/*
 * Only a genuine serialization/deadlock failure is transient. Anything else --
 * including every `ApiError` the callback throws for a business outcome -- must
 * surface on the first attempt, because retrying a 404 or a 409 would only
 * produce the same answer three times (api-spec Section 11.5).
 */
function isTransientConflict(error: unknown): boolean {
  return walkErrorCodes(error).some((code) => TRANSIENT_CODES.has(code));
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

interface TransactionOptions {
  isolationLevel?: "Serializable";
  timeout?: number;
}

/*
 * The bounded retry, shared by both transactional paths.
 *
 * An `ApiError` is a business outcome the transaction reached on purpose -- a
 * 404, a 409, a validation failure -- and running it again produces the same
 * answer three times, so it leaves on the first attempt (api-spec Section 11.5).
 * Only a serialization failure or a deadlock is worth a second look, and
 * exhausting the attempts on contention alone falls through to the centralized
 * 500: Lab 2 defines no Service Unavailable variant.
 */
async function runTransactionWithRetry<T>(
  prisma: PrismaClient,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
  options: TransactionOptions,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await prisma.$transaction(work, options);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (attempt >= TRANSACTION_ATTEMPTS || !isTransientConflict(error)) {
        throw error;
      }

      await delay(Math.random() * RETRY_DELAY_MS);
    }
  }
}

/*
 * api-spec Section 11.5. Prisma's default PostgreSQL isolation is explicitly not
 * trusted for the Active-count-then-insert pair: only `Serializable` makes the
 * count a promise the commit will keep, so two concurrent uploads to a Ticket at
 * four Active Attachments cannot both read four and both insert.
 */
export async function runSerializable<T>(
  prisma: PrismaClient,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return runTransactionWithRetry(prisma, work, { isolationLevel: "Serializable" });
}

export class AttachmentService {
  constructor(private readonly prisma: PrismaClient) {}

  /*
   * api-spec Section 11.4. A Pending Attachment is owned by its uploader and
   * bound to no Ticket. It is not Ticket evidence yet: `POST /api/tickets`
   * binding is what makes it Active, and an unbound row is cleanup-eligible
   * after 24 hours.
   */
  async createPending(input: CreatePendingInput): Promise<AttachmentDTO> {
    const file = validateFile(input.file);

    const row = await this.prisma.attachment.create({
      data: {
        storageKey: randomUUID(),
        ticketId: null,
        uploadedByRequesterId: input.requesterId,
        originalName: file.originalName,
        extension: file.extension,
        mimeType: file.mimeType,
        sizeBytes: file.data.length,
        data: file.data,
        createdBy: input.actor,
        updatedBy: input.actor,
      },
      omit: { data: true },
    });

    return toAttachmentDTO(row, null);
  }

  /*
   * api-spec Section 11.5. Resolving the owned Ticket, counting its Active
   * Attachments, and inserting the new one all happen inside the one
   * `Serializable` transaction -- splitting them would make the count advisory.
   */
  async createForTicket(input: CreateForTicketInput): Promise<AttachmentDTO> {
    /* Validated before the transaction opens: a bad file is not a contended one. */
    const file = validateFile(input.file);

    if (!STORAGE_KEY_PATTERN.test(input.publicId)) {
      throw new ApiError("NOT_FOUND");
    }

    return runSerializable(this.prisma, async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: { publicId: input.publicId, requesterId: input.requesterId, deleted: false },
        select: { id: true, publicId: true },
      });

      /* Missing, logically deleted, and owned by someone else are one answer. */
      if (ticket === null) {
        throw new ApiError("NOT_FOUND");
      }

      const active = await tx.attachment.count({
        where: { ticketId: ticket.id, deleted: false },
      });

      /* BR-47. Removed rows are not counted, so a removal frees a slot. */
      if (active >= MAX_ATTACHMENTS) {
        throw new ApiError("CONFLICT");
      }

      const row = await tx.attachment.create({
        data: {
          storageKey: randomUUID(),
          ticketId: ticket.id,
          uploadedByRequesterId: input.requesterId,
          originalName: file.originalName,
          extension: file.extension,
          mimeType: file.mimeType,
          sizeBytes: file.data.length,
          data: file.data,
          createdBy: input.actor,
          updatedBy: input.actor,
        },
        omit: { data: true },
      });

      return toAttachmentDTO(row, ticket.publicId);
    });
  }

  /*
   * api-spec Section 12.1. Pending, Active, and Removed owned Attachments all
   * answer metadata: a Removed row stays readable so Ticket Detail can keep
   * showing what was attached and why it was removed (Section 14.3).
   */
  async findMetadata(requesterId: number, storageKey: string): Promise<AttachmentDTO | null> {
    if (!STORAGE_KEY_PATTERN.test(storageKey)) {
      return null;
    }

    const row = await this.prisma.attachment.findFirst({
      where: ownedAttachmentWhere(requesterId, storageKey),
      omit: { data: true },
      include: { ticket: { select: { publicId: true } } },
    });

    return row === null ? null : toAttachmentDTO(row, row.ticket?.publicId ?? null);
  }

  /*
   * api-spec Sections 12.2 and 12.3. The one read that pulls `data`, which is
   * why nothing else selects it. A Removed Attachment is `410 Gone` rather than
   * `404`: the Requester owns it and can still see its metadata, so pretending
   * it never existed would contradict the row they are looking at.
   */
  async findBinary(requesterId: number, storageKey: string): Promise<AttachmentBinary | null> {
    if (!STORAGE_KEY_PATTERN.test(storageKey)) {
      return null;
    }

    /*
     * `deleted` is in the WHERE rather than checked on the answer, so a Removed
     * Attachment never has its `data` column read out of the database only to be
     * thrown away -- which for a row at MAX_ATTACHMENT_BYTES is the whole file.
     */
    const row = await this.prisma.attachment.findFirst({
      where: { ...ownedAttachmentWhere(requesterId, storageKey), deleted: false },
      select: { data: true, mimeType: true, originalName: true, sizeBytes: true },
    });

    if (row !== null) {
      return {
        data: Buffer.from(row.data),
        mimeType: row.mimeType,
        originalName: row.originalName,
        sizeBytes: row.sizeBytes,
      };
    }

    /*
     * Nothing readable, so the second query decides between the two ways of
     * having none: a Removed row the Requester owns is `410`, anything else is
     * the safe `404`. It selects the id alone and is only reached on the miss
     * path, which is the rare one -- the UI offers preview and download for
     * Pending and Active rows only.
     */
    const removed = await this.prisma.attachment.findFirst({
      where: ownedAttachmentWhere(requesterId, storageKey),
      select: { id: true },
    });

    if (removed !== null) {
      throw new ApiError("GONE");
    }

    return null;
  }

  /*
   * api-spec Section 13. One endpoint, two behaviors chosen by each row's
   * persisted lifecycle rather than by anything the client claims: a Pending row
   * is hard-deleted with its binary and its reason ignored, an Active row is
   * soft-removed with a required reason and its binary retained as evidence.
   *
   * The whole batch is validated before a single mutation runs, and every
   * mutation is guarded by the state it was validated against. If a row moved
   * underneath us -- a Pending Attachment bound to a Ticket by a concurrent
   * create between the read and the delete -- the guard affects no row, the
   * batch raises, and the transaction rolls back. That is what makes "cleanup
   * never deletes an Attachment after it becomes Active" a property of the
   * statement rather than of the timing.
   */
  async deleteCollection(input: DeleteCollectionInput): Promise<void> {
    const storageKeys = input.items.map((item) => item.attachmentId);
    const reasons = new Map(input.items.map((item) => [item.attachmentId, item.reason]));

    await runTransactionWithRetry(
      this.prisma,
      async (tx) => {
        const rows = await tx.attachment.findMany({
          where: {
            storageKey: { in: storageKeys },
            OR: ownershipBranches(input.requesterId),
          },
          select: { id: true, storageKey: true, ticketId: true, deleted: true },
        });

        const found = new Map(rows.map((row) => [row.storageKey, row]));
        const details: ErrorDetail[] = [];

        for (const [index, item] of input.items.entries()) {
          const row = found.get(item.attachmentId);

          /*
           * Unavailable, outside this Requester's scope, and already Removed are
           * the same centralized 404, and any one of them leaves the whole batch
           * unchanged (Sections 13.4 and 13.6).
           */
          if (row === undefined || row.deleted) {
            throw new ApiError("NOT_FOUND");
          }

          if (row.ticketId === null) {
            /* Pending: the reason is ignored and may be empty. */
            continue;
          }

          const message = removalReasonError(item.reason.trim());

          if (message !== null) {
            details.push({ field: `items[${index}].reason`, message });
          }
        }

        if (details.length > 0) {
          throw new ApiError("VALIDATION_ERROR", details);
        }

        /*
         * Sorted by the public identifier so concurrent batches sharing rows take
         * their locks in the same order. It reduces inconsistent lock ordering
         * rather than claiming to prevent every deadlock (Section 13.7).
         */
        const ordered = [...found.values()].sort((left, right) =>
          left.storageKey.localeCompare(right.storageKey),
        );
        const now = new Date();

        for (const row of ordered) {
          if (row.ticketId === null) {
            const { count } = await tx.attachment.deleteMany({
              where: { id: row.id, ticketId: null, deleted: false },
            });

            if (count !== 1) {
              throw new ApiError("CONFLICT");
            }

            continue;
          }

          const { count } = await tx.attachment.updateMany({
            where: { id: row.id, deleted: false },
            data: {
              deleted: true,
              removalReason: (reasons.get(row.storageKey) ?? "").trim(),
              updatedBy: input.actor,
              updatedAt: now,
            },
          });

          if (count !== 1) {
            throw new ApiError("CONFLICT");
          }
        }
      },
      /*
       * Headroom for a maximum batch's round trips; see the constant above.
       *
       * No `Serializable` here: every statement below is guarded by the state it
       * was validated against, so the default isolation already refuses to act on
       * a row that moved. What the retry adds is the deadlock two overlapping
       * batches can still reach -- the sorted lock order reduces those but does
       * not rule them out (Section 13.7), and without a retry one surfaces as a
       * 500 for a batch that would succeed on a second run. A guard that fires
       * raises an `ApiError`, which leaves on the first attempt.
       */
      { timeout: COLLECTION_TRANSACTION_TIMEOUT_MS },
    );
  }
}

/*
 * api-spec Section 14.2. A Pending Attachment belongs to whoever uploaded it; a
 * bound one belongs to whoever owns its Ticket. Both branches live in the
 * `where`, never in a check on the answer, so no route or hand-made request
 * reaches a row this Requester does not own.
 */
function ownershipBranches(requesterId: number): Prisma.AttachmentWhereInput[] {
  return [
    { ticketId: null, uploadedByRequesterId: requesterId },
    { ticket: { requesterId, deleted: false } },
  ];
}

function ownedAttachmentWhere(
  requesterId: number,
  storageKey: string,
): Prisma.AttachmentWhereInput {
  return { storageKey, OR: ownershipBranches(requesterId) };
}

/*
 * The upload rules, applied in the service rather than only in the multipart
 * middleware, so they hold for every caller and can be tested without an HTTP
 * request. The size check repeats what the parser's `fileSize` limit already
 * enforces: the two are independent, and the database CHECK is a third.
 */
function validateFile(file: UploadedFileInput): ValidatedFile {
  if (file.data.length === 0) {
    throw new ApiError("VALIDATION_ERROR", [
      { field: "file", message: "The uploaded file must not be empty." },
    ]);
  }

  if (file.data.length > MAX_ATTACHMENT_BYTES) {
    throw payloadTooLargeError();
  }

  const data = new Uint8Array(file.data.byteLength);
  data.set(file.data);

  return { ...resolveUploadName(file.filename), data };
}
