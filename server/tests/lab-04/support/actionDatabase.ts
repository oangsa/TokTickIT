import { randomUUID } from "node:crypto";
import type { TicketStatus, PrismaClient } from "../../../src/generated/prisma/client.js";
import { ActionTakenService } from "../../../src/services/actionTakenService.js";
import type { TicketActor } from "../../../src/services/ticketWorkflowService.js";
import { assertLab2TestDatabase, createTestPrisma, deployMigrations } from "../../lab-02/postgres/testDatabase.js";
import { createBody } from "./actionFixture.js";
export async function actionDatabase() {
  const target = assertLab2TestDatabase();
  if (!/(^|[_-])lab3([_-]|$)/i.test(target.databaseName)) throw new Error("Lab 4 requires guarded disposable Lab 3 target");
  await deployMigrations(target);
  const first = createTestPrisma(target);
  const second = createTestPrisma(target);
  const suffix = randomUUID();
  const users = await Promise.all((["REQUESTER", "IT_STAFF", "IT_STAFF", "ADMINISTRATOR"] as const).map((role, index) => first.user.create({ data: {
    name: `Action ${role} ${index}`, email: `action-${suffix}-${index}@example.test`, role, passwordHash: "unusable-synthetic-fixture", mustChangePassword: false, createdBy: "test", updatedBy: "test",
  } })));
  const actors: TicketActor[] = users.map((user) => ({ userId: user.id, userPublicId: user.publicId, email: user.email, role: user.role }));
  const [requester, staff, other, admin] = actors;
  const category = await first.category.create({ data: { name: `Action ${suffix}`, createdBy: "test", updatedBy: "test" } });
  const system = await first.relatedSystem.create({ data: { name: `Action ${suffix}`, createdBy: "test", updatedBy: "test" } });
  async function ticket(currentStatus: TicketStatus = "OPEN", ownerUserId: number | null = staff.userId) {
    return first.ticket.create({ data: { publicId: randomUUID(), ticketNumber: `TKT-20261001-${randomUUID().replaceAll("-", "").slice(0,12).toUpperCase()}`, requesterId: requester.userId, ownerUserId,
      categoryId: category.id, relatedSystemId: system.id, summary: "Synthetic Action test", description: "Synthetic local fixture", requestedPriority: "MEDIUM", currentStatus, createdBy: "test", updatedBy: "test" } });
  }
  async function file(ticketId: number | null, flags: { deleted?: boolean; removalReason?: string | null } = {}) {
    return first.attachment.create({ data: { storageKey: randomUUID(), ticketId, uploadedByRequesterId: requester.userId,
      originalName: "evidence.txt", extension: "txt", mimeType: "text/plain", sizeBytes: 4, data: Buffer.from("test"), createdBy: "test", updatedBy: "test", ...flags } });
  }
  async function create(ticketPublicId: string, assignedToUserPublicId: string | null = staff.userPublicId, attachmentIds: string[] = [], key = randomUUID(), database: PrismaClient = first) {
    return new ActionTakenService(database).create(staff, ticketPublicId, { ...createBody, assignedToUserPublicId, attachmentIds }, key);
  }
  return { first, second, requester, staff, other, admin, users, ticket, file, create,
    service: new ActionTakenService(first), secondService: new ActionTakenService(second),
    async close() { await Promise.all([first.$disconnect(), second.$disconnect()]); } };
}
export type ActionDatabase = Awaited<ReturnType<typeof actionDatabase>>;
