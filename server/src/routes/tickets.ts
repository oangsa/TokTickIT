import { NextFunction, Request, Response, Router } from "express";

import { ApiError } from "../http/errors.js";
import { setPaginationHeader } from "../http/pagination.js";
import { getPrisma } from "../prisma.js";
import { runCreateTicket } from "../services/createTicketFlow.js";
import { parseCreateTicketRequest, parseIdempotencyKey } from "../services/ticketCreateRequest.js";
import { listTicketsForRequester } from "../services/ticketListService.js";
import { parseTicketListQuery } from "../services/ticketQueryValidator.js";
import { findTicketForRequester } from "../services/ticketService.js";

export const ticketsRouter = Router();

/*
 * My Tickets (api-spec Section 9). The Requester comes from
 * `requireRequesterContext`, which already guards this path -- GET /tickets is
 * not exempt -- so the handler never re-derives it. Validation runs before any
 * data access, and a page past the last one is a 200 with an empty array
 * rather than an error (BR-38).
 */
ticketsRouter.get("/tickets", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = parseTicketListQuery(req.query);

    const { items, pagination } = await listTicketsForRequester(
      getPrisma(),
      req.requesterId as number,
      query,
    );

    setPaginationHeader(res, pagination);
    res.json(items);
  } catch (error) {
    next(error);
  }
});

ticketsRouter.post("/tickets", async (req: Request, res: Response, next: NextFunction) => {
  try {
    /* Steps 1-4: parse, validate for canonicalization, canonicalize, hash. */
    const key = parseIdempotencyKey(req.header("Idempotency-Key"));
    const { payload } = parseCreateTicketRequest(req.body);

    /* Steps 5-8 live in the flow so the PostgreSQL suites exercise the same path. */
    const { status, ticket } = await runCreateTicket(getPrisma(), {
      requesterId: req.requesterId as number,
      actor: req.requesterEmail as string,
      key,
      payload,
    });

    res.status(status).json(ticket);
  } catch (error) {
    next(error);
  }
});

/*
 * Ticket Detail (api-spec Section 8.6). The Requester comes from
 * `requireRequesterContext`, and the ownership and soft-delete predicates live
 * inside the query rather than in a check on the answer. Every miss -- missing,
 * malformed, logically deleted, or owned by someone else -- resolves to the one
 * centralized 404, so the response cannot be read as a statement about who owns
 * what (AC-22).
 */
ticketsRouter.get("/tickets/:publicId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ticket = await findTicketForRequester(
      getPrisma(),
      req.requesterId as number,
      req.params.publicId,
    );

    if (ticket === null) {
      throw new ApiError("NOT_FOUND");
    }

    res.json(ticket);
  } catch (error) {
    next(error);
  }
});
