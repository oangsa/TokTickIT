import { describe, expect, it } from "vitest";
import { parseUserListQuery } from "../../src/services/userQueryValidator.js";

describe("UNIT-14 UserQueryValidator @issue-6", () => {
  it("uses default values when query is empty", () => {
    const result = parseUserListQuery({});
    expect(result.pageNumber).toBe(1);
    expect(result.pageSize).toBe(10);
    expect(result.search).toBeUndefined();
    expect(result.filters).toEqual([]);
    expect(result.order).toEqual([
      { field: "name", direction: "asc" },
      { field: "publicId", direction: "asc" },
    ]);
  });

  it("parses valid search and approved searchFields with OR semantics", () => {
    const result = parseUserListQuery({
      search: "alice",
      searchFields: "name,email",
    });
    expect(result.search).toEqual({
      term: "alice",
      fields: ["name", "email"],
      caseInsensitive: true,
    });
  });

  it("ignores searchFields when search is empty or whitespace", () => {
    const result = parseUserListQuery({ search: "   ", searchFields: "name" });
    expect(result.search).toBeUndefined();
  });

  it("rejects unapproved or duplicate searchFields even without search text or with blank search", () => {
    expect(() => parseUserListQuery({ searchFields: "passwordHash" })).toThrowError();
    expect(() => parseUserListQuery({ search: "   ", searchFields: "name,name" })).toThrowError();
    expect(() => parseUserListQuery({ searchFields: "name,role" })).toThrowError();
  });

  it("rejects search without searchFields or with unapproved searchFields", () => {
    expect(() => parseUserListQuery({ search: "alice" })).toThrowError();
    expect(() => parseUserListQuery({ search: "alice", searchFields: "name,role" })).toThrowError();
    expect(() => parseUserListQuery({ search: "alice", searchFields: "name,name" })).toThrowError();
  });

  it("rejects search term over 200 characters", () => {
    expect(() => parseUserListQuery({ search: "x".repeat(201), searchFields: "name" })).toThrowError();
  });

  it("parses valid role EQUAL filter", () => {
    const filters = JSON.stringify([{ field: "role", condition: "EQUAL", value: "IT_STAFF" }]);
    const result = parseUserListQuery({ filters });
    expect(result.filters).toEqual([
      { field: "role", condition: "EQUAL", value: "IT_STAFF" },
    ]);
  });

  it("accepts empty filter array", () => {
    const result = parseUserListQuery({ filters: "[]" });
    expect(result.filters).toEqual([]);
  });

  it("rejects non-role filters, non-EQUAL conditions, or invalid roles", () => {
    expect(() =>
      parseUserListQuery({
        filters: JSON.stringify([{ field: "name", condition: "EQUAL", value: "Alice" }]),
      }),
    ).toThrowError();

    expect(() =>
      parseUserListQuery({
        filters: JSON.stringify([{ field: "role", condition: "IN", value: ["IT_STAFF"] }]),
      }),
    ).toThrowError();

    expect(() =>
      parseUserListQuery({
        filters: JSON.stringify([{ field: "role", condition: "EQUAL", value: "SUPERUSER" }]),
      }),
    ).toThrowError();

    expect(() => parseUserListQuery({ filters: "invalid-json" })).toThrowError();
  });

  it("parses approved sort options and appends publicId tie-break", () => {
    const desc = parseUserListQuery({ sort: "email:desc" });
    expect(desc.order).toEqual([
      { field: "email", direction: "desc" },
      { field: "publicId", direction: "asc" },
    ]);

    const asc = parseUserListQuery({ sort: "name:asc" });
    expect(asc.order).toEqual([
      { field: "name", direction: "asc" },
      { field: "publicId", direction: "asc" },
    ]);
  });

  it("rejects unapproved sort fields or directions", () => {
    expect(() => parseUserListQuery({ sort: "role:asc" })).toThrowError();
    expect(() => parseUserListQuery({ sort: "createdAt:desc" })).toThrowError();
    expect(() => parseUserListQuery({ sort: "name:up" })).toThrowError();
    expect(() => parseUserListQuery({ sort: "name" })).toThrowError();
  });

  it("validates pageNumber and pageSize bounds", () => {
    const valid = parseUserListQuery({ pageNumber: "3", pageSize: "50" });
    expect(valid.pageNumber).toBe(3);
    expect(valid.pageSize).toBe(50);

    expect(() => parseUserListQuery({ pageNumber: "0" })).toThrowError();
    expect(() => parseUserListQuery({ pageNumber: "-1" })).toThrowError();
    expect(() => parseUserListQuery({ pageNumber: "abc" })).toThrowError();
    expect(() => parseUserListQuery({ pageSize: "0" })).toThrowError();
    expect(() => parseUserListQuery({ pageSize: "101" })).toThrowError();
  });

  it("rejects unknown query parameters", () => {
    expect(() => parseUserListQuery({ foo: "bar" })).toThrowError();
    expect(() => parseUserListQuery({ department: "IT" })).toThrowError();
  });
});
