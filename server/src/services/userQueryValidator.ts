import { ApiError, type ErrorDetail } from "../http/errors.js";
import type { QueryExpression, QuerySearch, QuerySort } from "./queryBuilder.js";
import { invalidField, record } from "./staffQueueQueryValidator.js";

export const USER_SEARCH_FIELDS = ["name", "email"] as const;
export const USER_SORT_FIELDS = ["name", "email"] as const;
export const USER_ROLES = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const;

export interface UserListQuery {
  search?: QuerySearch;
  filters: QueryExpression[];
  order: QuerySort[];
  pageNumber: number;
  pageSize: number;
}

const ALLOWED_QUERY_KEYS = new Set([
  "search",
  "searchFields",
  "filters",
  "sort",
  "pageNumber",
  "pageSize",
]);

export function parseUserListQuery(input: unknown): UserListQuery {
  if (!record(input)) {
    invalidField("query");
  }

  for (const key of Object.keys(input)) {
    if (!ALLOWED_QUERY_KEYS.has(key)) {
      invalidField(key, `Unsupported query parameter '${key}'.`);
    }
  }

  for (const key of ["search", "searchFields", "filters", "sort", "pageNumber", "pageSize"]) {
    if (input[key] !== undefined && typeof input[key] !== "string") {
      invalidField(key);
    }
  }

  const details: ErrorDetail[] = [];

  let pageNumber = 1;
  if (input.pageNumber !== undefined) {
    const parsed = Number(input.pageNumber);
    if (!Number.isInteger(parsed) || parsed < 1) {
      details.push({ field: "pageNumber", message: "pageNumber must be a positive integer." });
    } else {
      pageNumber = parsed;
    }
  }

  let pageSize = 10;
  if (input.pageSize !== undefined) {
    const parsed = Number(input.pageSize);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
      details.push({ field: "pageSize", message: "pageSize must be between 1 and 100." });
    } else {
      pageSize = parsed;
    }
  }

  if (details.length) {
    throw new ApiError("VALIDATION_ERROR", details);
  }

  let searchFields: string[] | undefined;
  if (input.searchFields !== undefined) {
    const fields = (input.searchFields as string).split(",");
    if (
      !fields.length ||
      fields.some((f) => !USER_SEARCH_FIELDS.includes(f as typeof USER_SEARCH_FIELDS[number])) ||
      new Set(fields).size !== fields.length
    ) {
      invalidField("searchFields", "searchFields must contain unique approved fields (name, email).");
    }
    searchFields = fields;
  }

  let search: QuerySearch | undefined;
  const term = (input.search as string | undefined)?.trim();
  if (term) {
    if ([...term].length > 200) {
      invalidField("search", "Search term must be at most 200 characters.");
    }
    if (!searchFields) {
      invalidField("searchFields", "searchFields is required when search is provided.");
    }
    search = { term, fields: searchFields, caseInsensitive: true };
  }

  let rawFilters: unknown = [];
  if (input.filters !== undefined) {
    try {
      rawFilters = JSON.parse(input.filters as string);
    } catch {
      invalidField("filters", "filters must be a valid JSON array.");
    }
  }

  if (!Array.isArray(rawFilters) || rawFilters.length > 1) {
    invalidField("filters");
  }

  const filters: QueryExpression[] = rawFilters.map((entry): QueryExpression => {
    if (!record(entry) || entry.field !== "role") {
      invalidField("filters", "Only 'role' filter is supported for users.");
    }
    if (entry.condition !== "EQUAL") {
      invalidField("filters", "Role filter condition must be EQUAL.");
    }
    if (
      typeof entry.value !== "string" ||
      !USER_ROLES.includes(entry.value as typeof USER_ROLES[number])
    ) {
      invalidField("filters", "Role filter value must be a valid UserRole.");
    }
    return {
      field: "role",
      condition: "EQUAL",
      value: entry.value,
    };
  });

  const order: QuerySort[] = [];
  if (input.sort !== undefined) {
    const parts = (input.sort as string).split(":");
    if (
      parts.length !== 2 ||
      !USER_SORT_FIELDS.includes(parts[0] as typeof USER_SORT_FIELDS[number]) ||
      !["asc", "desc"].includes(parts[1])
    ) {
      invalidField("sort", "sort must be name:asc, name:desc, email:asc, or email:desc.");
    }
    order.push(
      { field: parts[0], direction: parts[1] as "asc" | "desc" },
      { field: "publicId", direction: "asc" },
    );
  } else {
    order.push(
      { field: "name", direction: "asc" },
      { field: "publicId", direction: "asc" },
    );
  }

  return { search, filters, order, pageNumber, pageSize };
}
