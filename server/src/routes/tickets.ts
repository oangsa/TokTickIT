import { NextFunction, Request, Response, Router } from "express";

import { ApiError } from "../http/errors.js";
import { getPrisma } from "../prisma.js";
import { ClaimResolution, IdempotencyService } from "../services/idempotencyService.js";
import { FencedOutError, TicketService, toTicketDTO } from "../services/ticketService.js";
import { parseCreateTicketRequest, parseIdempotencyKey } from "../services/ticketCreateRequest.js";

export const ticketsRouter = Router();

/*
 * api-spec Section 8.2.1: a same-hash request that meets a fresh PROCESSING
 * claim waits for the winner rather than starting a second operation. The wait
 * is bounded so a request cannot hang until the socket dies.
 */
const WAIT_POLL_MS = 50;
const WAIT_ATTEMPTS = 40;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/*
 * Resolves the claim, waiting out a fresh same-hash PROCESSING winner. Exhausting
 * the bound is the one outcome the contract leaves undefined; it reuses the
 * BR-76 precedent that exhausted bounded contention returns the centralized safe
 * 500 rather than inventing a Service Unavailable variant Lab 2 does not define.
 *
 * ponytail: polling, not a notification. A LISTEN/NOTIFY or advisory-lock wait
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

ticketsRouter.post("/tickets", async (req: Request, res: Response, next: NextFunction) => {
  try {
    /* Steps 1-4: parse, validate for canonicalization, canonicalize, hash. */
    const key = parseIdempotencyKey(req.header("Idempotency-Key"));
    const { payload, requestHash } = parseCreateTicketRequest(req.body);

    const requesterId = req.requesterId as number;
    const actor = req.requesterEmail as string;

    const prisma = getPrisma();
    const idempotency = new IdempotencyService(prisma);
    const tickets = new TicketService(prisma, idempotency);
    const claimInput = { requesterId, key, requestHash, actor };

    /*
     * The loop exists for one case: this attempt owned the claim, entered the
     * transaction, and was fenced out because a stale retry reclaimed the lease.
     * Section 8.5.1 sends that owner back to normal wait/replay resolution.
     */
    for (let round = 0; round < 3; round += 1) {
      const resolution = await resolveClaim(idempotency, claimInput);

      if (resolution.kind === "CONFLICT") {
        throw new ApiError("IDEMPOTENCY_CONFLICT");
      }

      if (resolution.kind === "REPLAY") {
        /*
         * Section 8.3: resolved before any mutable validation, and reconstructed
         * from current state, so Attachments that became Active on the original
         * commit -- or were added or removed later -- appear without changing
         * the original request hash.
         */
        const existing = await tickets.findForDto(resolution.ticketId);

        if (existing === null) {
          throw new ApiError("INTERNAL_SERVER_ERROR");
        }

        res.status(200).json(toTicketDTO(existing));
        return;
      }

      try {
        const created = await tickets.create({
          requesterId,
          actor,
          key,
          requestHash,
          recordId: resolution.recordId,
          processingStartedAt: resolution.processingStartedAt,
          payload,
          now: new Date(),
        });

        res.status(201).json(created);
        return;
      } catch (error) {
        if (error instanceof FencedOutError) {
          continue;
        }

        /*
         * Section 8.6: a controlled failure removes the owned claim instead of
         * storing a FAILED state, so an unchanged retry may run again with the
         * same key. The transaction rolled back, so there is no Ticket or
         * binding to compensate. The predicate on `processingStartedAt` keeps
         * this from deleting a claim another attempt has already reclaimed.
         */
        await idempotency.release({
          requesterId,
          key,
          processingStartedAt: resolution.processingStartedAt,
        });

        throw error;
      }
    }

    throw new ApiError("INTERNAL_SERVER_ERROR");
  } catch (error) {
    next(error);
  }
});
