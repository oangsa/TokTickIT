import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

import { RequestedPriority } from "../../../src/generated/prisma/enums.js";
import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { listTicketsForRequester } from "../../../src/services/ticketListService.js";
import { parseTicketListQuery } from "../../../src/services/ticketQueryValidator.js";
import {
  assertLab2TestDatabase,
  createTestPrisma,
  deployMigrations,
  resetTestSchema,
  type TestDatabaseTarget,
} from "./testDatabase.js";

/*
 * PG-15 (AC-21 to AC-30, AC-55). The engine-backed half of the My Tickets read
 * path.
 *
 * `my-tickets.api.test.ts` asserts the arguments handed to a mocked Prisma
 * client, which proves the validator rejects before data access and that the
 * route composes the `where` it claims to. It cannot prove what PostgreSQL then
 * does with that `where`, and several of the feature's load-bearing claims live
 * entirely on that side of the boundary:
 *
 * - ownership as an outcome ("Requester B's rows do not come back"), not as the
 *   presence of a `{ requesterId }` object;
 * - `mode: "insensitive"` actually reaching the comparison, including on `not`,
 *   which Prisma types permit but documents narrowly;
 * - `contains` against `ticket_number`, which is `CHAR(25)` rather than `TEXT`;
 * - semantic Priority ordering, which rests on PostgreSQL sorting an enum by
 *   declaration order and was previously pinned only by reading the DDL;
 * - the `createdAt DESC, id DESC` tiebreaker, which no single-row fixture and
 *   no argument assertion can exercise.
 *
 * The queries are built through `parseTicketListQuery` rather than by hand, so
 * each case exercises the real validator to QueryBuilder to Prisma path.
 */

const TICKET_DATE = "2026-08-20";

/* `ticket_number` is CHAR(25): "TKT-" + 8 + "-" + 12 is exactly 25, so a value
 * of this shape is never blank-padded and never compared against padding. */
function ticketNumber(suffix: string): string {
  const value = `TKT-${TICKET_DATE.replaceAll("-", "")}-${suffix}`;
  expect(value).toHaveLength(25);
  return value;
}

function at(hour: string): Date {
  return new Date(`${TICKET_DATE}T${hour}:00:00.000Z`);
}

interface Fixture {
  aliceId: number;
  bobId: number;
  carolId: number;
  networkId: number;
  hardwareId: number;
  vpnId: number;
  printerId: number;
  legacyCategoryId: number;
  legacySystemId: number;
}

interface TicketSeed {
  suffix: string;
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: RequestedPriority;
  createdAt: Date;
  deleted?: boolean;
}

async function createReference(prisma: PrismaClient): Promise<Fixture> {
  const requester = (name: string, email: string) =>
    prisma.developmentRequester.create({
      data: { name, email, createdBy: "system", updatedBy: "system" },
    });
  const category = (name: string) =>
    prisma.category.create({ data: { name, createdBy: "system", updatedBy: "system" } });
  const system = (name: string) =>
    prisma.relatedSystem.create({ data: { name, createdBy: "system", updatedBy: "system" } });

  const [alice, bob, carol] = await Promise.all([
    requester("List Alice", "list.alice@example.com"),
    requester("List Bob", "list.bob@example.com"),
    requester("List Carol", "list.carol@example.com"),
  ]);
  const [network, hardware, legacyCategory] = await Promise.all([
    category("List Network"),
    category("List Hardware"),
    category("List Legacy Category"),
  ]);
  const [vpn, printer, legacySystem] = await Promise.all([
    system("List VPN"),
    system("List Printer"),
    system("List Legacy System"),
  ]);

  return {
    aliceId: alice.id,
    bobId: bob.id,
    carolId: carol.id,
    networkId: network.id,
    hardwareId: hardware.id,
    vpnId: vpn.id,
    printerId: printer.id,
    legacyCategoryId: legacyCategory.id,
    legacySystemId: legacySystem.id,
  };
}

function ticketSeeds(fixture: Fixture): TicketSeed[] {
  const { aliceId, bobId, networkId, hardwareId, vpnId, printerId } = fixture;

  return [
    /* The only Ticket on the inactive/deleted reference rows. */
    {
      suffix: "AAAAAAAAAAA7",
      requesterId: aliceId,
      categoryId: fixture.legacyCategoryId,
      relatedSystemId: fixture.legacySystemId,
      summary: "Legacy reference ticket",
      description: "Kept to prove historical name resolution.",
      requestedPriority: RequestedPriority.MEDIUM,
      createdAt: at("09"),
    },
    {
      suffix: "AAAAAAAAAAA1",
      requesterId: aliceId,
      categoryId: networkId,
      relatedSystemId: vpnId,
      summary: "VPN disconnects every ten minutes",
      description: "The client drops right after credentials are accepted.",
      requestedPriority: RequestedPriority.HIGH,
      createdAt: at("10"),
    },
    /* Matches a "vpn" search only through Description, which the DTO omits. */
    {
      suffix: "AAAAAAAAAAA2",
      requesterId: aliceId,
      categoryId: hardwareId,
      relatedSystemId: printerId,
      summary: "Printer jams on duplex",
      description: "Only happens on the VPN-attached printer.",
      requestedPriority: RequestedPriority.LOW,
      createdAt: at("11"),
    },
    {
      suffix: "AAAAAAAAAAA3",
      requesterId: aliceId,
      categoryId: networkId,
      relatedSystemId: vpnId,
      summary: "Mailbox quota exceeded",
      description: "Cannot send outbound mail.",
      requestedPriority: RequestedPriority.MEDIUM,
      createdAt: at("12"),
    },
    /* Identical createdAt: only the id tiebreaker can order this pair. */
    {
      suffix: "AAAAAAAAAAA4",
      requesterId: aliceId,
      categoryId: networkId,
      relatedSystemId: vpnId,
      summary: "Tie A",
      description: "Shares a creation instant with Tie B.",
      requestedPriority: RequestedPriority.LOW,
      createdAt: at("13"),
    },
    {
      suffix: "AAAAAAAAAAA5",
      requesterId: aliceId,
      categoryId: networkId,
      relatedSystemId: vpnId,
      summary: "Tie B",
      description: "Shares a creation instant with Tie A.",
      requestedPriority: RequestedPriority.LOW,
      createdAt: at("13"),
    },
    /* Logically deleted, and it would match a "vpn" search if it were not. */
    {
      suffix: "AAAAAAAAAAA6",
      requesterId: aliceId,
      categoryId: networkId,
      relatedSystemId: vpnId,
      summary: "Deleted VPN ticket",
      description: "A removed vpn report.",
      requestedPriority: RequestedPriority.HIGH,
      createdAt: at("14"),
      deleted: true,
    },
    /* Every Carol row shares one createdAt; see CAROL_TIE_ROWS. */
    ...Array.from({ length: CAROL_TIE_ROWS }, (_unused, index) => ({
      suffix: `CCCCCCCCC${String(index).padStart(3, "0")}`,
      requesterId: fixture.carolId,
      categoryId: networkId,
      relatedSystemId: vpnId,
      summary: `Tied ticket ${index}`,
      description: "One of many rows sharing a creation instant.",
      requestedPriority: RequestedPriority.LOW,
      createdAt: at("13"),
    })),
    /* Bob's rows deliberately match Alice's search terms and filters. */
    {
      suffix: "BBBBBBBBBBB1",
      requesterId: bobId,
      categoryId: networkId,
      relatedSystemId: vpnId,
      summary: "VPN disconnects for Bob",
      description: "Bob's vpn report.",
      requestedPriority: RequestedPriority.HIGH,
      createdAt: at("15"),
    },
    {
      suffix: "BBBBBBBBBBB2",
      requesterId: bobId,
      categoryId: hardwareId,
      relatedSystemId: printerId,
      summary: "Bob printer jam",
      description: "Unrelated to Alice.",
      requestedPriority: RequestedPriority.LOW,
      createdAt: at("16"),
    },
  ];
}

/* Alice's non-deleted rows, newest first, with the id tiebreaker applied. */
const ALICE_DEFAULT_ORDER = [
  "AAAAAAAAAAA5",
  "AAAAAAAAAAA4",
  "AAAAAAAAAAA3",
  "AAAAAAAAAAA2",
  "AAAAAAAAAAA1",
  "AAAAAAAAAAA7",
];

const BOB_SUFFIXES = ["BBBBBBBBBBB1", "BBBBBBBBBBB2"];

/*
 * Carol's Tickets all share one creation instant. Two tied rows prove nothing:
 * PostgreSQL sorts a small set deterministically for a given plan, so the pair
 * comes back in insert order whether or not a tiebreaker was appended, and a
 * test built on them passes with the tiebreaker deleted. A tie this wide, paged
 * with a `LIMIT`/`OFFSET` small enough to switch the sort to a top-N heapsort,
 * is where an unordered tie actually repeats and drops rows between pages.
 */
const CAROL_TIE_ROWS = 40;
const CAROL_PAGE_SIZE = 7;

describe.sequential("Lab 2 My Tickets PostgreSQL read path", () => {
  let target: TestDatabaseTarget;
  let prisma: PrismaClient;
  let fixture: Fixture;

  /* Every assertion names Tickets by their number suffix rather than by a
   * generated id, so a failure reads as a list of Tickets rather than a list of
   * integers. */
  function suffixes(items: { ticketNumber: string }[]): string[] {
    return items.map((item) => item.ticketNumber.slice(-12));
  }

  function list(query: Record<string, unknown>, requesterId = fixture.aliceId) {
    return listTicketsForRequester(prisma, requesterId, parseTicketListQuery(query));
  }

  function search(
    term: string,
    extra: Record<string, unknown> = {},
    requesterId = fixture.aliceId,
  ) {
    return list(
      { search: term, searchFields: "ticketNumber,summary,description", ...extra },
      requesterId,
    );
  }

  beforeAll(async () => {
    target = assertLab2TestDatabase();
    prisma = createTestPrisma(target);
    await resetTestSchema(target);
    await deployMigrations(target);
    fixture = await createReference(prisma);

    /* Sequential, not Promise.all: Tie A and Tie B share a creation instant, so
     * the id order the tiebreaker test depends on has to be the insert order. */
    for (const seed of ticketSeeds(fixture)) {
      await prisma.ticket.create({
        data: {
          publicId: randomUUID(),
          ticketNumber: ticketNumber(seed.suffix),
          requesterId: seed.requesterId,
          categoryId: seed.categoryId,
          relatedSystemId: seed.relatedSystemId,
          summary: seed.summary,
          description: seed.description,
          requestedPriority: seed.requestedPriority,
          createdAt: seed.createdAt,
          deleted: seed.deleted ?? false,
          createdBy: "system",
          updatedBy: "system",
        },
      });
    }
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("returns only the Requester's own non-deleted Tickets, and counts only those", async () => {
    const alice = await list({});

    expect(suffixes(alice.items)).toEqual(ALICE_DEFAULT_ORDER);
    expect(alice.pagination.totalItems).toBe(ALICE_DEFAULT_ORDER.length);
    /* The deleted row is absent from the rows and from the total alike. */
    expect(suffixes(alice.items)).not.toContain("AAAAAAAAAAA6");

    const bob = await list({}, fixture.bobId);

    expect(suffixes(bob.items).sort()).toEqual([...BOB_SUFFIXES].sort());
    expect(bob.pagination.totalItems).toBe(BOB_SUFFIXES.length);

    /* AC-21 as an outcome: no overlap in either direction. */
    for (const suffix of BOB_SUFFIXES) {
      expect(suffixes(alice.items)).not.toContain(suffix);
    }
    for (const suffix of ALICE_DEFAULT_ORDER) {
      expect(suffixes(bob.items)).not.toContain(suffix);
    }
  });

  it("keeps a search inside the Requester's scope", async () => {
    /* Bob's "VPN disconnects for Bob" matches this term on every search field
     * Alice is allowed to search, so a scope predicate applied after the search
     * OR-group -- or flattened into it -- would surface it here. */
    const alice = await search("vpn");

    expect(suffixes(alice.items).sort()).toEqual(["AAAAAAAAAAA1", "AAAAAAAAAAA2"]);
    expect(alice.pagination.totalItems).toBe(2);

    /* The same term, run as Bob, returns his match and only his -- so the
     * predicate is scoping the search rather than the search being scoped by
     * whichever rows happened to be indexed first. */
    const bob = await search("vpn", {}, fixture.bobId);

    expect(suffixes(bob.items)).toEqual(["BBBBBBBBBBB1"]);
    expect(bob.pagination.totalItems).toBe(1);
  });

  it("matches a Ticket through Description alone while omitting it from the row", async () => {
    /* "duplex" is in no Description; "VPN-attached" is in no Summary. */
    const result = await search("vpn-attached");

    expect(suffixes(result.items)).toEqual(["AAAAAAAAAAA2"]);
    expect(result.items[0]).not.toHaveProperty("description");
  });

  it("searches case-insensitively, including against the CHAR(25) Ticket Number", async () => {
    /* `mode: "insensitive"` becomes ILIKE, and `ticket_number` is CHAR(25)
     * rather than TEXT, so this is the one search field whose column type could
     * change the comparison. */
    const upper = await search("VPN DISCONNECTS");
    const lower = await search("vpn disconnects");

    expect(suffixes(upper.items)).toEqual(["AAAAAAAAAAA1"]);
    expect(suffixes(lower.items)).toEqual(suffixes(upper.items));

    const byNumber = await search("aaaaaaaaaaa3");

    expect(suffixes(byNumber.items)).toEqual(["AAAAAAAAAAA3"]);
  });

  it("sorts Priority semantically rather than alphabetically", async () => {
    /* Alphabetically HIGH < LOW < MEDIUM, so an enum sorted as text would put
     * LOW second. PostgreSQL sorts an enum by declaration order
     * ('LOW','MEDIUM','HIGH'), which is what makes `desc` mean HIGH first with
     * no CASE expression. */
    const descending = await list({ sort: "requestedPriority:desc" });
    const ascending = await list({ sort: "requestedPriority:asc" });

    expect(descending.items.map((item) => item.requestedPriority)).toEqual([
      "HIGH",
      "MEDIUM",
      "MEDIUM",
      "LOW",
      "LOW",
      "LOW",
    ]);
    expect(ascending.items.map((item) => item.requestedPriority)).toEqual([
      "LOW",
      "LOW",
      "LOW",
      "MEDIUM",
      "MEDIUM",
      "HIGH",
    ]);
  });

  it("pages a wide createdAt tie without repeating or dropping a row", async () => {
    /*
     * BR-34/35. Every one of Carol's rows shares a creation instant, so
     * `createdAt DESC` alone leaves their relative order unspecified and a
     * `LIMIT`/`OFFSET` walk over an unspecified order may show some rows twice
     * and never show others. This asserts the walk is complete and
     * duplicate-free.
     *
     * It does NOT prove the `id DESC` tiebreaker is doing that work, and the
     * comment is deliberate rather than modest: deleting the tiebreaker from
     * `readOrder` was measured against this fixture and every case here still
     * passed, at two tied rows and again at forty paged in sevens. PostgreSQL's
     * sort is deterministic for a given plan, so a fixture cannot make it
     * choose a different arrangement on demand. The tiebreaker is a guarantee
     * about behavior PostgreSQL leaves unspecified across plan changes, which
     * is precisely what no fixture can falsify; that `id DESC` is present in
     * the emitted `orderBy` is pinned structurally by
     * `my-tickets.api.test.ts` instead. What this case does own is the
     * regression: if paging a wide tie ever starts repeating or dropping rows,
     * it fails here.
     */
    const pageCount = Math.ceil(CAROL_TIE_ROWS / CAROL_PAGE_SIZE);
    const pages = await Promise.all(
      Array.from({ length: pageCount }, (_unused, index) =>
        list({ pageSize: String(CAROL_PAGE_SIZE), pageNumber: String(index + 1) }, fixture.carolId),
      ),
    );

    const walked = pages.flatMap((page) => suffixes(page.items));

    expect(walked).toHaveLength(CAROL_TIE_ROWS);
    expect(new Set(walked).size).toBe(CAROL_TIE_ROWS);
  });

  it("orders a tie the same way on every identical request", async () => {
    const first = await list({});
    const again = await list({});

    expect(suffixes(first.items).slice(0, 2)).toEqual(["AAAAAAAAAAA5", "AAAAAAAAAAA4"]);
    expect(suffixes(again.items)).toEqual(suffixes(first.items));
  });

  it("applies mode: insensitive on NOTEQUAL", async () => {
    /* Prisma's types accept `mode` alongside `not`, which is why the unit suite
     * can assert it is emitted; whether PostgreSQL honours it is only decidable
     * here. The filter value differs from the stored Summary only in case. */
    const result = await list({
      filters: JSON.stringify([{ field: "summary", condition: "NOTEQUAL", value: "tie a" }]),
    });

    expect(suffixes(result.items)).not.toContain("AAAAAAAAAAA4");
    expect(suffixes(result.items)).toContain("AAAAAAAAAAA5");
    expect(result.pagination.totalItems).toBe(ALICE_DEFAULT_ORDER.length - 1);
  });

  it("combines the search OR-group with every filter as one AND", async () => {
    /* "vpn" alone matches AAAAAAAAAAA1 (Summary) and AAAAAAAAAAA2
     * (Description); the Category filter must remove the second rather than
     * widen the result. */
    const result = await search("vpn", {
      filters: JSON.stringify([
        { field: "categoryId", condition: "IN", value: [String(fixture.networkId)] },
      ]),
    });

    expect(suffixes(result.items)).toEqual(["AAAAAAAAAAA1"]);
    expect(result.pagination.totalItems).toBe(1);
  });

  it("pages without overlap or gaps and answers past the final page with an empty array", async () => {
    const pageSize = "2";
    const pages = await Promise.all(
      ["1", "2", "3", "4"].map((pageNumber) => list({ pageSize, pageNumber })),
    );

    expect(pages.map((page) => suffixes(page.items))).toEqual([
      ALICE_DEFAULT_ORDER.slice(0, 2),
      ALICE_DEFAULT_ORDER.slice(2, 4),
      ALICE_DEFAULT_ORDER.slice(4, 6),
      [],
    ]);

    for (const page of pages) {
      expect(page.pagination.totalItems).toBe(ALICE_DEFAULT_ORDER.length);
      expect(page.pagination.totalPages).toBe(3);
    }

    /* BR-38: past the last page is an empty array with metadata complete enough
     * to walk back, not an error and not a clamp. */
    expect(pages[3].pagination).toMatchObject({
      pageNumber: 4,
      hasPreviousPage: true,
      hasNextPage: false,
    });
  });

  it("keeps historical Category and Related System names after both go inactive and deleted", async () => {
    /* BR-72/73. Ticket metadata is historical, so the projection reads the
     * relation with no `isActive`/`deleted` predicate. Mutated inside the test
     * rather than in the fixture so the rows are known good beforehand. */
    const before = await list({});
    const legacy = before.items.find((item) => item.ticketNumber.endsWith("AAAAAAAAAAA7"));

    expect(legacy).toMatchObject({
      categoryName: "List Legacy Category",
      relatedSystemName: "List Legacy System",
    });

    await prisma.category.update({
      where: { id: fixture.legacyCategoryId },
      data: { isActive: false, deleted: true, updatedBy: "system" },
    });
    await prisma.relatedSystem.update({
      where: { id: fixture.legacySystemId },
      data: { isActive: false, deleted: true, updatedBy: "system" },
    });

    const after = await list({});
    const stillThere = after.items.find((item) => item.ticketNumber.endsWith("AAAAAAAAAAA7"));

    expect(stillThere).toMatchObject({
      categoryName: "List Legacy Category",
      relatedSystemName: "List Legacy System",
    });
    /* The Ticket itself is untouched by the reference rows' lifecycle. */
    expect(after.pagination.totalItems).toBe(ALICE_DEFAULT_ORDER.length);
  });
});
