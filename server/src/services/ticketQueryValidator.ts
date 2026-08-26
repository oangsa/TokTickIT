import { ApiError, ErrorDetail } from "../http/errors.js";
import {
  QUERY_CONDITIONS,
  QueryCondition,
  QueryExpression,
  QueryScalar,
  QuerySearch,
  QuerySort,
  SortDirection,
} from "./queryBuilder.js";
import { REQUESTED_PRIORITIES } from "./ticketCreateRequest.js";

/*
 * The Ticket half of the query contract (api-spec Section 9, BR-26-39, BR-75).
 *
 * Everything the shared QueryBuilder is forbidden to know lives here: the
 * Ticket field whitelists, the exact condition matrix, typed conversion,
 * enum membership, `IN` shape and cardinality, complexity bounds, the
 * deterministic `id` tiebreaker, and the pagination bounds. Only validated,
 * typed values leave this module, so QueryBuilder and Prisma never see a
 * request this file has not already approved (BR-31).
 *
 * Errors follow `ticketCreateRequest.ts`: every problem is collected into one
 * `ErrorDetail[]` and thrown once, so a single response can report every
 * invalid parameter. Messages never echo the submitted value.
 */

export const TICKET_SEARCH_FIELDS = ["ticketNumber", "summary", "description"] as const;

export const TICKET_SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "ticketNumber",
  "summary",
  "requestedPriority",
  "currentStatus",
  "categoryId",
  "relatedSystemId",
] as const;

export const TICKET_STATUSES = ["NEW"] as const;

export const SORT_DIRECTIONS = ["asc", "desc"] as const;

/* BR-75 / api-spec Sections 9.3, 9.4, 9.8, 9.12. */
export const MAX_SEARCH_LENGTH = 200;
export const MAX_FILTER_EXPRESSIONS = 20;
export const MIN_IN_VALUES = 1;
export const MAX_IN_VALUES = 100;
export const DEFAULT_PAGE_NUMBER = 1;
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;
/*
 * A page past the last one is a 200 with an empty array (BR-38), so this bound
 * is not about the data: it is about `skip`. `(pageNumber - 1) * pageSize` is
 * computed before Prisma sees it, and an unbounded `pageNumber` pushes that
 * product past the engine's integer range, which fails as a 500 rather than as
 * the empty page BR-38 promises. At the maximum `pageSize` this still allows
 * 100,000,000 rows to be paged through.
 */
export const MAX_PAGE_NUMBER = 1_000_000;

type TicketFieldKind = "string" | "reference" | "enum" | "datetime";

/*
 * api-spec Section 9.5. The Lab 2 Requester UI exposes only four of these as
 * controls; a direct API client still gets the whole whitelist and nothing more.
 */
const TICKET_FILTER_FIELDS = {
  ticketNumber: "string",
  summary: "string",
  description: "string",
  categoryId: "reference",
  relatedSystemId: "reference",
  requestedPriority: "enum",
  currentStatus: "enum",
  createdAt: "datetime",
  updatedAt: "datetime",
} as const satisfies Record<string, TicketFieldKind>;

type TicketFilterField = keyof typeof TICKET_FILTER_FIELDS;

/*
 * api-spec Section 9.7, the authoritative matrix. `ISNULL` and `ISNOTNULL`
 * appear in no row: they are real QueryBuilder capabilities, but no current
 * Ticket filter field is nullable, so they are rejected for every field by the
 * same table rather than by a special case.
 */
const ALLOWED_CONDITIONS: Record<TicketFieldKind, readonly QueryCondition[]> = {
  string: ["CONTAINS", "STARTWITH", "ENDWITH", "EQUAL", "NOTEQUAL", "IN"],
  reference: ["EQUAL", "NOTEQUAL", "IN"],
  enum: ["EQUAL", "NOTEQUAL", "IN"],
  datetime: ["EQUAL", "NOTEQUAL", "GREATER", "LESSER", "GREATEROREQUAL", "LESSEROREQUAL"],
};

const ENUM_VALUES: Record<string, readonly string[]> = {
  requestedPriority: REQUESTED_PRIORITIES,
  currentStatus: TICKET_STATUSES,
};

const UNSIGNED_INTEGER_PATTERN = /^\d+$/;

export interface TicketListQuery {
  search?: QuerySearch;
  filters: QueryExpression[];
  order: QuerySort[];
  pageNumber: number;
  pageSize: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/*
 * Express parses `?sort=a&sort=b` into an array and `?a[b]=c` into an object.
 * Neither is part of the contract, and letting an array through would reach
 * `.trim()` or `.split()` on a non-string.
 */
function readSingleQueryValue(
  value: unknown,
  field: string,
  details: ErrorDetail[],
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    details.push({ field, message: `${field} must be supplied at most once.` });
    return undefined;
  }

  return value;
}

function convertValue(
  field: TicketFilterField,
  raw: unknown,
  path: string,
  details: ErrorDetail[],
): QueryScalar | undefined {
  const kind = TICKET_FILTER_FIELDS[field];

  switch (kind) {
    case "string": {
      if (typeof raw !== "string") {
        details.push({ field: path, message: `${field} values must be text.` });
        return undefined;
      }

      return raw;
    }

    case "reference": {
      /*
       * api-spec Section 9.9 maps `"2"` to the number 2, so a numeric string is
       * an accepted spelling of a reference value; anything that is not a whole
       * positive number is a conversion failure, not a lookup miss.
       */
      const candidate =
        typeof raw === "number"
          ? raw
          : typeof raw === "string" && UNSIGNED_INTEGER_PATTERN.test(raw)
            ? Number(raw)
            : Number.NaN;

      if (!Number.isSafeInteger(candidate) || candidate <= 0) {
        details.push({ field: path, message: `${field} values must be positive integers.` });
        return undefined;
      }

      return candidate;
    }

    case "enum": {
      const allowed = ENUM_VALUES[field] ?? [];

      if (typeof raw !== "string" || !allowed.includes(raw)) {
        details.push({ field: path, message: `${field} values must be one of ${allowed.join(", ")}.` });
        return undefined;
      }

      return raw;
    }

    case "datetime": {
      if (typeof raw !== "string") {
        details.push({ field: path, message: `${field} values must be ISO-8601 date-times.` });
        return undefined;
      }

      const parsed = new Date(raw);

      if (Number.isNaN(parsed.getTime())) {
        details.push({ field: path, message: `${field} values must be ISO-8601 date-times.` });
        return undefined;
      }

      return parsed;
    }

    default: {
      const unreachable: never = kind;
      throw new Error(`Unsupported Ticket field kind: ${String(unreachable)}`);
    }
  }
}

/* api-spec Section 9.8: a JSON array of 1-100 unique, individually valid values. */
function convertInValues(
  field: TicketFilterField,
  raw: unknown,
  path: string,
  details: ErrorDetail[],
): QueryScalar[] | undefined {
  if (!Array.isArray(raw)) {
    details.push({ field: path, message: "IN values must be a JSON array." });
    return undefined;
  }

  if (raw.length < MIN_IN_VALUES || raw.length > MAX_IN_VALUES) {
    details.push({
      field: path,
      message: `IN values must contain ${MIN_IN_VALUES}-${MAX_IN_VALUES} values.`,
    });
    return undefined;
  }

  const converted: QueryScalar[] = [];

  for (const entry of raw) {
    const value = convertValue(field, entry, path, details);

    if (value === undefined) {
      return undefined;
    }

    converted.push(value);
  }

  /* Uniqueness is judged after conversion, so `1` and `"1"` are one value. */
  const keys = converted.map((value) => (value instanceof Date ? value.getTime() : value));

  if (new Set(keys).size !== keys.length) {
    details.push({ field: path, message: "IN values must not repeat." });
    return undefined;
  }

  return converted;
}

function readSearch(query: Record<string, unknown>, details: ErrorDetail[]): QuerySearch | undefined {
  const rawSearch = readSingleQueryValue(query.search, "search", details);

  if (rawSearch === undefined) {
    return undefined;
  }

  /* BR-27: a blank search is absent, and `searchFields` is then ignored. */
  const term = rawSearch.trim();

  if (term.length === 0) {
    return undefined;
  }

  /*
   * Counted in code points for the same reason `readTrimmedText` does it in
   * `ticketCreateRequest.ts`: one astral character is two UTF-16 code units.
   */
  const withinLength = [...term].length <= MAX_SEARCH_LENGTH;

  if (!withinLength) {
    details.push({
      field: "search",
      message: `search must contain at most ${MAX_SEARCH_LENGTH} characters.`,
    });
  }

  const rawFields = readSingleQueryValue(query.searchFields, "searchFields", details);

  if (rawFields === undefined || rawFields.trim().length === 0) {
    details.push({
      field: "searchFields",
      message: "searchFields is required when search is supplied.",
    });
    return undefined;
  }

  const fields = rawFields.split(",");

  for (const field of fields) {
    if (!TICKET_SEARCH_FIELDS.includes(field as (typeof TICKET_SEARCH_FIELDS)[number])) {
      details.push({
        field: "searchFields",
        message: `searchFields must be within ${TICKET_SEARCH_FIELDS.join(", ")}.`,
      });
      return undefined;
    }
  }

  if (new Set(fields).size !== fields.length) {
    details.push({ field: "searchFields", message: "searchFields must not repeat." });
    return undefined;
  }

  if (!withinLength) {
    return undefined;
  }

  /* BR-26/BR-33: Ticket search fields are text, so matching is case-insensitive. */
  return { fields, term, caseInsensitive: true };
}

function readFilters(query: Record<string, unknown>, details: ErrorDetail[]): QueryExpression[] {
  const raw = readSingleQueryValue(query.filters, "filters", details);

  if (raw === undefined) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    details.push({ field: "filters", message: "filters must be a JSON array." });
    return [];
  }

  if (!Array.isArray(parsed)) {
    details.push({ field: "filters", message: "filters must be a JSON array." });
    return [];
  }

  if (parsed.length > MAX_FILTER_EXPRESSIONS) {
    details.push({
      field: "filters",
      message: `filters must contain at most ${MAX_FILTER_EXPRESSIONS} expressions.`,
    });
    return [];
  }

  const expressions: QueryExpression[] = [];

  parsed.forEach((entry, index) => {
    const path = `filters[${index}]`;

    if (!isRecord(entry) || !("field" in entry) || !("condition" in entry) || !("value" in entry)) {
      details.push({ field: path, message: "Each filter requires field, condition, and value." });
      return;
    }

    const field = entry.field;

    /*
     * `Object.hasOwn`, never `in`: `in` walks the prototype chain, so `field`
     * values like `toString` or `constructor` would pass this whitelist and
     * then index `ALLOWED_CONDITIONS` with a Function, turning a rejection
     * into a TypeError and a 500.
     */
    if (typeof field !== "string" || !Object.hasOwn(TICKET_FILTER_FIELDS, field)) {
      details.push({
        field: `${path}.field`,
        message: `field must be one of ${Object.keys(TICKET_FILTER_FIELDS).join(", ")}.`,
      });
      return;
    }

    const ticketField = field as TicketFilterField;
    const condition = entry.condition;

    if (
      typeof condition !== "string" ||
      !QUERY_CONDITIONS.includes(condition as QueryCondition) ||
      !ALLOWED_CONDITIONS[TICKET_FILTER_FIELDS[ticketField]].includes(condition as QueryCondition)
    ) {
      /*
       * One message for both an unknown condition and a condition the matrix
       * forbids for this field: `summary + ISNULL` is representable by the
       * generic builder and still invalid here (api-spec Section 9.6).
       */
      details.push({
        field: `${path}.condition`,
        message: `condition is not supported for ${field}.`,
      });
      return;
    }

    const ticketCondition = condition as QueryCondition;

    const value =
      ticketCondition === "IN"
        ? convertInValues(ticketField, entry.value, `${path}.value`, details)
        : convertValue(ticketField, entry.value, `${path}.value`, details);

    if (value === undefined) {
      return;
    }

    expressions.push({
      field: ticketField,
      condition: ticketCondition,
      value,
      caseInsensitive: TICKET_FILTER_FIELDS[ticketField] === "string",
    });
  });

  return expressions;
}

function readOrder(query: Record<string, unknown>, details: ErrorDetail[]): QuerySort[] {
  const raw = readSingleQueryValue(query.sort, "sort", details);

  /*
   * BR-34/BR-35. `id DESC` is appended here rather than in QueryBuilder because
   * it is Ticket pagination determinism, not generic ordering, and `id` is
   * deliberately absent from the public sortable whitelist.
   *
   * Priority needs no translation: the migration declares
   * `CREATE TYPE "RequestedPriority" AS ENUM ('LOW','MEDIUM','HIGH')` and
   * PostgreSQL orders an enum column by declaration order, so `desc` already
   * means HIGH, MEDIUM, LOW. Choosing that mapping is still a Ticket decision,
   * which is why it is stated here and asserted by a named test rather than
   * left to look like an accident.
   */
  const tiebreaker: QuerySort = { field: "id", direction: "desc" };

  if (raw === undefined) {
    return [{ field: "createdAt", direction: "desc" }, tiebreaker];
  }

  const parts = raw.split(":");
  const [field, direction] = parts;

  if (
    parts.length !== 2 ||
    !TICKET_SORT_FIELDS.includes(field as (typeof TICKET_SORT_FIELDS)[number]) ||
    !SORT_DIRECTIONS.includes(direction as SortDirection)
  ) {
    details.push({
      field: "sort",
      message: `sort must be one of ${TICKET_SORT_FIELDS.join(", ")} with asc or desc.`,
    });
    return [{ field: "createdAt", direction: "desc" }, tiebreaker];
  }

  return [{ field, direction: direction as SortDirection }, tiebreaker];
}

function readPagingValue(
  query: Record<string, unknown>,
  field: "pageNumber" | "pageSize",
  fallback: number,
  minimum: number,
  maximum: number,
  details: ErrorDetail[],
): number {
  const raw = readSingleQueryValue(query[field], field, details);
  const message = `${field} must be between ${minimum} and ${maximum}.`;

  /*
   * api-spec Section 9.14: an absent parameter takes the default, but an
   * explicitly supplied blank or unparseable value is an error. `pageNumber=`
   * arrives as `""`, which fails the pattern rather than reading as absent.
   */
  if (raw === undefined) {
    return fallback;
  }

  if (!UNSIGNED_INTEGER_PATTERN.test(raw)) {
    details.push({ field, message });
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    details.push({ field, message });
    return fallback;
  }

  return value;
}

export function parseTicketListQuery(query: unknown): TicketListQuery {
  const details: ErrorDetail[] = [];

  if (!isRecord(query)) {
    throw new ApiError("VALIDATION_ERROR", [
      { field: "query", message: "The query string could not be read." },
    ]);
  }

  const search = readSearch(query, details);
  const filters = readFilters(query, details);
  const order = readOrder(query, details);
  const pageNumber = readPagingValue(
    query,
    "pageNumber",
    DEFAULT_PAGE_NUMBER,
    1,
    MAX_PAGE_NUMBER,
    details,
  );
  const pageSize = readPagingValue(query, "pageSize", DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE, details);

  if (details.length > 0) {
    throw new ApiError("VALIDATION_ERROR", details);
  }

  return { search, filters, order, pageNumber, pageSize };
}
