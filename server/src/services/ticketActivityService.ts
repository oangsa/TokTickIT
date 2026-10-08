import type { Prisma, PrismaClient, TicketActivityType } from "../generated/prisma/client.js";
import { ApiError } from "../http/errors.js";
import { buildPaginationMetadata } from "../http/pagination.js";
import { collectionInput, collectionOrder } from "./actionTakenQueryValidator.js";
import { ActionTakenService } from "./actionTakenService.js";
import { ACTIVITY_SELECT, toActivityDTO } from "./activityRepresentation.js";
import { buildOrderBy, buildFilter } from "./queryBuilder.js";
import { invalidField, PUBLIC_ID_PATTERN } from "./staffQueueQueryValidator.js";
import type { TicketActor } from "./ticketWorkflowService.js";
export const ACTIVITY_CATEGORIES: Record<string, TicketActivityType[]> = {
  "Ticket Workflow": ["TICKET_STARTED_WORK", "INFORMATION_REQUESTED", "TICKET_RESUMED", "TICKET_MARKED_RESOLVED", "REQUESTER_RESOLUTION_CONFIRMED", "TICKET_CLOSED", "TICKET_CANCELLED", "TICKET_REOPENED"],
  Assignment: ["TICKET_ASSIGNED", "TICKET_REASSIGNED", "TICKET_UNASSIGNED", "ACTION_ASSIGNED", "ACTION_REASSIGNED", "ACTION_UNASSIGNED"],
  Priority: ["IT_PRIORITY_CHANGED"],
  "Actions Taken": ["ACTION_CREATED", "ACTION_UPDATED", "ACTION_ASSIGNED", "ACTION_REASSIGNED", "ACTION_UNASSIGNED", "ACTION_STARTED", "ACTION_COMPLETED", "ACTION_CANCELLED"],
};
export function parseActivityQuery(value: unknown) {
  const { input, rawFilters, pageNumber, pageSize } = collectionInput(value, ["filters", "sort", "pageNumber", "pageSize"]);
  if (rawFilters.length > 1) invalidField("filters");
  let types: TicketActivityType[] | undefined;
  if (rawFilters.length) {
    const filter = rawFilters[0];
    if (filter.field !== "category" || filter.condition !== "EQUAL" || typeof filter.value !== "string" || !Object.hasOwn(ACTIVITY_CATEGORIES, filter.value)) invalidField("filters");
    types = ACTIVITY_CATEGORIES[filter.value];
  }
  return { types, order: collectionOrder(input, ["createdAt"]), pageNumber, pageSize };
}
export async function listTicketActivity(prisma: PrismaClient, actor: TicketActor, ticketPublicId: string, input: unknown, actionPublicId?: string) {
  if (actor.role !== "IT_STAFF" && actor.role !== "ADMINISTRATOR") throw new ApiError("FORBIDDEN");
  const query = parseActivityQuery(input);
  return prisma.$transaction(async (tx) => {
    const ticket = await new ActionTakenService(prisma).ticket(tx, actor, ticketPublicId);
    const AND: Prisma.TicketActivityWhereInput[] = [{ ticketId: ticket.id }];
    if (actionPublicId !== undefined) {
      if (!PUBLIC_ID_PATTERN.test(actionPublicId)) throw new ApiError("NOT_FOUND");
      const action = await tx.actionTaken.findFirst({ where: { ticketId: ticket.id, publicId: actionPublicId.toLowerCase() }, select: { id: true } });
      if (!action) throw new ApiError("NOT_FOUND");
      AND.push({ actionTaken: { is: { actionTakenId: action.id } } });
    }
    if (query.types) AND.push(buildFilter({ field: "action", condition: "IN", value: query.types }));
    const where = { AND };
    const totalItems = await tx.ticketActivity.count({ where });
    const skip = (query.pageNumber - 1) * query.pageSize;
    const rows = skip < totalItems ? await tx.ticketActivity.findMany({ where, select: ACTIVITY_SELECT, orderBy: buildOrderBy(query.order), skip, take: query.pageSize }) : [];
    return { items: rows.map(toActivityDTO), pagination: buildPaginationMetadata(query.pageNumber, query.pageSize, totalItems) };
  }, { isolationLevel: "RepeatableRead" });
}
