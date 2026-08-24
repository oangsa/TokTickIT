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

/* Only the bootstrap endpoint and the health check are exempt; everything else is denied by default. */
const EXEMPT_ROUTES = new Set(["GET /requesters", "GET /health"]);

const INTEGER_PATTERN = /^-?\d+$/;

export async function requireRequesterContext(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  /* Mounted at "/api", so `req.path` is already stripped of that prefix. */
  const path = req.path.replace(/\/+$/, "") || "/";

  if (EXEMPT_ROUTES.has(`${req.method} ${path}`)) {
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
