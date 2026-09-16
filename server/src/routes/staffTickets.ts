import { Router, type RequestHandler } from "express";
import { ApiError } from "../http/errors.js";
import { setPaginationHeader } from "../http/pagination.js";
import { requireRole } from "../middleware/authentication.js";
import { getPrisma } from "../prisma.js";
import { findStaffTicket, listAssignableUsers, listStaffTickets } from "../services/staffTicketReadService.js";
import { parseStaffQueueQuery, PUBLIC_ID_PATTERN } from "../services/staffQueueQueryValidator.js";
import { mutateStaffTicket, type PublicCommentWriter, type TicketMutation } from "../services/ticketWorkflowService.js";
import { sendBinary } from "./attachments.js";

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
        const { publicId, storageKey } = req.params;
        if (!PUBLIC_ID_PATTERN.test(publicId) || !PUBLIC_ID_PATTERN.test(storageKey)) throw new ApiError("NOT_FOUND");
        const where = { storageKey, ticket: { publicId, deleted: false } };
        const row = await getPrisma().attachment.findFirst({ where: { ...where, deleted: false }, select: { data: true, mimeType: true, originalName: true } });
        if (!row) {
          const removed = await getPrisma().attachment.findFirst({ where, select: { deleted: true } });
          throw new ApiError(removed?.deleted ? "GONE" : "NOT_FOUND");
        }
        sendBinary(res, kind === "preview" ? "inline" : "attachment", { ...row, data: Buffer.from(row.data) });
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
