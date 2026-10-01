import { expect, it } from "vitest";
import { parseActionQuery } from "../../src/services/actionTakenQueryValidator.js";
import { TICKET_ID } from "../lab-03/support/staffFixture.js";
it("UNIT-07 defaults to bounded newest-first collection", () => {
  expect(parseActionQuery({})).toEqual({ search: undefined, filters: [], order: [{ field: "createdAt", direction: "desc" }, { field: "id", direction: "desc" }], pageNumber: 1, pageSize: 10 });
});
it("UNIT-07 validates full search/filter/sort grammar", () => {
  const filters = [
    { field: "status", condition: "IN", value: ["PLANNED", "COMPLETED"] },
    { field: "assignedToUserPublicId", condition: "ISNULL", value: "" },
    { field: "performedByUserPublicId", condition: "EQUAL", value: TICKET_ID },
    { field: "followUpRequired", condition: "EQUAL", value: true },
    { field: "createdAt", condition: "GREATEROREQUAL", value: "2026-01-01T00:00:00Z" },
  ];
  const query = parseActionQuery({ search: " 😀 ", searchFields: "description,result,followUpNote,attachmentNotes", filters: JSON.stringify(filters), sort: "status:asc", pageSize: "100", pageNumber: "2" });
  expect(query.search).toEqual({ term: "😀", fields: ["description", "result", "followUpNote", "attachmentNotes"], caseInsensitive: true });
  expect(query.filters[4].value).toEqual(new Date("2026-01-01T00:00:00Z"));
  expect(query.pageNumber).toBe(2);
});
it.each([
  { secret: "x" }, { search: [] }, { search: "x" }, { search: "😀".repeat(201), searchFields: "description" },
  { searchFields: "description,description" }, { searchFields: "creator" }, { sort: "description:asc" }, { sort: "createdAt:ASC" },
  { pageNumber: "0" }, { pageNumber: "9007199254740992" }, { pageSize: "101" }, { pageSize: "1.0" }, { filters: "{" }, { filters: "{}" },
  ...[
    { field: "ticketId", condition: "EQUAL", value: 1 }, { field: "status", condition: "CONTAINS", value: "PLANNED" },
    { field: "status", condition: "EQUAL", value: "NEW" }, { field: "status", condition: "IN", value: [] },
    { field: "assignedToUserPublicId", condition: "EQUAL", value: 1 }, { field: "assignedToUserPublicId", condition: "ISNULL", value: null },
    { field: "followUpRequired", condition: "EQUAL", value: "true" }, { field: "createdAt", condition: "EQUAL", value: "2026-02-30T00:00:00Z" },
    { field: "status", condition: "EQUAL", value: "PLANNED", OR: true },
  ].map((entry) => ({ filters: JSON.stringify([entry]) })),
])("UNIT-07 rejects unapproved/malformed query %#", (input) => { expect(() => parseActionQuery(input)).toThrow(expect.objectContaining({ code: "VALIDATION_ERROR" })); });
