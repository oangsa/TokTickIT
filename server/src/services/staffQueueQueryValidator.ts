import { ApiError, type ErrorDetail } from "../http/errors.js";
import type { QueryCondition, QueryExpression, QueryScalar, QuerySearch, QuerySort } from "./queryBuilder.js";
import { isCalendarDate, readPagingValue, TICKET_STATUSES } from "./ticketQueryValidator.js";

export const STAFF_SEARCH_FIELDS = ["ticketNumber", "summary", "description", "requesterName"];
export const STAFF_SORT_FIELDS = ["createdAt", "updatedAt", "ticketNumber", "itPriority", "currentStatus"];
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export const PUBLIC_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FILTER_FIELDS = ["currentStatus", "itPriority", "requestedPriority", "ownerPublicId", "categoryId", "relatedSystemId", "createdAt"];

export interface StaffQueueQuery {
  search?: QuerySearch;
  filters: QueryExpression[];
  order: QuerySort[];
  pageNumber: number;
  pageSize: number;
}

export function invalidField(field: string, message = "The value is invalid."): never {
  throw new ApiError("VALIDATION_ERROR", [{ field, message }]);
}

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function scalar(field: string, value: unknown): QueryScalar {
  if (field === "categoryId" || field === "relatedSystemId") {
    const number = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
    if (!Number.isSafeInteger(number) || number < 1 || number > 2_147_483_647) invalidField("filters");
    return number;
  }
  if (typeof value !== "string") invalidField("filters");
  if (field === "ownerPublicId") {
    if (!PUBLIC_ID_PATTERN.test(value)) invalidField("filters");
    return value.toLowerCase();
  }
  if (field === "createdAt") {
    const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/.exec(value);
    if (!match || Number(match[1]) < 1 || !isCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))) invalidField("filters");
    return new Date(value);
  }
  const values: readonly string[] = field === "currentStatus" ? TICKET_STATUSES : PRIORITIES;
  if (!values.includes(value)) invalidField("filters");
  return value;
}

export function parseStaffQueueQuery(input: unknown): StaffQueueQuery {
  if (!record(input)) invalidField("query");
  for (const key of ["search", "filters", "sort", "pageNumber", "pageSize"]) {
    if (input[key] !== undefined && typeof input[key] !== "string") invalidField(key);
  }
  const details: ErrorDetail[] = [];
  const pageNumber = readPagingValue(input, "pageNumber", 1, 1, undefined, details);
  const pageSize = readPagingValue(input, "pageSize", 10, 1, 100, details);
  if (details.length) throw new ApiError("VALIDATION_ERROR", details);
  let search: QuerySearch | undefined;
  const term = (input.search as string | undefined)?.trim();
  if (term) {
    if ([...term].length > 200) invalidField("search");
    if (typeof input.searchFields !== "string") invalidField("searchFields");
    const fields = (input.searchFields as string | undefined)?.split(",") ?? [];
    if (!fields.length || fields.some((field) => !STAFF_SEARCH_FIELDS.includes(field)) || new Set(fields).size !== fields.length) invalidField("searchFields");
    search = { term, fields, caseInsensitive: true };
  }
  let rawFilters: unknown = [];
  if (input.filters !== undefined) {
    try { rawFilters = JSON.parse(input.filters as string); } catch { invalidField("filters"); }
  }
  if (!Array.isArray(rawFilters) || rawFilters.length > 20) invalidField("filters");
  const filters = rawFilters.map((entry): QueryExpression => {
    if (!record(entry) || typeof entry.field !== "string" || !FILTER_FIELDS.includes(entry.field)) invalidField("filters");
    const { field, condition, value } = entry;
    const allowed = field === "createdAt"
      ? ["EQUAL", "NOTEQUAL", "GREATER", "LESSER", "GREATEROREQUAL", "LESSEROREQUAL"]
      : field === "ownerPublicId" ? ["EQUAL", "NOTEQUAL", "IN", "ISNULL", "ISNOTNULL"] : ["EQUAL", "NOTEQUAL", "IN"];
    if (typeof condition !== "string" || !allowed.includes(condition)) invalidField("filters");
    if (condition === "ISNULL" || condition === "ISNOTNULL") {
      if (value !== "") invalidField("filters");
      return { field, condition, value: null };
    }
    if (condition === "IN") {
      if (!Array.isArray(value) || value.length < 1 || value.length > 100) invalidField("filters");
      const values = value.map((item) => scalar(field, item));
      if (new Set(values).size !== values.length) invalidField("filters");
      return { field, condition, value: values };
    }
    return { field, condition: condition as QueryCondition, value: scalar(field, value) };
  });
  const order: QuerySort[] = [];
  if (input.sort !== undefined) {
    const parts = (input.sort as string).split(":");
    if (parts.length !== 2 || !STAFF_SORT_FIELDS.includes(parts[0]) || !["asc", "desc"].includes(parts[1])) invalidField("sort");
    order.push({ field: parts[0], direction: parts[1] as "asc" | "desc" }, { field: "id", direction: "asc" });
  }
  return { search, filters, order, pageNumber, pageSize };
}
