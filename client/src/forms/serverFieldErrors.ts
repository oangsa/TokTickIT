import type { FieldValues, UseFormSetError } from "react-hook-form";

import { ApiResponseError, type ApiErrorDetail } from "../api.js";

export const DEFAULT_FORM_ERROR = "Please review the form and try again.";

export interface ServerErrorResult {
  formError?: string;
  mappedFields: string[];
}

function safeFieldMessage(detail: ApiErrorDetail): string {
  return typeof detail.message === "string" && detail.message.trim() !== ""
    ? detail.message
    : "This value is invalid.";
}

function extractDetails(error: unknown): ApiErrorDetail[] {
  const candidate = error instanceof ApiResponseError
    ? error.details
    : typeof error === "object" && error !== null
      ? (error as { details?: unknown }).details
      : undefined;
  if (!Array.isArray(candidate)) return [];
  return candidate.flatMap((detail): ApiErrorDetail[] => {
    if (typeof detail !== "object" || detail === null) return [];
    const value = detail as { field?: unknown; message?: unknown };
    if (typeof value.field !== "string" || value.field.trim() === "") return [];
    return [{ field: value.field, message: typeof value.message === "string" ? value.message : "" }];
  });
}

export function mapServerFieldErrors<TValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TValues>,
  knownFields: ReadonlySet<string>,
  fallback = DEFAULT_FORM_ERROR,
): ServerErrorResult {
  const details = extractDetails(error);
  if (details.length === 0) return { formError: fallback, mappedFields: [] };

  const mappedFields: string[] = [];
  for (const detail of details) {
    if (knownFields.has(detail.field)) {
      setError(detail.field as never, { type: "server", message: safeFieldMessage(detail) });
      mappedFields.push(detail.field);
    }
  }

  return {
    formError: mappedFields.length === details.length && mappedFields.length > 0 ? undefined : fallback,
    mappedFields,
  };
}
