import { NextFunction, Request, Response, Router } from "express";

import { isDevelopmentOrTest } from "../env.js";
import { ApiError } from "../http/errors.js";
import { getPrisma } from "../prisma.js";
import { CategoryService } from "../services/categoryService.js";
import { DevelopmentRequesterService } from "../services/developmentRequesterService.js";
import { RelatedSystemService } from "../services/relatedSystemService.js";

export const referenceDataRouter = Router();

/*
 * api-spec Section 6.1 — the only Lab 2 endpoint that works without requester
 * context.
 *
 * It hands the full DevelopmentRequesterDTO, names and emails included, to any
 * caller that can reach the port. The spec restricts that to development/test
 * networks (Section 1) and is explicit that CORS is browser hardening, not an
 * API or privacy boundary (Sections 3.4, 6.1) -- so the restriction is enforced
 * here instead of being left to whoever deploys it.
 */
referenceDataRouter.get(
  "/requesters",
  async (_req: Request, res: Response, next: NextFunction) => {
    if (!isDevelopmentOrTest(process.env.NODE_ENV)) {
      /* Indistinguishable from a route that was never mounted. */
      next(new ApiError("NOT_FOUND"));
      return;
    }

    try {
      const service = new DevelopmentRequesterService(getPrisma());
      res.json(await service.listSelectable());
    } catch (error) {
      next(error);
    }
  },
);

/*
 * api-spec Sections 6.2 and 6.3. Both are requester-scoped: the guard mounted
 * ahead of this router already rejected a request without valid context.
 *
 * Prisma rows are returned as-is because the model fields and the DTO fields
 * are the same set; `res.json` renders the `Date` columns as the ISO-8601 UTC
 * strings the contract requires. A hand-built projection here would only be a
 * second place to forget a field.
 */
referenceDataRouter.get("/categories", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await new CategoryService(getPrisma()).listSelectable());
  } catch (error) {
    next(error);
  }
});

referenceDataRouter.get(
  "/related-systems",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await new RelatedSystemService(getPrisma()).listSelectable());
    } catch (error) {
      next(error);
    }
  },
);
