import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import {
  createReplyComment,
  createRootComment,
  getCommentReplies,
  getRootComments,
  validateCommentContent,
  writePublicCommentForWorkflow,
} from "../../src/services/publicCommentService.js";
import { actor, ADMIN, REQUESTER, STAFF, TICKET_ID } from "./support/staffFixture.js";

const OTHER_TICKET_ID = "20000000-0000-4000-8000-000000000022";

describe("UNIT-11 PublicCommentService @issue-6", () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      ticket: {
        findFirst: vi.fn(),
      },
      publicComment: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
    };
  });

  describe("Validation", () => {
    it("accepts trimmed content with 1 to 2000 Unicode code points", () => {
      expect(validateCommentContent("a")).toBe("a");
      expect(validateCommentContent("  hello world  ")).toBe("hello world");
      expect(validateCommentContent("x".repeat(2000))).toBe("x".repeat(2000));
      expect(validateCommentContent("🎉".repeat(2000))).toBe("🎉".repeat(2000));
    });

    it.each([
      "",
      "   ",
      "\n\t  ",
      "x".repeat(2001),
      "🎉".repeat(2001),
      null,
      undefined,
      123,
      {},
    ])("rejects invalid content: %j", (invalid) => {
      expect(() => validateCommentContent(invalid)).toThrowError();
    });

    it("preserves HTML and Markdown as literal plain text", () => {
      const html = "<script>alert('xss')</script> <b>bold</b>";
      expect(validateCommentContent(html)).toBe(html);
      const md = "## Header\n[link](http://example.com)\n* item";
      expect(validateCommentContent(md)).toBe(md);
    });
  });

  describe("Root comment creation and ticket scoping", () => {
    it("creates root comment with depth 0 and null parent/replyTo", async () => {
      mockPrisma.ticket.findFirst.mockResolvedValue({
        id: 31,
        publicId: TICKET_ID,
        requesterId: REQUESTER.id,
        currentStatus: "OPEN",
      });
      mockPrisma.publicComment.create.mockResolvedValue({
        id: 101,
        publicId: "c101-0000-4000-8000-000000000001",
        ticketId: 31,
        authorUserId: REQUESTER.id,
        parentCommentId: null,
        replyToCommentId: null,
        content: "Need help with VPN",
        createdAt: new Date("2026-09-17T10:00:00Z"),
        author: { publicId: REQUESTER.publicId, name: REQUESTER.name, role: REQUESTER.role },
      });

      const res = await createRootComment(mockPrisma, actor(REQUESTER), TICKET_ID, "  Need help with VPN  ");
      expect(res.depth).toBe(0);
      expect(res.parentCommentPublicId).toBeNull();
      expect(res.replyTo).toBeNull();
      expect(res.author.publicId).toBe(REQUESTER.publicId);
      expect(mockPrisma.publicComment.create).toHaveBeenCalledWith({
        data: {
          ticketId: 31,
          authorUserId: REQUESTER.id,
          content: "Need help with VPN",
        },
        include: { author: { select: { publicId: true, name: true, role: true } } },
      });
    });

    it("rejects cross-Requester ticket access with 404", async () => {
      mockPrisma.ticket.findFirst.mockResolvedValue({
        id: 31,
        publicId: TICKET_ID,
        requesterId: 999, // different requester
        currentStatus: "OPEN",
      });

      await expect(
        createRootComment(mockPrisma, actor(REQUESTER), TICKET_ID, "Hello"),
      ).rejects.toThrowError();
    });

    it("allows IT Staff and Admin to comment on any visible ticket", async () => {
      mockPrisma.ticket.findFirst.mockResolvedValue({
        id: 31,
        publicId: TICKET_ID,
        requesterId: REQUESTER.id,
        currentStatus: "OPEN",
      });
      mockPrisma.publicComment.create.mockResolvedValue({
        id: 102,
        publicId: "c102-0000-4000-8000-000000000002",
        ticketId: 31,
        authorUserId: STAFF.id,
        parentCommentId: null,
        replyToCommentId: null,
        content: "Staff reply",
        createdAt: new Date("2026-09-17T10:05:00Z"),
        author: { publicId: STAFF.publicId, name: STAFF.name, role: STAFF.role },
      });

      const res = await createRootComment(mockPrisma, actor(STAFF), TICKET_ID, "Staff reply");
      expect(res.author.publicId).toBe(STAFF.publicId);
    });
  });

  describe("Structural depth and replyTo targeting", () => {
    const rootComment = {
      id: 1,
      publicId: "c1000000-0000-4000-8000-000000000001",
      parentCommentId: null,
      parent: null,
      author: STAFF,
    };
    const depth1Comment = {
      id: 2,
      publicId: "c2000000-0000-4000-8000-000000000002",
      parentCommentId: 1,
      parent: { id: 1, parentCommentId: null, publicId: "c1000000-0000-4000-8000-000000000001" },
      author: REQUESTER,
    };
    const depth2Comment = {
      id: 3,
      publicId: "c3000000-0000-4000-8000-000000000003",
      parentCommentId: 2,
      parent: { id: 2, parentCommentId: 1, publicId: "c2000000-0000-4000-8000-000000000002" },
      author: STAFF,
    };

    beforeEach(() => {
      mockPrisma.ticket.findFirst.mockResolvedValue({
        id: 31,
        publicId: TICKET_ID,
        requesterId: REQUESTER.id,
        currentStatus: "OPEN",
      });
    });

    it("reply to depth-0 root produces depth 1 with target as parent and replyTo", async () => {
      mockPrisma.publicComment.findFirst.mockResolvedValue(rootComment);
      mockPrisma.publicComment.create.mockResolvedValue({
        id: 10,
        publicId: "new-depth-1",
        content: "Reply to root",
        createdAt: new Date(),
        author: REQUESTER,
        parent: { id: 1, publicId: rootComment.publicId, parentCommentId: null },
        parentCommentId: 1,
        replyTo: { publicId: rootComment.publicId, author: STAFF },
      });

      const res = await createReplyComment(
        mockPrisma,
        actor(REQUESTER),
        TICKET_ID,
        rootComment.publicId,
        "Reply to root",
      );

      expect(mockPrisma.publicComment.create).toHaveBeenCalledWith({
        data: {
          ticketId: 31,
          authorUserId: REQUESTER.id,
          parentCommentId: 1,
          replyToCommentId: 1,
          content: "Reply to root",
        },
        include: expect.any(Object),
      });
      expect(res.depth).toBe(1);
      expect(res.parentCommentPublicId).toBe(rootComment.publicId);
      expect(res.replyTo?.commentPublicId).toBe(rootComment.publicId);
      expect(res.replyTo?.name).toBe(STAFF.name);
    });

    it("reply to depth-1 produces depth 2 with depth-1 as parent and replyTo", async () => {
      mockPrisma.publicComment.findFirst.mockResolvedValue(depth1Comment);
      mockPrisma.publicComment.create.mockResolvedValue({
        id: 11,
        publicId: "new-depth-2",
        content: "Reply to depth1",
        createdAt: new Date(),
        author: ADMIN,
        parent: { id: 2, publicId: depth1Comment.publicId, parentCommentId: 1 },
        parentCommentId: 2,
        replyTo: { publicId: depth1Comment.publicId, author: REQUESTER },
      });

      const res = await createReplyComment(
        mockPrisma,
        actor(ADMIN),
        TICKET_ID,
        depth1Comment.publicId,
        "Reply to depth1",
      );

      expect(mockPrisma.publicComment.create).toHaveBeenCalledWith({
        data: {
          ticketId: 31,
          authorUserId: ADMIN.id,
          parentCommentId: 2,
          replyToCommentId: 2,
          content: "Reply to depth1",
        },
        include: expect.any(Object),
      });
      expect(res.depth).toBe(2);
      expect(res.parentCommentPublicId).toBe(depth1Comment.publicId);
      expect(res.replyTo?.commentPublicId).toBe(depth1Comment.publicId);
      expect(res.replyTo?.name).toBe(REQUESTER.name);
    });

    it("reply to depth-2 flattens to depth 2 under depth-1 parent with exact clicked target in replyTo", async () => {
      mockPrisma.publicComment.findFirst.mockResolvedValue(depth2Comment);
      mockPrisma.publicComment.create.mockResolvedValue({
        id: 12,
        publicId: "new-depth-2-sibling",
        content: "Reply to depth2",
        createdAt: new Date(),
        author: REQUESTER,
        parent: { id: 2, publicId: depth1Comment.publicId, parentCommentId: 1 },
        parentCommentId: 2,
        replyTo: { publicId: depth2Comment.publicId, author: STAFF },
      });

      const res = await createReplyComment(
        mockPrisma,
        actor(REQUESTER),
        TICKET_ID,
        depth2Comment.publicId,
        "Reply to depth2",
      );

      // Sibling under depth-1 parent (id: 2), clicked target is depth-2 (id: 3)
      expect(mockPrisma.publicComment.create).toHaveBeenCalledWith({
        data: {
          ticketId: 31,
          authorUserId: REQUESTER.id,
          parentCommentId: 2,
          replyToCommentId: 3,
          content: "Reply to depth2",
        },
        include: expect.any(Object),
      });
      expect(res.depth).toBe(2);
      expect(res.parentCommentPublicId).toBe(depth1Comment.publicId);
      expect(res.replyTo?.commentPublicId).toBe(depth2Comment.publicId);
      expect(res.replyTo?.name).toBe(STAFF.name);
    });
  });

  describe("getRootComments bounded preview retrieval", () => {
    const rootRow = (id: number, publicId: string, createdAt: string) => ({
      id,
      publicId,
      content: `Root ${id}`,
      createdAt: new Date(createdAt),
      parentCommentId: null,
      replyToCommentId: null,
      author: { publicId: STAFF.publicId, name: STAFF.name, role: STAFF.role },
    });

    const replyRow = (
      id: number,
      publicId: string,
      parentCommentId: number,
      createdAt: string,
      parent: { id: number; publicId: string; parentCommentId: number | null },
      replyTo: { publicId: string; author: { publicId: string; name: string } },
    ) => ({
      id,
      publicId,
      content: `Reply ${id}`,
      parentCommentId,
      createdAt: new Date(createdAt),
      author: { publicId: REQUESTER.publicId, name: REQUESTER.name, role: REQUESTER.role },
      parent,
      replyTo,
    });

    beforeEach(() => {
      mockPrisma.ticket.findFirst.mockResolvedValue({
        id: 31,
        publicId: TICKET_ID,
        requesterId: REQUESTER.id,
        currentStatus: "OPEN",
      });
      mockPrisma.$queryRaw = vi.fn().mockResolvedValue([]);
    });

    it("returns replyCount 0 and empty previews for roots without replies", async () => {
      mockPrisma.publicComment.count.mockResolvedValue(1);
      mockPrisma.publicComment.findMany.mockResolvedValueOnce([
        rootRow(10, "root-10", "2026-09-17T10:00:00Z"),
      ]);

      const res = await getRootComments(mockPrisma, actor(REQUESTER), TICKET_ID, {});

      expect(res.items).toHaveLength(1);
      expect(res.items[0].replyCount).toBe(0);
      expect(res.items[0].replies).toEqual([]);
      // No preview hydration needed when the ranking returns no rows.
      expect(mockPrisma.publicComment.findMany).toHaveBeenCalledTimes(1);
    });

    it("hydrates only the three oldest previews while reporting the full reply count", async () => {
      // Root 10 has 20 replies; the database ranking reports the exact count
      // and only ranks 1-3 (ids 101, 102, 103) for hydration.
      mockPrisma.publicComment.count.mockResolvedValue(1);
      mockPrisma.$queryRaw.mockResolvedValueOnce([
        { root_id: 10, reply_id: 101, reply_rank: 1, reply_count: 20 },
        { root_id: 10, reply_id: 102, reply_rank: 2, reply_count: 20 },
        { root_id: 10, reply_id: 103, reply_rank: 3, reply_count: 20 },
      ]);

      const parent = { id: 10, publicId: "root-10", parentCommentId: null };
      const previewRows = [
        replyRow(101, "r101", 10, "2026-09-17T10:01:00Z", parent, { publicId: "root-10", author: STAFF }),
        replyRow(102, "r102", 10, "2026-09-17T10:02:00Z", parent, { publicId: "root-10", author: STAFF }),
        replyRow(103, "r103", 102, "2026-09-17T10:03:00Z", { id: 102, publicId: "r102", parentCommentId: 10 }, { publicId: "r102", author: REQUESTER }),
      ];
      mockPrisma.publicComment.findMany
        .mockResolvedValueOnce([rootRow(10, "root-10", "2026-09-17T10:00:00Z")])
        .mockImplementation(async (args: any) =>
          previewRows.filter((row) => (args?.where?.id?.in ?? []).includes(row.id)),
        );

      const res = await getRootComments(mockPrisma, actor(REQUESTER), TICKET_ID, {});

      expect(res.items[0].replyCount).toBe(20);
      expect(res.items[0].replies.map((r) => r.publicId)).toEqual(["r101", "r102", "r103"]);
      expect(res.items[0].replies[2].depth).toBe(2);
      expect(res.items[0].replies[2].parentCommentPublicId).toBe("r102");
      expect(res.items[0].replies[2].replyTo?.commentPublicId).toBe("r102");

      // Bounded hydration: the detail fetch receives exactly the ranked ids.
      const previewCalls = mockPrisma.publicComment.findMany.mock.calls.filter(
        (call: any[]) => call[0]?.where?.id?.in !== undefined,
      );
      expect(previewCalls).toHaveLength(1);
      expect(previewCalls[0][0].where.id.in).toEqual([101, 102, 103]);
    });

    it("keeps counts and previews independent across roots on one page", async () => {
      mockPrisma.publicComment.count.mockResolvedValue(2);
      mockPrisma.$queryRaw.mockResolvedValueOnce([
        { root_id: 10, reply_id: 21, reply_rank: 1, reply_count: 4 },
        { root_id: 10, reply_id: 22, reply_rank: 2, reply_count: 4 },
        { root_id: 10, reply_id: 23, reply_rank: 3, reply_count: 4 },
        { root_id: 11, reply_id: 31, reply_rank: 1, reply_count: 1 },
      ]);

      const parentA = { id: 10, publicId: "root-10", parentCommentId: null };
      const parentB = { id: 11, publicId: "root-11", parentCommentId: null };
      const previewRows = [
        replyRow(21, "r21", 10, "2026-09-17T12:01:00Z", parentA, { publicId: "root-10", author: REQUESTER }),
        replyRow(22, "r22", 10, "2026-09-17T12:02:00Z", parentA, { publicId: "root-10", author: REQUESTER }),
        replyRow(23, "r23", 21, "2026-09-17T12:03:00Z", { id: 21, publicId: "r21", parentCommentId: 10 }, { publicId: "r21", author: STAFF }),
        replyRow(31, "r31", 11, "2026-09-17T11:01:00Z", parentB, { publicId: "root-11", author: STAFF }),
      ];
      mockPrisma.publicComment.findMany
        .mockResolvedValueOnce([
          rootRow(10, "root-10", "2026-09-17T12:00:00Z"),
          rootRow(11, "root-11", "2026-09-17T11:00:00Z"),
        ])
        .mockImplementation(async (args: any) =>
          previewRows.filter((row) => (args?.where?.id?.in ?? []).includes(row.id)),
        );

      const res = await getRootComments(mockPrisma, actor(REQUESTER), TICKET_ID, {});

      expect(res.items).toHaveLength(2);
      expect(res.items[0].replyCount).toBe(4);
      expect(res.items[0].replies.map((r) => r.publicId)).toEqual(["r21", "r22", "r23"]);
      expect(res.items[1].replyCount).toBe(1);
      expect(res.items[1].replies.map((r) => r.publicId)).toEqual(["r31"]);
    });

    it("preserves the database ranking order, including equal-timestamp ties by internal id", async () => {
      mockPrisma.publicComment.count.mockResolvedValue(1);
      // Equal created_at: the database ranks by id ASC, so 41 < 42 < 43.
      mockPrisma.$queryRaw.mockResolvedValueOnce([
        { root_id: 10, reply_id: 41, reply_rank: 1, reply_count: 3 },
        { root_id: 10, reply_id: 42, reply_rank: 2, reply_count: 3 },
        { root_id: 10, reply_id: 43, reply_rank: 3, reply_count: 3 },
      ]);

      const parent = { id: 10, publicId: "root-10", parentCommentId: null };
      const sameTime = "2026-09-17T10:00:00.000Z";
      const previewRows = [
        replyRow(41, "r41", 10, sameTime, parent, { publicId: "root-10", author: STAFF }),
        replyRow(42, "r42", 41, sameTime, { id: 41, publicId: "r41", parentCommentId: 10 }, { publicId: "r41", author: REQUESTER }),
        replyRow(43, "r43", 10, sameTime, parent, { publicId: "root-10", author: STAFF }),
      ];
      mockPrisma.publicComment.findMany
        .mockResolvedValueOnce([rootRow(10, "root-10", "2026-09-17T09:00:00Z")])
        .mockImplementation(async (args: any) =>
          previewRows.filter((row) => (args?.where?.id?.in ?? []).includes(row.id)),
        );

      const res = await getRootComments(mockPrisma, actor(REQUESTER), TICKET_ID, {});

      expect(res.items[0].replies.map((r) => r.publicId)).toEqual(["r41", "r42", "r43"]);
      expect(res.items[0].replies[1].depth).toBe(2);
      expect(res.items[0].replies[1].parentCommentPublicId).toBe("r41");
    });
  });

  describe("writePublicCommentForWorkflow transaction seam", () => {
    it("writes trimmed comment inside provided transaction client", async () => {
      const txMock = {
        publicComment: {
          create: vi.fn().mockResolvedValue({ id: 99 }),
        },
      };
      await writePublicCommentForWorkflow(txMock as any, {
        ticketId: 31,
        authorUserId: STAFF.id,
        content: "  Workflow comment  ",
      });
      expect(txMock.publicComment.create).toHaveBeenCalledWith({
        data: {
          ticketId: 31,
          authorUserId: STAFF.id,
          content: "Workflow comment",
        },
      });
    });
  });
});
