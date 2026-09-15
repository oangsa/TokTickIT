import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import {
  ALICE,
  ALICE_AUTH,
  ATTACHMENT_A,
  prismaMock,
  attachmentRow,
  tx,
} from "../lab-02/support/ticketPrismaMock.js";
import {
  bearerToken,
  configureRequesterAuth,
  type RequesterTokens,
} from "../lab-02/support/authenticatedRequester.js";

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => prismaMock }));

import { app } from "../../src/app.js";

const TICKET_PUBLIC_ID = "05a214b4-b957-4ed7-a58e-73f4392b35ec";
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

let tokens: RequesterTokens;

function auth(): string {
  return bearerToken(tokens, ALICE_AUTH.id);
}

beforeEach(async () => {
  vi.clearAllMocks();
  tokens = await configureRequesterAuth(prismaMock, [ALICE_AUTH]);
  prismaMock.attachment.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
    attachmentRow({ ...data, createdBy: ALICE.email, updatedBy: ALICE.email }));
  prismaMock.attachment.findFirst.mockResolvedValue(attachmentRow({
    storageKey: ATTACHMENT_A,
    ticket: null,
  }));
  prismaMock.$transaction.mockImplementation(async (work: (client: typeof tx) => unknown) => work(tx));
  tx.ticket.findFirst.mockResolvedValue({ id: 42, publicId: TICKET_PUBLIC_ID });
  tx.attachment.count.mockResolvedValue(0);
  tx.attachment.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
    attachmentRow({ ...data, id: 99, ticketId: 42 }));
  tx.attachment.findMany.mockResolvedValue([attachmentRow({ storageKey: ATTACHMENT_A, ticketId: null })]);
  tx.attachment.deleteMany.mockResolvedValue({ count: 1 });
  tx.attachment.updateMany.mockResolvedValue({ count: 1 });
});

describe("authenticated Requester Attachment API @issue-4", () => {
  it("API-17 creates Pending ownership from the authenticated User @issue-4", async () => {
    const response = await request(app)
      .post("/api/users/me/attachments")
      .set("Authorization", auth())
      .attach("file", PNG, { filename: "vpn-error.png" });

    expect(response.status).toBe(201);
    expect(response.body.ticketPublicId).toBeNull();
    expect(prismaMock.attachment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ uploadedByRequesterId: ALICE_AUTH.id, ticketId: null }),
    }));
  });

  it("API-17 uses authenticated ownership for direct Ticket upload @issue-4", async () => {
    const response = await request(app)
      .post(`/api/users/me/tickets/${TICKET_PUBLIC_ID}/attachments`)
      .set("Authorization", auth())
      .attach("file", PNG, { filename: "vpn-error.png" });

    expect(response.status).toBe(201);
    expect(tx.ticket.findFirst).toHaveBeenCalledWith({
      where: { publicId: TICKET_PUBLIC_ID, requesterId: ALICE_AUTH.id, deleted: false },
      select: { id: true, publicId: true },
    });
    expect(tx.attachment.create.mock.calls[0]?.[0].data.ticketId).toBe(42);
  });

  it("API-17 keeps metadata/read and collection removal on /users/me routes @issue-4", async () => {
    const metadata = await request(app)
      .get(`/api/users/me/attachments/${ATTACHMENT_A}`)
      .set("Authorization", auth());
    expect(metadata.status).toBe(200);
    expect(prismaMock.attachment.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ storageKey: ATTACHMENT_A, OR: expect.any(Array) }),
    }));

    const removed = await request(app)
      .delete("/api/users/me/attachments/collection")
      .set("Authorization", auth())
      .send({ items: [{ attachmentId: ATTACHMENT_A }] });
    expect(removed.status).toBe(204);
    expect(tx.attachment.deleteMany).toHaveBeenCalledWith({
      where: { id: 11, ticketId: null, deleted: false },
    });
  });

  it("API-17 does not expose requester Attachment writes without authentication @issue-4", async () => {
    const response = await request(app)
      .post("/api/users/me/attachments")
      .attach("file", PNG, { filename: "vpn-error.png" });

    expect(response.status).toBe(401);
    expect(prismaMock.attachment.create).not.toHaveBeenCalled();
  });
});
