import { describe, expect, it } from "vitest";
import { parseStaffQueueQuery } from "../../src/services/staffQueueQueryValidator.js";

describe("UNIT-13 Queue query validation @issue-5", () => {
  it("defaults to operational order and ten rows", () => {
    expect(parseStaffQueueQuery({})).toMatchObject({ pageNumber: 1, pageSize: 10, order: [], filters: [] });
  });
  it("ignores searchFields when search is inactive", () => {
    expect(parseStaffQueueQuery({ search: "  ", searchFields: ["unapproved"] }).search).toBeUndefined();
  });
  it.each([
    { pageNumber: "0" }, { pageSize: "101" }, { pageSize: "" }, { sort: "summary:asc" }, { sort: "createdAt:ASC" },
    { sort: ["createdAt:asc"] }, { search: "x" }, { search: "x", searchFields: "owner" },
    { search: "x", searchFields: "summary,summary" }, { search: "x".repeat(201), searchFields: "summary" },
  ])("rejects invalid query %j", (query) => expect(() => parseStaffQueueQuery(query)).toThrow());
  it.each([
    ["summary", "EQUAL", "x"], ["currentStatus", "ISNULL", ""], ["itPriority", "CONTAINS", "HIGH"],
    ["requestedPriority", "EQUAL", "high"], ["ownerPublicId", "ISNULL", null], ["ownerPublicId", "EQUAL", "1"],
    ["categoryId", "EQUAL", true], ["categoryId", "IN", [1, "1"]], ["categoryId", "EQUAL", 2147483648],
    ["relatedSystemId", "ISNOTNULL", ""], ["createdAt", "IN", ["2026-01-01T00:00:00Z"]],
    ["createdAt", "EQUAL", "2026-02-30T00:00:00Z"], ["createdAt", "EQUAL", "2026-01-01"],
    ["createdAt", "EQUAL", "2026-01-01T00:00:00+07:00"], ["createdAt", "EQUAL", "0000-01-01T00:00:00Z"],
    ["currentStatus", "IN", []], ["currentStatus", "IN", Array(101).fill("OPEN")], ["constructor", "EQUAL", 1],
  ])("rejects incompatible %s %s %j", (field, condition, value) => {
    expect(() => parseStaffQueueQuery({ filters: JSON.stringify([{ field, condition, value }]) })).toThrow();
  });
  it("converts integer/UUID/UTC values and keeps terminal states reachable", () => {
    const parsed = parseStaffQueueQuery({ search: " vpn ", searchFields: "requesterName,summary", pageNumber: "999999999", pageSize: "100", sort: "itPriority:desc", filters: JSON.stringify([
      { field: "categoryId", condition: "IN", value: ["1", 2] }, { field: "currentStatus", condition: "EQUAL", value: "CLOSED" },
      { field: "createdAt", condition: "GREATEROREQUAL", value: "2026-01-01T00:00:00Z" },
    ]) });
    expect(parsed.filters[0].value).toEqual([1, 2]);
    expect(parsed.filters[2].value).toBeInstanceOf(Date);
    expect(parsed.search?.term).toBe("vpn");
  });
});
