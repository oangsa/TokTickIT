import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Prisma, PrismaClient } from "../../../src/generated/prisma/client.js";
import { ApiError } from "../../../src/http/errors.js";
import { createUser, resetInitialPassword, updateUser } from "../../../src/services/userService.js";
import { AuthService } from "../../../src/services/authService.js";
import { SessionService } from "../../../src/services/sessionService.js";
import { hashPassword, TEST_ARGON2_PROFILE } from "../../../src/services/passwordService.js";
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

  it("rejects a login verified before a concurrent password reset commits", async () => {
    vi.stubEnv("JWT_SECRET", `synthetic-${randomUUID()}-${randomUUID()}`);
    const password = `Synthetic-${randomUUID()}!`;
    const user = await first.user.create({ data: {
      name: "Reset Race", email: `reset-race-${randomUUID()}@example.test`, role: "REQUESTER",
      passwordHash: await hashPassword(password, TEST_ARGON2_PROFILE), mustChangePassword: false,
      createdBy: "test", updatedBy: "test",
    } });
    const verify = argon2.verify;
    const verification = vi.spyOn(argon2, "verify").mockImplementationOnce(async (...args) => {
      const matches = await verify(...args);
      await resetInitialPassword(second, adminActor, user.publicId);
      return matches;
    });
    const service = new AuthService(first, TEST_ARGON2_PROFILE);
    try {
      const failure = await service.login({
        email: user.email, password, rememberMe: false, ipAddress: "127.0.0.11",
      }).then(() => null, (error: unknown) => error);
      expect(failure).toMatchObject({ code: "AUTHENTICATION_FAILED" });
      expect(await first.userSession.count({ where: { userId: user.id } })).toBe(0);
      expect(await first.user.findUniqueOrThrow({ where: { id: user.id } }))
        .toMatchObject({ mustChangePassword: true });
    } finally {
      verification.mockRestore();
      vi.unstubAllEnvs();
    }
  });

  it("serializes reset with a login that has reserved its session, preserving User timestamps", async () => {
    vi.stubEnv("JWT_SECRET", `synthetic-${randomUUID()}-${randomUUID()}`);
    const password = `Synthetic-${randomUUID()}!`;
    const user = await first.user.create({ data: {
      name: "Session Race", email: `session-race-${randomUUID()}@example.test`, role: "REQUESTER",
      passwordHash: await hashPassword(password, TEST_ARGON2_PROFILE), mustChangePassword: false,
      createdBy: "test", updatedBy: "test",
    } });
    let enteredSession!: () => void;
    let releaseSession!: () => void;
    let readResetTarget!: () => void;
    const sessionEntered = new Promise<void>((resolve) => { enteredSession = resolve; });
    const sessionReleased = new Promise<void>((resolve) => { releaseSession = resolve; });
    const resetTargetRead = new Promise<void>((resolve) => { readResetTarget = resolve; });
    // Observe the real query only to control transaction ordering.
    const observedAdmin = second.$extends({ query: { user: {
      async findFirst({ args, query }) {
        const result = await query(args);
        readResetTarget();
        return result;
      },
    } } });
    const createSession = SessionService.prototype.create;
    const sessionSpy = vi.spyOn(SessionService.prototype, "create").mockImplementationOnce(async function (this: SessionService, input, client) {
      enteredSession();
      await sessionReleased;
      return createSession.call(this, input, client);
    });
    const service = new AuthService(first, TEST_ARGON2_PROFILE);
    try {
      const login = service.login({ email: user.email, password, rememberMe: false, ipAddress: "127.0.0.12" });
      await sessionEntered;
      const reset = resetInitialPassword(observedAdmin as unknown as PrismaClient, adminActor, user.publicId)
        .then(() => null, (error: unknown) => error);
      await resetTargetRead;
      releaseSession();
      const signedIn = await login;
      expect(await reset).toMatchObject({ code: "CONFLICT" });
      expect((await first.user.findUniqueOrThrow({ where: { id: user.id } })).updatedAt).toEqual(user.updatedAt);

      const sessionId = signedIn.refreshToken.split(".")[0];
      await resetInitialPassword(second, adminActor, user.publicId);
      await expect(service.context(sessionId, user.publicId)).rejects.toMatchObject({ code: "SESSION_INVALID" });
      expect(await first.userSession.count({ where: { userId: user.id, revokedAt: null } })).toBe(0);
    } finally {
      releaseSession();
      sessionSpy.mockRestore();
      vi.unstubAllEnvs();
    }
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

      const unrelatedTicket = await first.ticket.create({
        data: {
          ...ticket1,
          id: undefined,
          publicId: randomUUID(),
          ticketNumber: `TKT-20260917-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
          ownerUserId: adminActor.userId,
        },
      });
      const assignedAction = await first.actionTaken.create({
        data: {
          ticketId: ticket1.id, description: "Retain Action assignment", status: "PLANNED",
          assignedToUserId: staff.id, creatorUserId: adminActor.userId,
          followUpRequired: false,
          createdBy: "test", updatedBy: "test",
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

      for (const ticket of [ticket1, ticket2]) {
        const activities = await first.ticketActivity.findMany({
          where: { ticketId: ticket.id },
          include: { assignment: true, status: true },
        });
        expect(activities).toHaveLength(1);
        expect(activities[0]).toMatchObject({
          action: "TICKET_UNASSIGNED",
          performedByUserId: adminActor.userId,
          assignment: { previousAssignedToUserId: staff.id, assignedToUserId: null },
          status: null,
        });
      }
      expect(await first.ticket.findUniqueOrThrow({ where: { id: unrelatedTicket.id } })).toEqual(unrelatedTicket);
      expect(await first.ticketActivity.count({ where: { ticketId: unrelatedTicket.id } })).toBe(0);
      expect(await first.actionTaken.findUniqueOrThrow({ where: { id: assignedAction.id } })).toEqual(assignedAction);

      await updateUser(first, adminActor, staff.publicId, { isActive: false });
      expect(await first.ticketActivity.count({ where: { ticketId: { in: [ticket1.id, ticket2.id] } } })).toBe(2);
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
      const activities = await first.ticketActivity.findMany({
        where: { ticketId: ticket.id }, include: { assignment: true, status: true },
      });
      expect(activities).toHaveLength(1);
      expect(activities[0]).toMatchObject({
        action: "TICKET_UNASSIGNED", performedByUserId: adminActor.userId,
        assignment: { previousAssignedToUserId: staff.id, assignedToUserId: null },
        status: null,
      });
      await updateUser(first, adminActor, staff.publicId, { role: "REQUESTER" });
      expect(await first.ticketActivity.count({ where: { ticketId: ticket.id } })).toBe(1);
    });

    it.each([{ isActive: false }, { role: "REQUESTER" }] as const)(
      "PG-10 Activity failure rolls back User edit %j, sessions, all owner removals and earlier Activity",
      async (change) => {
        const staff = await first.user.create({ data: {
          name: "Rollback Staff", email: `rollback-${randomUUID()}@example.test`, role: "IT_STAFF",
          passwordHash: "unusable-fixture-hash", mustChangePassword: false,
          createdBy: "test", updatedBy: "test",
        } });
        const session = await first.userSession.create({ data: {
          userId: staff.id, stage: "FULL", refreshTokenHash: randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", ""),
          absoluteExpiresAt: new Date(Date.now() + 3600_000),
        } });
        const category = await first.category.findFirstOrThrow();
        const system = await first.relatedSystem.findFirstOrThrow();
        const tickets = [];
        for (const currentStatus of ["OPEN", "IN_PROGRESS"] as const) {
          tickets.push(await first.ticket.create({ data: {
            publicId: randomUUID(),
            ticketNumber: `TKT-20260917-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
            requesterId: adminActor.userId, ownerUserId: staff.id,
            categoryId: category.id, relatedSystemId: system.id,
            summary: "Rollback owner cleanup", description: "Synthetic rollback fixture",
            requestedPriority: "MEDIUM", itPriority: "HIGH", currentStatus,
            createdBy: "test", updatedBy: "test",
          } }));
        }
        let appends = 0;
        const failing = first.$extends({ query: { ticketActivity: {
          async create({ args, query }) {
            // Fail the second append with a real PostgreSQL FK violation after the first succeeds.
            if (++appends === 2) (args.data as Prisma.TicketActivityUncheckedCreateInput).performedByUserId = -1;
            return query(args);
          },
        } } });
        await expect(updateUser(failing as unknown as PrismaClient, adminActor, staff.publicId, change))
          .rejects.toMatchObject({ code: "P2003" });
        expect(appends).toBe(2);
        expect(await first.user.findUniqueOrThrow({ where: { id: staff.id } })).toEqual(staff);
        expect(await first.userSession.findUniqueOrThrow({ where: { id: session.id } })).toEqual(session);
        for (const ticket of tickets) {
          expect(await first.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).toEqual(ticket);
          expect(await first.ticketActivity.count({ where: { ticketId: ticket.id } })).toBe(0);
        }
        await updateUser(first, adminActor, staff.publicId, change);
        expect(await first.ticketActivity.count({ where: { ticketId: { in: tickets.map((ticket) => ticket.id) } } })).toBe(2);
      },
    );
  });
});
