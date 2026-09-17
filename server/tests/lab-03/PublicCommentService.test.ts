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
