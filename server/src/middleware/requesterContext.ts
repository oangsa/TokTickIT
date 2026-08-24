import type { NextFunction, Request, Response } from "express";

import { ApiError } from "../http/errors.js";
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
 * Only the bootstrap endpoint and the health check are exempt; everything else
 * is denied by default.
 *
 * Matched the way Express itself routes, or the guard rejects requests the
 * router would have served: paths case-insensitively (`caseSensitive` is off),
 * and HEAD alongside GET (Express dispatches HEAD to GET handlers). A miss here
 * fails closed, but it fails closed with the context-invalidating code, which
 * makes the client discard a perfectly good stored Requester.
 */
const EXEMPT_PATHS = new Set(["/requesters", "/health"]);
const EXEMPT_METHODS = new Set(["GET", "HEAD"]);

const INTEGER_PATTERN = /^-?\d+$/;

/*
 * Every rejection uses the one protocol code `REQUESTER_CONTEXT_INVALID`, whose
 * fixed generic message leaks nothing about the Requester (api-spec Section
 * 3.1). The client keys its "discard the stored Requester" rule on that code,
 * so all six cases must carry it and no ordinary 400 may.
 */
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
    next(new ApiError("REQUESTER_CONTEXT_INVALID"));
    return;
  }

  const raw = header.trim();

  if (!INTEGER_PATTERN.test(raw)) {
    next(new ApiError("REQUESTER_CONTEXT_INVALID"));
    return;
  }

  const requesterId = Number(raw);

  if (!Number.isSafeInteger(requesterId) || requesterId <= 0) {
    next(new ApiError("REQUESTER_CONTEXT_INVALID"));
    return;
  }

  try {
    const service = new DevelopmentRequesterService(getPrisma());
    const requester = await service.findSelectableById(requesterId);

    if (requester === null) {
      /* Unknown, logically deleted, and inactive are one indistinguishable outcome. */
      next(new ApiError("REQUESTER_CONTEXT_INVALID"));
      return;
    }

    req.requesterId = requesterId;
    next();
  } catch (error) {
    next(error);
  }
}
