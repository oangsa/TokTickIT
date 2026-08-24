import { NextFunction, Request, Response, Router } from "express";

import { getPrisma } from "../prisma.js";
import { DevelopmentRequesterService } from "../services/developmentRequesterService.js";

export const referenceDataRouter = Router();

/* api-spec Section 6.1 — the only Lab 2 endpoint that works without requester context. */
referenceDataRouter.get(
  "/requesters",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const service = new DevelopmentRequesterService(getPrisma());
      res.json(await service.listSelectable());
    } catch (error) {
      next(error);
    }
  },
);
