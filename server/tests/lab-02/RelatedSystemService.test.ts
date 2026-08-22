import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { RelatedSystemService } from "../../src/services/relatedSystemService.js";

function createPrismaMock() {
  return {
    relatedSystem: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  };
}

const activeRelatedSystem = {
  id: 1,
  name: "Corporate Laptop",
  isActive: true,
  deleted: false,
  createdBy: "seed",
  createdAt: new Date("2026-08-20T00:00:00.000Z"),
  updatedBy: "seed",
  updatedAt: new Date("2026-08-20T00:00:00.000Z"),
};

describe("RelatedSystemService", () => {
  it("returns only active, non-deleted Related Systems for selection", async () => {
    const prisma = createPrismaMock();
    prisma.relatedSystem.findMany.mockResolvedValue([activeRelatedSystem]);
    const service = new RelatedSystemService(prisma as unknown as PrismaClient);

    await expect(service.listSelectable()).resolves.toEqual([activeRelatedSystem]);
    expect(prisma.relatedSystem.findMany).toHaveBeenCalledWith({
      where: { deleted: false, isActive: true },
      orderBy: { id: "asc" },
    });
  });

  it("rejects inactive and deleted Related Systems for new Ticket selection", async () => {
    const prisma = createPrismaMock();
    prisma.relatedSystem.findFirst
      .mockResolvedValueOnce(activeRelatedSystem)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const service = new RelatedSystemService(prisma as unknown as PrismaClient);

    await expect(service.findSelectableById(1)).resolves.toEqual(activeRelatedSystem);
    await expect(service.findSelectableById(2)).resolves.toBeNull();
    await expect(service.findSelectableById(3)).resolves.toBeNull();
    expect(prisma.relatedSystem.findFirst).toHaveBeenCalledTimes(3);
    expect(prisma.relatedSystem.findFirst).toHaveBeenNthCalledWith(1, {
      where: { id: 1, deleted: false, isActive: true },
    });
  });

  it("resolves inactive or deleted Related System metadata for history", async () => {
    const prisma = createPrismaMock();
    const inactiveRelatedSystem = { ...activeRelatedSystem, id: 2, isActive: false };
    const deletedRelatedSystem = { ...activeRelatedSystem, id: 3, deleted: true };
    prisma.relatedSystem.findUnique
      .mockResolvedValueOnce(inactiveRelatedSystem)
      .mockResolvedValueOnce(deletedRelatedSystem);
    const service = new RelatedSystemService(prisma as unknown as PrismaClient);

    await expect(service.findHistoricalById(2)).resolves.toEqual(inactiveRelatedSystem);
    await expect(service.findHistoricalById(3)).resolves.toEqual(deletedRelatedSystem);
    expect(prisma.relatedSystem.findUnique).toHaveBeenNthCalledWith(1, { where: { id: 2 } });
    expect(prisma.relatedSystem.findUnique).toHaveBeenNthCalledWith(2, { where: { id: 3 } });
  });
});
