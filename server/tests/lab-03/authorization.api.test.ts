import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN, REQUESTER, STAFF, staffPrismaMock, staffTicketRow, TICKET_ID } from "./support/staffFixture.js";
import { bearerToken, configureRequesterAuth, type RequesterTokens } from "../lab-02/support/authenticatedRequester.js";

const { mock } = staffPrismaMock();
vi.mock("../../src/prisma.js", () => ({ getPrisma: () => mock }));

import { app } from "../../src/app.js";

describe("authorization transport @issue-2", () => {
  it("API-12 rejects protected routes without a bearer token @issue-2", async () => {
    const response = await request(app).get("/api/categories");
    expect(response.status).toBe(401);
    expect(response.body.code).toBe("UNAUTHENTICATED");
  });

  it("API-12 does not accept the removed requester selector as authentication @issue-2", async () => {
    const response = await request(app).get("/api/categories").set("X-Requester-Id", "1");
    expect(response.status).toBe(401);
    expect(response.body.code).toBe("UNAUTHENTICATED");
  });
});

describe("API-22 and API-23 Ticket authorization matrix @issue-5", () => {
  let tokens: RequesterTokens;
  const path = `/api/tickets/${TICKET_ID}`;

  beforeEach(async () => {
    vi.clearAllMocks();
    tokens = await configureRequesterAuth(mock, [STAFF, ADMIN, REQUESTER]);
    mock.ticket.findFirst.mockResolvedValue(staffTicketRow());
    mock.ticket.findUnique.mockResolvedValue(staffTicketRow());
    mock.ticket.updateMany.mockResolvedValue({ count: 1 });
    mock.user.findFirst.mockResolvedValue(STAFF);
  });

  it("API-22 rejects owner-only actions for non-owner IT Staff while reads and reassignment work @issue-5", async () => {
    // Ticket is owned by ADMIN, so STAFF is a non-owner IT Staff
    mock.ticket.findFirst.mockResolvedValue(staffTicketRow({ currentStatus: "OPEN", ownerUserId: ADMIN.id, owner: ADMIN }));

    const ownerOnlyActions = ["start-work", "request-information", "resume-work", "mark-resolved", "close"] as const;
    for (const action of ownerOnlyActions) {
      const response = await request(app)
        .post(`${path}/${action}`)
        .set("Authorization", bearerToken(tokens, STAFF.id))
        .send({ content: "Need details" });
      expect(response.status).toBe(403);
      expect(response.body.code).toBe("FORBIDDEN");
    }
    expect(mock.ticket.updateMany).not.toHaveBeenCalled();

    // Read, reassignment, and cancel remain permitted to non-owner IT Staff
    expect((await request(app).get(path).set("Authorization", bearerToken(tokens, STAFF.id))).status).toBe(200);
    expect((await request(app).patch(`${path}/owner`).set("Authorization", bearerToken(tokens, STAFF.id)).send({ ownerPublicId: STAFF.publicId, expectedOwnerPublicId: ADMIN.publicId })).status).toBe(200);
    expect((await request(app).patch(`${path}/it-priority`).set("Authorization", bearerToken(tokens, STAFF.id)).send({ itPriority: "LOW" })).status).toBe(200);
    expect((await request(app).post(`${path}/cancel`).set("Authorization", bearerToken(tokens, STAFF.id))).status).toBe(200);
  });

  it("API-23 enforces Administrator Ticket operation matrix before and after explicit owner assignment @issue-5", async () => {
    // Phase 1: Administrator is NOT the owner
    mock.ticket.findFirst.mockResolvedValue(staffTicketRow({ currentStatus: "OPEN", ownerUserId: STAFF.id, owner: STAFF }));

    // Read is permitted to Admin non-owner
    expect((await request(app).get(path).set("Authorization", bearerToken(tokens, ADMIN.id))).status).toBe(200);

    // All mutations are forbidden to Admin non-owner
    expect((await request(app).post(`${path}/claim`).set("Authorization", bearerToken(tokens, ADMIN.id))).status).toBe(403);
    expect((await request(app).patch(`${path}/owner`).set("Authorization", bearerToken(tokens, ADMIN.id)).send({ ownerPublicId: ADMIN.publicId, expectedOwnerPublicId: STAFF.publicId })).status).toBe(403);
    expect((await request(app).patch(`${path}/it-priority`).set("Authorization", bearerToken(tokens, ADMIN.id)).send({ itPriority: "LOW" })).status).toBe(403);

    for (const action of ["start-work", "request-information", "resume-work", "mark-resolved", "close", "cancel"] as const) {
      const response = await request(app)
        .post(`${path}/${action}`)
        .set("Authorization", bearerToken(tokens, ADMIN.id))
        .send({ content: "Need details" });
      expect(response.status).toBe(403);
      expect(response.body.code).toBe("FORBIDDEN");
    }
    expect(mock.ticket.updateMany).not.toHaveBeenCalled();

    // Phase 2: Administrator IS the explicit assigned owner
    mock.ticket.findFirst.mockResolvedValue(staffTicketRow({ currentStatus: "OPEN", ownerUserId: ADMIN.id, owner: ADMIN }));

    // Claim remains forbidden to Administrator even when assigned
    expect((await request(app).post(`${path}/claim`).set("Authorization", bearerToken(tokens, ADMIN.id))).status).toBe(403);

    // Reassign/unassign permitted
    expect((await request(app).patch(`${path}/owner`).set("Authorization", bearerToken(tokens, ADMIN.id)).send({ ownerPublicId: STAFF.publicId, expectedOwnerPublicId: ADMIN.publicId })).status).toBe(200);

    // IT Priority edit permitted
    expect((await request(app).patch(`${path}/it-priority`).set("Authorization", bearerToken(tokens, ADMIN.id)).send({ itPriority: "LOW" })).status).toBe(200);

    // Approved owner lifecycle action permitted (start-work from OPEN)
    expect((await request(app).post(`${path}/start-work`).set("Authorization", bearerToken(tokens, ADMIN.id))).status).toBe(200);

    // Cancel permitted
    expect((await request(app).post(`${path}/cancel`).set("Authorization", bearerToken(tokens, ADMIN.id))).status).toBe(200);
  });
});
