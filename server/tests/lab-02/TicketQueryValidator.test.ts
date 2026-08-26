import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { ApiError } from "../../src/http/errors.js";
import { QueryCondition } from "../../src/services/queryBuilder.js";
import { REQUESTED_PRIORITIES } from "../../src/services/ticketCreateRequest.js";
import {
  MAX_FILTER_EXPRESSIONS,
  MAX_FILTER_VALUE_LENGTH,
  MAX_FREE_TEXT_IN_VALUES,
  MAX_IN_VALUES,
  MAX_REFERENCE_ID,
  MAX_SEARCH_LENGTH,
  TICKET_SORT_FIELDS,
  parseTicketListQuery,
} from "../../src/services/ticketQueryValidator.js";

/*
 * UNIT-06 (BR-26-39, BR-75, AC-24-30, AC-55). Only Ticket-approved bounded
 * input may leave this module, so every rejection below is proof that
 * QueryBuilder and Prisma never see the request at all.
 */

function filters(...expressions: unknown[]): Record<string, unknown> {
  return { filters: JSON.stringify(expressions) };
}

function expectRejected(query: Record<string, unknown>, field?: string): ApiError {
  let thrown: unknown;

  try {
    parseTicketListQuery(query);
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(ApiError);
  const error = thrown as ApiError;
  expect(error.code).toBe("VALIDATION_ERROR");
  expect(error.statusCode).toBe(400);

  if (field !== undefined) {
    expect(error.details?.map((detail) => detail.field)).toContain(field);
  }

  return error;
}

describe("Ticket list query defaults", () => {
  it("applies the documented defaults to an empty query", () => {
    expect(parseTicketListQuery({})).toEqual({
      search: undefined,
      filters: [],
      order: [
        { field: "createdAt", direction: "desc" },
        { field: "id", direction: "desc" },
      ],
      pageNumber: 1,
      pageSize: 10,
    });
  });

  it("rejects a query string that is not an object", () => {
    expectRejected(null as unknown as Record<string, unknown>, "query");
  });

  it("rejects a parameter supplied more than once", () => {
    // Express parses `?sort=a&sort=b` into an array.
    expectRejected({ sort: ["createdAt:desc", "summary:asc"] }, "sort");
  });
});

describe("Ticket list search validation", () => {
  it("trims the term and marks Ticket search fields case-insensitive", () => {
    const query = parseTicketListQuery({
      search: "  vpn  ",
      searchFields: "ticketNumber,summary,description",
    });

    expect(query.search).toEqual({
      fields: ["ticketNumber", "summary", "description"],
      term: "vpn",
      caseInsensitive: true,
    });
  });

  it("treats a blank search as absent and ignores searchFields entirely", () => {
    // BR-27: unvalidated, not merely unused -- an unknown field is not an error
    // when there is no active search to apply it to.
    expect(parseTicketListQuery({ search: "   ", searchFields: "nonsense" }).search).toBeUndefined();
    expect(parseTicketListQuery({ searchFields: "nonsense" }).search).toBeUndefined();
  });

  it("requires searchFields when a non-blank search is supplied", () => {
    expectRejected({ search: "vpn" }, "searchFields");
    expectRejected({ search: "vpn", searchFields: "" }, "searchFields");
  });

  it("reports a repeated searchFields once rather than twice", () => {
    /*
     * `?searchFields=a&searchFields=b` arrives as an array, which is a single
     * problem. Reporting "supplied at most once" and "is required" together
     * would make one mistake look like two, and the second is not even true.
     */
    const error = expectRejected({ search: "vpn", searchFields: ["summary", "description"] });
    const reported = (error.details ?? []).filter((detail) => detail.field === "searchFields");

    expect(reported).toHaveLength(1);
    expect(reported[0].message).toBe("searchFields must be supplied at most once.");
  });

  it("rejects unknown and repeated search fields", () => {
    expectRejected({ search: "vpn", searchFields: "summary,requesterEmail" }, "searchFields");
    expectRejected({ search: "vpn", searchFields: "summary,summary" }, "searchFields");
  });

  it("accepts a 200-character term and rejects a longer one", () => {
    const fields = "ticketNumber,summary,description";

    expect(
      parseTicketListQuery({ search: "a".repeat(MAX_SEARCH_LENGTH), searchFields: fields }).search
        ?.term,
    ).toHaveLength(MAX_SEARCH_LENGTH);

    expectRejected({ search: "a".repeat(MAX_SEARCH_LENGTH + 1), searchFields: fields }, "search");
  });

  it("measures the term in characters, not UTF-16 code units", () => {
    // 200 astral characters are 400 code units; a `.length` bound would reject
    // a term the contract accepts.
    const astral = "\u{1F600}".repeat(MAX_SEARCH_LENGTH);

    expect(
      parseTicketListQuery({ search: astral, searchFields: "summary" }).search?.term,
    ).toBe(astral);

    expectRejected({ search: "\u{1F600}".repeat(MAX_SEARCH_LENGTH + 1), searchFields: "summary" }, "search");
  });
});

describe("Ticket filter serialization and shape", () => {
  it("rejects malformed JSON and a non-array root", () => {
    expectRejected({ filters: "not-json" }, "filters");
    expectRejected({ filters: "" }, "filters");
    expectRejected({ filters: JSON.stringify({}) }, "filters");
    expectRejected({ filters: JSON.stringify("summary") }, "filters");
    expectRejected({ filters: JSON.stringify(3) }, "filters");
  });

  it("treats an empty array as no filters", () => {
    expect(parseTicketListQuery({ filters: "[]" }).filters).toEqual([]);
  });

  it("accepts 20 expressions and rejects 21", () => {
    const expression = { field: "summary", condition: "CONTAINS", value: "a" };

    expect(
      parseTicketListQuery(filters(...Array(MAX_FILTER_EXPRESSIONS).fill(expression))).filters,
    ).toHaveLength(MAX_FILTER_EXPRESSIONS);

    expectRejected(filters(...Array(MAX_FILTER_EXPRESSIONS + 1).fill(expression)), "filters");
  });

  it("requires field, condition, and value on every expression", () => {
    expectRejected(filters({ field: "summary", condition: "CONTAINS" }), "filters[0]");
    expectRejected(filters({ field: "summary", value: "a" }), "filters[0]");
    expectRejected(filters({ condition: "CONTAINS", value: "a" }), "filters[0]");
    expectRejected(filters("summary"), "filters[0]");
  });

  it("rejects a field outside the Ticket whitelist", () => {
    expectRejected(filters({ field: "requesterId", condition: "EQUAL", value: 3 }), "filters[0].field");
    expectRejected(filters({ field: "deleted", condition: "EQUAL", value: false }), "filters[0].field");
  });

  it.each([["toString"], ["constructor"], ["hasOwnProperty"], ["valueOf"]])(
    "rejects the inherited property name %s as a field",
    (field) => {
      /*
       * A whitelist tested with `in` instead of `Object.hasOwn` accepts every
       * `Object.prototype` member, and the condition lookup that follows then
       * indexes its table with a Function: a TypeError and a 500 where the
       * contract owes a 400.
       */
      expectRejected(filters({ field, condition: "EQUAL", value: "x" }), "filters[0].field");
    },
  );
});

describe("Ticket condition compatibility matrix", () => {
  const allowed: Array<[string, QueryCondition, unknown]> = [
    ["summary", "CONTAINS", "vpn"],
    ["summary", "STARTWITH", "vpn"],
    ["summary", "ENDWITH", "vpn"],
    ["ticketNumber", "EQUAL", "TKT-20260820-A81F3C9D7B21"],
    ["description", "NOTEQUAL", "none"],
    ["categoryId", "EQUAL", 2],
    ["relatedSystemId", "NOTEQUAL", 5],
    ["requestedPriority", "EQUAL", "HIGH"],
    ["currentStatus", "EQUAL", "NEW"],
    ["createdAt", "GREATER", "2026-08-20T00:00:00.000Z"],
    ["updatedAt", "LESSEROREQUAL", "2026-08-20T00:00:00.000Z"],
  ];

  it.each(allowed)("accepts %s + %s", (field, condition, value) => {
    const query = parseTicketListQuery(filters({ field, condition, value }));

    expect(query.filters).toHaveLength(1);
    expect(query.filters[0].field).toBe(field);
    expect(query.filters[0].condition).toBe(condition);
  });

  const forbidden: Array<[string, QueryCondition]> = [
    ["summary", "GREATER"],
    ["summary", "LESSEROREQUAL"],
    ["categoryId", "CONTAINS"],
    ["categoryId", "STARTWITH"],
    ["requestedPriority", "CONTAINS"],
    ["currentStatus", "ENDWITH"],
    ["createdAt", "IN"],
    ["createdAt", "CONTAINS"],
    ["updatedAt", "IN"],
  ];

  it.each(forbidden)("rejects %s + %s", (field, condition) => {
    expectRejected(filters({ field, condition, value: "x" }), "filters[0].condition");
  });

  const everyField = [
    "ticketNumber",
    "summary",
    "description",
    "categoryId",
    "relatedSystemId",
    "requestedPriority",
    "currentStatus",
    "createdAt",
    "updatedAt",
  ];

  it.each(everyField)("rejects ISNULL and ISNOTNULL on %s", (field) => {
    // The generic builder supports both; no current Ticket field is nullable,
    // so both are rejected before QueryBuilder or Prisma sees the request.
    expectRejected(filters({ field, condition: "ISNULL", value: "" }), "filters[0].condition");
    expectRejected(filters({ field, condition: "ISNOTNULL", value: "" }), "filters[0].condition");
  });

  it("rejects a condition outside the generic vocabulary", () => {
    expectRejected(filters({ field: "summary", condition: "LIKE", value: "a" }), "filters[0].condition");
  });
});

describe("Ticket filter value conversion", () => {
  it("converts a reference value from a number or a numeric string", () => {
    // api-spec Section 9.9 maps `"2"` to the number 2.
    expect(parseTicketListQuery(filters({ field: "categoryId", condition: "EQUAL", value: 2 })).filters[0].value).toBe(2);
    expect(parseTicketListQuery(filters({ field: "categoryId", condition: "EQUAL", value: "2" })).filters[0].value).toBe(2);
  });

  it.each([["abc"], [0], [-1], [1.5], [true], [null]])(
    "rejects %s as a reference value",
    (value) => {
      expectRejected(filters({ field: "categoryId", condition: "EQUAL", value }), "filters[0].value");
    },
  );

  it("bounds a reference value at what an INTEGER column can hold", () => {
    /*
     * A safe integer is not a storable one. `3000000000` passed the old check
     * and reached Prisma, which answered `P2020 ValueOutOfRange` -- reported as
     * a 500 for what is a malformed query parameter. The bound is the column's,
     * so nothing that could identify a row is lost.
     */
    expect(
      parseTicketListQuery(
        filters({ field: "categoryId", condition: "EQUAL", value: MAX_REFERENCE_ID }),
      ).filters[0].value,
    ).toBe(MAX_REFERENCE_ID);

    expectRejected(
      filters({ field: "categoryId", condition: "EQUAL", value: MAX_REFERENCE_ID + 1 }),
      "filters[0].value",
    );
    expectRejected(
      filters({ field: "relatedSystemId", condition: "EQUAL", value: Number.MAX_SAFE_INTEGER }),
      "filters[0].value",
    );
    /* Every element of an `IN` array goes through the same conversion. */
    expectRejected(
      filters({ field: "categoryId", condition: "IN", value: [1, MAX_REFERENCE_ID + 1] }),
      "filters[0].value",
    );
  });

  it("rejects a year PostgreSQL cannot represent", () => {
    /*
     * PostgreSQL has no year zero; JavaScript does, so `new Date` accepted
     * "0000-01-01" and the database answered `22008` -- another 500 for a
     * malformed parameter. The offset case matters too: the local year is in
     * range and the normalised one is not.
     */
    expectRejected(
      filters({ field: "createdAt", condition: "GREATER", value: "0000-01-01" }),
      "filters[0].value",
    );
    expectRejected(
      filters({ field: "createdAt", condition: "GREATER", value: "0001-01-01T00:00:00+14:00" }),
      "filters[0].value",
    );

    expect(
      parseTicketListQuery(
        filters({ field: "createdAt", condition: "GREATER", value: "0001-01-01" }),
      ).filters[0].value,
    ).toEqual(new Date("0001-01-01"));
  });

  /*
   * `ticket_number` is CHECK-constrained to `^TKT-[0-9]{8}-[0-9A-F]{12}$`, so no
   * stored value can hold a lowercase letter. Folding the input and comparing
   * case-sensitively is therefore the same match BR-33 asks for, and it is the
   * difference between an indexable `IN (...)` and 100 unindexable `ILIKE`s:
   * 0.238ms against 1,430ms on 30,000 rows.
   */
  it("folds a ticketNumber value and drops the insensitive flag", () => {
    const query = parseTicketListQuery(
      filters({ field: "ticketNumber", condition: "IN", value: ["tkt-20260820-a81f3c9d7b21"] }),
    );

    expect(query.filters[0].value).toEqual(["TKT-20260820-A81F3C9D7B21"]);
    /* The flag is what would turn `IN (...)` back into an OR of `ILIKE`. */
    expect(query.filters[0].caseInsensitive).toBe(false);
  });

  it.each([["EQUAL"], ["NOTEQUAL"], ["CONTAINS"], ["STARTWITH"], ["ENDWITH"]])(
    "folds a ticketNumber %s value too, so the whole field stays indexable",
    (condition) => {
      const query = parseTicketListQuery(
        filters({ field: "ticketNumber", condition, value: "tkt-2026" }),
      );

      expect(query.filters[0].value).toBe("TKT-2026");
      expect(query.filters[0].caseInsensitive).toBe(false);
    },
  );

  it("reads two spellings of one ticketNumber as the repeat they are", () => {
    /* Uniqueness is judged after folding, so these are one value, not two. */
    expectRejected(
      filters({ field: "ticketNumber", condition: "IN", value: ["TKT-A", "tkt-a"] }),
      "filters[0].value",
    );
  });

  it("leaves free text case-insensitive rather than folding it", () => {
    /* `summary` has no constrained domain, so folding would change the match. */
    const query = parseTicketListQuery(
      filters({ field: "summary", condition: "IN", value: ["Mixed Case"] }),
    );

    expect(query.filters[0].value).toEqual(["Mixed Case"]);
    expect(query.filters[0].caseInsensitive).toBe(true);
  });

  /*
   * A free-text `IN` is the one filter shape whose cost scales with the value
   * count rather than the result, because each value becomes its own `ILIKE`.
   * Measured on 30,000 rows: 10 values stayed on the trigram index at 6.5ms,
   * 25 tipped to a sequential scan at 454ms, and 100 cost 1,210ms.
   */
  it("bounds a free-text IN lower than a field that stays indexable", () => {
    const free = (count: number) =>
      filters({
        field: "summary",
        condition: "IN",
        value: Array.from({ length: count }, (_unused, index) => `summary ${index}`),
      });

    expect(
      parseTicketListQuery(free(MAX_FREE_TEXT_IN_VALUES)).filters[0].value,
    ).toHaveLength(MAX_FREE_TEXT_IN_VALUES);
    expectRejected(free(MAX_FREE_TEXT_IN_VALUES + 1), "filters[0].value");

    /* `ticketNumber` keeps the full contract range: it renders as one `IN`. */
    const numbers = Array.from(
      { length: MAX_IN_VALUES },
      (_unused, index) => `TKT-20260820-${index.toString(16).padStart(12, "0").toUpperCase()}`,
    );

    expect(
      parseTicketListQuery(filters({ field: "ticketNumber", condition: "IN", value: numbers }))
        .filters[0].value,
    ).toHaveLength(MAX_IN_VALUES);

    /* So do the reference and enum fields, which were never the expensive case. */
    expect(
      parseTicketListQuery(
        filters({
          field: "categoryId",
          condition: "IN",
          value: Array.from({ length: MAX_IN_VALUES }, (_unused, index) => index + 1),
        }),
      ).filters[0].value,
    ).toHaveLength(MAX_IN_VALUES);
  });

  it("bounds a string filter value the way search is bounded", () => {
    /*
     * `search` has always been capped at 200; a string filter value had no
     * bound at all, so only Node's request-line limit stood between a
     * hand-built URL and a multi-kilobyte `contains` term -- long enough to
     * defeat the trigram indexes. Nothing longer than the longest filterable
     * column can match a row, so no legitimate query is lost.
     */
    const longest = "a".repeat(MAX_FILTER_VALUE_LENGTH);

    expect(
      parseTicketListQuery(filters({ field: "description", condition: "CONTAINS", value: longest }))
        .filters[0].value,
    ).toBe(longest);

    expectRejected(
      filters({ field: "description", condition: "CONTAINS", value: `${longest}a` }),
      "filters[0].value",
    );
    /* Every element of an `IN` array goes through the same conversion. */
    expectRejected(
      filters({ field: "summary", condition: "IN", value: ["ok", `${longest}a`] }),
      "filters[0].value",
    );
  });

  it("measures a string filter value in characters, not UTF-16 code units", () => {
    const astral = "\u{1F600}".repeat(MAX_FILTER_VALUE_LENGTH);

    expect(
      parseTicketListQuery(filters({ field: "summary", condition: "CONTAINS", value: astral }))
        .filters[0].value,
    ).toBe(astral);

    expectRejected(
      filters({ field: "summary", condition: "CONTAINS", value: `${astral}\u{1F600}` }),
      "filters[0].value",
    );
  });

  it("converts a date value to a Date", () => {
    const query = parseTicketListQuery(
      filters({ field: "createdAt", condition: "GREATER", value: "2026-08-20T00:00:00.000Z" }),
    );

    expect(query.filters[0].value).toEqual(new Date("2026-08-20T00:00:00.000Z"));
  });

  it.each([["not-a-date"], [20260820], [null]])("rejects %s as a date value", (value) => {
    expectRejected(filters({ field: "createdAt", condition: "GREATER", value }), "filters[0].value");
  });

  /*
   * `new Date` alone reads "5" as 2001-05-01 and "Dec 5 2026" as a date, so
   * without a shape check the filter would silently mean a moment the caller
   * never asked for. "2026-13-45" is the reverse case: right shape, impossible
   * date, still rejected by the parse.
   */
  it.each([["5"], ["2026"], ["Dec 5 2026"], ["08/20/2026"], ["2026-13-45"]])(
    "rejects %s as a non-ISO-8601 date value",
    (value) => {
      expectRejected(filters({ field: "createdAt", condition: "GREATER", value }), "filters[0].value");
    },
  );

  it.each([["2026-08-20"], ["2026-08-20T09:30:00Z"], ["2026-08-20T09:30:00+07:00"]])(
    "accepts %s as an ISO-8601 date value",
    (value) => {
      const query = parseTicketListQuery(filters({ field: "createdAt", condition: "GREATER", value }));

      expect(query.filters[0].value).toEqual(new Date(value));
    },
  );

  /*
   * A day that does not exist in its month is the one malformed date neither
   * the shape check nor `new Date` catches: `MakeDay` rolls it forward, so
   * "2026-02-30" parsed to 2026-03-02 and the filter silently meant a moment
   * two days from the one asked for -- a 200 with confidently wrong rows.
   * "2026-13-45" only ever failed because month 13 falls outside the ISO
   * grammar and drops to the fallback parser; a day out of range for its month
   * stays inside the grammar.
   */
  it.each([
    ["2026-02-30", "February 30th"],
    ["2026-02-29", "February 29th of a common year"],
    ["1900-02-29", "February 29th of a century that is not a leap year"],
    ["2026-04-31", "April 31st"],
    ["2026-01-32", "a day past the end of any month"],
    ["2026-01-00", "day zero"],
    ["2026-00-10", "month zero"],
    ["2026-06-31T23:59:59+07:00", "an impossible day carrying a time and an offset"],
  ])("rejects %s (%s) rather than rolling it forward", (value) => {
    expectRejected(filters({ field: "createdAt", condition: "GREATER", value }), "filters[0].value");
  });

  it.each([["2024-02-29"], ["2000-02-29"], ["2026-01-31"], ["2026-12-31T23:59:59.999Z"]])(
    "accepts %s, so the calendar check keeps both leap-year rules",
    (value) => {
      const query = parseTicketListQuery(filters({ field: "createdAt", condition: "GREATER", value }));

      expect(query.filters[0].value).toEqual(new Date(value));
    },
  );

  it.each([["URGENT"], ["high"], [1], [null]])("rejects %s as a Priority value", (value) => {
    expectRejected(filters({ field: "requestedPriority", condition: "EQUAL", value }), "filters[0].value");
  });

  it("rejects a non-text value on a String field", () => {
    expectRejected(filters({ field: "summary", condition: "CONTAINS", value: 7 }), "filters[0].value");
  });

  it("marks only String fields case-insensitive", () => {
    expect(
      parseTicketListQuery(filters({ field: "summary", condition: "CONTAINS", value: "a" })).filters[0]
        .caseInsensitive,
    ).toBe(true);

    expect(
      parseTicketListQuery(filters({ field: "categoryId", condition: "EQUAL", value: 1 })).filters[0]
        .caseInsensitive,
    ).toBe(false);

    expect(
      parseTicketListQuery(filters({ field: "requestedPriority", condition: "EQUAL", value: "HIGH" }))
        .filters[0].caseInsensitive,
    ).toBe(false);
  });
});

describe("Ticket IN values", () => {
  it("accepts a typed non-empty array", () => {
    const query = parseTicketListQuery(filters({ field: "categoryId", condition: "IN", value: [1, "2"] }));

    expect(query.filters[0].value).toEqual([1, 2]);
  });

  it("accepts 100 values and rejects 101", () => {
    const hundred = Array.from({ length: MAX_IN_VALUES }, (_unused, index) => index + 1);

    expect(
      parseTicketListQuery(filters({ field: "categoryId", condition: "IN", value: hundred })).filters[0]
        .value,
    ).toHaveLength(MAX_IN_VALUES);

    expectRejected(
      filters({ field: "categoryId", condition: "IN", value: [...hundred, MAX_IN_VALUES + 1] }),
      "filters[0].value",
    );
  });

  it.each([[[]], ["1,2,4"], [2], [null]])("rejects %s as an IN value", (value) => {
    expectRejected(filters({ field: "categoryId", condition: "IN", value }), "filters[0].value");
  });

  it("rejects repeated values, including across spellings", () => {
    expectRejected(filters({ field: "categoryId", condition: "IN", value: [1, 1] }), "filters[0].value");
    expectRejected(filters({ field: "categoryId", condition: "IN", value: [1, "1"] }), "filters[0].value");
    expectRejected(
      filters({ field: "requestedPriority", condition: "IN", value: ["HIGH", "HIGH"] }),
      "filters[0].value",
    );
  });

  it("rejects an array containing an unconvertible element", () => {
    expectRejected(filters({ field: "categoryId", condition: "IN", value: [1, "abc"] }), "filters[0].value");
    expectRejected(
      filters({ field: "requestedPriority", condition: "IN", value: ["HIGH", "URGENT"] }),
      "filters[0].value",
    );
  });
});

describe("Ticket sorting", () => {
  it("appends the internal id tiebreaker to every order", () => {
    expect(parseTicketListQuery({ sort: "summary:asc" }).order).toEqual([
      { field: "summary", direction: "asc" },
      { field: "id", direction: "desc" },
    ]);
  });

  it.each(TICKET_SORT_FIELDS)("accepts %s in both directions", (field) => {
    expect(parseTicketListQuery({ sort: `${field}:asc` }).order[0]).toEqual({ field, direction: "asc" });
    expect(parseTicketListQuery({ sort: `${field}:desc` }).order[0]).toEqual({ field, direction: "desc" });
  });

  it("sorts Priority semantically", () => {
    /*
     * BR-35. The mapping is the identity, so `desc` emits HIGH, MEDIUM, LOW
     * with no CASE expression -- but only because PostgreSQL orders an enum
     * column by declaration order and the migration happens to declare it
     * ascending. Asserting the passthrough alone would prove nothing: it holds
     * whatever the migration says, including a reordered one that silently
     * reverses the sort. The premise itself is what has to be pinned, so it is
     * read out of the migration below.
     */
    expect(parseTicketListQuery({ sort: "requestedPriority:desc" }).order[0]).toEqual({
      field: "requestedPriority",
      direction: "desc",
    });
    expect(parseTicketListQuery({ sort: "requestedPriority:asc" }).order[0]).toEqual({
      field: "requestedPriority",
      direction: "asc",
    });
  });

  it("keeps the migration's enum declared in ascending Priority order", () => {
    /*
     * The premise the identity mapping rests on, asserted against the SQL
     * PostgreSQL actually executes rather than against `schema.prisma` or the
     * generated client -- the migration is hand-written here, so the DDL is the
     * only authority on the sort order the database will use. Reordering that
     * `CREATE TYPE` now fails here instead of quietly inverting every
     * `sort=requestedPriority:*` response.
     */
    const migrations = join(fileURLToPath(new URL("../../prisma/migrations", import.meta.url)));
    const declarations = readdirSync(migrations, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => readFileSync(join(migrations, entry.name, "migration.sql"), "utf8"))
      .flatMap((sql) => [...sql.matchAll(/CREATE TYPE "RequestedPriority" AS ENUM \(([^)]*)\)/g)]);

    /* One declaration, or the last one to run is not the one asserted. */
    expect(declarations).toHaveLength(1);

    const declared = declarations[0][1].split(",").map((value) => value.trim().replace(/^'|'$/g, ""));

    expect(declared).toEqual([...REQUESTED_PRIORITIES]);
    expect(declared).toEqual(["LOW", "MEDIUM", "HIGH"]);
  });

  it.each([
    ["", "explicitly blank"],
    ["createdAt", "missing a direction"],
    ["createdAt:sideways", "an unsupported direction"],
    ["id:desc", "the internal tiebreaker"],
    ["requesterId:asc", "a non-sortable field"],
    ["createdAt:asc,summary:desc", "more than one sort"],
  ])("rejects %s sort (%s)", (sort) => {
    expectRejected({ sort }, "sort");
  });
});

describe("Ticket pagination bounds", () => {
  it("accepts the documented range", () => {
    expect(parseTicketListQuery({ pageNumber: "3", pageSize: "1" })).toMatchObject({ pageNumber: 3, pageSize: 1 });
    expect(parseTicketListQuery({ pageSize: "100" }).pageSize).toBe(100);
  });

  it.each([["0"], ["-1"], ["1.5"], ["abc"], [""]])("rejects pageNumber %s", (pageNumber) => {
    expectRejected({ pageNumber }, "pageNumber");
  });

  it("puts no ceiling on pageNumber", () => {
    /*
     * api-spec Section 9.12 states the rule as `pageNumber >= 1` and makes an
     * out-of-range page a 200 with an empty array, so a ceiling here would
     * answer a valid request with a 400. The `skip` a large page produces is
     * `ticketListService.ts`'s to handle.
     */
    expect(parseTicketListQuery({ pageNumber: "1000001" }).pageNumber).toBe(1_000_001);
    expect(parseTicketListQuery({ pageNumber: String(Number.MAX_SAFE_INTEGER) }).pageNumber).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it("still rejects a pageNumber outside the safe-integer range", () => {
    expectRejected({ pageNumber: String(Number.MAX_SAFE_INTEGER + 2) }, "pageNumber");
  });

  it.each([["0"], ["101"], ["1.5"], ["abc"], [""]])("rejects pageSize %s", (pageSize) => {
    expectRejected({ pageSize }, "pageSize");
  });
});

describe("Ticket query error reporting", () => {
  it("collects every invalid parameter into one error", () => {
    const error = expectRejected({
      search: "vpn",
      pageNumber: "0",
      pageSize: "500",
      sort: "nonsense",
    });

    expect(error.details?.map((detail) => detail.field).sort()).toEqual([
      "pageNumber",
      "pageSize",
      "searchFields",
      "sort",
    ]);
  });

  it("never echoes the submitted value back to the client", () => {
    const error = expectRejected({ search: "secret-term", searchFields: "requesterEmail" });

    for (const detail of error.details ?? []) {
      expect(detail.message).not.toContain("secret-term");
      expect(detail.message).not.toContain("requesterEmail");
    }
  });
});
