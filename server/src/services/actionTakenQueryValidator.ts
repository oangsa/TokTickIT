import type { QueryCondition, QueryExpression, QueryScalar, QuerySearch, QuerySort } from "./queryBuilder.js";
import { invalidField, PUBLIC_ID_PATTERN, record } from "./staffQueueQueryValidator.js";
import { isCalendarDate } from "./ticketQueryValidator.js";
export const ACTION_STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export interface ActionQuery { search?: QuerySearch; filters: QueryExpression[]; order: QuerySort[]; pageNumber: number; pageSize: number }
export function collectionInput(input: unknown, allowed: readonly string[]) {
  if (!record(input)) invalidField("query");
  for (const [key, value] of Object.entries(input)) if (!allowed.includes(key) || typeof value !== "string") invalidField(key);
  const parameters = input;
  function page(field: string, fallback: number, max = Number.MAX_SAFE_INTEGER) {
    if (parameters[field] === undefined) return fallback;
    if (typeof parameters[field] !== "string" || !/^\d+$/.test(parameters[field])) invalidField(field);
    const number = Number(parameters[field]);
    if (!Number.isSafeInteger(number) || number < 1 || number > max) invalidField(field);
    return number;
  }
  let filters: unknown = [];
  if (typeof input.filters === "string") {
    try { filters = JSON.parse(input.filters); } catch { invalidField("filters"); }
  }
  if (!Array.isArray(filters) || filters.length > 20) invalidField("filters");
  for (const entry of filters) if (!record(entry) || Object.keys(entry).some((key) => !["field", "condition", "value"].includes(key))) invalidField("filters");
  return { input, rawFilters: filters as Record<string, unknown>[], pageNumber: page("pageNumber", 1), pageSize: page("pageSize", 10, 100) };
}
export function collectionOrder(input: Record<string, unknown>, fields: readonly string[]): QuerySort[] {
  const sort = input.sort === undefined ? ["createdAt", "desc"] : String(input.sort).split(":");
  if (sort.length !== 2 || !fields.includes(sort[0]) || !["asc", "desc"].includes(sort[1])) invalidField("sort");
  const direction = sort[1] as "asc" | "desc";
  return [{ field: sort[0], direction }, { field: "id", direction }];
}
function scalar(field: string, value: unknown): QueryScalar {
  if (field === "followUpRequired") { if (typeof value !== "boolean") invalidField("filters"); return value; }
  if (typeof value !== "string") invalidField("filters");
  if (field.endsWith("UserPublicId")) { if (!PUBLIC_ID_PATTERN.test(value)) invalidField("filters"); return value.toLowerCase(); }
  if (field === "status") { if (!(ACTION_STATUSES as readonly string[]).includes(value)) invalidField("filters"); return value; }
  const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/.exec(value);
  if (!match || Number(match[1]) < 1 || !isCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))) invalidField("filters");
  return new Date(value);
}
export function parseActionQuery(value: unknown): ActionQuery {
  const { input, rawFilters, pageNumber, pageSize } = collectionInput(value, ["search", "searchFields", "filters", "sort", "pageNumber", "pageSize"]);
  let search: QuerySearch | undefined;
  let fields: string[] | undefined;
  if (typeof input.searchFields === "string") {
    fields = input.searchFields.split(",");
    if (!fields.length || fields.some((field) => !["description", "result", "followUpNote", "attachmentNotes"].includes(field)) || new Set(fields).size !== fields.length) invalidField("searchFields");
  }
  const term = typeof input.search === "string" ? input.search.trim() : "";
  if (term) { if ([...term].length > 200) invalidField("search"); if (!fields) invalidField("searchFields"); search = { fields, term, caseInsensitive: true }; }
  const filters = rawFilters.map(({ field, condition, value }): QueryExpression => {
    if (typeof field !== "string" || !["status", "assignedToUserPublicId", "performedByUserPublicId", "followUpRequired", "createdAt"].includes(field)) invalidField("filters");
    const allowed = field === "createdAt" ? ["EQUAL", "NOTEQUAL", "GREATER", "LESSER", "GREATEROREQUAL", "LESSEROREQUAL"]
      : field.endsWith("UserPublicId") ? ["EQUAL", "NOTEQUAL", "IN", "ISNULL", "ISNOTNULL"] : field === "status" ? ["EQUAL", "NOTEQUAL", "IN"] : ["EQUAL", "NOTEQUAL"];
    if (typeof condition !== "string" || !allowed.includes(condition)) invalidField("filters");
    if (condition === "ISNULL" || condition === "ISNOTNULL") { if (value !== "") invalidField("filters"); return { field, condition, value: null }; }
    if (condition === "IN") {
      if (!Array.isArray(value) || !value.length || value.length > 100) invalidField("filters");
      const values = value.map((entry: unknown) => scalar(field, entry));
      if (new Set(values).size !== values.length) invalidField("filters");
      return { field, condition, value: values };
    }
    return { field, condition: condition as QueryCondition, value: scalar(field, value) };
  });
  return { search, filters, order: collectionOrder(input, ["createdAt", "updatedAt", "status"]), pageNumber, pageSize };
}
