import { NextFunction, Request, Response, Router } from "express";

import { getPrisma } from "../prisma.js";
import { CategoryService } from "../services/categoryService.js";
import { RelatedSystemService } from "../services/relatedSystemService.js";

export const referenceDataRouter = Router();

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
