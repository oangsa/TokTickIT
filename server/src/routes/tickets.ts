import { NextFunction, Request, Response, Router } from "express";

import { ApiError } from "../http/errors.js";
import { setPaginationHeader } from "../http/pagination.js";
import { uploadSingleFile } from "../http/upload.js";
import { getPrisma } from "../prisma.js";
import { AttachmentService } from "../services/attachmentService.js";
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
 * Direct upload to an existing owned Ticket (api-spec Section 11.5). Distinct
 * from `POST /api/attachments`: this one persists an Active Attachment bound to
 * a Ticket that already exists, where that one creates an unbound Pending row
 * for a Ticket that does not exist yet. The five-Active limit and the insert
 * share one `Serializable` transaction inside the service.
 */
ticketsRouter.post(
  "/tickets/:publicId/attachments",
  uploadSingleFile,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = req.file as Express.Multer.File;
      const service = new AttachmentService(getPrisma());

      const attachment = await service.createForTicket({
        requesterId: req.requesterId as number,
        actor: req.requesterEmail as string,
        publicId: req.params.publicId,
        file: { filename: file.originalname, data: file.buffer },
      });

      res.status(201).json(attachment);
    } catch (error) {
      next(error);
    }
  },
);

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
