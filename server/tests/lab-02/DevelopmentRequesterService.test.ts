import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { DevelopmentRequesterService } from "../../src/services/developmentRequesterService.js";

function createPrismaMock() {
  return {
    developmentRequester: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  };
}

const activeRequester = {
  id: 1,
  name: "Alice Johnson",
  email: "alice.johnson@example.com",
  isActive: true,
  deleted: false,
  createdBy: "seed",
  createdAt: new Date("2026-08-20T01:00:00.000Z"),
  updatedBy: "seed",
  updatedAt: new Date("2026-08-20T01:00:00.000Z"),
};

describe("DevelopmentRequesterService", () => {
  it("returns only active, non-deleted Development Requesters for selection", async () => {
    const prisma = createPrismaMock();
    prisma.developmentRequester.findMany.mockResolvedValue([activeRequester]);
    const service = new DevelopmentRequesterService(prisma as unknown as PrismaClient);

    await expect(service.listSelectable()).resolves.toEqual([activeRequester]);
    expect(prisma.developmentRequester.findMany).toHaveBeenCalledWith({
      where: { deleted: false, isActive: true },
      orderBy: { id: "asc" },
    });
  });

  it("rejects inactive and deleted Development Requesters for requester context", async () => {
    const prisma = createPrismaMock();
    prisma.developmentRequester.findFirst
      .mockResolvedValueOnce(activeRequester)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const service = new DevelopmentRequesterService(prisma as unknown as PrismaClient);

    await expect(service.findSelectableById(1)).resolves.toEqual(activeRequester);
    await expect(service.findSelectableById(2)).resolves.toBeNull();
    await expect(service.findSelectableById(3)).resolves.toBeNull();
    expect(prisma.developmentRequester.findFirst).toHaveBeenCalledTimes(3);
    expect(prisma.developmentRequester.findFirst).toHaveBeenNthCalledWith(1, {
      where: { id: 1, deleted: false, isActive: true },
    });
  });

  it("resolves inactive or deleted Requester metadata for history", async () => {
    const prisma = createPrismaMock();
    const inactiveRequester = { ...activeRequester, id: 2, isActive: false };
    const deletedRequester = { ...activeRequester, id: 3, deleted: true };
    prisma.developmentRequester.findUnique
      .mockResolvedValueOnce(inactiveRequester)
      .mockResolvedValueOnce(deletedRequester);
    const service = new DevelopmentRequesterService(prisma as unknown as PrismaClient);

    await expect(service.findHistoricalById(2)).resolves.toEqual(inactiveRequester);
    await expect(service.findHistoricalById(3)).resolves.toEqual(deletedRequester);
    expect(prisma.developmentRequester.findUnique).toHaveBeenNthCalledWith(1, { where: { id: 2 } });
    expect(prisma.developmentRequester.findUnique).toHaveBeenNthCalledWith(2, { where: { id: 3 } });
  });
});
