import { Router } from "express";
import { requireRole } from "../middleware/authentication.js";
import { getPrisma } from "../prisma.js";
import { requesterDashboard, staffDashboard } from "../services/dashboardService.js";
import { parseDashboardQuery } from "../services/dashboardQueryValidator.js";

export const dashboardsRouter = Router();
dashboardsRouter.get("/users/me/dashboard", requireRole("REQUESTER"), async (req, res, next) => {
  try { res.json(await requesterDashboard(getPrisma(), req.auth!.userId, parseDashboardQuery(req.query).recentTicketsSize)); } catch (error) { next(error); }
});

dashboardsRouter.get("/dashboard", requireRole("IT_STAFF", "ADMINISTRATOR"), async (req, res, next) => {
  try { res.json(await staffDashboard(getPrisma(), req.auth!.userId, parseDashboardQuery(req.query, true))); } catch (error) { next(error); }
});
