import { NextFunction, Request, Response, Router } from "express";

import { ApiError, ErrorDetail } from "../http/errors.js";
import { uploadSingleFile } from "../http/upload.js";
import { getPrisma } from "../prisma.js";
import { AttachmentDeleteItem, AttachmentService } from "../services/attachmentService.js";

export const attachmentsRouter = Router();

const MIN_COLLECTION_ITEMS = 1;
const MAX_COLLECTION_ITEMS = 100;

/*
 * Accepts any case so the value can be canonicalized to lowercase, like the
 * Ticket-create body does. Kept local for the same reason the other copies are:
 * this one guards a JSON body field on this endpoint, and the contract it
 * enforces is not the route-parameter one.
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/*
 * api-spec Section 13.3. A malformed Attachment ID inside this JSON body is a
 * request-validation failure and returns 400 -- deliberately unlike a malformed
 * public route identifier, which returns the safe 404. The body is client-
 * authored data being validated; the route parameter is a resource being looked
 * up, and a 400 there would confirm that a well-formed identifier means
 * something.
 */
function parseCollectionDeleteRequest(body: unknown): AttachmentDeleteItem[] {
  const details: ErrorDetail[] = [];
  const items = isRecord(body) ? body.items : undefined;

  if (!Array.isArray(items)) {
    throw new ApiError("VALIDATION_ERROR", [
      { field: "items", message: "items must be an array of Attachment references." },
    ]);
  }

  if (items.length < MIN_COLLECTION_ITEMS || items.length > MAX_COLLECTION_ITEMS) {
    throw new ApiError("VALIDATION_ERROR", [
      {
        field: "items",
        message: `items must contain ${MIN_COLLECTION_ITEMS}-${MAX_COLLECTION_ITEMS} entries.`,
      },
    ]);
  }

  const parsed: AttachmentDeleteItem[] = [];

  for (const [index, entry] of items.entries()) {
    const field = `items[${index}]`;

    if (!isRecord(entry)) {
      details.push({ field, message: "Each item must be an object." });
      continue;
    }

    const { attachmentId, reason } = entry;

    if (typeof attachmentId !== "string" || !UUID_PATTERN.test(attachmentId)) {
      details.push({
        field: `${field}.attachmentId`,
        message: "attachmentId must be a valid UUID.",
      });
      continue;
    }

    /*
     * An omitted reason is read as empty rather than rejected: it is the one
     * shape a Pending-only batch legitimately has, and the reason is ignored for
     * Pending rows (Section 13.4). A non-string is still a type error, and an
     * Active row still fails later on the 3-200 rule.
     */
    if (reason !== undefined && typeof reason !== "string") {
      details.push({ field: `${field}.reason`, message: "reason must be a string." });
      continue;
    }

    parsed.push({ attachmentId: attachmentId.toLowerCase(), reason: reason ?? "" });
  }

  if (details.length > 0) {
    throw new ApiError("VALIDATION_ERROR", details);
  }

  /* Duplicates are rejected, never silently deduplicated (Section 13.3). */
  if (new Set(parsed.map((item) => item.attachmentId)).size !== parsed.length) {
    throw new ApiError("VALIDATION_ERROR", [
      { field: "items", message: "Attachment IDs must not repeat." },
    ]);
  }

  return parsed;
}

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
 * `Cache-Control: no-store` is already set by `transport`, and `Vary: Origin,
 * X-Requester-Id` by `transport` plus the requester guard. Neither is re-set
 * here: doing so would overwrite the merged CORS value rather than add to it.
 */
function sendBinary(
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

/* api-spec Section 11.4. */
attachmentsRouter.post(
  "/attachments",
  uploadSingleFile,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = req.file as Express.Multer.File;
      const service = new AttachmentService(getPrisma());

      const attachment = await service.createPending({
        requesterId: req.requesterId as number,
        actor: req.requesterEmail as string,
        file: { filename: file.originalname, data: file.buffer },
      });

      res.status(201).json(attachment);
    } catch (error) {
      next(error);
    }
  },
);

/*
 * api-spec Section 13. Registered before the `:storageKey` routes so the literal
 * segment is never read as an identifier.
 */
attachmentsRouter.delete(
  "/attachments/collection",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const items = parseCollectionDeleteRequest(req.body);
      const service = new AttachmentService(getPrisma());

      await service.deleteCollection({
        requesterId: req.requesterId as number,
        actor: req.requesterEmail as string,
        items,
      });

      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);

/* api-spec Section 12.1. Pending, Active, and Removed all answer 200. */
attachmentsRouter.get(
  "/attachments/:storageKey",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = new AttachmentService(getPrisma());
      const attachment = await service.findMetadata(
        req.requesterId as number,
        req.params.storageKey,
      );

      if (attachment === null) {
        throw new ApiError("NOT_FOUND");
      }

      res.json(attachment);
    } catch (error) {
      next(error);
    }
  },
);

function binaryRoute(kind: "inline" | "attachment") {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const service = new AttachmentService(getPrisma());
      const binary = await service.findBinary(req.requesterId as number, req.params.storageKey);

      /* A Removed Attachment raises `410` inside the service; `null` is the
       * missing/malformed/out-of-scope case and shares the one 404. */
      if (binary === null) {
        throw new ApiError("NOT_FOUND");
      }

      sendBinary(res, kind, binary);
    } catch (error) {
      next(error);
    }
  };
}

/* api-spec Sections 12.2 and 12.3. */
attachmentsRouter.get("/attachments/:storageKey/preview", binaryRoute("inline"));
attachmentsRouter.get("/attachments/:storageKey/download", binaryRoute("attachment"));
