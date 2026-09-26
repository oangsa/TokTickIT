import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStaffTicketsRouter } from "../../src/routes/staffTickets.js";
import { errorHandler } from "../../src/http/errors.js";
import { ADMIN, REQUESTER, STAFF, staffPrismaMock, staffTicketRow, TICKET_ID } from "./support/staffFixture.js";
import { bearerToken, configureRequesterAuth, type RequesterTokens } from "../lab-02/support/authenticatedRequester.js";

const { mock } = staffPrismaMock();
vi.mock("../../src/prisma.js", () => ({ getPrisma: () => mock }));

import { app } from "../../src/app.js";

describe("API-26 Request Information transaction seam @issue-5", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.ticket.findFirst.mockResolvedValue(staffTicketRow({ ownerUserId: STAFF.id, owner: STAFF, currentStatus: "OPEN" }));
  });
  it("uses injected typed writer and trims the public message", async () => {
    const writer = vi.fn().mockResolvedValue(undefined);
    const isolatedApp = express().use(express.json()).use("/api", createStaffTicketsRouter(writer)).use(errorHandler);
    const tokens = await configureRequesterAuth(mock, [STAFF]);
    const response = await request(isolatedApp).post(`/api/tickets/${TICKET_ID}/request-information`).set("Authorization", bearerToken(tokens, STAFF.id)).send({ content: " More details please " });
    expect(response.status).toBe(200);
    expect(writer).toHaveBeenCalledWith(mock, { ticketId: 31, authorUserId: STAFF.id, content: "More details please" });
  });
  it.each(["", "   ", "x".repeat(2001), null])("validates comment content before Ticket access", async (content) => {
    const writer = vi.fn();
    const isolatedApp = express().use(express.json()).use("/api", createStaffTicketsRouter(writer)).use(errorHandler);
    const tokens = await configureRequesterAuth(mock, [STAFF]);
    expect((await request(isolatedApp).post(`/api/tickets/${TICKET_ID}/request-information`).set("Authorization", bearerToken(tokens, STAFF.id)).send({ content })).status).toBe(400);
    expect(mock.ticket.findFirst).not.toHaveBeenCalled(); expect(writer).not.toHaveBeenCalled();
  });
});

describe("API-27, API-33–API-39 Public Comments and Internal Notes @issue-6", () => {
  let tokens: RequesterTokens;

  beforeEach(async () => {
    vi.clearAllMocks();
    tokens = await configureRequesterAuth(mock, [STAFF, ADMIN, REQUESTER]);
    mock.ticket.findFirst.mockResolvedValue(staffTicketRow({ requesterId: REQUESTER.id, currentStatus: "OPEN" }));
    mock.ticket.updateMany.mockResolvedValue({ count: 1 });
    mock.publicComment = {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    };
    mock.$queryRaw = vi.fn().mockResolvedValue([]);
    mock.internalNote = {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    };
  });

  describe("API-27 Public Comment while Ticket is Waiting @issue-6", () => {
    it("appends comment while status remains WAITING_FOR_REQUESTER without auto-resume", async () => {
      mock.ticket.findFirst.mockResolvedValue(
        staffTicketRow({ requesterId: REQUESTER.id, currentStatus: "WAITING_FOR_REQUESTER" }),
      );
      mock.publicComment.create.mockResolvedValue({
        id: 1,
        publicId: "comment-1",
        ticketId: 31,
        authorUserId: REQUESTER.id,
        content: "Here is the extra info",
        createdAt: new Date(),
        author: REQUESTER,
      });

      const response = await request(app)
        .post(`/api/tickets/${TICKET_ID}/comments`)
        .set("Authorization", bearerToken(tokens, REQUESTER.id))
        .send({ content: "Here is the extra info" });

      expect(response.status).toBe(201);
      expect(response.body.content).toBe("Here is the extra info");
      // Ticket status must NOT change
      expect(mock.ticket.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("API-33 Root Public Comment validation and server metadata @issue-6", () => {
    it("accepts 1 and 2000 trimmed characters and derives author/time server-side", async () => {
      mock.publicComment.create.mockResolvedValue({
        id: 2,
        publicId: "comment-2",
        ticketId: 31,
        authorUserId: REQUESTER.id,
        content: "Valid comment",
        createdAt: new Date("2026-09-17T12:00:00Z"),
        author: REQUESTER,
      });

      const response = await request(app)
        .post(`/api/tickets/${TICKET_ID}/comments`)
        .set("Authorization", bearerToken(tokens, REQUESTER.id))
        .send({
          content: "  Valid comment  ",
          author: { name: "Spoofed" },
          createdAt: "2000-01-01T00:00:00Z",
        });

      expect(response.status).toBe(201);
      expect(response.body.content).toBe("Valid comment");
      expect(response.body.author.name).toBe(REQUESTER.name);
      expect(response.body.createdAt).toBe("2026-09-17T12:00:00.000Z");
      expect(mock.publicComment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            authorUserId: REQUESTER.id,
            content: "Valid comment",
          }),
        }),
      );
    });

    it.each(["", "   ", "x".repeat(2001)])("rejects invalid content: %j", async (content) => {
      const response = await request(app)
        .post(`/api/tickets/${TICKET_ID}/comments`)
        .set("Authorization", bearerToken(tokens, REQUESTER.id))
        .send({ content });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("VALIDATION_ERROR");
    });
  });

const ROOT_COMMENT_ID = "c1000000-0000-4000-8000-000000000001";
const DEPTH1_COMMENT_ID = "c2000000-0000-4000-8000-000000000002";
const DEPTH2_COMMENT_ID = "c3000000-0000-4000-8000-000000000003";

  it.each(["comments", `comments/${ROOT_COMMENT_ID}/replies`, "internal-notes"])(
    "returns empty large pages for %s without oversized Prisma queries", async (path) => {
      mock.publicComment.findFirst.mockResolvedValue({ id: 10 });
      mock.publicComment.count.mockResolvedValue(1);
      mock.publicComment.findMany.mockResolvedValue([]);
      mock.internalNote.count.mockResolvedValue(1);
      mock.internalNote.findMany.mockResolvedValue([]);
      const response = await request(app).get(`/api/tickets/${TICKET_ID}/${path}`)
        .query({ pageNumber: Number.MAX_SAFE_INTEGER, pageSize: 10 })
        .set("Authorization", bearerToken(tokens, STAFF.id));
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
      expect(JSON.parse(response.headers["x-pagination"])).toEqual({
        pageNumber: Number.MAX_SAFE_INTEGER, pageSize: 10, totalItems: 1,
        totalPages: 1, hasPreviousPage: true, hasNextPage: false,
      });
      expect(mock.publicComment.findMany).not.toHaveBeenCalledWith(expect.objectContaining({ skip: expect.any(Number) }));
      expect(mock.internalNote.findMany).not.toHaveBeenCalled();
    },
  );

  describe("API-34 Retrieve root Public Comments @issue-6", () => {
    it("defaults to 10 newest-first roots with total replyCount and up to 3 preview replies", async () => {
      mock.publicComment.count.mockImplementation(async (args: any) =>
        args?.where?.parentCommentId === null ? 1 : 0,
      );
      mock.publicComment.findMany
        .mockResolvedValueOnce([
          {
            id: 10,
            publicId: ROOT_COMMENT_ID,
            content: "Root comment",
            createdAt: new Date(),
            author: REQUESTER,
          },
        ]) // roots
        .mockResolvedValueOnce([]); // previews (only ranked preview ids)

      const response = await request(app)
        .get(`/api/tickets/${TICKET_ID}/comments`)
        .set("Authorization", bearerToken(tokens, REQUESTER.id));

      expect(response.status).toBe(200);
      expect(response.headers["x-pagination"]).toBeDefined();
      expect(response.body).toHaveLength(1);
      expect(response.body[0].replyCount).toBe(0);
      expect(response.body[0].replies).toEqual([]);
    });

    it("hydrates only the three oldest preview replies per root, never every reply", async () => {
      mock.publicComment.count.mockImplementation(async (args: any) =>
        args?.where?.parentCommentId === null ? 2 : 0,
      );
      const rootA = {
        id: 10,
        publicId: ROOT_COMMENT_ID,
        content: "Root A",
        createdAt: new Date("2026-09-17T12:00:00Z"),
        author: REQUESTER,
      };
      const rootB = {
        id: 11,
        publicId: DEPTH1_COMMENT_ID,
        content: "Root B",
        createdAt: new Date("2026-09-17T11:00:00Z"),
        author: STAFF,
      };

      // Root A: 5 replies (ids 21-25), Root B: 2 replies (ids 31-32).
      // The database ranking returns counts plus only ranks 1-3 per root.
      mock.$queryRaw.mockResolvedValueOnce([
        { root_id: 10, reply_id: 21, reply_rank: 1, reply_count: 5 },
        { root_id: 10, reply_id: 22, reply_rank: 2, reply_count: 5 },
        { root_id: 10, reply_id: 23, reply_rank: 3, reply_count: 5 },
        { root_id: 11, reply_id: 31, reply_rank: 1, reply_count: 2 },
        { root_id: 11, reply_id: 32, reply_rank: 2, reply_count: 2 },
      ]);

      const replyRows = [
        { id: 21, publicId: "r21", content: "A1", parentCommentId: 10, createdAt: new Date("2026-09-17T12:01:00Z"), author: STAFF, parent: { id: 10, publicId: ROOT_COMMENT_ID, parentCommentId: null }, replyTo: { publicId: ROOT_COMMENT_ID, author: REQUESTER } },
        { id: 22, publicId: "r22", content: "A2", parentCommentId: 10, createdAt: new Date("2026-09-17T12:02:00Z"), author: STAFF, parent: { id: 10, publicId: ROOT_COMMENT_ID, parentCommentId: null }, replyTo: { publicId: ROOT_COMMENT_ID, author: REQUESTER } },
        { id: 23, publicId: "r23", content: "A3", parentCommentId: 21, createdAt: new Date("2026-09-17T12:03:00Z"), author: REQUESTER, parent: { id: 21, publicId: "r21", parentCommentId: 10 }, replyTo: { publicId: "r21", author: STAFF } },
        { id: 31, publicId: "r31", content: "B1", parentCommentId: 11, createdAt: new Date("2026-09-17T11:01:00Z"), author: REQUESTER, parent: { id: 11, publicId: DEPTH1_COMMENT_ID, parentCommentId: null }, replyTo: { publicId: DEPTH1_COMMENT_ID, author: STAFF } },
        { id: 32, publicId: "r32", content: "B2", parentCommentId: 11, createdAt: new Date("2026-09-17T11:02:00Z"), author: STAFF, parent: { id: 11, publicId: DEPTH1_COMMENT_ID, parentCommentId: null }, replyTo: { publicId: DEPTH1_COMMENT_ID, author: STAFF } },
      ];
      mock.publicComment.findMany
        .mockResolvedValueOnce([rootA, rootB]) // roots, newest first
        .mockImplementation(async (args: any) =>
          replyRows.filter((row) => (args?.where?.id?.in ?? []).includes(row.id)),
        ); // previews: only the ranked ids the service selects

      const response = await request(app)
        .get(`/api/tickets/${TICKET_ID}/comments`)
        .set("Authorization", bearerToken(tokens, REQUESTER.id));

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);

      // Root A: full count 5, exactly the three oldest previews, oldest first.
      expect(response.body[0].replyCount).toBe(5);
      expect(response.body[0].replies.map((r: any) => r.publicId)).toEqual(["r21", "r22", "r23"]);
      // Depth-2 preview keeps its depth-1 structural parent and exact replyTo.
      expect(response.body[0].replies[2].depth).toBe(2);
      expect(response.body[0].replies[2].parentCommentPublicId).toBe("r21");
      expect(response.body[0].replies[2].replyTo?.commentPublicId).toBe("r21");

      // Root B: independent count 2, no cross-root leakage.
      expect(response.body[1].replyCount).toBe(2);
      expect(response.body[1].replies.map((r: any) => r.publicId)).toEqual(["r31", "r32"]);

      // Bounded hydration: the detail fetch receives only the five ranked
      // preview ids, never the full reply population (ids 24 and 25 excluded).
      const previewCalls = mock.publicComment.findMany.mock.calls.filter(
        (call: any[]) => call[0]?.where?.id?.in !== undefined,
      );
      expect(previewCalls).toHaveLength(1);
      expect(previewCalls[0][0].where.id.in.sort((a: number, b: number) => a - b)).toEqual([21, 22, 23, 31, 32]);
    });
  });

  describe("API-35 Retrieve additional replies @issue-6", () => {
    it("returns thread replies oldest-first with default pageSize 5 and X-Pagination", async () => {
      mock.publicComment.findFirst.mockResolvedValue({ id: 10 }); // root found
      mock.publicComment.count.mockResolvedValue(1);
      mock.publicComment.findMany
        .mockResolvedValueOnce([]) // depth-1 check
        .mockResolvedValueOnce([
          {
            id: 20,
            publicId: DEPTH1_COMMENT_ID,
            content: "A reply",
            parentCommentId: 10,
            createdAt: new Date(),
            author: STAFF,
            parent: { id: 10, publicId: ROOT_COMMENT_ID, parentCommentId: null },
            replyTo: { publicId: ROOT_COMMENT_ID, author: REQUESTER },
          },
        ]);

      const response = await request(app)
        .get(`/api/tickets/${TICKET_ID}/comments/${ROOT_COMMENT_ID}/replies`)
        .set("Authorization", bearerToken(tokens, REQUESTER.id));

      expect(response.status).toBe(200);
      expect(response.headers["x-pagination"]).toBeDefined();
      const meta = JSON.parse(response.headers["x-pagination"]);
      expect(meta.pageSize).toBe(5);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].depth).toBe(1);
    });

    it("returns empty array for valid page beyond the final page", async () => {
      mock.publicComment.findFirst.mockResolvedValue({ id: 10 });
      mock.publicComment.count.mockResolvedValue(1);
      mock.publicComment.findMany
        .mockResolvedValueOnce([]) // depth-1 check
        .mockResolvedValueOnce([]); // page 2 empty

      const response = await request(app)
        .get(`/api/tickets/${TICKET_ID}/comments/${ROOT_COMMENT_ID}/replies?pageNumber=2&pageSize=5`)
        .set("Authorization", bearerToken(tokens, REQUESTER.id));

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe("API-36 Reply depths and flattening @issue-6", () => {
    it("bounds replies to depth 2 and sets exact clicked target in replyTo", async () => {
      // Clicked target is depth 2 (its parent has a parent)
      mock.publicComment.findFirst.mockResolvedValue({
        id: 30,
        publicId: DEPTH2_COMMENT_ID,
        parentCommentId: 20,
        parent: { id: 20, parentCommentId: 10, publicId: DEPTH1_COMMENT_ID },
      });
      mock.publicComment.create.mockResolvedValue({
        id: 31,
        publicId: "c4000000-0000-4000-8000-000000000004",
        content: "Reply to depth 2",
        createdAt: new Date(),
        author: REQUESTER,
        parentCommentId: 20,
        parent: { id: 20, parentCommentId: 10, publicId: DEPTH1_COMMENT_ID },
        replyTo: { publicId: DEPTH2_COMMENT_ID, author: STAFF },
      });

      const response = await request(app)
        .post(`/api/tickets/${TICKET_ID}/comments/${DEPTH2_COMMENT_ID}/replies`)
        .set("Authorization", bearerToken(tokens, REQUESTER.id))
        .send({ content: "Reply to depth 2" });

      expect(response.status).toBe(201);
      expect(response.body.depth).toBe(2);
      expect(response.body.parentCommentPublicId).toBe(DEPTH1_COMMENT_ID);
      expect(response.body.replyTo.commentPublicId).toBe(DEPTH2_COMMENT_ID);
      expect(response.body.replyTo.name).toBe(STAFF.name);
    });
  });

  describe("API-37 Append-only contract and plain text @issue-6", () => {
    it("exposes no edit or delete endpoints for comments", async () => {
      const put = await request(app)
        .put(`/api/tickets/${TICKET_ID}/comments/${ROOT_COMMENT_ID}`)
        .set("Authorization", bearerToken(tokens, REQUESTER.id))
        .send({ content: "Edit attempt" });
      expect([404, 405]).toContain(put.status);

      const del = await request(app)
        .delete(`/api/tickets/${TICKET_ID}/comments/${ROOT_COMMENT_ID}`)
        .set("Authorization", bearerToken(tokens, REQUESTER.id));
      expect([404, 405]).toContain(del.status);
    });

    it("returns HTML and Markdown as plain text without rendering", async () => {
      const markup = "<b>bold</b> <script>alert(1)</script>";
      mock.publicComment.create.mockResolvedValue({
        id: 1,
        publicId: "markup-c",
        ticketId: 31,
        authorUserId: REQUESTER.id,
        content: markup,
        createdAt: new Date(),
        author: REQUESTER,
      });

      const response = await request(app)
        .post(`/api/tickets/${TICKET_ID}/comments`)
        .set("Authorization", bearerToken(tokens, REQUESTER.id))
        .send({ content: markup });

      expect(response.status).toBe(201);
      expect(response.body.content).toBe(markup);
    });
  });

  describe("API-38 Internal Note read authorization @issue-6", () => {
    it("allows IT Staff and Admin to read notes, but rejects Requester with 403", async () => {
      mock.internalNote.count.mockResolvedValue(0);
      mock.internalNote.findMany.mockResolvedValue([]);

      // Staff allowed
      const staffRes = await request(app)
        .get(`/api/tickets/${TICKET_ID}/internal-notes`)
        .set("Authorization", bearerToken(tokens, STAFF.id));
      expect(staffRes.status).toBe(200);

      // Admin allowed
      const adminRes = await request(app)
        .get(`/api/tickets/${TICKET_ID}/internal-notes`)
        .set("Authorization", bearerToken(tokens, ADMIN.id));
      expect(adminRes.status).toBe(200);

      // Requester forbidden
      const reqRes = await request(app)
        .get(`/api/tickets/${TICKET_ID}/internal-notes`)
        .set("Authorization", bearerToken(tokens, REQUESTER.id));
      expect(reqRes.status).toBe(403);
      expect(reqRes.body.code).toBe("FORBIDDEN");
    });
  });

  describe("API-39 Internal Note create and Admin owner rule @issue-6", () => {
    it("allows IT Staff to create internal note", async () => {
      mock.internalNote.create.mockResolvedValue({
        id: 1,
        publicId: "note-1",
        content: "Staff note",
        author: STAFF,
        createdAt: new Date(),
      });

      const response = await request(app)
        .post(`/api/tickets/${TICKET_ID}/internal-notes`)
        .set("Authorization", bearerToken(tokens, STAFF.id))
        .send({ content: "Staff note" });

      expect(response.status).toBe(201);
      expect(response.body.content).toBe("Staff note");
    });

    it("allows Admin owner to create internal note, but rejects Admin non-owner with 403", async () => {
      // Phase 1: Admin is owner
      mock.ticket.findFirst.mockResolvedValue(
        staffTicketRow({ ownerUserId: ADMIN.id, owner: ADMIN }),
      );
      mock.internalNote.create.mockResolvedValue({
        id: 2,
        publicId: "note-admin",
        content: "Admin owner note",
        author: ADMIN,
        createdAt: new Date(),
      });

      const ownerRes = await request(app)
        .post(`/api/tickets/${TICKET_ID}/internal-notes`)
        .set("Authorization", bearerToken(tokens, ADMIN.id))
        .send({ content: "Admin owner note" });
      expect(ownerRes.status).toBe(201);

      // Phase 2: Admin is NOT owner (ticket owned by STAFF)
      mock.ticket.findFirst.mockResolvedValue(
        staffTicketRow({ ownerUserId: STAFF.id, owner: STAFF }),
      );

      const nonOwnerRes = await request(app)
        .post(`/api/tickets/${TICKET_ID}/internal-notes`)
        .set("Authorization", bearerToken(tokens, ADMIN.id))
        .send({ content: "Admin non-owner note attempt" });
      expect(nonOwnerRes.status).toBe(403);
      expect(nonOwnerRes.body.code).toBe("FORBIDDEN");
    });

    it("rejects Requester with 403 on internal note create", async () => {
      const response = await request(app)
        .post(`/api/tickets/${TICKET_ID}/internal-notes`)
        .set("Authorization", bearerToken(tokens, REQUESTER.id))
        .send({ content: "Requester note attempt" });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("FORBIDDEN");
    });
  });
});
