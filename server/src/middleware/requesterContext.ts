import type { NextFunction, Request, Response } from "express";

import { ApiError, ErrorDetail } from "../http/errors.js";
import { getPrisma } from "../prisma.js";
import { DevelopmentRequesterService } from "../services/developmentRequesterService.js";

declare global {
  namespace Express {
    interface Request {
      requesterId?: number;
    }
  }
}

/*
 * One generic message for every rejection so nothing about the Requester leaks
 * (api-spec Section 3.1). The client treats this exact `field` value as the
 * signal to clear its stored context, so it must be attached to all four cases.
 */
const REQUESTER_CONTEXT_DETAILS: ErrorDetail[] = [
  { field: "X-Requester-Id", message: "The requester context is invalid." },
];

/*
 * Only the bootstrap endpoint and the health check are exempt; everything else
 * is denied by default.
 *
 * Matched the way Express itself routes, or the guard rejects requests the
 * router would have served: paths case-insensitively (`caseSensitive` is off),
 * and HEAD alongside GET (Express dispatches HEAD to GET handlers). A miss here
 * fails closed, but it fails closed with the context-invalidating `details`,
 * which makes the client discard a perfectly good stored Requester.
 */
const EXEMPT_PATHS = new Set(["/requesters", "/health"]);
const EXEMPT_METHODS = new Set(["GET", "HEAD"]);

const INTEGER_PATTERN = /^-?\d+$/;

export async function requireRequesterContext(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  /* Mounted at "/api", so `req.path` is already stripped of that prefix. */
  const path = req.path.replace(/\/+$/, "") || "/";

  if (EXEMPT_METHODS.has(req.method) && EXEMPT_PATHS.has(path.toLowerCase())) {
    next();
    return;
  }

  const header = req.header("X-Requester-Id");

  if (header === undefined || header.trim() === "") {
    next(new ApiError("BAD_REQUEST", REQUESTER_CONTEXT_DETAILS));
    return;
  }

  const raw = header.trim();

  if (!INTEGER_PATTERN.test(raw)) {
    next(new ApiError("VALIDATION_ERROR", REQUESTER_CONTEXT_DETAILS));
    return;
  }

  const requesterId = Number(raw);

  if (!Number.isSafeInteger(requesterId) || requesterId <= 0) {
    next(new ApiError("VALIDATION_ERROR", REQUESTER_CONTEXT_DETAILS));
    return;
  }

  try {
    const service = new DevelopmentRequesterService(getPrisma());
    const requester = await service.findSelectableById(requesterId);

    if (requester === null) {
      /* Unknown, logically deleted, and inactive are one indistinguishable outcome. */
      next(new ApiError("BAD_REQUEST", REQUESTER_CONTEXT_DETAILS));
      return;
    }

    req.requesterId = requesterId;
    next();
  } catch (error) {
    next(error);
  }
}
