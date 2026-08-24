import express, { Request, Response } from "express";

import { errorHandler, notFoundHandler } from "./http/errors.js";
import { createCorsMiddleware } from "./middleware/cors.js";
import { requestLog } from "./middleware/requestLog.js";
import { requireRequesterContext } from "./middleware/requesterContext.js";
import { transport } from "./middleware/transport.js";
import { referenceDataRouter } from "./routes/referenceData.js";
import { ticketsRouter } from "./routes/tickets.js";

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
// Issue 20 — Development Requester bootstrap.
// Issue 21 — Categories (moved here from the Lab 1 inline handler and widened
// from { id, name } to the full CategoryDTO) and Related Systems.
// ---------------------------------------------------------------------------
app.use("/api", referenceDataRouter);

// ---------------------------------------------------------------------------
// Issue 21 — Ticket creation
// ---------------------------------------------------------------------------
app.use("/api", ticketsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
