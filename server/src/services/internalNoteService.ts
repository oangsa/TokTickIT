import type { PrismaClient, UserRole } from "../generated/prisma/client.js";
import { ApiError } from "../http/errors.js";
import { buildPaginationMetadata, type PaginationMetadata } from "../http/pagination.js";
import { PUBLIC_ID_PATTERN } from "./staffQueueQueryValidator.js";
import type { TicketActor } from "./ticketWorkflowService.js";

export interface InternalNoteDTO {
  publicId: string;
  content: string;
  author: {
    publicId: string;
    name: string;
    role: UserRole;
  };
  createdAt: string;
}

export function validateNoteContent(content: unknown): string {
  if (typeof content !== "string") {
    throw new ApiError("VALIDATION_ERROR", [{ field: "content", message: "Enter a note of 1–4000 characters." }]);
  }
  const trimmed = content.trim();
  const len = [...trimmed].length;
  if (len < 1 || len > 4000) {
    throw new ApiError("VALIDATION_ERROR", [{ field: "content", message: "Enter a note of 1–4000 characters." }]);
  }
  return trimmed;
}

export function parseNotePaginationParams(query: Record<string, unknown>, defaultPageSize = 10) {
  let pageNumber = 1;
  let pageSize = defaultPageSize;
  if (query.pageNumber !== undefined) {
    const parsed = Number(query.pageNumber);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new ApiError("VALIDATION_ERROR", [{ field: "pageNumber", message: "pageNumber must be a positive integer." }]);
    }
    pageNumber = parsed;
  }
  if (query.pageSize !== undefined) {
    const parsed = Number(query.pageSize);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
      throw new ApiError("VALIDATION_ERROR", [{ field: "pageSize", message: "pageSize must be between 1 and 100." }]);
    }
    pageSize = parsed;
  }
  return { pageNumber, pageSize };
}

export async function getInternalNotes(
  prisma: PrismaClient,
  actor: TicketActor,
  ticketPublicId: string,
  query: Record<string, unknown>,
): Promise<{ items: InternalNoteDTO[]; pagination: PaginationMetadata }> {
  // Requester is rejected with 403 before accessing any notes or ticket
  if (actor.role === "REQUESTER") {
    throw new ApiError("FORBIDDEN");
  }

  if (!PUBLIC_ID_PATTERN.test(ticketPublicId)) {
    throw new ApiError("NOT_FOUND");
  }

  const ticket = await prisma.ticket.findFirst({
    where: { publicId: ticketPublicId, deleted: false },
    select: { id: true },
  });

  if (!ticket) {
    throw new ApiError("NOT_FOUND");
  }

  const { pageNumber, pageSize } = parseNotePaginationParams(query, 10);

  const totalItems = await prisma.internalNote.count({
    where: { ticketId: ticket.id },
  });

  const notes = await prisma.internalNote.findMany({
    where: { ticketId: ticket.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (pageNumber - 1) * pageSize,
    take: pageSize,
    include: {
      author: { select: { publicId: true, name: true, role: true } },
    },
  });

  const items: InternalNoteDTO[] = notes.map((n) => ({
    publicId: n.publicId,
    content: n.content,
    author: {
      publicId: n.author.publicId,
      name: n.author.name,
      role: n.author.role,
    },
    createdAt: n.createdAt.toISOString(),
  }));

  return {
    items,
    pagination: buildPaginationMetadata(pageNumber, pageSize, totalItems),
  };
}

export async function createInternalNote(
  prisma: PrismaClient,
  actor: TicketActor,
  ticketPublicId: string,
  rawContent: unknown,
): Promise<InternalNoteDTO> {
  // Requester is rejected with 403 before accessing any notes or ticket
  if (actor.role === "REQUESTER") {
    throw new ApiError("FORBIDDEN");
  }

  const content = validateNoteContent(rawContent);

  if (!PUBLIC_ID_PATTERN.test(ticketPublicId)) {
    throw new ApiError("NOT_FOUND");
  }

  // Create inside transaction to verify ownership transactionally if Administrator
  return await prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findFirst({
      where: { publicId: ticketPublicId, deleted: false },
      select: { id: true, ownerUserId: true },
    });

    if (!ticket) {
      throw new ApiError("NOT_FOUND");
    }

    // Admin may create only when current Ticket owner
    if (actor.role === "ADMINISTRATOR" && ticket.ownerUserId !== actor.userId) {
      throw new ApiError("FORBIDDEN");
    }

    const created = await tx.internalNote.create({
      data: {
        ticketId: ticket.id,
        authorUserId: actor.userId,
        content,
      },
      include: {
        author: { select: { publicId: true, name: true, role: true } },
      },
    });

    return {
      publicId: created.publicId,
      content: created.content,
      author: {
        publicId: created.author.publicId,
        name: created.author.name,
        role: created.author.role,
      },
      createdAt: created.createdAt.toISOString(),
    };
  });
}
