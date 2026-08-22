import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { CategoryService } from "../../src/services/categoryService.js";

function createPrismaMock() {
  return {
    category: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  };
}

const activeCategory = {
  id: 1,
  name: "Hardware",
  isActive: true,
  deleted: false,
  createdBy: "seed",
  createdAt: new Date("2026-08-20T00:00:00.000Z"),
  updatedBy: "seed",
  updatedAt: new Date("2026-08-20T00:00:00.000Z"),
};

describe("CategoryService", () => {
  it("returns only active, non-deleted Categories for selection", async () => {
    const prisma = createPrismaMock();
    prisma.category.findMany.mockResolvedValue([activeCategory]);
    const service = new CategoryService(prisma as unknown as PrismaClient);

    await expect(service.listSelectable()).resolves.toEqual([activeCategory]);
    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { deleted: false, isActive: true },
      orderBy: { id: "asc" },
    });
  });

  it("rejects inactive and deleted Categories for new Ticket selection", async () => {
    const prisma = createPrismaMock();
    prisma.category.findFirst
      .mockResolvedValueOnce(activeCategory)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const service = new CategoryService(prisma as unknown as PrismaClient);

    await expect(service.findSelectableById(1)).resolves.toEqual(activeCategory);
    await expect(service.findSelectableById(2)).resolves.toBeNull();
    await expect(service.findSelectableById(3)).resolves.toBeNull();
    expect(prisma.category.findFirst).toHaveBeenCalledTimes(3);
    expect(prisma.category.findFirst).toHaveBeenNthCalledWith(1, {
      where: { id: 1, deleted: false, isActive: true },
    });
  });

  it("resolves inactive or deleted Category metadata for history", async () => {
    const prisma = createPrismaMock();
    const inactiveCategory = { ...activeCategory, id: 2, isActive: false };
    const deletedCategory = { ...activeCategory, id: 3, deleted: true };
    prisma.category.findUnique
      .mockResolvedValueOnce(inactiveCategory)
      .mockResolvedValueOnce(deletedCategory);
    const service = new CategoryService(prisma as unknown as PrismaClient);

    await expect(service.findHistoricalById(2)).resolves.toEqual(inactiveCategory);
    await expect(service.findHistoricalById(3)).resolves.toEqual(deletedCategory);
    expect(prisma.category.findUnique).toHaveBeenNthCalledWith(1, { where: { id: 2 } });
    expect(prisma.category.findUnique).toHaveBeenNthCalledWith(2, { where: { id: 3 } });
  });
});
