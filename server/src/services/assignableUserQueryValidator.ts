import { invalidField, record } from "./staffQueueQueryValidator.js";
import { parseUserListQuery, type UserListQuery } from "./userQueryValidator.js";

export function parseAssignableUserQuery(input: unknown, sortFields: readonly string[] = ["name", "email", "role"]): UserListQuery {
  if (record(input)) for (const field of ["pageNumber", "pageSize"]) {
    if (input[field] !== undefined && (typeof input[field] !== "string" || !/^\d+$/.test(input[field]))) invalidField(field);
  }
  const query = parseUserListQuery(input, sortFields);
  if (!Number.isSafeInteger(query.pageNumber)) invalidField("pageNumber");
  if (record(input) && typeof input.filters === "string") {
    const filters: unknown = JSON.parse(input.filters);
    if (Array.isArray(filters) && filters.some((entry: unknown) => !record(entry) || Object.keys(entry).some((key) => !["field", "condition", "value"].includes(key)))) invalidField("filters");
  }
  return query;
}
