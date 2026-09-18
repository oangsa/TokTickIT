import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN, REQUESTER, STAFF, staffPrismaMock } from "./support/staffFixture.js";
import { bearerToken, configureRequesterAuth, type RequesterTokens } from "../lab-02/support/authenticatedRequester.js";

const { mock } = staffPrismaMock();
vi.mock("../../src/prisma.js", () => ({ getPrisma: () => mock }));

import { app } from "../../src/app.js";

const OTHER_ADMIN = {
  id: 25,
  publicId: "25000000-0000-4000-8000-000000000025",
  name: "Other Admin",
  email: "otheradmin@example.test",
  role: "ADMINISTRATOR" as const,
  isActive: true,
  deleted: false,
  mustChangePassword: false,
  createdAt: new Date("2026-09-17T10:00:00Z"),
  updatedAt: new Date("2026-09-17T10:00:00Z"),
};

describe("API-46–API-53 Administrator User APIs @issue-6", () => {
  let tokens: RequesterTokens;

  beforeEach(async () => {
    vi.clearAllMocks();
    tokens = await configureRequesterAuth(mock, [ADMIN, STAFF, REQUESTER]);
    mock.user.findFirst.mockResolvedValue(STAFF);
    mock.user.findMany.mockResolvedValue([STAFF]);
    mock.user.count.mockResolvedValue(1);
    mock.userSession.updateMany.mockResolvedValue({ count: 1 });
    mock.ticket.updateMany.mockResolvedValue({ count: 1 });
  });

  describe("API-46 User collection queries and validation @issue-6", () => {
    it("returns safe User list DTO fields with default name-first order and X-Pagination", async () => {
      mock.user.count.mockResolvedValue(1);
      mock.user.findMany.mockResolvedValue([
        {
          publicId: STAFF.publicId,
          name: STAFF.name,
          email: STAFF.email,
          role: STAFF.role,
          isActive: true,
        },
      ]);

      const response = await request(app)
        .get("/api/admin/users")
        .set("Authorization", bearerToken(tokens, ADMIN.id));

      expect(response.status).toBe(200);
      expect(response.headers["x-pagination"]).toBeDefined();
      expect(response.body).toHaveLength(1);
      const item = response.body[0];
      expect(item).toEqual({
        publicId: STAFF.publicId,
        name: STAFF.name,
        email: STAFF.email,
        role: STAFF.role,
        isActive: true,
      });
      expect(item.id).toBeUndefined();
      expect(item.passwordHash).toBeUndefined();
      expect(item.createdAt).toBeUndefined();
    });

    it("returns empty large pages without an oversized Prisma query", async () => {
      const response = await request(app).get("/api/admin/users")
        .query({ pageNumber: Number.MAX_SAFE_INTEGER })
        .set("Authorization", bearerToken(tokens, ADMIN.id));
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
      expect(JSON.parse(response.headers["x-pagination"])).toEqual({
        pageNumber: Number.MAX_SAFE_INTEGER, pageSize: 10, totalItems: 1,
        totalPages: 1, hasPreviousPage: true, hasNextPage: false,
      });
      expect(mock.user.findMany).not.toHaveBeenCalled();
    });

    it.each(["IT_STAFF", "ADMINISTRATOR"])("rejects duplicate role filters including %s", async (role) => {
      const response = await request(app).get("/api/admin/users")
        .query({ filters: JSON.stringify([
          { field: "role", condition: "EQUAL", value: "IT_STAFF" },
          { field: "role", condition: "EQUAL", value: role },
        ]) })
        .set("Authorization", bearerToken(tokens, ADMIN.id));
      expect(response.status).toBe(400);
      expect(response.body.code).toBe("VALIDATION_ERROR");
      expect(mock.user.count).not.toHaveBeenCalled();
      expect(mock.user.findMany).not.toHaveBeenCalled();
    });

    it("rejects invalid search/filter/sort queries with 400 VALIDATION_ERROR before data access", async () => {
      // Unknown filter field
      const res1 = await request(app)
        .get("/api/admin/users?filters=" + encodeURIComponent(JSON.stringify([{ field: "status", condition: "EQUAL", value: "active" }])))
        .set("Authorization", bearerToken(tokens, ADMIN.id));
      expect(res1.status).toBe(400);
      expect(res1.body.code).toBe("VALIDATION_ERROR");

      // IN filter not allowed
      const res2 = await request(app)
        .get("/api/admin/users?filters=" + encodeURIComponent(JSON.stringify([{ field: "role", condition: "IN", value: ["IT_STAFF"] }])))
        .set("Authorization", bearerToken(tokens, ADMIN.id));
      expect(res2.status).toBe(400);

      // Search without searchFields
      const res3 = await request(app)
        .get("/api/admin/users?search=test")
        .set("Authorization", bearerToken(tokens, ADMIN.id));
      expect(res3.status).toBe(400);

      // Unsupported sort field
      const res4 = await request(app)
        .get("/api/admin/users?sort=createdAt:desc")
        .set("Authorization", bearerToken(tokens, ADMIN.id));
      expect(res4.status).toBe(400);

      // Unknown query param
      const res5 = await request(app)
        .get("/api/admin/users?unknown=param")
        .set("Authorization", bearerToken(tokens, ADMIN.id));
      expect(res5.status).toBe(400);

      expect(mock.user.findMany).not.toHaveBeenCalled();
    });
  });

  describe("API-47 Create User @issue-6", () => {
    it("creates user with default isActive=true, mustChangePassword=true, returning 16-char password once", async () => {
      mock.user.findFirst.mockResolvedValue(null); // no duplicate
      mock.user.create.mockResolvedValue({
        id: 99,
        publicId: "99000000-0000-4000-8000-000000000099",
        name: "Clara Requester",
        email: "clara@example.test",
        role: "REQUESTER",
        isActive: true,
        mustChangePassword: true,
        createdAt: new Date("2026-09-17T12:00:00Z"),
        updatedAt: new Date("2026-09-17T12:00:00Z"),
      });

      const response = await request(app)
        .post("/api/admin/users")
        .set("Authorization", bearerToken(tokens, ADMIN.id))
        .send({
          name: "Clara Requester",
          email: "clara@example.test",
          role: "REQUESTER",
        });

      expect(response.status).toBe(201);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.publicId).toBe("99000000-0000-4000-8000-000000000099");
      expect(response.body.user.mustChangePassword).toBe(true);
      expect(response.body.user.isActive).toBe(true);
      expect(response.body.user.id).toBeUndefined();
      expect(response.body.user.passwordHash).toBeUndefined();
      expect(response.body.initialPassword).toHaveLength(16);
    });
  });

  describe("API-48 Duplicate User email rejection @issue-6", () => {
    it("rejects duplicate email case-insensitively with 409 DUPLICATE_EMAIL", async () => {
      mock.user.findFirst.mockResolvedValue({ id: 11 }); // existing email

      const response = await request(app)
        .post("/api/admin/users")
        .set("Authorization", bearerToken(tokens, ADMIN.id))
        .send({
          name: "Duplicate User",
          email: "STAFF@example.test",
          role: "IT_STAFF",
        });

      expect(response.status).toBe(409);
      expect(response.body.code).toBe("DUPLICATE_EMAIL");
    });
  });

  describe("API-49 Edit User side effects @issue-6", () => {
    it("name-only edit does not revoke sessions or unassign tickets", async () => {
      mock.user.findFirst.mockResolvedValue(STAFF);
      mock.user.update.mockResolvedValue({ ...STAFF, name: "New Name" });

      const response = await request(app)
        .patch(`/api/admin/users/${STAFF.publicId}`)
        .set("Authorization", bearerToken(tokens, ADMIN.id))
        .send({ name: "New Name" });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe("New Name");
      expect(mock.userSession.updateMany).not.toHaveBeenCalled();
      expect(mock.ticket.updateMany).not.toHaveBeenCalled();
    });

    it("email change revokes target sessions", async () => {
      mock.user.findFirst
        .mockResolvedValueOnce(STAFF)
        .mockResolvedValueOnce(null); // no dup
      mock.user.update.mockResolvedValue({ ...STAFF, email: "newstaff@example.test" });

      const response = await request(app)
        .patch(`/api/admin/users/${STAFF.publicId}`)
        .set("Authorization", bearerToken(tokens, ADMIN.id))
        .send({ email: "newstaff@example.test" });

      expect(response.status).toBe(200);
      expect(mock.userSession.updateMany).toHaveBeenCalledWith({
        where: { userId: STAFF.id, revokedAt: null },
        data: expect.objectContaining({ revokeReason: "EMAIL_CHANGED" }),
      });
    });

    it.each([true, false])("case-only email edit revokes sessions; changed=%s", async (changed) => {
      const email = changed ? STAFF.email.toUpperCase() : STAFF.email;
      mock.user.update.mockResolvedValue({ ...STAFF, email });
      const response = await request(app).patch(`/api/admin/users/${STAFF.publicId}`)
        .set("Authorization", bearerToken(tokens, ADMIN.id)).send({ email });
      expect(response.status).toBe(200);
      expect(mock.user.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ email }),
      }));
      if (changed) {
        expect(mock.userSession.updateMany).toHaveBeenCalledWith({
          where: { userId: STAFF.id, revokedAt: null },
          data: expect.objectContaining({ revokeReason: "EMAIL_CHANGED" }),
        });
      } else {
        expect(mock.userSession.updateMany).not.toHaveBeenCalled();
      }
      expect(mock.ticket.updateMany).not.toHaveBeenCalled();
    });

    it("role change to REQUESTER revokes sessions and unassigns tickets", async () => {
      mock.user.findFirst.mockResolvedValue(STAFF);
      mock.user.update.mockResolvedValue({ ...STAFF, role: "REQUESTER" });

      const response = await request(app)
        .patch(`/api/admin/users/${STAFF.publicId}`)
        .set("Authorization", bearerToken(tokens, ADMIN.id))
        .send({ role: "REQUESTER" });

      expect(response.status).toBe(200);
      expect(mock.userSession.updateMany).toHaveBeenCalledWith({
        where: { userId: STAFF.id, revokedAt: null },
        data: expect.objectContaining({ revokeReason: "ROLE_CHANGED" }),
      });
      expect(mock.ticket.updateMany).toHaveBeenCalledWith({
        where: { ownerUserId: STAFF.id },
        data: { ownerUserId: null, updatedBy: ADMIN.email },
      });
    });

    it("deactivation revokes sessions and unassigns tickets", async () => {
      mock.user.findFirst.mockResolvedValue(STAFF);
      mock.user.update.mockResolvedValue({ ...STAFF, isActive: false });

      const response = await request(app)
        .patch(`/api/admin/users/${STAFF.publicId}`)
        .set("Authorization", bearerToken(tokens, ADMIN.id))
        .send({ isActive: false });

      expect(response.status).toBe(200);
      expect(mock.userSession.updateMany).toHaveBeenCalledWith({
        where: { userId: STAFF.id, revokedAt: null },
        data: expect.objectContaining({ revokeReason: "DEACTIVATED" }),
      });
      expect(mock.ticket.updateMany).toHaveBeenCalledWith({
        where: { ownerUserId: STAFF.id },
        data: { ownerUserId: null, updatedBy: ADMIN.email },
      });
    });
  });

  describe("API-50 Administrator self-safety @issue-6", () => {
    it("rejects self-deactivation and self-role change with conflict", async () => {
      mock.user.findFirst.mockResolvedValue(ADMIN);

      const deact = await request(app)
        .patch(`/api/admin/users/${ADMIN.publicId}`)
        .set("Authorization", bearerToken(tokens, ADMIN.id))
        .send({ isActive: false });
      expect(deact.status).toBe(409);

      const roleChange = await request(app)
        .patch(`/api/admin/users/${ADMIN.publicId}`)
        .set("Authorization", bearerToken(tokens, ADMIN.id))
        .send({ role: "IT_STAFF" });
      expect(roleChange.status).toBe(409);
    });

    it("rejects self initial-password reset with conflict", async () => {
      const reset = await request(app)
        .post(`/api/admin/users/${ADMIN.publicId}/initial-password`)
        .set("Authorization", bearerToken(tokens, ADMIN.id));
      expect(reset.status).toBe(409);
    });
  });

  describe("API-51 Last active Administrator protection @issue-6", () => {
    it("rejects deactivation or demotion of the last active Administrator", async () => {
      mock.user.findFirst.mockResolvedValue(OTHER_ADMIN);
      mock.user.count.mockResolvedValue(1); // Only 1 active Admin

      const deact = await request(app)
        .patch(`/api/admin/users/${OTHER_ADMIN.publicId}`)
        .set("Authorization", bearerToken(tokens, ADMIN.id))
        .send({ isActive: false });
      expect(deact.status).toBe(409);

      const demote = await request(app)
        .patch(`/api/admin/users/${OTHER_ADMIN.publicId}`)
        .set("Authorization", bearerToken(tokens, ADMIN.id))
        .send({ role: "REQUESTER" });
      expect(demote.status).toBe(409);
    });

    it("permits deactivating an Administrator when another active Admin exists", async () => {
      mock.user.findFirst.mockResolvedValue(OTHER_ADMIN);
      mock.user.count.mockResolvedValue(2); // 2 active Admins
      mock.user.update.mockResolvedValue({ ...OTHER_ADMIN, isActive: false });

      const response = await request(app)
        .patch(`/api/admin/users/${OTHER_ADMIN.publicId}`)
        .set("Authorization", bearerToken(tokens, ADMIN.id))
        .send({ isActive: false });
      expect(response.status).toBe(200);
      expect(response.body.isActive).toBe(false);
    });
  });

  describe("API-52 Set new initial password @issue-6", () => {
    it("returns one generated password, sets mustChangePassword=true, and revokes sessions", async () => {
      mock.user.findFirst.mockResolvedValue(STAFF);
      mock.user.update.mockResolvedValue({ ...STAFF, mustChangePassword: true });

      const response = await request(app)
        .post(`/api/admin/users/${STAFF.publicId}/initial-password`)
        .set("Authorization", bearerToken(tokens, ADMIN.id));

      expect(response.status).toBe(200);
      expect(response.body.initialPassword).toHaveLength(16);
      expect(mock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mustChangePassword: true,
            updatedBy: ADMIN.email,
          }),
        }),
      );
      expect(mock.userSession.updateMany).toHaveBeenCalledWith({
        where: { userId: STAFF.id, revokedAt: null },
        data: expect.objectContaining({ revokeReason: "INITIAL_PASSWORD_RESET" }),
      });
    });
  });

  describe("API-53 Non-Administrator access control @issue-6", () => {
    it("rejects IT Staff and Requester on all /api/admin/users endpoints with 403", async () => {
      const paths: Array<{ method: "get" | "post" | "patch"; url: string; body?: unknown }> = [
        { method: "get", url: "/api/admin/users" },
        { method: "post", url: "/api/admin/users", body: { name: "A", email: "a@b.c", role: "REQUESTER" } },
        { method: "get", url: `/api/admin/users/${STAFF.publicId}` },
        { method: "patch", url: `/api/admin/users/${STAFF.publicId}`, body: { name: "New" } },
        { method: "post", url: `/api/admin/users/${STAFF.publicId}/initial-password` },
      ];

      for (const nonAdmin of [STAFF, REQUESTER]) {
        for (const endpoint of paths) {
          const req = (request(app) as any)[endpoint.method](endpoint.url)
            .set("Authorization", bearerToken(tokens, nonAdmin.id));
          if (endpoint.body) {
            req.send(endpoint.body);
          }
          const res = await req;
          expect(res.status).toBe(403);
          expect(res.body.code).toBe("FORBIDDEN");
        }
      }
    });
  });
});
