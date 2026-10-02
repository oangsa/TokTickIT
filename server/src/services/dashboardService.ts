import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import { toUserSummary } from "./actionTakenRepresentation.js";
import { USER_SUMMARY_SELECT } from "./staffTicketReadService.js";
import { actionActivityAt, compareActionActivity, type DashboardSizes } from "./dashboardQueryValidator.js";

export const ACTIVE_STATUSES = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] as const;
const REQUESTER_TICKET_SELECT = {
  publicId: true, ticketNumber: true, summary: true, requestedPriority: true, currentStatus: true, updatedAt: true,
} satisfies Prisma.TicketSelect;

export async function requesterDashboard(prisma: PrismaClient, userId: number, recentTicketsSize = 5) {
  return prisma.$transaction(async (tx) => {
    const where = { requesterId: userId, deleted: false };
    const activeTickets = await tx.ticket.count({ where: { ...where, currentStatus: { in: [...ACTIVE_STATUSES] } } });
    const waitingForRequester = await tx.ticket.count({ where: { ...where, currentStatus: "WAITING_FOR_REQUESTER" } });
    const resolvedTickets = await tx.ticket.count({ where: { ...where, currentStatus: "RESOLVED" } });
    const closedTickets = await tx.ticket.count({ where: { ...where, currentStatus: "CLOSED" } });
    const recent = await tx.ticket.findMany({ where, select: REQUESTER_TICKET_SELECT, take: recentTicketsSize, orderBy: [{ updatedAt: "desc" }, { id: "desc" }] });
    return { metrics: { activeTickets, waitingForRequester, resolvedTickets, closedTickets }, recentTickets: recent.map((row) => ({
      publicId: row.publicId, ticketNumber: row.ticketNumber, summary: row.summary, requestedPriority: row.requestedPriority,
      currentStatus: row.currentStatus, updatedAt: row.updatedAt.toISOString(),
    })) };
  }, { isolationLevel: "RepeatableRead" });
}


const NON_TERMINAL = { deleted: false, currentStatus: { notIn: ["CLOSED", "CANCELLED"] } } satisfies Prisma.TicketWhereInput;
const STAFF_TICKET_SELECT = {
  publicId: true, ticketNumber: true, summary: true, requester: { select: { name: true } }, itPriority: true,
  currentStatus: true, owner: { select: USER_SUMMARY_SELECT }, updatedAt: true,
} satisfies Prisma.TicketSelect;
const ACTION_SELECT = {
  id: true, publicId: true, ticket: { select: { publicId: true, ticketNumber: true } }, description: true, status: true,
  assignedTo: { select: USER_SUMMARY_SELECT }, performedBy: { select: { publicId: true, name: true, role: true } },
  createdAt: true, startedAt: true, completedAt: true, cancelledAt: true,
} satisfies Prisma.ActionTakenSelect;
function staffTicket(row: Prisma.TicketGetPayload<{ select: typeof STAFF_TICKET_SELECT }>) {
  return { publicId: row.publicId, ticketNumber: row.ticketNumber, summary: row.summary, requesterName: row.requester.name,
    itPriority: row.itPriority, currentStatus: row.currentStatus, owner: toUserSummary(row.owner), updatedAt: row.updatedAt.toISOString() };
}
export async function staffDashboard(prisma: PrismaClient, userId: number, sizes: DashboardSizes) {
  return prisma.$transaction(async (tx) => {
    const unassignedTickets = await tx.ticket.count({ where: { ...NON_TERMINAL, ownerUserId: null } });
    const myAssignedTickets = await tx.ticket.count({ where: { ...NON_TERMINAL, ownerUserId: userId } });
    const inProgressTickets = await tx.ticket.count({ where: { deleted: false, currentStatus: "IN_PROGRESS" } });
    const waitingForRequester = await tx.ticket.count({ where: { deleted: false, currentStatus: "WAITING_FOR_REQUESTER" } });
    const highPriorityTickets = await tx.ticket.count({ where: { ...NON_TERMINAL, itPriority: "HIGH" } });
    const recent = await tx.ticket.findMany({ where: NON_TERMINAL, select: STAFF_TICKET_SELECT, take: sizes.recentTicketsSize, orderBy: [{ updatedAt: "desc" }, { id: "desc" }] });
    const urgent = [];
    // Null owners are a separate first group; both reads remain query-bounded.
    for (const ownerUserId of [null, { not: null }]) {
      urgent.push(...await tx.ticket.findMany({ where: { ...NON_TERMINAL, itPriority: "HIGH", ownerUserId }, select: STAFF_TICKET_SELECT,
        take: sizes.urgentTicketsSize, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }));
    }
    const actions = [];
    // Top N from each disjoint lifecycle group contains the global top N.
    // Prisma cannot order by CASE; merge at most 4*N selected rows, never a full collection.
    for (const [status, timestamp] of [["COMPLETED", "completedAt"], ["CANCELLED", "cancelledAt"], ["IN_PROGRESS", "startedAt"], ["PLANNED", "createdAt"]] as const) {
      actions.push(...await tx.actionTaken.findMany({ where: { status, ticket: { deleted: false }, OR: [{ assignedToUserId: userId }, { performedByUserId: userId }] },
        select: ACTION_SELECT, take: sizes.myActionsSize, orderBy: [{ [timestamp]: "desc" }, { id: "desc" }] }));
    }
    return { metrics: { unassignedTickets, myAssignedTickets, inProgressTickets, waitingForRequester, highPriorityTickets },
      recentTickets: recent.map(staffTicket), urgentTickets: urgent.slice(0, sizes.urgentTicketsSize).map(staffTicket),
      myActions: actions.sort(compareActionActivity).slice(0, sizes.myActionsSize).map((row) => ({
        publicId: row.publicId, ticketPublicId: row.ticket.publicId, ticketNumber: row.ticket.ticketNumber, description: row.description,
        status: row.status, assignedTo: toUserSummary(row.assignedTo), performedBy: row.performedBy ? { publicId: row.performedBy.publicId, name: row.performedBy.name, role: row.performedBy.role } : null, activityAt: actionActivityAt(row).toISOString(),
      })) };
  }, { isolationLevel: "RepeatableRead" });
}
