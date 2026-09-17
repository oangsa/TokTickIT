import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { ApiError } from "../../../src/http/errors.js";
import { createUser, updateUser } from "../../../src/services/userService.js";
import type { TicketActor } from "../../../src/services/ticketWorkflowService.js";
import {
  assertLab2TestDatabase,
  createTestPrisma,
  deployMigrations,
  resetTestSchema,
  type TestDatabaseTarget,
} from "../../lab-02/postgres/testDatabase.js";

describe.sequential("PostgreSQL User Admin Integration PG-03, PG-12, PG-13 @issue-6", () => {
  let target: TestDatabaseTarget;
  let first: PrismaClient;
  let second: PrismaClient;
  let adminActor: TicketActor;

  beforeAll(async () => {
    target = assertLab2TestDatabase();
    await resetTestSchema(target);
    await deployMigrations(target);
    first = createTestPrisma(target);
    second = createTestPrisma(target);

    const admin = await first.user.create({
      data: {
        name: "Primary Admin",
        email: "primary.admin@example.test",
        role: "ADMINISTRATOR",
        passwordHash: "unusable-fixture-hash",
        mustChangePassword: false,
        createdBy: "system",
        updatedBy: "system",
      },
    });

    adminActor = {
      userId: admin.id,
      userPublicId: admin.publicId,
      email: admin.email,
      role: admin.role,
    };
  }, 120_000);

  afterAll(async () => {
    await first?.$disconnect();
    await second?.$disconnect();
  });

  describe("PG-03 Case-insensitive email unique constraint under real PostgreSQL", () => {
    it("rejects creation with duplicate email differing only in case", async () => {
      const email = `test-pg03-${randomUUID().slice(0, 8)}@example.test`;
      await createUser(first, adminActor, {
        name: "User One",
        email: email.toLowerCase(),
        role: "REQUESTER",
        isActive: true,
      });

      await expect(
        createUser(first, adminActor, {
          name: "User Two",
          email: email.toUpperCase(),
          role: "REQUESTER",
          isActive: true,
        }),
      ).rejects.toThrow(ApiError);

      try {
        await createUser(first, adminActor, {
          name: "User Two",
          email: email.toUpperCase(),
          role: "REQUESTER",
          isActive: true,
        });
      } catch (error: any) {
        expect(error.code).toBe("DUPLICATE_EMAIL");
      }
    });

    it("rejects update to existing email differing only in case", async () => {
      const emailA = `test-a-${randomUUID().slice(0, 8)}@example.test`;
      const emailB = `test-b-${randomUUID().slice(0, 8)}@example.test`;

      await createUser(first, adminActor, {
        name: "User A",
        email: emailA.toLowerCase(),
        role: "REQUESTER",
        isActive: true,
      });

      const userB = await createUser(first, adminActor, {
        name: "User B",
        email: emailB.toLowerCase(),
        role: "REQUESTER",
        isActive: true,
      });

      await expect(
        updateUser(first, adminActor, userB.user.publicId, {
          email: emailA.toUpperCase(),
        }),
      ).rejects.toMatchObject({ code: "DUPLICATE_EMAIL" });
    });

    it("concurrent createUser with case-insensitive collision results in exactly one winner", async () => {
      const collisionEmail = `concurrent-${randomUUID().slice(0, 8)}@example.test`;

      const results = await Promise.allSettled([
        createUser(first, adminActor, {
          name: "Concurrent 1",
          email: collisionEmail.toLowerCase(),
          role: "REQUESTER",
          isActive: true,
        }),
        createUser(second, adminActor, {
          name: "Concurrent 2",
          email: collisionEmail.toUpperCase(),
          role: "REQUESTER",
          isActive: true,
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
        code: "DUPLICATE_EMAIL",
      });

      const matching = await first.user.findMany({
        where: { email: { equals: collisionEmail, mode: "insensitive" } },
      });
      expect(matching).toHaveLength(1);
    });
  });

  describe("PG-12 Concurrent removal of final active Administrator", () => {
    it("prevents zero active Administrators when two concurrent operations attempt demotion/deactivation", async () => {
      // Create second administrator so exactly 2 active administrators exist
      const adminBUser = await first.user.create({
        data: {
          name: "Second Admin",
          email: `admin-b-${randomUUID().slice(0, 8)}@example.test`,
          role: "ADMINISTRATOR",
          isActive: true,
          passwordHash: "unusable-fixture-hash",
          mustChangePassword: false,
          createdBy: "system",
          updatedBy: "system",
        },
      });

      const adminBActor: TicketActor = {
        userId: adminBUser.id,
        userPublicId: adminBUser.publicId,
        email: adminBUser.email,
        role: adminBUser.role,
      };

      // Admin A tries to deactivate Admin B, Admin B tries to deactivate Admin A concurrently
      const results = await Promise.allSettled([
        updateUser(first, adminActor, adminBUser.publicId, { isActive: false }),
        updateUser(second, adminBActor, adminActor.userPublicId, { isActive: false }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      // At least one must be rejected to prevent 0 active administrators
      expect(rejected.length).toBeGreaterThanOrEqual(1);
      for (const rej of rejected) {
        expect((rej as PromiseRejectedResult).reason).toMatchObject({
          code: "CONFLICT",
        });
      }

      // Verify DB state: must have at least 1 active Administrator
      const activeAdmins = await first.user.count({
        where: { role: "ADMINISTRATOR", isActive: true, deleted: false },
      });
      expect(activeAdmins).toBeGreaterThanOrEqual(1);

      // Restore admin state if adminActor was deactivated
      await first.user.update({
        where: { id: adminActor.userId },
        data: { isActive: true, role: "ADMINISTRATOR" },
      });
    });
  });

  describe("PG-13 Email/role/deactivation edit transaction with active sessions and owned Tickets", () => {
    it("commits user deactivation, session revocation, and ticket unassignment together preserving ticket status", async () => {
      // Create an IT Staff user
      const staff = await first.user.create({
        data: {
          name: "Staff For PG13",
          email: `staff-pg13-${randomUUID().slice(0, 8)}@example.test`,
          role: "IT_STAFF",
          isActive: true,
          passwordHash: "unusable-fixture-hash",
          mustChangePassword: false,
          createdBy: "system",
          updatedBy: "system",
        },
      });

      // Create an active session
      const session = await first.userSession.create({
        data: {
          userId: staff.id,
          stage: "FULL",
          refreshTokenHash: randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", ""),
          absoluteExpiresAt: new Date(Date.now() + 3600_000),
        },
      });

      // Create Category & RelatedSystem
      const category = await first.category.create({
        data: { name: `Cat-${randomUUID().slice(0, 8)}`, createdBy: "test", updatedBy: "test" },
      });
      const system = await first.relatedSystem.create({
        data: { name: `Sys-${randomUUID().slice(0, 8)}`, createdBy: "test", updatedBy: "test" },
      });

      // Create 2 tickets owned by staff: one OPEN, one IN_PROGRESS
      const ticket1 = await first.ticket.create({
        data: {
          publicId: randomUUID(),
          ticketNumber: `TKT-20260917-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
          requesterId: adminActor.userId,
          ownerUserId: staff.id,
          categoryId: category.id,
          relatedSystemId: system.id,
          summary: "PG13 ticket 1",
          description: "Description 1",
          requestedPriority: "MEDIUM",
          itPriority: "HIGH",
          currentStatus: "OPEN",
          createdBy: "test",
          updatedBy: "test",
        },
      });

      const ticket2 = await first.ticket.create({
        data: {
          publicId: randomUUID(),
          ticketNumber: `TKT-20260917-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
          requesterId: adminActor.userId,
          ownerUserId: staff.id,
          categoryId: category.id,
          relatedSystemId: system.id,
          summary: "PG13 ticket 2",
          description: "Description 2",
          requestedPriority: "LOW",
          itPriority: "MEDIUM",
          currentStatus: "IN_PROGRESS",
          createdBy: "test",
          updatedBy: "test",
        },
      });

      // Deactivate staff user
      const updated = await updateUser(first, adminActor, staff.publicId, { isActive: false });
      expect(updated.isActive).toBe(false);

      // Verify session was revoked with DEACTIVATED
      const refreshedSession = await first.userSession.findUniqueOrThrow({
        where: { id: session.id },
      });
      expect(refreshedSession.revokedAt).not.toBeNull();
      expect(refreshedSession.revokeReason).toBe("DEACTIVATED");

      // Verify tickets: ownerUserId is null, status preserved
      const t1 = await first.ticket.findUniqueOrThrow({ where: { id: ticket1.id } });
      expect(t1.ownerUserId).toBeNull();
      expect(t1.currentStatus).toBe("OPEN");

      const t2 = await first.ticket.findUniqueOrThrow({ where: { id: ticket2.id } });
      expect(t2.ownerUserId).toBeNull();
      expect(t2.currentStatus).toBe("IN_PROGRESS");
    });

    it("role demotion to REQUESTER unassigns owned tickets and revokes sessions with ROLE_CHANGED", async () => {
      const staff = await first.user.create({
        data: {
          name: "Staff Demote Test",
          email: `staff-demote-${randomUUID().slice(0, 8)}@example.test`,
          role: "IT_STAFF",
          isActive: true,
          passwordHash: "unusable-fixture-hash",
          mustChangePassword: false,
          createdBy: "system",
          updatedBy: "system",
        },
      });

      const session = await first.userSession.create({
        data: {
          userId: staff.id,
          stage: "FULL",
          refreshTokenHash: randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", ""),
          absoluteExpiresAt: new Date(Date.now() + 3600_000),
        },
      });

      const category = await first.category.findFirstOrThrow();
      const system = await first.relatedSystem.findFirstOrThrow();

      const ticket = await first.ticket.create({
        data: {
          publicId: randomUUID(),
          ticketNumber: `TKT-20260917-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
          requesterId: adminActor.userId,
          ownerUserId: staff.id,
          categoryId: category.id,
          relatedSystemId: system.id,
          summary: "PG13 demote ticket",
          description: "Demote ticket description",
          requestedPriority: "HIGH",
          itPriority: "HIGH",
          currentStatus: "IN_PROGRESS",
          createdBy: "test",
          updatedBy: "test",
        },
      });

      await updateUser(first, adminActor, staff.publicId, { role: "REQUESTER" });

      const refreshedSession = await first.userSession.findUniqueOrThrow({
        where: { id: session.id },
      });
      expect(refreshedSession.revokedAt).not.toBeNull();
      expect(refreshedSession.revokeReason).toBe("ROLE_CHANGED");

      const refreshedTicket = await first.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect(refreshedTicket.ownerUserId).toBeNull();
      expect(refreshedTicket.currentStatus).toBe("IN_PROGRESS");
    });
  });
});
