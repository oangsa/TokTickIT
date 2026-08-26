import { describe, expect, it } from "vitest";

import {
  QUERY_CONDITIONS,
  QueryCondition,
  buildFilter,
  buildOrderBy,
  buildSearchGroup,
  buildWhere,
} from "../../src/services/queryBuilder.js";

/*
 * UNIT-07/08/09 (BR-28-35, AC-24, AC-27-28).
 *
 * Every case below uses a fictional `article` resource -- `title`, `authorId`,
 * `publishedAt`, `archivedAt` -- rather than Ticket fields. That is the point
 * of the suite as much as the assertions are: if a Ticket whitelist, the
 * ownership predicate, semantic Priority ordering, or pagination ever leaked
 * into the shared QueryBuilder, it could not satisfy a resource it has never
 * heard of, and these tests would fail instead of quietly passing (BR-31).
 */
describe("QueryBuilder generic condition construction (UNIT-07)", () => {
  const cases: Array<[QueryCondition, unknown, Record<string, unknown>]> = [
    ["CONTAINS", "vpn", { contains: "vpn" }],
    ["STARTWITH", "vpn", { startsWith: "vpn" }],
    ["ENDWITH", "vpn", { endsWith: "vpn" }],
    ["EQUAL", "vpn", { equals: "vpn" }],
    ["NOTEQUAL", "vpn", { not: "vpn" }],
    ["GREATER", 5, { gt: 5 }],
    ["LESSER", 5, { lt: 5 }],
    ["GREATEROREQUAL", 5, { gte: 5 }],
    ["LESSEROREQUAL", 5, { lte: 5 }],
    ["ISNULL", "", { equals: null }],
    ["ISNOTNULL", "", { not: null }],
    ["IN", [1, 2], { in: [1, 2] }],
  ];

  it.each(cases)("builds %s", (condition, value, expected) => {
    expect(buildFilter({ field: "title", condition, value: value as never })).toEqual({
      title: expected,
    });
  });

  it("covers the complete approved generic vocabulary", () => {
    // A new condition added to the vocabulary must arrive with a case above.
    expect(cases.map(([condition]) => condition).sort()).toEqual([...QUERY_CONDITIONS].sort());
  });

  it("ignores the value carried by ISNULL and ISNOTNULL", () => {
    // api-spec Section 9.6 keeps `value` present but unused for both.
    expect(buildFilter({ field: "archivedAt", condition: "ISNULL", value: "" })).toEqual({
      archivedAt: { equals: null },
    });
    expect(buildFilter({ field: "archivedAt", condition: "ISNOTNULL", value: "ignored" })).toEqual({
      archivedAt: { not: null },
    });
  });

  it("adds insensitive mode only when the caller asks for it", () => {
    // BR-33 is a resource decision about which fields are textual. The builder
    // never infers it: `mode` on an Int or enum filter is a Prisma query error.
    expect(
      buildFilter({ field: "title", condition: "CONTAINS", value: "vpn", caseInsensitive: true }),
    ).toEqual({ title: { contains: "vpn", mode: "insensitive" } });

    expect(buildFilter({ field: "title", condition: "CONTAINS", value: "vpn" })).toEqual({
      title: { contains: "vpn" },
    });

    expect(
      buildFilter({ field: "title", condition: "EQUAL", value: "vpn", caseInsensitive: true }),
    ).toEqual({ title: { equals: "vpn", mode: "insensitive" } });

  });

  it("never adds insensitive mode to IN", () => {
    // Prisma's `StringFilter` type accepts `mode` beside `in`, so emitting it
    // would typecheck and read as correct; Prisma honours the flag for
    // `equals`, `contains`, `startsWith`, `endsWith`, and `not` only, and
    // silently ignores it for `in`. A flag the database ignores must not be
    // emitted, or the fragment promises a semantic no row will be matched by.
    expect(
      buildFilter({ field: "title", condition: "IN", value: ["a", "b"], caseInsensitive: true }),
    ).toEqual({ title: { in: ["a", "b"] } });
  });

  it("escapes LIKE wildcards in every pattern-rendered condition", () => {
    // `%`, `_`, and `\` are parameterized by Prisma, so they are not injection,
    // but PostgreSQL still reads them as pattern syntax. Unescaped, CONTAINS
    // "100%" matches "1009" and STARTWITH "a_b" matches "axb".
    expect(buildFilter({ field: "title", condition: "CONTAINS", value: "100%" })).toEqual({
      title: { contains: "100\\%" },
    });

    expect(buildFilter({ field: "title", condition: "STARTWITH", value: "a_b" })).toEqual({
      title: { startsWith: "a\\_b" },
    });

    expect(buildFilter({ field: "title", condition: "ENDWITH", value: "c\\d" })).toEqual({
      title: { endsWith: "c\\\\d" },
    });

    // The backslash is escaped first, or it would double-escape what follows.
    expect(buildFilter({ field: "title", condition: "CONTAINS", value: "\\%" })).toEqual({
      title: { contains: "\\\\\\%" },
    });
  });

  it("escapes EQUAL and NOTEQUAL only once they are case-insensitive", () => {
    // Prisma renders an insensitive `equals` as ILIKE, so without this an
    // equality filter silently becomes a pattern match: EQUAL "100%" would
    // return "1009" as well.
    expect(
      buildFilter({ field: "title", condition: "EQUAL", value: "100%", caseInsensitive: true }),
    ).toEqual({ title: { equals: "100\\%", mode: "insensitive" } });

    expect(
      buildFilter({ field: "title", condition: "NOTEQUAL", value: "100%", caseInsensitive: true }),
    ).toEqual({ title: { not: "100\\%", mode: "insensitive" } });

    // Case-sensitive `equals` is a plain `=`, where a wildcard is already literal.
    expect(buildFilter({ field: "title", condition: "EQUAL", value: "100%" })).toEqual({
      title: { equals: "100%" },
    });
  });

  it("never escapes a value no LIKE pattern will read", () => {
    // `IN` renders as `IN (...)`, so an escape here would make the caller
    // search for a literal backslash that no row holds.
    expect(
      buildFilter({ field: "title", condition: "IN", value: ["100%"], caseInsensitive: true }),
    ).toEqual({ title: { in: ["100%"] } });

    // Only a string can carry a wildcard.
    expect(buildFilter({ field: "authorId", condition: "EQUAL", value: 7 })).toEqual({
      authorId: { equals: 7 },
    });
  });

  it("never adds insensitive mode to a comparison condition", () => {
    expect(
      buildFilter({
        field: "publishedAt",
        condition: "GREATER",
        value: new Date("2026-08-20T00:00:00.000Z"),
        caseInsensitive: true,
      }),
    ).toEqual({ publishedAt: { gt: new Date("2026-08-20T00:00:00.000Z") } });

    expect(
      buildFilter({ field: "archivedAt", condition: "ISNULL", value: "", caseInsensitive: true }),
    ).toEqual({ archivedAt: { equals: null } });
  });
});

describe("QueryBuilder multi-field search construction (UNIT-08)", () => {
  it("ORs one term across every supplied field", () => {
    expect(
      buildSearchGroup({ fields: ["title", "body"], term: "vpn", caseInsensitive: true }),
    ).toEqual({
      OR: [
        { title: { contains: "vpn", mode: "insensitive" } },
        { body: { contains: "vpn", mode: "insensitive" } },
      ],
    });
  });

  it("escapes a wildcard in the term on every field of the group", () => {
    // A search reaches the same pattern rendering as a CONTAINS filter, so the
    // escape has to hold here too: "100%" must not match "1009".
    expect(
      buildSearchGroup({ fields: ["title", "body"], term: "100%", caseInsensitive: true }),
    ).toEqual({
      OR: [
        { title: { contains: "100\\%", mode: "insensitive" } },
        { body: { contains: "100\\%", mode: "insensitive" } },
      ],
    });
  });

  it("keeps the search group as one AND element beside fixed predicates and filters", () => {
    // BR-30: (a OR b) AND filter1 AND filter2. Flattening the OR into the AND
    // would let a search term widen the caller's fixed predicate.
    const where = buildWhere({
      base: [{ authorId: 7 }, { deleted: false }],
      search: { fields: ["title", "body"], term: "vpn", caseInsensitive: true },
      filters: [
        { field: "authorId", condition: "IN", value: [1, 2] },
        { field: "publishedAt", condition: "GREATER", value: new Date("2026-01-01T00:00:00.000Z") },
      ],
    });

    expect(where).toEqual({
      AND: [
        { authorId: 7 },
        { deleted: false },
        {
          OR: [
            { title: { contains: "vpn", mode: "insensitive" } },
            { body: { contains: "vpn", mode: "insensitive" } },
          ],
        },
        { authorId: { in: [1, 2] } },
        { publishedAt: { gt: new Date("2026-01-01T00:00:00.000Z") } },
      ],
    });
  });

  it("contributes nothing for an absent search or an empty filter list", () => {
    expect(buildWhere({ base: [{ authorId: 7 }], filters: [] })).toEqual({
      AND: [{ authorId: 7 }],
    });
    expect(buildWhere({})).toEqual({ AND: [] });
  });
});

describe("QueryBuilder generic order construction (UNIT-09)", () => {
  it("maps each sort to one asc/desc entry in order", () => {
    expect(
      buildOrderBy([
        { field: "publishedAt", direction: "desc" },
        { field: "id", direction: "desc" },
      ]),
    ).toEqual([{ publishedAt: "desc" }, { id: "desc" }]);

    expect(buildOrderBy([{ field: "title", direction: "asc" }])).toEqual([{ title: "asc" }]);
  });

  it("applies no semantic translation of its own", () => {
    // The Ticket half of UNIT-09 -- Priority sorting semantically HIGH to LOW --
    // lives in TicketQueryValidator.test.ts, because deciding that
    // `requestedPriority:desc` means HIGH first is resource knowledge. All the
    // builder may do is emit the direction it was handed.
    expect(buildOrderBy([{ field: "rank", direction: "desc" }])).toEqual([{ rank: "desc" }]);
  });
});
