import cors from "cors";
import type { RequestHandler } from "express";

import { isDevelopmentOrTest } from "../env.js";

/* api-spec Section 3.4. Wildcard origins are prohibited. */
const DEVELOPMENT_ORIGIN = "http://localhost:5173";
const EXACT_ORIGIN_PATTERN = /^https?:\/\/[^\s/]+$/;

export const ALLOWED_REQUEST_HEADERS = [
  "Authorization",
  "Content-Type",
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
  const configuredValue = env.CORS_ALLOWED_ORIGINS ?? "";
  const configuredEntries = configuredValue
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (configuredEntries.some((origin) => !EXACT_ORIGIN_PATTERN.test(origin))) {
    throw new Error("CORS_ALLOWED_ORIGINS must contain exact origins only.");
  }

  const configured = configuredEntries;

  if (configured.length > 0) {
    return configured;
  }

  if (isDevelopmentOrTest(env.NODE_ENV)) {
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
    credentials: true,
  });
}
