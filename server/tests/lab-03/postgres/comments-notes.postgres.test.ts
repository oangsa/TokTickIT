import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import {
  createRootComment,
  createReplyComment,
  getRootComments,
  getCommentReplies,
} from "../../../src/services/publicCommentService.js";
import {
  createInternalNote,
  getInternalNotes,
} from "../../../src/services/internalNoteService.js";
import type { TicketActor } from "../../../src/services/ticketWorkflowService.js";
import {
  assertLab2TestDatabase,
  createTestPrisma,
  deployMigrations,
  resetTestSchema,
  type TestDatabaseTarget,
} from "../../lab-02/postgres/testDatabase.js";

describe.sequential("PostgreSQL Comments and Notes Integration PG-14, PG-15 @issue-6", () => {
  let target: TestDatabaseTarget;
  let prisma: PrismaClient;
  let requesterActor: TicketActor;
  let staffActor: TicketActor;
  let adminActor: TicketActor;
  let ticketPublicId: string;
  let ticketId: number;

  beforeAll(async () => {
    target = assertLab2TestDatabase();
    await resetTestSchema(target);
    await deployMigrations(target);
    prisma = createTestPrisma(target);

    const requester = await prisma.user.create({
      data: {
        name: "Requester PG14",
        email: "requester.pg14@example.test",
        role: "REQUESTER",
        passwordHash: "unusable-fixture-hash",
        mustChangePassword: false,
        createdBy: "system",
        updatedBy: "system",
      },
    });

    const staff = await prisma.user.create({
      data: {
        name: "Staff PG14",
        email: "staff.pg14@example.test",
        role: "IT_STAFF",
        passwordHash: "unusable-fixture-hash",
        mustChangePassword: false,
        createdBy: "system",
        updatedBy: "system",
      },
    });

    const admin = await prisma.user.create({
      data: {
        name: "Admin PG14",
        email: "admin.pg14@example.test",
        role: "ADMINISTRATOR",
        passwordHash: "unusable-fixture-hash",
        mustChangePassword: false,
        createdBy: "system",
        updatedBy: "system",
      },
    });

    requesterActor = {
      userId: requester.id,
      userPublicId: requester.publicId,
      email: requester.email,
      role: requester.role,
    };

    staffActor = {
      userId: staff.id,
      userPublicId: staff.publicId,
      email: staff.email,
      role: staff.role,
    };

    adminActor = {
      userId: admin.id,
      userPublicId: admin.publicId,
      email: admin.email,
      role: admin.role,
    };

    const category = await prisma.category.create({
      data: { name: "PG14 Category", createdBy: "system", updatedBy: "system" },
    });

    const system = await prisma.relatedSystem.create({
      data: { name: "PG14 System", createdBy: "system", updatedBy: "system" },
    });

    const ticket = await prisma.ticket.create({
      data: {
        publicId: randomUUID(),
        ticketNumber: `TKT-20260917-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
        requesterId: requester.id,
        ownerUserId: staff.id,
        categoryId: category.id,
        relatedSystemId: system.id,
        summary: "PG14 Comment and Note ticket",
        description: "Valid ticket description for testing comments and notes.",
        requestedPriority: "MEDIUM",
        itPriority: "HIGH",
        currentStatus: "OPEN",
        createdBy: "system",
        updatedBy: "system",
      },
    });

    ticketPublicId = ticket.publicId;
    ticketId = ticket.id;
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  describe("PG-14 Public Comment thread persistence and ordering", () => {
    it("persists root comments and retrieves them in newest-first order with pagination", async () => {
      const root1 = await createRootComment(prisma, requesterActor, ticketPublicId, "Root comment 1");

      // Small tick to ensure timestamp progression
      await new Promise((resolve) => setTimeout(resolve, 15));

      const root2 = await createRootComment(prisma, staffActor, ticketPublicId, "Root comment 2");

      await new Promise((resolve) => setTimeout(resolve, 15));

      const root3 = await createRootComment(prisma, requesterActor, ticketPublicId, "Root comment 3");

      const list = await getRootComments(prisma, requesterActor, ticketPublicId, {
        page: "1",
        limit: "10",
      });

      expect(list.items.length).toBeGreaterThanOrEqual(3);
      // Newest first: root3, root2, root1
      const publicIds = list.items.map((i) => i.publicId);
      const idx3 = publicIds.indexOf(root3.publicId);
      const idx2 = publicIds.indexOf(root2.publicId);
      const idx1 = publicIds.indexOf(root1.publicId);

      expect(idx3).toBeLessThan(idx2);
      expect(idx2).toBeLessThan(idx1);
    });

    it("retrieves oldest-first previews up to 3 and paginates thread replies", async () => {
      const root = await createRootComment(prisma, requesterActor, ticketPublicId, "Thread root for replies");

      const rep1 = await createReplyComment(prisma, staffActor, ticketPublicId, root.publicId, "Reply 1");
      await new Promise((resolve) => setTimeout(resolve, 15));
      const rep2 = await createReplyComment(prisma, requesterActor, ticketPublicId, root.publicId, "Reply 2");
      await new Promise((resolve) => setTimeout(resolve, 15));
      const rep3 = await createReplyComment(prisma, staffActor, ticketPublicId, root.publicId, "Reply 3");
      await new Promise((resolve) => setTimeout(resolve, 15));
      const rep4 = await createReplyComment(prisma, requesterActor, ticketPublicId, root.publicId, "Reply 4");

      // Fetch root comment via getRootComments
      const list = await getRootComments(prisma, staffActor, ticketPublicId, {
        page: "1",
        limit: "20",
      });

      const foundRoot = list.items.find((i) => i.publicId === root.publicId);
      expect(foundRoot).toBeDefined();
      expect(foundRoot?.replyCount).toBe(4);
      // Up to 3 preview replies, oldest first: rep1, rep2, rep3
      expect(foundRoot?.replies).toHaveLength(3);
      expect(foundRoot?.replies[0].publicId).toBe(rep1.publicId);
      expect(foundRoot?.replies[1].publicId).toBe(rep2.publicId);
      expect(foundRoot?.replies[2].publicId).toBe(rep3.publicId);

      // Reply pagination: page 1 (size 2) -> rep1, rep2
      const page1 = await getCommentReplies(prisma, staffActor, ticketPublicId, root.publicId, {
        pageNumber: 1,
        pageSize: 2,
      });
      expect(page1.items).toHaveLength(2);
      expect(page1.items[0].publicId).toBe(rep1.publicId);
      expect(page1.items[1].publicId).toBe(rep2.publicId);
      expect(page1.pagination.totalItems).toBe(4);
      expect(page1.pagination.totalPages).toBe(2);

      // Reply pagination: page 2 (size 2) -> rep3, rep4
      const page2 = await getCommentReplies(prisma, staffActor, ticketPublicId, root.publicId, {
        pageNumber: 2,
        pageSize: 2,
      });
      expect(page2.items).toHaveLength(2);
      expect(page2.items[0].publicId).toBe(rep3.publicId);
      expect(page2.items[1].publicId).toBe(rep4.publicId);
    });

    it("bounds preview hydration to the three oldest replies on a 20-reply mixed-depth thread", async () => {
      const root = await createRootComment(prisma, requesterActor, ticketPublicId, "Bounded preview root");

      // Interleaved depth-1/depth-2 creation: d1a, d2a (under d1a), d1b, d1c,
      // d2b (under d1b), then 15 more depth-1 replies.
      const d1a = await createReplyComment(prisma, staffActor, ticketPublicId, root.publicId, "d1a");
      await new Promise((resolve) => setTimeout(resolve, 15));
      const d2a = await createReplyComment(prisma, requesterActor, ticketPublicId, d1a.publicId, "d2a under d1a");
      await new Promise((resolve) => setTimeout(resolve, 15));
      const d1b = await createReplyComment(prisma, staffActor, ticketPublicId, root.publicId, "d1b");
      await new Promise((resolve) => setTimeout(resolve, 15));
      const d1c = await createReplyComment(prisma, requesterActor, ticketPublicId, root.publicId, "d1c");
      await new Promise((resolve) => setTimeout(resolve, 15));
      const d2b = await createReplyComment(prisma, staffActor, ticketPublicId, d1b.publicId, "d2b under d1b");
      await new Promise((resolve) => setTimeout(resolve, 15));
      for (let i = 1; i <= 15; i += 1) {
        const tail = await createReplyComment(prisma, i % 2 === 0 ? staffActor : requesterActor, ticketPublicId, root.publicId, `tail d1 ${i}`);
        await new Promise((resolve) => setTimeout(resolve, 15));
      }

      const loggedSql: string[] = [];
      const loggingPrisma = createTestPrisma(target, (sql) => loggedSql.push(sql));
      let list: Awaited<ReturnType<typeof getRootComments>>;
      try {
        list = await getRootComments(loggingPrisma, staffActor, ticketPublicId, {
          pageNumber: 1,
          pageSize: 100,
        });

        const foundRoot = list.items.find((i) => i.publicId === root.publicId);
        expect(foundRoot).toBeDefined();
        expect(foundRoot?.replyCount).toBe(20);
        expect(foundRoot?.replies).toHaveLength(3);
        expect(foundRoot?.replies.map((r) => r.publicId)).toEqual([d1a.publicId, d2a.publicId, d1b.publicId]);

        // Depth-2 preview keeps its depth-1 structural parent and exact replyTo.
        expect(foundRoot?.replies[1].depth).toBe(2);
        expect(foundRoot?.replies[1].parentCommentPublicId).toBe(d1a.publicId);
        expect(foundRoot?.replies[1].replyTo?.commentPublicId).toBe(d1a.publicId);
      } finally {
        await loggingPrisma.$disconnect();
      }

      // Bounded hydration: the complete-record fetch selects at most three
      // preview ids per root, never the full reply set. Prisma's pg adapter
      // logs parameterized SQL, so the bound is proven by the placeholder count
      // in the main preview fetch's `id IN (...)` clause, not by literal ids.
      // The main preview fetch is the only public_comment `id IN` query that
      // carries an ORDER BY (the include-relation fetches have none).
      const mainPreviewFetches = loggedSql.filter(
        (sql) => /FROM "public"."public_comment"/.test(sql) && /"id" IN \(/i.test(sql) && /ORDER BY/i.test(sql),
      );
      expect(mainPreviewFetches).toHaveLength(1);
      const inClause = mainPreviewFetches[0].match(/"id" IN \(([^)]*)\)/i)?.[1] ?? "";
      const previewPlaceholderCount = (inClause.match(/\$\d+/g) ?? []).length;

      const rootsOnPage = list.items;
      const totalRepliesOnPage = rootsOnPage.reduce((sum, r) => sum + r.replyCount, 0);
      // Each root hydrates at most 3 previews; the page holds 24 replies total,
      // so a bounded fetch is strictly smaller than hydrating every reply.
      expect(previewPlaceholderCount).toBeLessThanOrEqual(3 * rootsOnPage.length);
      expect(previewPlaceholderCount).toBeLessThan(totalRepliesOnPage);
    });

    it("enforces depth bounds and flattens depth-2 replies preserving reply target", async () => {
      const root = await createRootComment(prisma, requesterActor, ticketPublicId, "Root for depth testing");

      // Reply to root (depth 1)
      const depth1 = await createReplyComment(prisma, staffActor, ticketPublicId, root.publicId, "Depth 1 reply");

      // Reply to depth1 (depth 2)
      const depth2 = await createReplyComment(prisma, requesterActor, ticketPublicId, depth1.publicId, "Depth 2 reply");

      // Reply to depth2 (depth 2 flattened - sibling of depth2 under depth1 parent)
      const depth2Flattened = await createReplyComment(
        prisma,
        staffActor,
        ticketPublicId,
        depth2.publicId,
        "Depth 2 flattened reply to depth2",
      );

      // Check DB records directly
      const rootRow = await prisma.publicComment.findUniqueOrThrow({
        where: { publicId: root.publicId },
      });
      const d1Row = await prisma.publicComment.findUniqueOrThrow({
        where: { publicId: depth1.publicId },
      });
      const d2Row = await prisma.publicComment.findUniqueOrThrow({
        where: { publicId: depth2.publicId },
      });
      const d2fRow = await prisma.publicComment.findUniqueOrThrow({
        where: { publicId: depth2Flattened.publicId },
      });

      expect(rootRow.parentCommentId).toBeNull();
      expect(rootRow.replyToCommentId).toBeNull();

      expect(d1Row.parentCommentId).toBe(rootRow.id);
      expect(d1Row.replyToCommentId).toBe(rootRow.id);

      expect(d2Row.parentCommentId).toBe(d1Row.id);
      expect(d2Row.replyToCommentId).toBe(d1Row.id);

      // Flattened: parent is still d1Row.id, but replyTo is d2Row.id
      expect(d2fRow.parentCommentId).toBe(d1Row.id);
      expect(d2fRow.replyToCommentId).toBe(d2Row.id);

      // DTO checks
      expect(depth1.depth).toBe(1);
      expect(depth1.replyTo?.commentPublicId).toBe(root.publicId);

      expect(depth2.depth).toBe(2);
      expect(depth2.replyTo?.commentPublicId).toBe(depth1.publicId);

      expect(depth2Flattened.depth).toBe(2);
      expect(depth2Flattened.replyTo?.commentPublicId).toBe(depth2.publicId);
    });
  });

  describe("PG-15 Internal Note persistence and restrictive foreign key evidence", () => {
    it("persists flat internal notes and lists them in newest-first order with author projection", async () => {
      const note1 = await createInternalNote(
        prisma,
        staffActor,
        ticketPublicId,
        "First internal note by staff",
      );

      await new Promise((resolve) => setTimeout(resolve, 15));

      const note2 = await createInternalNote(
        prisma,
        staffActor,
        ticketPublicId,
        "Second internal note by staff",
      );

      const notes = await getInternalNotes(prisma, staffActor, ticketPublicId, {
        page: "1",
        limit: "10",
      });

      expect(notes.items.length).toBeGreaterThanOrEqual(2);
      const publicIds = notes.items.map((n) => n.publicId);
      const idx1 = publicIds.indexOf(note1.publicId);
      const idx2 = publicIds.indexOf(note2.publicId);

      // Newest first
      expect(idx2).toBeLessThan(idx1);
      expect(notes.items[idx2].author).toEqual({
        publicId: staffActor.userPublicId,
        name: "Staff PG14",
        role: "IT_STAFF",
      });
    });

    it("evidence that User and Ticket deletions fail with foreign key restrict (no cascade delete)", async () => {
      // Attempting to delete the staff user who authored notes/comments must fail with foreign key restrict
      await expect(
        prisma.user.delete({
          where: { id: staffActor.userId },
        }),
      ).rejects.toThrow();

      // Attempting to delete the ticket with comments and notes must fail with foreign key restrict
      await expect(
        prisma.ticket.delete({
          where: { id: ticketId },
        }),
      ).rejects.toThrow();

      // Confirm note still exists
      const count = await prisma.internalNote.count({
        where: { ticketId },
      });
      expect(count).toBeGreaterThanOrEqual(2);
    });
  });
});
