import { NextFunction, Request, Response, Router } from "express";

import { getPrisma } from "../prisma.js";
import { runCreateTicket } from "../services/createTicketFlow.js";
import { parseCreateTicketRequest, parseIdempotencyKey } from "../services/ticketCreateRequest.js";

export const ticketsRouter = Router();

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
