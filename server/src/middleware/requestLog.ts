import type { NextFunction, Request, Response } from "express";

function routeKey(req: Request): string {
  if (!req.route) {
    return "unmatched";
  }

  const path = String(req.route.path);
  return /^\/api(?:\/|$)/.test(path) ? path : `/api${path}`;
}

/*
 * api-spec Section 17: one structured line per request, built from an explicit
 * allowlist. The raw URL/query string, headers, bodies, Requester names and
 * emails, filenames, SQL, and Prisma metadata are never logged, so this
 * function must only ever read the fields listed below.
 */
export function requestLog(req: Request, res: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const errorCode = typeof res.locals.errorCode === "string" ? res.locals.errorCode : null;

    console.log(
      JSON.stringify({
        requestId: req.requestId ?? null,
        method: req.method,
        route: routeKey(req),
        status: res.statusCode,
        durationMs: Math.round(durationMs),
        errorCode,
      }),
    );
  });

  next();
}
