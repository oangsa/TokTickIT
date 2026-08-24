import type { NextFunction, Request, Response } from "express";

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
        route: req.route ? `${req.baseUrl}${req.route.path}` : "unmatched",
        status: res.statusCode,
        durationMs: Math.round(durationMs),
        errorCode,
      }),
    );
  });

  next();
}
