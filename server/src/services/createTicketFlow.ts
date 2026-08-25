import { ApiError } from "../http/errors.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import { ClaimResolution, IdempotencyService } from "./idempotencyService.js";
import { FencedOutError, TicketDTO, TicketService, toTicketDTO } from "./ticketService.js";
import { CreateTicketPayload, hashCreateTicketPayload } from "./ticketCreateRequest.js";

/*
 * api-spec Section 8.2.1: a same-hash request that meets a fresh PROCESSING
 * claim waits for the winner rather than starting a second operation. The wait
 * is bounded so a request cannot hang until the socket dies.
 */
export const WAIT_POLL_MS = 50;
export const WAIT_ATTEMPTS = 40;

/*
 * One fenced owner can be pushed back to resolution at most this many times
 * before something is badly wrong; each round requires another attempt to have
 * reclaimed the lease, so it is not a spin.
 */
const FENCE_ROUNDS = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface CreateTicketFlowInput {
  requesterId: number;
  actor: string;
  key: string;
  payload: CreateTicketPayload;
}

export interface CreateTicketFlowResult {
  status: 200 | 201;
  ticket: TicketDTO;
}

/*
 * Resolves the claim, waiting out a fresh same-hash PROCESSING winner.
 * Exhausting the bound is the one outcome the contract leaves undefined; it
 * reuses the BR-76 precedent that exhausted bounded contention returns the
 * centralized safe 500 rather than inventing a Service Unavailable variant Lab 2
 * does not define.
 *
 * ponytail: polling, not a notification. LISTEN/NOTIFY or an advisory-lock wait
 * would cut the latency, and is worth it only if real concurrent retries show up.
 */
async function resolveClaim(
  idempotency: IdempotencyService,
  input: { requesterId: number; key: string; requestHash: string; actor: string },
): Promise<Exclude<ClaimResolution, { kind: "WAIT" }>> {
  for (let attempt = 0; attempt < WAIT_ATTEMPTS; attempt += 1) {
    const resolution = await idempotency.resolve({ ...input, now: new Date() });

    if (resolution.kind !== "WAIT") {
      return resolution;
    }

    await sleep(WAIT_POLL_MS);
  }

  throw new ApiError("INTERNAL_SERVER_ERROR");
}

/*
 * Steps 5-8 of the Ticket-create processing order. Parsing, canonicalization,
 * and hashing happen in the route; this owns claim ownership, fencing, and the
 * resource transaction.
 *
 * Exported so the PostgreSQL concurrency suites drive the same code path a real
 * request does instead of a second copy of it.
 */
export async function runCreateTicket(
  prisma: PrismaClient,
  input: CreateTicketFlowInput,
): Promise<CreateTicketFlowResult> {
  const idempotency = new IdempotencyService(prisma);
  const tickets = new TicketService(prisma, idempotency);
  const requestHash = hashCreateTicketPayload(input.payload);
  const claimInput = {
    requesterId: input.requesterId,
    key: input.key,
    requestHash,
    actor: input.actor,
  };

  /*
   * The loop exists for one case: this attempt owned the claim, entered the
   * transaction, and was fenced out because a stale retry reclaimed the lease.
   * Section 8.5.1 sends that owner back to normal wait/replay resolution.
   */
  for (let round = 0; round < FENCE_ROUNDS; round += 1) {
    const resolution = await resolveClaim(idempotency, claimInput);

    if (resolution.kind === "CONFLICT") {
      throw new ApiError("IDEMPOTENCY_CONFLICT");
    }

    if (resolution.kind === "REPLAY") {
      /*
       * Section 8.3: resolved before any mutable validation, and reconstructed
       * from current state, so Attachments that became Active on the original
       * commit -- or were added or removed later -- appear without changing the
       * original request hash.
       */
      const existing = await tickets.findForDto(resolution.ticketId);

      if (existing === null) {
        throw new ApiError("INTERNAL_SERVER_ERROR");
      }

      return { status: 200, ticket: toTicketDTO(existing) };
    }

    try {
      const ticket = await tickets.create({
        requesterId: input.requesterId,
        actor: input.actor,
        key: input.key,
        requestHash,
        recordId: resolution.recordId,
        processingStartedAt: resolution.processingStartedAt,
        payload: input.payload,
        now: new Date(),
      });

      return { status: 201, ticket };
    } catch (error) {
      if (error instanceof FencedOutError) {
        continue;
      }

      /*
       * Section 8.6: a controlled failure removes the owned claim instead of
       * storing a FAILED state, so an unchanged retry may run again with the
       * same key. The transaction rolled back, so there is no Ticket or binding
       * to compensate. The predicate on `processingStartedAt` keeps this from
       * deleting a claim another attempt has already reclaimed.
       */
      await idempotency.release({
        requesterId: input.requesterId,
        key: input.key,
        processingStartedAt: resolution.processingStartedAt,
      });

      throw error;
    }
  }

  throw new ApiError("INTERNAL_SERVER_ERROR");
}
