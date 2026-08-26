import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const prismaMock = vi.hoisted(() => ({
  developmentRequester: { findFirst: vi.fn() },
  ticket: { findMany: vi.fn(), count: vi.fn() },
}));

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => prismaMock }));

import { app } from "../../src/app.js";

/*
 * API-21 to API-34, API-38, and API-68 (AC-21, AC-24-30, AC-55).
 *
 * A local double rather than `support/ticketPrismaMock.ts`: that module is the
 * Ticket-creation fixture and its `ticket` client has no `findMany`/`count`.
 *
 * Every rejection case also asserts `ticket.findMany` was never called. That
 * assertion is the contract: the Ticket validator must reject before
 * QueryBuilder or Prisma receives the request, so a 400 alone would not prove
 * the requirement.
 */

const ALICE = {
  id: 3,
  name: "Alice Johnson",
  email: "alice.johnson@example.com",
  isActive: true,
  deleted: false,
  createdBy: "seed",
  createdAt: new Date("2026-08-20T01:00:00.000Z"),
  updatedBy: "seed",
  updatedAt: new Date("2026-08-20T01:00:00.000Z"),
};

const BOB = { ...ALICE, id: 4, name: "Bob Smith", email: "bob.smith@example.com" };

function ticketRow(overrides: Record<string, unknown> = {}) {
  return {
    publicId: "0f0e8a9f-6d9e-4a1a-9f0e-1b2c3d4e5f60",
    ticketNumber: "TKT-20260820-A81F3C9D7B21",
    categoryId: 1,
    relatedSystemId: 2,
    summary: "VPN disconnects every ten minutes",
    requestedPriority: "HIGH",
    currentStatus: "NEW",
    createdAt: new Date("2026-08-20T02:00:00.000Z"),
    category: { name: "Network" },
    relatedSystem: { name: "VPN" },
    ...overrides,
  };
}

function list(query = "", requesterId = ALICE.id) {
  const path = query === "" ? "/api/tickets" : `/api/tickets?${query}`;
  return request(app).get(path).set("X-Requester-Id", String(requesterId));
}

/* The arguments the route handed Prisma, for scope and composition assertions. */
function findManyArgs() {
  expect(prismaMock.ticket.findMany).toHaveBeenCalledTimes(1);
  return prismaMock.ticket.findMany.mock.calls[0][0];
}

async function expectRejected(query: string, field: string) {
  const response = await list(query);

  expect(response.status).toBe(400);
  expect(response.body.code).toBe("VALIDATION_ERROR");
  expect(response.body.details.map((detail: { field: string }) => detail.field)).toContain(field);
  /* Rejected before QueryBuilder/Prisma (AC-26, AC-55). */
  expect(prismaMock.ticket.findMany).not.toHaveBeenCalled();
  expect(prismaMock.ticket.count).not.toHaveBeenCalled();

  return response;
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.developmentRequester.findFirst.mockImplementation(
    ({ where }: { where: { id: number } }) =>
      Promise.resolve(where.id === ALICE.id ? ALICE : where.id === BOB.id ? BOB : null),
  );
  prismaMock.ticket.findMany.mockResolvedValue([ticketRow()]);
  prismaMock.ticket.count.mockResolvedValue(1);
});

describe("Ticket list ownership and projection (API-21)", () => {
  it("scopes every read to the current Requester's non-deleted Tickets", async () => {
    await list().expect(200);

    const { where } = findManyArgs();

    expect(where.AND).toEqual([{ requesterId: ALICE.id }, { deleted: false }]);
    /* The same predicate governs the count, so totals cannot leak either. */
    expect(prismaMock.ticket.count.mock.calls[0][0].where).toEqual(where);
  });

  it("never lets one Requester read another Requester's scope", async () => {
    await list("", BOB.id).expect(200);

    expect(findManyArgs().where.AND).toContainEqual({ requesterId: BOB.id });
    expect(findManyArgs().where.AND).not.toContainEqual({ requesterId: ALICE.id });
  });

  it("returns exactly the TicketListItemDTO fields", async () => {
    const response = await list().expect(200);

    expect(Object.keys(response.body[0]).sort()).toEqual([
      "categoryId",
      "categoryName",
      "createdAt",
      "currentStatus",
      "publicId",
      "relatedSystemId",
      "relatedSystemName",
      "requestedPriority",
      "summary",
      "ticketNumber",
    ]);
  });

  it("never reads the excluded columns from the database", async () => {
    await list().expect(200);

    const { select } = findManyArgs();

    for (const excluded of ["description", "requester", "attachments", "createdBy", "updatedBy", "updatedAt", "deleted"]) {
      expect(select).not.toHaveProperty(excluded);
    }
  });

  it("requires a Requester context on the collection route", async () => {
    const response = await request(app).get("/api/tickets").expect(400);

    expect(response.body.code).toBe("REQUESTER_CONTEXT_INVALID");
    expect(prismaMock.ticket.findMany).not.toHaveBeenCalled();
  });
});

describe("Ticket list historical reference data (API-38)", () => {
  it("still resolves Category and Related System names after the master goes inactive", async () => {
    prismaMock.ticket.findMany.mockResolvedValue([
      ticketRow({ category: { name: "Legacy Network" }, relatedSystem: { name: "Retired VPN" } }),
    ]);

    const response = await list().expect(200);

    expect(response.body[0].categoryName).toBe("Legacy Network");
    expect(response.body[0].relatedSystemName).toBe("Retired VPN");
    /* No activeness predicate on the relations, or a retired master would vanish. */
    expect(findManyArgs().select.category).toEqual({ select: { name: true } });
    expect(findManyArgs().select.relatedSystem).toEqual({ select: { name: true } });
  });
});

describe("Ticket list search (API-22, API-23)", () => {
  it("trims the term and ORs it across the supplied fields case-insensitively", async () => {
    await list("search=%20%20VPN%20%20&searchFields=ticketNumber,summary,description").expect(200);

    expect(findManyArgs().where.AND).toContainEqual({
      OR: [
        { ticketNumber: { contains: "VPN", mode: "insensitive" } },
        { summary: { contains: "VPN", mode: "insensitive" } },
        { description: { contains: "VPN", mode: "insensitive" } },
      ],
    });
  });

  it("matches on Description alone and still omits Description from the row", async () => {
    await list("search=leaks&searchFields=description").expect(200);

    expect(findManyArgs().where.AND).toContainEqual({
      OR: [{ description: { contains: "leaks", mode: "insensitive" } }],
    });

    const response = await list("search=leaks&searchFields=description").expect(200);
    expect(response.body[0]).not.toHaveProperty("description");
  });

  it("treats a blank search as absent and ignores searchFields", async () => {
    await list("search=%20%20&searchFields=summary").expect(200);

    expect(findManyArgs().where.AND).toEqual([{ requesterId: ALICE.id }, { deleted: false }]);
  });

  it("ignores searchFields supplied without an active search", async () => {
    await list("searchFields=summary").expect(200);

    expect(findManyArgs().where.AND).toEqual([{ requesterId: ALICE.id }, { deleted: false }]);
  });

  it("rejects a non-blank search without searchFields", async () => {
    await expectRejected("search=vpn", "searchFields");
  });

  it("rejects a search field outside the whitelist", async () => {
    await expectRejected("search=vpn&searchFields=requesterEmail", "searchFields");
  });
});

describe("Ticket list filters (API-24 to API-28)", () => {
  function filterQuery(...expressions: unknown[]) {
    return `filters=${encodeURIComponent(JSON.stringify(expressions))}`;
  }

  it("parses, converts, and forwards typed filter expressions", async () => {
    await list(
      filterQuery(
        { field: "categoryId", condition: "IN", value: [1, "2"] },
        { field: "requestedPriority", condition: "EQUAL", value: "HIGH" },
        { field: "createdAt", condition: "GREATER", value: "2026-08-20T00:00:00.000Z" },
      ),
    ).expect(200);

    const { where } = findManyArgs();

    expect(where.AND).toContainEqual({ categoryId: { in: [1, 2] } });
    expect(where.AND).toContainEqual({ requestedPriority: { equals: "HIGH" } });
    expect(where.AND).toContainEqual({
      createdAt: { gt: new Date("2026-08-20T00:00:00.000Z") },
    });
  });

  it("rejects malformed JSON and a non-array root", async () => {
    await expectRejected("filters=not-json", "filters");
    await expectRejected(`filters=${encodeURIComponent("{}")}`, "filters");
  });

  it("rejects an unsupported filter field", async () => {
    await expectRejected(filterQuery({ field: "requesterId", condition: "EQUAL", value: 3 }), "filters[0].field");
  });

  it("answers an inherited property name with 400 rather than 500", async () => {
    /*
     * The whitelist has to be an own-property test. A membership test that
     * walks the prototype chain admits `toString`, and the condition lookup
     * that follows then throws instead of rejecting: the client would see a
     * 500 for a value the contract says is an invalid field.
     */
    for (const field of ["toString", "constructor", "hasOwnProperty"]) {
      vi.clearAllMocks();
      prismaMock.developmentRequester.findFirst.mockResolvedValue(ALICE);
      await expectRejected(filterQuery({ field, condition: "EQUAL", value: "x" }), "filters[0].field");
    }
  });

  it("rejects a Ticket-forbidden condition, including the generic null operators", async () => {
    await expectRejected(filterQuery({ field: "summary", condition: "GREATER", value: "a" }), "filters[0].condition");
    await expectRejected(filterQuery({ field: "categoryId", condition: "CONTAINS", value: "1" }), "filters[0].condition");
    await expectRejected(filterQuery({ field: "summary", condition: "ISNULL", value: "" }), "filters[0].condition");
    await expectRejected(filterQuery({ field: "createdAt", condition: "ISNOTNULL", value: "" }), "filters[0].condition");
  });

  it("rejects an invalid IN value and accepts a typed array", async () => {
    await expectRejected(filterQuery({ field: "categoryId", condition: "IN", value: "1,2,4" }), "filters[0].value");
    await expectRejected(filterQuery({ field: "categoryId", condition: "IN", value: [] }), "filters[0].value");

    await list(filterQuery({ field: "categoryId", condition: "IN", value: [1, 2, 4] })).expect(200);
    expect(findManyArgs().where.AND).toContainEqual({ categoryId: { in: [1, 2, 4] } });
  });

  it("rejects more than twenty expressions (API-68)", async () => {
    const expression = { field: "summary", condition: "CONTAINS", value: "a" };
    await expectRejected(filterQuery(...Array(21).fill(expression)), "filters");
  });

  it("rejects a search longer than 200 characters (API-68)", async () => {
    await expectRejected(`search=${"a".repeat(201)}&searchFields=summary`, "search");
  });

  it("rejects repeated search fields (API-68)", async () => {
    await expectRejected("search=vpn&searchFields=summary,summary", "searchFields");
  });
});

describe("Ticket list logical composition (API-29)", () => {
  it("ANDs the fixed predicates, one search OR group, and every filter", async () => {
    const filters = encodeURIComponent(
      JSON.stringify([
        { field: "categoryId", condition: "IN", value: [1] },
        { field: "requestedPriority", condition: "EQUAL", value: "HIGH" },
      ]),
    );

    await list(`search=vpn&searchFields=summary,description&filters=${filters}`).expect(200);

    expect(findManyArgs().where).toEqual({
      AND: [
        { requesterId: ALICE.id },
        { deleted: false },
        {
          OR: [
            { summary: { contains: "vpn", mode: "insensitive" } },
            { description: { contains: "vpn", mode: "insensitive" } },
          ],
        },
        { categoryId: { in: [1] } },
        { requestedPriority: { equals: "HIGH" } },
      ],
    });
  });
});

describe("Ticket list sorting (API-30)", () => {
  it("defaults to createdAt DESC then id DESC", async () => {
    await list().expect(200);

    expect(findManyArgs().orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
  });

  it("applies approved Ticket Number and Summary directions", async () => {
    await list("sort=ticketNumber:asc").expect(200);
    expect(findManyArgs().orderBy).toEqual([{ ticketNumber: "asc" }, { id: "desc" }]);

    vi.clearAllMocks();
    prismaMock.ticket.findMany.mockResolvedValue([]);
    prismaMock.ticket.count.mockResolvedValue(0);
    await list("sort=summary:desc").expect(200);
    expect(findManyArgs().orderBy).toEqual([{ summary: "desc" }, { id: "desc" }]);
  });

  it("sorts Priority semantically", async () => {
    /*
     * The migration declares the enum as ('LOW','MEDIUM','HIGH') and PostgreSQL
     * orders enum columns by declaration order, so `desc` is HIGH, MEDIUM, LOW
     * with no CASE expression. This suite can only prove the emitted order;
     * the row order itself belongs to the PostgreSQL suites.
     */
    await list("sort=requestedPriority:desc").expect(200);
    expect(findManyArgs().orderBy).toEqual([{ requestedPriority: "desc" }, { id: "desc" }]);
  });

  it("rejects a malformed or unsupported sort", async () => {
    await expectRejected("sort=", "sort");
    await expectRejected("sort=createdAt", "sort");
    await expectRejected("sort=summary:sideways", "sort");
    await expectRejected("sort=id:desc", "sort");
  });
});

describe("Ticket list pagination (API-31 to API-34)", () => {
  it("defaults to page 1 of size 10", async () => {
    await list().expect(200);

    expect(findManyArgs()).toMatchObject({ skip: 0, take: 10 });
  });

  it("accepts the full 1-100 page-size range and offsets correctly", async () => {
    await list("pageNumber=3&pageSize=20").expect(200);
    expect(findManyArgs()).toMatchObject({ skip: 40, take: 20 });

    vi.clearAllMocks();
    prismaMock.ticket.findMany.mockResolvedValue([]);
    prismaMock.ticket.count.mockResolvedValue(0);
    await list("pageSize=100").expect(200);
    expect(findManyArgs()).toMatchObject({ skip: 0, take: 100 });
  });

  it("rejects out-of-range and explicitly blank pagination values", async () => {
    await expectRejected("pageNumber=0", "pageNumber");
    await expectRejected("pageNumber=", "pageNumber");
    await expectRejected("pageSize=0", "pageSize");
    await expectRejected("pageSize=101", "pageSize");
    await expectRejected("pageSize=", "pageSize");
  });

  it("rejects a page number past the bound instead of computing an unusable skip", async () => {
    await expectRejected(`pageNumber=${Number.MAX_SAFE_INTEGER}`, "pageNumber");
  });

  it("returns 200 with an empty array beyond the final page", async () => {
    prismaMock.ticket.findMany.mockResolvedValue([]);
    prismaMock.ticket.count.mockResolvedValue(3);

    const response = await list("pageNumber=5&pageSize=10").expect(200);

    expect(response.body).toEqual([]);
    expect(JSON.parse(response.headers["x-pagination"])).toEqual({
      pageNumber: 5,
      pageSize: 10,
      totalItems: 3,
      totalPages: 1,
      hasPreviousPage: true,
      hasNextPage: false,
    });
  });

  it("returns complete X-Pagination metadata for a middle page", async () => {
    prismaMock.ticket.count.mockResolvedValue(47);

    const response = await list("pageNumber=2&pageSize=20").expect(200);

    expect(JSON.parse(response.headers["x-pagination"])).toEqual({
      pageNumber: 2,
      pageSize: 20,
      totalItems: 47,
      totalPages: 3,
      hasPreviousPage: true,
      hasNextPage: true,
    });
  });

  it("reports zero pages and no neighbours for an empty result set", async () => {
    prismaMock.ticket.findMany.mockResolvedValue([]);
    prismaMock.ticket.count.mockResolvedValue(0);

    const response = await list().expect(200);

    expect(JSON.parse(response.headers["x-pagination"])).toEqual({
      pageNumber: 1,
      pageSize: 10,
      totalItems: 0,
      totalPages: 0,
      hasPreviousPage: false,
      hasNextPage: false,
    });
  });

  it("sends no pagination header with a rejected query", async () => {
    const response = await expectRejected("pageSize=101", "pageSize");

    expect(response.headers["x-pagination"]).toBeUndefined();
  });
});
