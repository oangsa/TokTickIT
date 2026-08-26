import { PaginationMetadata, buildPaginationMetadata } from "../http/pagination.js";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import { buildOrderBy, buildWhere } from "./queryBuilder.js";
import { TicketListQuery } from "./ticketQueryValidator.js";

/*
 * The Ticket list read path (api-spec Sections 5.6 and 9).
 *
 * Kept out of `ticketService.ts` because that module owns Ticket creation and
 * its class needs an IdempotencyService a read has no use for.
 *
 * This module owns exactly the responsibilities the shared QueryBuilder must
 * not: Requester ownership, `deleted = false`, the bounded projection, and
 * pagination (BR-31).
 */

/*
 * A `select`, not the detail `include`. The exclusion of Description and the
 * Requester, Attachment, and audit fields is then structural -- those columns
 * are never read -- so the projection cannot regress through a mapping slip.
 * Description stays fully searchable because search lives in the `where`.
 *
 * Category and Related System are read by relation with no `isActive`/`deleted`
 * predicate, because Ticket metadata is historical: a Ticket keeps resolving
 * its names after the master row goes inactive or is logically deleted
 * (BR-72-73), exactly as the Ticket Detail projection does.
 */
const TICKET_LIST_SELECT = {
  publicId: true,
  ticketNumber: true,
  categoryId: true,
  relatedSystemId: true,
  summary: true,
  requestedPriority: true,
  currentStatus: true,
  createdAt: true,
  category: { select: { name: true } },
  relatedSystem: { select: { name: true } },
} satisfies Prisma.TicketSelect;

type TicketListRow = Prisma.TicketGetPayload<{ select: typeof TICKET_LIST_SELECT }>;

export interface TicketListItemDTO {
  publicId: string;
  ticketNumber: string;
  categoryId: number;
  categoryName: string;
  relatedSystemId: number;
  relatedSystemName: string;
  summary: string;
  requestedPriority: "LOW" | "MEDIUM" | "HIGH";
  currentStatus: "NEW";
  createdAt: string;
}

export interface TicketListResult {
  items: TicketListItemDTO[];
  pagination: PaginationMetadata;
}

export function toTicketListItemDTO(row: TicketListRow): TicketListItemDTO {
  return {
    publicId: row.publicId,
    ticketNumber: row.ticketNumber,
    categoryId: row.categoryId,
    categoryName: row.category.name,
    relatedSystemId: row.relatedSystemId,
    relatedSystemName: row.relatedSystem.name,
    summary: row.summary,
    requestedPriority: row.requestedPriority,
    currentStatus: row.currentStatus,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listTicketsForRequester(
  prisma: PrismaClient,
  requesterId: number,
  query: TicketListQuery,
): Promise<TicketListResult> {
  /*
   * Ownership and the soft-delete flag are fixed top-level `AND` members, so no
   * search term or client filter can widen the scope. They are supplied to the
   * builder as opaque predicates; the builder is not told what they mean.
   *
   * The single cast is the deliberate price of a resource-agnostic builder. It
   * is safe because only whitelisted fields and converted values reach it: the
   * Ticket validator has already rejected everything else.
   */
  const where = buildWhere({
    base: [{ requesterId }, { deleted: false }],
    search: query.search,
    filters: query.filters,
  }) as Prisma.TicketWhereInput;

  const orderBy = buildOrderBy(query.order) as Prisma.TicketOrderByWithRelationInput[];

  /*
   * ponytail: two statements rather than one snapshot -- a concurrent insert
   * can shift `totalItems` between the page read and the count. Wrap both in
   * `$transaction` if the count ever has to be exact to the row.
   *
   * The default `where`/`orderBy` matches the partial index
   * `ticket (requester_id, created_at DESC, id DESC) WHERE deleted = false`.
   */
  const [rows, totalItems] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy,
      select: TICKET_LIST_SELECT,
      skip: (query.pageNumber - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.ticket.count({ where }),
  ]);

  return {
    items: rows.map(toTicketListItemDTO),
    pagination: buildPaginationMetadata(query.pageNumber, query.pageSize, totalItems),
  };
}
