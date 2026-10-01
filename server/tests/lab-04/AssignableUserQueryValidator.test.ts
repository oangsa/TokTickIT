import { expect, it } from "vitest";
import { parseAssignableUserQuery } from "../../src/services/assignableUserQueryValidator.js";
it.each([" ", "1e2", "0x10", "1.0", "+1"])("UNIT-11 rejects malformed integer query %s", (value) => {
  expect(() => parseAssignableUserQuery({ pageNumber: value })).toThrow();
});
it("UNIT-11 defaults and complete collection grammar", () => {
  expect(parseAssignableUserQuery({})).toMatchObject({ pageNumber: 1, pageSize: 10, order: [{ field: "name", direction: "asc" }, { field: "publicId", direction: "asc" }] });
  expect(parseAssignableUserQuery({ search: " 😀 ", searchFields: "name,email", filters: JSON.stringify([{ field: "role", condition: "EQUAL", value: "REQUESTER" }]), sort: "role:desc", pageSize: "100" })).toMatchObject({ search: { term: "😀", fields: ["name", "email"], caseInsensitive: true }, order: [{ field: "role", direction: "desc" }, { field: "publicId", direction: "asc" }], pageSize: 100 });
});
it.each([
  { unknown: "x" }, { search: "x" }, { search: "😀".repeat(201), searchFields: "name" }, { searchFields: "role" }, { searchFields: "name,name" },
  { sort: "publicId:asc" }, { pageSize: "0" }, { pageSize: "101" }, { pageNumber: "9007199254740992" }, { filters: "{}" }, { filters: "[" }, { filters: "[null]" },
  { search: ["a", "b"] }, { sort: { name: "asc" } },
  ...[{ field: "isActive", condition: "EQUAL", value: true }, { field: "role", condition: "IN", value: ["IT_STAFF"] }, { field: "role", condition: "EQUAL", value: "SYSTEM" }, { field: "role", condition: "EQUAL", value: "IT_STAFF", extra: true }].map((entry) => ({ filters: JSON.stringify([entry]) })),
  { filters: JSON.stringify([{ field: "role", condition: "EQUAL", value: "IT_STAFF" }, { field: "role", condition: "EQUAL", value: "ADMINISTRATOR" }]) },
])("UNIT-11 rejects invalid query %#", (query) => { expect(() => parseAssignableUserQuery(query)).toThrow(expect.objectContaining({ code: "VALIDATION_ERROR" })); });
