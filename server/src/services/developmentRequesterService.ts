import type { PrismaClient } from "../generated/prisma/client.js";

export class DevelopmentRequesterService {
  constructor(private readonly prisma: PrismaClient) {}

  listSelectable() {
    return this.prisma.developmentRequester.findMany({
      where: { deleted: false, isActive: true },
      orderBy: { id: "asc" },
    });
  }

  findSelectableById(id: number) {
    return this.prisma.developmentRequester.findFirst({
      where: { id, deleted: false, isActive: true },
    });
  }

  findHistoricalById(id: number) {
    return this.prisma.developmentRequester.findUnique({ where: { id } });
  }
}
