import { Router, type RequestHandler } from "express";
import { sendBinary } from "../http/binary.js";
import { ApiError } from "../http/errors.js";
import { setPaginationHeader } from "../http/pagination.js";
import { requireRole } from "../middleware/authentication.js";
import { getPrisma } from "../prisma.js";
import { AttachmentService } from "../services/attachmentService.js";
import { findStaffTicket, listAssignableUsers, listStaffTickets } from "../services/staffTicketReadService.js";
import { parseStaffQueueQuery } from "../services/staffQueueQueryValidator.js";
import { mutateStaffTicket, type PublicCommentWriter, type TicketMutation } from "../services/ticketWorkflowService.js";

// Issue 6 supplies the writer when composing the application, not a global setter.
export function createStaffTicketsRouter(writePublicComment?: PublicCommentWriter) {
  const router = Router();
  const guard = requireRole("IT_STAFF", "ADMINISTRATOR");
  router.get("/users/assignable", guard, async (_req, res, next) => {
    try { res.json(await listAssignableUsers(getPrisma())); } catch (error) { next(error); }
  });
  router.get("/tickets", guard, async (req, res, next) => {
    try {
      const query = parseStaffQueueQuery(req.query);
      const result = await listStaffTickets(getPrisma(), query);
      setPaginationHeader(res, result.pagination);
      res.json(result.items);
    } catch (error) { next(error); }
  });
  router.get("/tickets/:publicId", guard, async (req, res, next) => {
    try { res.json(await findStaffTicket(getPrisma(), req.params.publicId)); } catch (error) { next(error); }
  });
  router.get("/tickets/:publicId/attachments", guard, async (req, res, next) => {
    try { res.json((await findStaffTicket(getPrisma(), req.params.publicId)).attachments); } catch (error) { next(error); }
  });
  for (const kind of ["preview", "download"] as const) {
    router.get(`/tickets/:publicId/attachments/:storageKey/${kind}`, guard, async (req, res, next) => {
      try {
        const binary = await new AttachmentService(getPrisma()).findStaffBinary(req.params.publicId, req.params.storageKey);
        if (binary === null) throw new ApiError("NOT_FOUND");
        sendBinary(res, kind === "preview" ? "inline" : "attachment", binary);
      } catch (error) { next(error); }
    });
  }
  const handler = (action: TicketMutation): RequestHandler => async (req, res, next) => {
    try { res.json(await mutateStaffTicket(getPrisma(), req.auth!, req.params.publicId, action, req.body, writePublicComment)); } catch (error) { next(error); }
  };
  for (const action of ["claim", "start-work", "request-information", "resume-work", "mark-resolved", "close", "cancel"] as const) router.post(`/tickets/:publicId/${action}`, guard, handler(action));
  for (const action of ["owner", "it-priority"] as const) router.patch(`/tickets/:publicId/${action}`, guard, handler(action));
  return router;
}
