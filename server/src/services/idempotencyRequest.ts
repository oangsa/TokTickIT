import { createHash } from "node:crypto";

export function canonicalResourcePath(resourcePath: string): string {
  const queryStart = resourcePath.indexOf("?");
  let path = (queryStart === -1 ? resourcePath : resourcePath.slice(0, queryStart)).toLowerCase();
  while (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path;
}

export function hashIdempotencyRequest(
  method: string,
  resourcePath: string,
  normalizedBody: unknown,
): string {
  const canonical = JSON.stringify({
    method: method.toUpperCase(),
    resourcePath: canonicalResourcePath(resourcePath),
    body: canonicalize(normalizedBody),
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== "object" || value === null) return value ?? null;
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([key, entry]) => [key, canonicalize(entry)]),
  );
}
