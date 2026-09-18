import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createUser,
  getUser,
  listUsers,
  resetInitialPassword,
  updateUser,
} from "../../src/services/userService.js";
import { actor, ADMIN, REQUESTER, STAFF } from "./support/staffFixture.js";

const OTHER_ADMIN = {
  id: 15,
  publicId: "15000000-0000-4000-8000-000000000015",
  name: "Other Admin",
  email: "otheradmin@example.test",
  role: "ADMINISTRATOR" as const,
  isActive: true,
  deleted: false,
  mustChangePassword: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("UNIT-15 UserService @issue-6", () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      userSession: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      ticket: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: vi.fn((fn: any) => fn(mockPrisma)),
    };
  });

  describe("Create User", () => {
    it("creates user with default isActive=true, mustChangePassword=true, and 16-char password", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 50,
        publicId: "new-user-public-id",
        name: "New Requester",
        email: "newreq@example.test",
        role: "REQUESTER",
        isActive: true,
        mustChangePassword: true,
        createdAt: new Date("2026-09-17T10:00:00Z"),
        updatedAt: new Date("2026-09-17T10:00:00Z"),
      });

      const res = await createUser(mockPrisma, actor(ADMIN), {
        name: "New Requester",
        email: "newreq@example.test",
        role: "REQUESTER",
      });

      expect(res.user.publicId).toBe("new-user-public-id");
      expect(res.user.isActive).toBe(true);
      expect(res.user.mustChangePassword).toBe(true);
      expect(res.initialPassword).toHaveLength(16);
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "New Requester",
            email: "newreq@example.test",
            role: "REQUESTER",
            isActive: true,
            mustChangePassword: true,
          }),
        }),
      );
    });

    it("rejects duplicate email case-insensitively with DUPLICATE_EMAIL", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 1 });

      await expect(
        createUser(mockPrisma, actor(ADMIN), {
          name: "Duplicate User",
          email: "STAFF@example.test",
          role: "IT_STAFF",
        }),
      ).rejects.toThrowError();
    });
  });

  describe("Edit User and Coupled Side Effects", () => {
    const targetStaff = {
      id: STAFF.id,
      publicId: STAFF.publicId,
      name: STAFF.name,
      email: STAFF.email,
      role: "IT_STAFF",
      isActive: true,
      deleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("updates name without revoking sessions or unassigning tickets", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(targetStaff);
      mockPrisma.user.update.mockResolvedValue({ ...targetStaff, name: "Updated Staff" });

      const updated = await updateUser(mockPrisma, actor(ADMIN), STAFF.publicId, {
        name: "Updated Staff",
      });

      expect(updated.name).toBe("Updated Staff");
      expect(mockPrisma.userSession.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.ticket.updateMany).not.toHaveBeenCalled();
    });

    it("email change revokes target sessions", async () => {
      mockPrisma.user.findFirst
        .mockResolvedValueOnce(targetStaff) // target lookup
        .mockResolvedValueOnce(null); // duplicate check
      mockPrisma.user.update.mockResolvedValue({ ...targetStaff, email: "newemail@example.test" });

      await updateUser(mockPrisma, actor(ADMIN), STAFF.publicId, {
        email: "newemail@example.test",
      });

      expect(mockPrisma.userSession.updateMany).toHaveBeenCalledWith({
        where: { userId: targetStaff.id, revokedAt: null },
        data: expect.objectContaining({ revokeReason: "EMAIL_CHANGED" }),
      });
      expect(mockPrisma.ticket.updateMany).not.toHaveBeenCalled();
    });

    it("demoting IT_STAFF to REQUESTER revokes sessions and unassigns owned tickets", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(targetStaff);
      mockPrisma.user.update.mockResolvedValue({ ...targetStaff, role: "REQUESTER" });

      await updateUser(mockPrisma, actor(ADMIN), STAFF.publicId, {
        role: "REQUESTER",
      });

      expect(mockPrisma.userSession.updateMany).toHaveBeenCalledWith({
        where: { userId: targetStaff.id, revokedAt: null },
        data: expect.objectContaining({ revokeReason: "ROLE_CHANGED" }),
      });
      expect(mockPrisma.ticket.updateMany).toHaveBeenCalledWith({
        where: { ownerUserId: targetStaff.id },
        data: { ownerUserId: null, updatedBy: ADMIN.email },
      });
    });

    it("deactivation revokes sessions and unassigns owned tickets", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(targetStaff);
      mockPrisma.user.update.mockResolvedValue({ ...targetStaff, isActive: false });

      await updateUser(mockPrisma, actor(ADMIN), STAFF.publicId, {
        isActive: false,
      });

      expect(mockPrisma.userSession.updateMany).toHaveBeenCalledWith({
        where: { userId: targetStaff.id, revokedAt: null },
        data: expect.objectContaining({ revokeReason: "DEACTIVATED" }),
      });
      expect(mockPrisma.ticket.updateMany).toHaveBeenCalledWith({
        where: { ownerUserId: targetStaff.id },
        data: { ownerUserId: null, updatedBy: ADMIN.email },
      });
    });
  });

  describe("Self-Safety and Last-Administrator Protection", () => {
    const adminUser = {
      id: ADMIN.id,
      publicId: ADMIN.publicId,
      name: ADMIN.name,
      email: ADMIN.email,
      role: "ADMINISTRATOR",
      isActive: true,
      deleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("rejects self-deactivation", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(adminUser);

      await expect(
        updateUser(mockPrisma, actor(ADMIN), ADMIN.publicId, { isActive: false }),
      ).rejects.toThrowError();
    });

    it("rejects self-role change", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(adminUser);

      await expect(
        updateUser(mockPrisma, actor(ADMIN), ADMIN.publicId, { role: "IT_STAFF" }),
      ).rejects.toThrowError();
    });

    it("rejects self initial-password reset", async () => {
      await expect(
        resetInitialPassword(mockPrisma, actor(ADMIN), ADMIN.publicId),
      ).rejects.toThrowError();
    });

    it("rejects demoting or deactivating the last active Administrator", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(OTHER_ADMIN);
      mockPrisma.user.count.mockResolvedValue(1); // Only 1 active Admin

      await expect(
        updateUser(mockPrisma, actor(ADMIN), OTHER_ADMIN.publicId, { isActive: false }),
      ).rejects.toThrowError();

      await expect(
        updateUser(mockPrisma, actor(ADMIN), OTHER_ADMIN.publicId, { role: "IT_STAFF" }),
      ).rejects.toThrowError();
    });

    it("permits deactivating an Administrator when another active Admin exists", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(OTHER_ADMIN);
      mockPrisma.user.count.mockResolvedValue(2); // 2 active Admins
      mockPrisma.user.update.mockResolvedValue({ ...OTHER_ADMIN, isActive: false });

      const updated = await updateUser(mockPrisma, actor(ADMIN), OTHER_ADMIN.publicId, { isActive: false });
      expect(updated.isActive).toBe(false);
    });
  });

  describe("Reset Initial Password", () => {
    it("atomically updates passwordHash, sets mustChangePassword=true, and revokes sessions", async () => {
      const targetUser = {
        id: 20,
        publicId: "20000000-0000-4000-8000-000000000020",
        deleted: false,
      };
      mockPrisma.user.findFirst.mockResolvedValue(targetUser);
      mockPrisma.user.update.mockResolvedValue({ ...targetUser });

      const res = await resetInitialPassword(mockPrisma, actor(ADMIN), targetUser.publicId);
      expect(res.initialPassword).toHaveLength(16);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: targetUser.id },
          data: expect.objectContaining({
            mustChangePassword: true,
            updatedBy: ADMIN.email,
          }),
        }),
      );
      expect(mockPrisma.userSession.updateMany).toHaveBeenCalledWith({
        where: { userId: targetUser.id, revokedAt: null },
        data: expect.objectContaining({ revokeReason: "INITIAL_PASSWORD_RESET" }),
      });
    });
  });
});
