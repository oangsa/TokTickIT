import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import {
  ALICE,
  ALICE_AUTH,
  BOB_AUTH,
  KEY,
  VALID_BODY,
  arrangeHappyPath,
  prismaMock,
  ticketRow,
  tx,
} from "../lab-02/support/ticketPrismaMock.js";
import {
  bearerToken,
  configureRequesterAuth,
  type RequesterTokens,
} from "../lab-02/support/authenticatedRequester.js";

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => prismaMock }));

import { app } from "../../src/app.js";

const PUBLIC_ID = "05a214b4-b957-4ed7-a58e-73f4392b35ec";
const OTHER_PUBLIC_ID = "9f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f";

let tokens: RequesterTokens;

function auth(userId = ALICE_AUTH.id): string {
  return bearerToken(tokens, userId);
}

function ticketDto(overrides: Record<string, unknown> = {}) {
  return ticketRow({
    requester: {
      id: ALICE.id,
      publicId: ALICE_AUTH.publicId,
      name: ALICE.name,
      email: ALICE.email,
    },
    owner: null,
    itPriority: "HIGH",
    requesterResolutionConfirmedAt: null,
    ...overrides,
  });
}

beforeEach(async () => {
  arrangeHappyPath();
  tokens = await configureRequesterAuth(prismaMock, [ALICE_AUTH, BOB_AUTH]);
  prismaMock.ticket.findUnique.mockResolvedValue(ticketDto());
  prismaMock.ticket.findFirst.mockResolvedValue(ticketDto());
  tx.ticket.findFirst.mockResolvedValue({
    id: 42,
    currentStatus: "OPEN",
    requesterResolutionConfirmedAt: null,
  });
  tx.ticket.findUnique.mockResolvedValue(ticketDto());
  tx.ticket.updateMany.mockResolvedValue({ count: 1 });
});

describe("authenticated Requester Ticket API @issue-4", () => {
  it("API-16 reads only the authenticated User-owned Ticket and returns full DTO @issue-4", async () => {
    const response = await request(app)
      .get(`/api/users/me/tickets/${PUBLIC_ID}`)
      .set("Authorization", auth());

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      publicId: PUBLIC_ID,
      requesterPublicId: ALICE_AUTH.publicId,
      requesterName: ALICE.name,
      itPriority: "HIGH",
      owner: null,
      requesterResolutionConfirmedAt: null,
    });
    expect(prismaMock.ticket.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { publicId: PUBLIC_ID, requesterId: ALICE_AUTH.id, deleted: false },
    }));
  });

  it("API-15 gives cross-owner and missing Tickets the same safe 404 @issue-4", async () => {
    prismaMock.ticket.findFirst.mockResolvedValue(null);

    const crossOwner = await request(app)
      .get(`/api/users/me/tickets/${OTHER_PUBLIC_ID}`)
      .set("Authorization", auth());
    const missing = await request(app)
      .get(`/api/users/me/tickets/${PUBLIC_ID}`)
      .set("Authorization", auth());

    expect(crossOwner.status).toBe(404);
    expect(crossOwner.text).toBe(missing.text);
    expect(crossOwner.body).toEqual(expect.objectContaining({ code: "NOT_FOUND" }));
  });

  it("API-14 ignores client-owned Ticket fields and keeps authenticated ownership @issue-4", async () => {
    const response = await request(app)
      .post("/api/users/me/tickets")
      .set("Authorization", auth())
      .set("Idempotency-Key", KEY)
      .send({ ...VALID_BODY, requesterId: BOB_AUTH.id, createdBy: "attacker@example.test" });

    expect(response.status).toBe(201);
    expect(tx.ticket.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        requesterId: ALICE_AUTH.id,
        createdBy: ALICE_AUTH.email,
      }),
    }));
  });

  it("API-31 exposes requester Cancel/Looks Resolved/Reopen routes with authenticated ownership @issue-4", async () => {
    const cancel = await request(app)
      .post(`/api/users/me/tickets/${PUBLIC_ID}/cancel`)
      .set("Authorization", auth());
    expect(cancel.status).toBe(200);
    expect(tx.ticket.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ currentStatus: "CANCELLED", updatedBy: ALICE_AUTH.email }),
    }));

    tx.ticket.findFirst.mockResolvedValue({ id: 42, currentStatus: "RESOLVED", requesterResolutionConfirmedAt: null });
    tx.ticket.findUnique.mockResolvedValue(ticketDto({ currentStatus: "RESOLVED", requesterResolutionConfirmedAt: new Date() }));
    const looksResolved = await request(app)
      .post(`/api/users/me/tickets/${PUBLIC_ID}/looks-resolved`)
      .set("Authorization", auth());
    expect(looksResolved.status).toBe(200);
    expect(tx.ticket.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({ currentStatus: expect.anything() }),
    }));

    tx.ticket.findFirst.mockResolvedValue({ id: 42, currentStatus: "CLOSED", requesterResolutionConfirmedAt: new Date() });
    tx.ticket.findUnique.mockResolvedValue(ticketDto({ currentStatus: "REOPENED", owner: null, requesterResolutionConfirmedAt: null }));
    const reopen = await request(app)
      .post(`/api/users/me/tickets/${PUBLIC_ID}/reopen`)
      .set("Authorization", auth());
    expect(reopen.status).toBe(200);
    expect(tx.ticket.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ currentStatus: "REOPENED", ownerUserId: null, requesterResolutionConfirmedAt: null }),
    }));
  });

  it("API-16 rejects protected Ticket calls without bearer authentication @issue-4", async () => {
    const response = await request(app).get(`/api/users/me/tickets/${PUBLIC_ID}`);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("UNAUTHENTICATED");
    expect(prismaMock.ticket.findFirst).not.toHaveBeenCalled();
  });
});
