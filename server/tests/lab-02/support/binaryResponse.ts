import type { Response } from "superagent";

/*
 * Superagent parses only the content types it knows, and an Attachment binary is
 * not one of them. This collects the raw bytes instead, so a suite can assert on
 * the body as well as on the headers.
 *
 * The value superagent hands a custom parser is the underlying response stream;
 * the published type is the parsed `Response`, so the stream shape is recovered
 * here rather than at every call site.
 */
export function binaryParser(
  res: Response,
  callback: (error: Error | null, body: Buffer) => void,
): void {
  const stream = res as unknown as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];

  stream.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
  stream.on("end", () => callback(null, Buffer.concat(chunks)));
}
