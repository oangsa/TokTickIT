import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createInternalNote,
  getInternalNotes,
  validateNoteContent,
} from "../../src/services/internalNoteService.js";
import { actor, ADMIN, REQUESTER, STAFF, TICKET_ID } from "./support/staffFixture.js";

describe("UNIT-12 InternalNoteService @issue-6", () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      ticket: {
        findFirst: vi.fn(),
      },
      internalNote: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      $transaction: vi.fn((fn: any) => fn(mockPrisma)),
    };
  });

  describe("Validation", () => {
    it("accepts trimmed note content with 1 to 4000 Unicode code points", () => {
      expect(validateNoteContent("n")).toBe("n");
      expect(validateNoteContent("  investigating server logs  ")).toBe("investigating server logs");
      expect(validateNoteContent("x".repeat(4000))).toBe("x".repeat(4000));
      expect(validateNoteContent("🔒".repeat(4000))).toBe("🔒".repeat(4000));
    });

    it.each([
      "",
      "   ",
      "x".repeat(4001),
      "🔒".repeat(4001),
      null,
      undefined,
      {},
      [],
    ])("rejects invalid note content: %j", (invalid) => {
      expect(() => validateNoteContent(invalid)).toThrowError();
    });

    it("preserves HTML and Markdown as literal plain text", () => {
      const html = "<script>steal()</script>";
      expect(validateNoteContent(html)).toBe(html);
    });
  });

  describe("Authorization & Read/Create", () => {
    it("rejects Requester immediately with 403 on read before data access", async () => {
      await expect(
        getInternalNotes(mockPrisma, actor(REQUESTER), TICKET_ID, {}),
      ).rejects.toThrowError();
      expect(mockPrisma.ticket.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.internalNote.findMany).not.toHaveBeenCalled();
    });

    it("rejects Requester immediately with 403 on create before data access", async () => {
      await expect(
        createInternalNote(mockPrisma, actor(REQUESTER), TICKET_ID, "Secret note"),
      ).rejects.toThrowError();
      expect(mockPrisma.ticket.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.internalNote.create).not.toHaveBeenCalled();
    });

    it("allows IT Staff to read notes and returns flat list in newest-first order", async () => {
      mockPrisma.ticket.findFirst.mockResolvedValue({ id: 31 });
      mockPrisma.internalNote.count.mockResolvedValue(1);
      mockPrisma.internalNote.findMany.mockResolvedValue([
        {
          publicId: "note-1",
          content: "First note",
          author: STAFF,
          createdAt: new Date("2026-09-17T11:00:00Z"),
        },
      ]);

      const result = await getInternalNotes(mockPrisma, actor(STAFF), TICKET_ID, { pageNumber: 1, pageSize: 10 });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].content).toBe("First note");
      expect(result.pagination.totalItems).toBe(1);
      expect(mockPrisma.internalNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        }),
      );
    });

    it("allows Administrator to read notes even when not owner", async () => {
      mockPrisma.ticket.findFirst.mockResolvedValue({ id: 31 });
      mockPrisma.internalNote.count.mockResolvedValue(0);
      mockPrisma.internalNote.findMany.mockResolvedValue([]);

      const result = await getInternalNotes(mockPrisma, actor(ADMIN), TICKET_ID, {});
      expect(result.items).toEqual([]);
    });

    it("allows IT Staff to create internal note on any ticket", async () => {
      mockPrisma.ticket.findFirst.mockResolvedValue({ id: 31, ownerUserId: ADMIN.id });
      mockPrisma.internalNote.create.mockResolvedValue({
        publicId: "note-new",
        content: "Staff observation",
        createdAt: new Date("2026-09-17T12:00:00Z"),
        author: STAFF,
      });

      const res = await createInternalNote(mockPrisma, actor(STAFF), TICKET_ID, "Staff observation");
      expect(res.publicId).toBe("note-new");
      expect(res.content).toBe("Staff observation");
      expect(res.author.publicId).toBe(STAFF.publicId);
    });

    it("allows Administrator owner to create internal note", async () => {
      mockPrisma.ticket.findFirst.mockResolvedValue({ id: 31, ownerUserId: ADMIN.id });
      mockPrisma.internalNote.create.mockResolvedValue({
        publicId: "admin-note",
        content: "Admin owner note",
        createdAt: new Date("2026-09-17T12:05:00Z"),
        author: ADMIN,
      });

      const res = await createInternalNote(mockPrisma, actor(ADMIN), TICKET_ID, "Admin owner note");
      expect(res.content).toBe("Admin owner note");
    });

    it("rejects Administrator non-owner with 403 on note create", async () => {
      // Ticket owned by STAFF, not ADMIN
      mockPrisma.ticket.findFirst.mockResolvedValue({ id: 31, ownerUserId: STAFF.id });

      await expect(
        createInternalNote(mockPrisma, actor(ADMIN), TICKET_ID, "Admin note"),
      ).rejects.toThrowError();
      expect(mockPrisma.internalNote.create).not.toHaveBeenCalled();
    });
  });
});
