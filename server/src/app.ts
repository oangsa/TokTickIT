import express, { NextFunction, Request, Response } from "express";

import { errorHandler, notFoundHandler } from "./http/errors.js";
import { createCorsMiddleware } from "./middleware/cors.js";
import { requestLog } from "./middleware/requestLog.js";
import { requireRequesterContext } from "./middleware/requesterContext.js";
import { transport } from "./middleware/transport.js";
import { getPrisma } from "./prisma.js";
import { referenceDataRouter } from "./routes/referenceData.js";

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

// Order is contractual (api-spec Sections 3.4, 3.5, 3.6, 17):
//   CORS first so an OPTIONS preflight ends before anything else runs;
//   transport next so every remaining response carries X-Request-Id, no-store,
//   and the merged Vary;
//   the JSON parser before the guard so a 413 or a parse-400 is not masked by a
//   missing-header 400;
//   the guard mounted at "/api", default-deny with a two-route exemption.
app.use(createCorsMiddleware());
app.use(transport);
app.use(express.json({ limit: 131072 }));
app.use(requestLog);
app.use("/api", requireRequesterContext);

// ---------------------------------------------------------------------------
// Issue 2 — API health check
// ---------------------------------------------------------------------------
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "TokTickIT API" });
});

// ---------------------------------------------------------------------------
// Issue 20 — Development Requester bootstrap
// ---------------------------------------------------------------------------
app.use("/api", referenceDataRouter);

// ---------------------------------------------------------------------------
// Issue 4 — Category list. Issue 20 puts it behind the requester guard by mount
// order; its Lab 1 { id, name } body is unchanged. Issue 21 converts it to the
// full CategoryDTO.
// ---------------------------------------------------------------------------
app.get("/api/categories", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await getPrisma().category.findMany({
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
