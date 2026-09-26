import type { Response } from "express";

/*
 * api-spec Sections 12.2, 12.3, and BR-84. Both parameters are written, never
 * the raw name: the quoted `filename` is reduced to printable ASCII so it cannot
 * carry a quote, a backslash, or anything that would end the header early, and
 * `filename*` carries the real UTF-8 name percent-encoded per RFC 5987.
 *
 * `encodeURIComponent` leaves a handful of characters RFC 5987 does not include
 * in `attr-char`, so those are encoded explicitly afterwards.
 */
function contentDisposition(kind: "inline" | "attachment", originalName: string): string {
  const ascii = originalName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_").trim();
  const fallback = ascii === "" ? "attachment" : ascii;
  const encoded = encodeURIComponent(originalName).replace(
    /['()!*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `${kind}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

/*
 * `Cache-Control: no-store` is already set by `transport`, and `Vary: Origin`
 * by CORS/transport. Neither is re-set
 * here: doing so would overwrite the merged CORS value rather than add to it.
 */
export function sendBinary(
  res: Response,
  kind: "inline" | "attachment",
  binary: { data: Buffer; mimeType: string; originalName: string },
): void {
  res.setHeader("Content-Type", binary.mimeType);
  res.setHeader("Content-Disposition", contentDisposition(kind, binary.originalName));
  res.setHeader("Content-Length", binary.data.length);
  /* The derived MIME is a mapping from an extension, not an inspection of the
   * bytes, so the browser must not be allowed to sniff its way past it. */
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(binary.data);
}
