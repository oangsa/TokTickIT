import type { Prisma, PrismaClient, UserRole } from "../generated/prisma/client.js";
import { ApiError } from "../http/errors.js";
import { buildPaginationMetadata, type PaginationMetadata } from "../http/pagination.js";
import { PUBLIC_ID_PATTERN } from "./staffQueueQueryValidator.js";
import type { TicketActor, PublicCommentWriter } from "./ticketWorkflowService.js";

export interface PublicCommentAuthorDTO {
  publicId: string;
  name: string;
  role: UserRole;
}

export interface PublicCommentReplyTargetDTO {
  commentPublicId: string;
  userPublicId: string;
  name: string;
}

export interface PublicCommentDTO {
  publicId: string;
  content: string;
  author: PublicCommentAuthorDTO;
  parentCommentPublicId: string | null;
  replyTo: PublicCommentReplyTargetDTO | null;
  depth: 0 | 1 | 2;
  createdAt: string;
}

export interface RootPublicCommentDTO extends PublicCommentDTO {
  depth: 0;
  replyCount: number;
  replies: PublicCommentDTO[];
}

export function validateCommentContent(content: unknown): string {
  if (typeof content !== "string") {
    throw new ApiError("VALIDATION_ERROR", [{ field: "content", message: "Enter a message of 1–2000 characters." }]);
  }
  const trimmed = content.trim();
  const len = [...trimmed].length;
  if (len < 1 || len > 2000) {
    throw new ApiError("VALIDATION_ERROR", [{ field: "content", message: "Enter a message of 1–2000 characters." }]);
  }
  return trimmed;
}

export function parsePaginationParams(query: Record<string, unknown>, defaultPageSize: number) {
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

export async function findAccessibleTicket(
  prisma: PrismaClient | Prisma.TransactionClient,
  actor: TicketActor,
  ticketPublicId: string,
) {
  if (!PUBLIC_ID_PATTERN.test(ticketPublicId)) {
    throw new ApiError("NOT_FOUND");
  }
  const ticket = await prisma.ticket.findFirst({
    where: { publicId: ticketPublicId, deleted: false },
    select: { id: true, publicId: true, requesterId: true, currentStatus: true },
  });
  if (!ticket) {
    throw new ApiError("NOT_FOUND");
  }
  if (actor.role === "REQUESTER" && ticket.requesterId !== actor.userId) {
    throw new ApiError("NOT_FOUND");
  }
  return ticket;
}

export function toPublicCommentDTO(
  comment: {
    publicId: string;
    content: string;
    createdAt: Date;
    author: { publicId: string; name: string; role: UserRole };
    parent?: { publicId: string; parentCommentId: number | null } | null;
    parentCommentId?: number | null;
    replyTo?: {
      publicId: string;
      author: { publicId: string; name: string };
    } | null;
  },
  computedDepth?: 0 | 1 | 2,
): PublicCommentDTO {
  let depth: 0 | 1 | 2;
  if (computedDepth !== undefined) {
    depth = computedDepth;
  } else if (!comment.parentCommentId && !comment.parent) {
    depth = 0;
  } else if (comment.parent && comment.parent.parentCommentId === null) {
    depth = 1;
  } else {
    depth = 2;
  }

  return {
    publicId: comment.publicId,
    content: comment.content,
    author: {
      publicId: comment.author.publicId,
      name: comment.author.name,
      role: comment.author.role,
    },
    parentCommentPublicId: comment.parent ? comment.parent.publicId : null,
    replyTo: comment.replyTo
      ? {
          commentPublicId: comment.replyTo.publicId,
          userPublicId: comment.replyTo.author.publicId,
          name: comment.replyTo.author.name,
        }
      : null,
    depth,
    createdAt: comment.createdAt.toISOString(),
  };
}

export const writePublicCommentForWorkflow: PublicCommentWriter = async (tx, input) => {
  const content = validateCommentContent(input.content);
  await tx.publicComment.create({
    data: {
      ticketId: input.ticketId,
      authorUserId: input.authorUserId,
      content,
    },
  });
};

export async function createRootComment(
  prisma: PrismaClient,
  actor: TicketActor,
  ticketPublicId: string,
  rawContent: unknown,
): Promise<PublicCommentDTO> {
  const content = validateCommentContent(rawContent);
  const ticket = await findAccessibleTicket(prisma, actor, ticketPublicId);

  const created = await prisma.publicComment.create({
    data: {
      ticketId: ticket.id,
      authorUserId: actor.userId,
      content,
    },
    include: {
      author: { select: { publicId: true, name: true, role: true } },
    },
  });

  return toPublicCommentDTO({
    ...created,
    parent: null,
    replyTo: null,
  }, 0);
}

export async function createReplyComment(
  prisma: PrismaClient,
  actor: TicketActor,
  ticketPublicId: string,
  targetCommentPublicId: string,
  rawContent: unknown,
): Promise<PublicCommentDTO> {
  const content = validateCommentContent(rawContent);
  if (!PUBLIC_ID_PATTERN.test(targetCommentPublicId)) {
    throw new ApiError("NOT_FOUND");
  }
  const ticket = await findAccessibleTicket(prisma, actor, ticketPublicId);

  const target = await prisma.publicComment.findFirst({
    where: { publicId: targetCommentPublicId, ticketId: ticket.id },
    include: {
      parent: { select: { id: true, parentCommentId: true, publicId: true } },
    },
  });

  if (!target) {
    throw new ApiError("NOT_FOUND");
  }

  let parentCommentId: number;
  let replyToCommentId: number;
  let depth: 1 | 2;

  if (target.parentCommentId === null) {
    // Target is root (depth 0) -> new comment is depth 1
    parentCommentId = target.id;
    replyToCommentId = target.id;
    depth = 1;
  } else if (target.parent?.parentCommentId === null) {
    // Target is depth 1 -> new comment is depth 2
    parentCommentId = target.id;
    replyToCommentId = target.id;
    depth = 2;
  } else {
    // Target is depth 2 -> new comment is depth 2 under target's depth-1 parent
    parentCommentId = target.parentCommentId;
    replyToCommentId = target.id;
    depth = 2;
  }

  const created = await prisma.publicComment.create({
    data: {
      ticketId: ticket.id,
      authorUserId: actor.userId,
      parentCommentId,
      replyToCommentId,
      content,
    },
    include: {
      author: { select: { publicId: true, name: true, role: true } },
      parent: { select: { id: true, publicId: true, parentCommentId: true } },
      replyTo: {
        select: {
          publicId: true,
          author: { select: { publicId: true, name: true } },
        },
      },
    },
  });

  return toPublicCommentDTO(created, depth);
}

export async function getRootComments(
  prisma: PrismaClient,
  actor: TicketActor,
  ticketPublicId: string,
  query: Record<string, unknown>,
): Promise<{ items: RootPublicCommentDTO[]; pagination: PaginationMetadata }> {
  const ticket = await findAccessibleTicket(prisma, actor, ticketPublicId);
  const { pageNumber, pageSize } = parsePaginationParams(query, 10);

  const totalItems = await prisma.publicComment.count({
    where: { ticketId: ticket.id, parentCommentId: null },
  });

  const roots = await prisma.publicComment.findMany({
    where: { ticketId: ticket.id, parentCommentId: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (pageNumber - 1) * pageSize,
    take: pageSize,
    include: {
      author: { select: { publicId: true, name: true, role: true } },
    },
  });

  if (roots.length === 0) {
    return {
      items: [],
      pagination: buildPaginationMetadata(pageNumber, pageSize, totalItems),
    };
  }

  const rootIds = roots.map((r) => r.id);

  // Depth-1 comments under these roots
  const depth1Comments = await prisma.publicComment.findMany({
    where: { parentCommentId: { in: rootIds } },
    select: { id: true, parentCommentId: true },
  });

  const depth1IdsByRoot = new Map<number, number[]>();
  const d1IdToRootId = new Map<number, number>();
  const replyCountByRoot = new Map<number, number>();

  for (const c of depth1Comments) {
    if (c.parentCommentId !== null) {
      const list = depth1IdsByRoot.get(c.parentCommentId) ?? [];
      list.push(c.id);
      depth1IdsByRoot.set(c.parentCommentId, list);
      d1IdToRootId.set(c.id, c.parentCommentId);
      replyCountByRoot.set(
        c.parentCommentId,
        (replyCountByRoot.get(c.parentCommentId) ?? 0) + 1,
      );
    }
  }

  const allD1Ids = depth1Comments.map((c) => c.id);
  if (allD1Ids.length > 0) {
    const depth2Comments = await prisma.publicComment.findMany({
      where: { parentCommentId: { in: allD1Ids } },
      select: { id: true, parentCommentId: true },
    });
    for (const c of depth2Comments) {
      if (c.parentCommentId !== null) {
        const rootId = d1IdToRootId.get(c.parentCommentId);
        if (rootId !== undefined) {
          replyCountByRoot.set(rootId, (replyCountByRoot.get(rootId) ?? 0) + 1);
        }
      }
    }
  }

  // Preview replies for each root (up to 3, oldest first) and total count
  const items: RootPublicCommentDTO[] = await Promise.all(
    roots.map(async (root) => {
      const d1Ids = depth1IdsByRoot.get(root.id) ?? [];
      const replyCount = replyCountByRoot.get(root.id) ?? 0;

      if (replyCount === 0 || d1Ids.length === 0) {
        return {
          ...toPublicCommentDTO({ ...root, parent: null, replyTo: null }, 0),
          depth: 0 as const,
          replyCount: 0,
          replies: [],
        };
      }

      const replyWhere: Prisma.PublicCommentWhereInput = {
        OR: [{ parentCommentId: root.id }, { parentCommentId: { in: d1Ids } }],
      };

      const previews = await prisma.publicComment.findMany({
        where: replyWhere,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 3,
        include: {
          author: { select: { publicId: true, name: true, role: true } },
          parent: { select: { id: true, publicId: true, parentCommentId: true } },
          replyTo: {
            select: {
              publicId: true,
              author: { select: { publicId: true, name: true } },
            },
          },
        },
      });

      const mappedPreviews = previews.map((p) =>
        toPublicCommentDTO(p, p.parentCommentId === root.id ? 1 : 2),
      );

      return {
        ...toPublicCommentDTO({ ...root, parent: null, replyTo: null }, 0),
        depth: 0 as const,
        replyCount,
        replies: mappedPreviews,
      };
    }),
  );

  return {
    items,
    pagination: buildPaginationMetadata(pageNumber, pageSize, totalItems),
  };
}

export async function getCommentReplies(
  prisma: PrismaClient,
  actor: TicketActor,
  ticketPublicId: string,
  rootCommentPublicId: string,
  query: Record<string, unknown>,
): Promise<{ items: PublicCommentDTO[]; pagination: PaginationMetadata }> {
  if (!PUBLIC_ID_PATTERN.test(rootCommentPublicId)) {
    throw new ApiError("NOT_FOUND");
  }
  const ticket = await findAccessibleTicket(prisma, actor, ticketPublicId);
  const { pageNumber, pageSize } = parsePaginationParams(query, 5);

  const root = await prisma.publicComment.findFirst({
    where: { publicId: rootCommentPublicId, ticketId: ticket.id, parentCommentId: null },
    select: { id: true },
  });

  if (!root) {
    throw new ApiError("NOT_FOUND");
  }

  const depth1Comments = await prisma.publicComment.findMany({
    where: { parentCommentId: root.id },
    select: { id: true },
  });

  const d1Ids = depth1Comments.map((c) => c.id);
  const replyWhere: Prisma.PublicCommentWhereInput =
    d1Ids.length === 0
      ? { parentCommentId: root.id }
      : { OR: [{ parentCommentId: root.id }, { parentCommentId: { in: d1Ids } }] };

  const totalItems = await prisma.publicComment.count({ where: replyWhere });

  const replies = await prisma.publicComment.findMany({
    where: replyWhere,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    skip: (pageNumber - 1) * pageSize,
    take: pageSize,
    include: {
      author: { select: { publicId: true, name: true, role: true } },
      parent: { select: { id: true, publicId: true, parentCommentId: true } },
      replyTo: {
        select: {
          publicId: true,
          author: { select: { publicId: true, name: true } },
        },
      },
    },
  });

  const items = replies.map((r) =>
    toPublicCommentDTO(r, r.parentCommentId === root.id ? 1 : 2),
  );

  return {
    items,
    pagination: buildPaginationMetadata(pageNumber, pageSize, totalItems),
  };
}
