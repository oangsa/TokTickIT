import { Router } from "express";

import { setPaginationHeader } from "../http/pagination.js";
import { requireRole } from "../middleware/authentication.js";
import { getPrisma } from "../prisma.js";
import { ActionTakenService } from "../services/actionTakenService.js";
import { listTicketActivity } from "../services/ticketActivityService.js";

export const actionsTakenRouter = Router();
const staff = requireRole("IT_STAFF", "ADMINISTRATOR");
actionsTakenRouter.post("/tickets/:ticketPublicId/actions", staff, async (req, res, next) => {
  try {
    const result = await new ActionTakenService(getPrisma()).create(req.auth!, req.params.ticketPublicId, req.body, req.header("Idempotency-Key"));
    res.status(result.status).json(result.action);
  } catch (error) { next(error); }
});
for (const [path, guard] of [["/tickets/:ticketPublicId/actions", staff], ["/users/me/tickets/:ticketPublicId/actions", requireRole("REQUESTER")]] as const) {
  actionsTakenRouter.get(path, guard, async (req, res, next) => {
    try {
      const result = await new ActionTakenService(getPrisma()).list(req.auth!, req.params.ticketPublicId, req.query);
      setPaginationHeader(res, result.pagination);
      res.json(result.items);
    } catch (error) { next(error); }
  });
  actionsTakenRouter.get(`${path}/filter-users`, guard, async (req, res, next) => {
    try {
      const result = await new ActionTakenService(getPrisma()).filterUsers(req.auth!, req.params.ticketPublicId, req.query);
      setPaginationHeader(res, result.pagination);
      res.json(result.items);
    } catch (error) { next(error); }
  });
  actionsTakenRouter.get(`${path}/:actionPublicId`, guard, async (req, res, next) => {
    try { res.json(await new ActionTakenService(getPrisma()).detail(req.auth!, req.params.ticketPublicId, req.params.actionPublicId)); }
    catch (error) { next(error); }
  });
}

for (const operation of ["start", "complete", "cancel"] as const) {
  actionsTakenRouter.post(`/tickets/:ticketPublicId/actions/:actionPublicId/${operation}`, staff, async (req, res, next) => {
    try {
      const result = await new ActionTakenService(getPrisma()).lifecycle(req.auth!, req.params.ticketPublicId, req.params.actionPublicId, operation, req.body, req.header("Idempotency-Key"));
      res.status(result.status).json(result.action);
    } catch (error) { next(error); }
  });
}

actionsTakenRouter.patch("/tickets/:ticketPublicId/actions/:actionPublicId/assignee", staff, async (req, res, next) => {
  try { res.json(await new ActionTakenService(getPrisma()).assign(req.auth!, req.params.ticketPublicId, req.params.actionPublicId, req.body)); }
  catch (error) { next(error); }
});

actionsTakenRouter.patch("/tickets/:ticketPublicId/actions/:actionPublicId", staff, async (req, res, next) => {
  try { res.json(await new ActionTakenService(getPrisma()).edit(req.auth!, req.params.ticketPublicId, req.params.actionPublicId, req.body)); }
  catch (error) { next(error); }
});

for (const path of ["/tickets/:ticketPublicId/activity", "/tickets/:ticketPublicId/actions/:actionPublicId/activity"]) {
  actionsTakenRouter.get(path, staff, async (req, res, next) => {
    try {
      const result = await listTicketActivity(getPrisma(), req.auth!, req.params.ticketPublicId, req.query, req.params.actionPublicId);
      setPaginationHeader(res, result.pagination);
      res.json(result.items);
    } catch (error) { next(error); }
  });
}
