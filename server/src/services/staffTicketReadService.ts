import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import { ApiError } from "../http/errors.js";
import { buildPaginationMetadata } from "../http/pagination.js";
import { buildFilter, buildOrderBy } from "./queryBuilder.js";
import { PUBLIC_ID_PATTERN, type StaffQueueQuery } from "./staffQueueQueryValidator.js";
import { TICKET_DTO_INCLUDE, toTicketDTO } from "./ticketRepresentation.js";

export interface TicketOwnerDTO { publicId: string; name: string; role: "IT_STAFF" | "ADMINISTRATOR" }
export const OWNER_SELECT = { publicId: true, name: true, role: true } as const;
export const ELIGIBLE_OWNER = { isActive: true, deleted: false, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } } satisfies Prisma.UserWhereInput;

export async function listAssignableUsers(prisma: PrismaClient): Promise<TicketOwnerDTO[]> {
  const users = await prisma.user.findMany({ where: ELIGIBLE_OWNER, select: OWNER_SELECT, orderBy: [{ name: "asc" }, { publicId: "asc" }] });
  return users.map((user) => ({ ...user, role: user.role as TicketOwnerDTO["role"] }));
}

export async function findStaffTicket(prisma: PrismaClient, publicId: string) {
  if (!PUBLIC_ID_PATTERN.test(publicId)) throw new ApiError("NOT_FOUND");
  const ticket = await prisma.ticket.findFirst({ where: { publicId, deleted: false }, include: TICKET_DTO_INCLUDE });
  if (!ticket) throw new ApiError("NOT_FOUND");
  return toTicketDTO(ticket);
}

const LIST_SELECT = {
  publicId: true, ticketNumber: true, summary: true, categoryId: true,
  category: { select: { name: true } }, requester: { select: { name: true } },
  requestedPriority: true, itPriority: true, currentStatus: true,
  owner: { select: OWNER_SELECT }, createdAt: true, updatedAt: true,
} satisfies Prisma.TicketSelect;
type ListRow = Prisma.TicketGetPayload<{ select: typeof LIST_SELECT }>;
export type StaffTicketListItemDTO = Omit<ListRow, "category" | "requester" | "createdAt" | "updatedAt" | "owner"> & {
  categoryName: string; requesterName: string; createdAt: string; updatedAt: string; owner: TicketOwnerDTO | null;
};

export function staffQueueWhere(query: StaffQueueQuery): Prisma.TicketWhereInput {
  const AND: Prisma.TicketWhereInput[] = [{ deleted: false }];
  if (query.search) {
    const { fields, term } = query.search;
    AND.push({ OR: fields.map((field) => {
      const fragment = buildFilter({ field: field === "requesterName" ? "name" : field, condition: "CONTAINS", value: term, caseInsensitive: true });
      return field === "requesterName" ? { requester: { is: fragment } } : fragment;
    }) });
  }
  for (const expression of query.filters) {
    if (expression.field !== "ownerPublicId") { AND.push(buildFilter(expression)); continue; }
    if (expression.condition === "ISNULL") AND.push({ ownerUserId: null });
    else if (expression.condition === "ISNOTNULL") AND.push({ ownerUserId: { not: null } });
    else AND.push({ owner: { is: buildFilter({ ...expression, field: "publicId" }) } });
  }
  return { AND };
}

export async function listStaffTickets(prisma: PrismaClient, query: StaffQueueQuery) {
  const where = staffQueueWhere(query);
  return prisma.$transaction(async (tx) => {
    const totalItems = await tx.ticket.count({ where });
    let skip = (query.pageNumber - 1) * query.pageSize;
    const rows: ListRow[] = [];
    if (skip < totalItems) {
      if (query.order.length) {
        rows.push(...await tx.ticket.findMany({ where, select: LIST_SELECT, orderBy: buildOrderBy(query.order), skip, take: query.pageSize }));
      } else {
        // Prisma cannot order by the boolean owner-is-null expression. Page six
        // disjoint buckets in one snapshot, without sorting all rows in memory.
        for (const assigned of [false, true]) {
          for (const itPriority of ["HIGH", "MEDIUM", "LOW"] as const) {
            const bucket = { AND: [where, { ownerUserId: assigned ? { not: null } : null, itPriority }] };
            const count = await tx.ticket.count({ where: bucket });
            if (skip >= count) { skip -= count; continue; }
            rows.push(...await tx.ticket.findMany({ where: bucket, select: LIST_SELECT, orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip, take: query.pageSize - rows.length }));
            skip = 0;
            if (rows.length === query.pageSize) break;
          }
          if (rows.length === query.pageSize) break;
        }
      }
    }
    const items: StaffTicketListItemDTO[] = rows.map(({ category, requester, owner, createdAt, updatedAt, ...row }) => ({
      ...row, categoryName: category.name, requesterName: requester.name,
      owner: owner && (owner.role === "IT_STAFF" || owner.role === "ADMINISTRATOR") ? { ...owner, role: owner.role } : null,
      createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString(),
    }));
    return { items, pagination: buildPaginationMetadata(query.pageNumber, query.pageSize, totalItems) };
  }, { isolationLevel: "RepeatableRead" });
}
