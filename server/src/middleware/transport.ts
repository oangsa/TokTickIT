import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/*
 * api-spec Sections 3.3 and 3.6. A malformed incoming `X-Request-Id` is
 * replaced rather than rejected. `res.vary` appends to whatever the CORS
 * middleware already set instead of overwriting it, so no header merging is
 * hand-rolled here.
 */
export function transport(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("X-Request-Id");
  const requestId = incoming !== undefined && UUID_PATTERN.test(incoming) ? incoming : randomUUID();

  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  res.setHeader("Cache-Control", "no-store");
  res.vary("Origin");
  res.vary("X-Requester-Id");

  next();
}
