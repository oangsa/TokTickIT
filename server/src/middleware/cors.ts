import cors from "cors";
import type { RequestHandler } from "express";

/* api-spec Section 3.4. Wildcard origins are prohibited. */
const DEVELOPMENT_ORIGIN = "http://localhost:5173";
const DEVELOPMENT_ENVIRONMENTS = new Set(["development", "test"]);
const EXACT_ORIGIN_PATTERN = /^https?:\/\/[^\s/]+$/;

export const ALLOWED_REQUEST_HEADERS = [
  "Content-Type",
  "X-Requester-Id",
  "Idempotency-Key",
  "X-Request-Id",
];

export const EXPOSED_RESPONSE_HEADERS = ["X-Pagination", "X-Request-Id"];

export interface CorsEnvironment {
  CORS_ALLOWED_ORIGINS?: string;
  NODE_ENV?: string;
}

/*
 * Takes the environment as an argument rather than reading `process.env`, so
 * the startup-failure case can be tested without mutating the process.
 */
export function resolveAllowedOrigins(env: CorsEnvironment): string[] {
  const configured = (env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => EXACT_ORIGIN_PATTERN.test(origin));

  if (configured.length > 0) {
    return configured;
  }

  if (env.NODE_ENV === undefined || DEVELOPMENT_ENVIRONMENTS.has(env.NODE_ENV)) {
    return [DEVELOPMENT_ORIGIN];
  }

  throw new Error(
    "CORS_ALLOWED_ORIGINS must list at least one exact origin outside development and test.",
  );
}

export function createCorsMiddleware(env: CorsEnvironment = process.env): RequestHandler {
  return cors({
    origin: resolveAllowedOrigins(env),
    allowedHeaders: ALLOWED_REQUEST_HEADERS,
    exposedHeaders: EXPOSED_RESPONSE_HEADERS,
  });
}
