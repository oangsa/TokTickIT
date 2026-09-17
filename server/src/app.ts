import express, { Request, Response } from "express";

import { errorHandler, notFoundHandler } from "./http/errors.js";
import { requireFullSession, requireRole } from "./middleware/authentication.js";
import { createCorsMiddleware } from "./middleware/cors.js";
import { requestLog } from "./middleware/requestLog.js";
import { transport } from "./middleware/transport.js";
import { authRouter } from "./routes/auth.js";
import { attachmentsRouter } from "./routes/attachments.js";
import { referenceDataRouter } from "./routes/referenceData.js";
import { ticketsRouter } from "./routes/tickets.js";
import { createStaffTicketsRouter } from "./routes/staffTickets.js";

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

// Order is contractual (api-spec Sections 3.4, 3.5, 3.6, 17):
//   CORS first so an OPTIONS preflight ends before anything else runs;
//   transport next so every remaining response carries X-Request-Id, no-store,
//   and the merged Vary;
//   the JSON parser before the guard so a 413 or a parse-400 is not masked by a
//   missing-header 400;
//   authentication middleware is mounted after public health/auth routes.
app.use(createCorsMiddleware());
app.use(transport);
app.use(express.json({ limit: 131072 }));
app.use(requestLog);

// ---------------------------------------------------------------------------
// Issue 2 — API health check
// ---------------------------------------------------------------------------
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "TokTickIT API" });
});

app.use("/api", authRouter);
app.use("/api", requireFullSession());

// ---------------------------------------------------------------------------
// Reference data and authenticated Lab 2 requester routes.
// ---------------------------------------------------------------------------
app.use("/api", referenceDataRouter);
app.use("/api", createStaffTicketsRouter());

// ---------------------------------------------------------------------------
// Issue 21 — Ticket creation
// ---------------------------------------------------------------------------
app.use("/api/users/me", requireRole("REQUESTER"), ticketsRouter);

// ---------------------------------------------------------------------------
// Issue 24 — Attachment lifecycle
// ---------------------------------------------------------------------------
app.use("/api/users/me", requireRole("REQUESTER"), attachmentsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
