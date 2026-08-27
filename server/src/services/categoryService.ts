import type { PrismaClient } from "../generated/prisma/client.js";

export class CategoryService {
  constructor(private readonly prisma: PrismaClient) {}

  listSelectable() {
    return this.prisma.category.findMany({
      where: { deleted: false, isActive: true },
      orderBy: { id: "asc" },
    });
  }

  findSelectableById(id: number) {
    return this.prisma.category.findFirst({
      where: { id, deleted: false, isActive: true },
    });
  }

  findHistoricalById(id: number) {
    return this.prisma.category.findUnique({ where: { id } });
  }
}
