import type { NextFunction, Request, Response } from "express";

export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "GONE"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "INTERNAL_SERVER_ERROR"
  | "IDEMPOTENCY_CONFLICT"
  | "REQUESTER_CONTEXT_INVALID";

export interface ErrorDetail {
  field: string;
  message: string;
}

export interface ErrorEnvelope {
  statusCode: number;
  code: ErrorCode;
  message: string;
  error: string;
  details?: ErrorDetail[];
}

interface ErrorDefinition {
  statusCode: number;
  error: string;
  message: string;
}

/* api-spec Section 4.3. The public copy is fixed here so no handler invents its own. */
const ERROR_DEFINITIONS: Record<ErrorCode, ErrorDefinition> = {
  BAD_REQUEST: { statusCode: 400, error: "Bad Request", message: "The request is invalid." },
  VALIDATION_ERROR: {
    statusCode: 400,
    error: "Bad Request",
    message: "The request contains invalid values.",
  },
  FORBIDDEN: {
    statusCode: 403,
    error: "Forbidden",
    message: "You do not have access to this resource.",
  },
  NOT_FOUND: {
    statusCode: 404,
    error: "Not Found",
    message: "The requested resource was not found.",
  },
  CONFLICT: {
    statusCode: 409,
    error: "Conflict",
    message: "The requested operation conflicts with the current resource state.",
  },
  GONE: { statusCode: 410, error: "Gone", message: "This resource is no longer available." },
  PAYLOAD_TOO_LARGE: {
    statusCode: 413,
    error: "Content Too Large",
    message: "The request body exceeds the maximum allowed size.",
  },
  UNSUPPORTED_MEDIA_TYPE: {
    statusCode: 415,
    error: "Unsupported Media Type",
    message: "The request media type is not supported.",
  },
  INTERNAL_SERVER_ERROR: {
    statusCode: 500,
    error: "Internal Server Error",
    message: "An unexpected error occurred.",
  },
  IDEMPOTENCY_CONFLICT: {
    statusCode: 409,
    error: "Conflict",
    message: "The requested operation conflicts with the current resource state.",
  },
  /*
   * The one 400 the client is allowed to treat as "discard the stored
   * Requester" (api-spec Section 3.1). Ordinary BAD_REQUEST/VALIDATION_ERROR
   * must never carry this code, or a bad form would wipe the session. The
   * message stays generic: unknown, inactive, and deleted are indistinguishable.
   */
  REQUESTER_CONTEXT_INVALID: {
    statusCode: 400,
    error: "Bad Request",
    message: "The requester context is invalid.",
  },
};

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: ErrorDetail[];

  constructor(code: ErrorCode, details?: ErrorDetail[]) {
    const definition = ERROR_DEFINITIONS[code];
    super(definition.message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = definition.statusCode;
    this.details = details;
  }
}

function buildEnvelope(code: ErrorCode, details?: ErrorDetail[]): ErrorEnvelope {
  const definition = ERROR_DEFINITIONS[code];

  return {
    statusCode: definition.statusCode,
    code,
    message: definition.message,
    error: definition.error,
    ...(details ? { details } : {}),
  };
}

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(new ApiError("NOT_FOUND"));
}

/*
 * Body-parser failures arrive here as plain Errors carrying a `type`, so they
 * are classified before anything else (api-spec Section 3.5). Anything left
 * unrecognised is an internal error: its message and stack never reach the
 * client, and only a sanitized class name is logged (Section 17).
 */
function classify(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (typeof error === "object" && error !== null && "type" in error) {
    const { type } = error as { type?: unknown };

    if (type === "entity.too.large") {
      return new ApiError("PAYLOAD_TOO_LARGE");
    }

    if (type === "entity.parse.failed") {
      return new ApiError("BAD_REQUEST");
    }

    if (type === "encoding.unsupported" || type === "charset.unsupported") {
      return new ApiError("UNSUPPORTED_MEDIA_TYPE");
    }
  }

  return new ApiError("INTERNAL_SERVER_ERROR");
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  const apiError = classify(error);
  res.locals.errorCode = apiError.code;

  if (apiError.code === "INTERNAL_SERVER_ERROR") {
    /* Sanitized class name only: no message, no stack, no Prisma metadata. */
    console.error(
      JSON.stringify({
        requestId: res.getHeader("X-Request-Id"),
        errorCode: apiError.code,
        errorClass: error instanceof Error ? error.constructor.name : typeof error,
      }),
    );
  }

  res.status(apiError.statusCode).json(buildEnvelope(apiError.code, apiError.details));
}
