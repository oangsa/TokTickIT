import type { Prisma, PrismaClient, TicketStatus } from "../generated/prisma/client.js";
import { ApiError } from "../http/errors.js";
import type { AuthContext } from "./authService.js";
import { ELIGIBLE_OWNER } from "./staffTicketReadService.js";
import { invalidField, PRIORITIES, PUBLIC_ID_PATTERN, record } from "./staffQueueQueryValidator.js";
import { TICKET_DTO_INCLUDE, toTicketDTO } from "./ticketService.js";

export type TicketActor = Pick<AuthContext, "userId" | "userPublicId" | "role" | "email">;
export type WorkflowAction = "start-work" | "request-information" | "resume-work" | "mark-resolved" | "close" | "cancel";
export type TicketMutation = WorkflowAction | "claim" | "owner" | "it-priority";
export type PublicCommentWriter = (tx: Prisma.TransactionClient, input: {
  ticketId: number; authorUserId: number; content: string;
}) => Promise<void>;

const TRANSITIONS: Record<WorkflowAction, { from: readonly TicketStatus[]; to: TicketStatus }> = {
  "start-work": { from: ["OPEN", "REOPENED"], to: "IN_PROGRESS" },
  "request-information": { from: ["OPEN", "IN_PROGRESS", "REOPENED"], to: "WAITING_FOR_REQUESTER" },
  "resume-work": { from: ["WAITING_FOR_REQUESTER"], to: "IN_PROGRESS" },
  "mark-resolved": { from: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"], to: "RESOLVED" },
  close: { from: ["RESOLVED"], to: "CLOSED" },
  cancel: { from: ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"], to: "CANCELLED" },
};

export function nextTicketStatus(action: WorkflowAction, status: TicketStatus, confirmedAt: Date | null): TicketStatus {
  if (!TRANSITIONS[action].from.includes(status) || (action === "close" && !confirmedAt)) throw new ApiError("INVALID_STATUS_TRANSITION");
  return TRANSITIONS[action].to;
}

function nullableOwner(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !PUBLIC_ID_PATTERN.test(value)) invalidField(field, "Select an eligible owner or null.");
  return value.toLowerCase();
}

export function parseTicketMutation(action: TicketMutation, body: unknown) {
  const input = record(body) ? body : {};
  if (action === "owner") return {
    ownerPublicId: nullableOwner(input.ownerPublicId, "ownerPublicId"),
    expectedOwnerPublicId: nullableOwner(input.expectedOwnerPublicId, "expectedOwnerPublicId"),
  };
  if (action === "it-priority") {
    if (typeof input.itPriority !== "string" || !PRIORITIES.includes(input.itPriority as typeof PRIORITIES[number])) invalidField("itPriority");
    return { itPriority: input.itPriority as typeof PRIORITIES[number] };
  }
  if (action === "request-information") {
    if (typeof input.content !== "string") invalidField("content", "Enter a message of 1–2000 characters.");
    const content = input.content.trim();
    if ([...content].length < 1 || [...content].length > 2000) invalidField("content", "Enter a message of 1–2000 characters.");
    return { content };
  }
  return {};
}

export async function mutateStaffTicket(
  prisma: PrismaClient, actor: TicketActor, publicId: string,
  action: TicketMutation, body: unknown, writePublicComment?: PublicCommentWriter,
) {
  if (actor.role !== "IT_STAFF" && actor.role !== "ADMINISTRATOR") throw new ApiError("FORBIDDEN");
  if (action === "claim" && actor.role !== "IT_STAFF") throw new ApiError("FORBIDDEN");
  if (!PUBLIC_ID_PATTERN.test(publicId)) throw new ApiError("NOT_FOUND");
  const input = parseTicketMutation(action, body);
  const ownership = action === "claim" || action === "owner";
  const conflict = ownership || action === "it-priority" ? "OWNERSHIP_CONFLICT" : "INVALID_STATUS_TRANSITION";
  try {
    return await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({ where: { publicId, deleted: false }, include: TICKET_DTO_INCLUDE });
      if (!ticket) throw new ApiError("NOT_FOUND");
      const isOwner = ticket.ownerUserId === actor.userId;
      if (actor.role === "ADMINISTRATOR" && !isOwner) throw new ApiError("FORBIDDEN");
      if (!ownership && action !== "it-priority" && action !== "cancel" && !isOwner) throw new ApiError("FORBIDDEN");
      const data: Prisma.TicketUncheckedUpdateManyInput = { updatedBy: actor.email };
      if (ownership) {
        if (["CANCELLED", "CLOSED"].includes(ticket.currentStatus)) throw new ApiError("INVALID_STATUS_TRANSITION");
        if (action === "claim" && ticket.ownerUserId !== null) throw new ApiError("OWNERSHIP_CONFLICT");
        if (action === "owner" && (ticket.owner?.publicId ?? null) !== input.expectedOwnerPublicId) throw new ApiError("OWNERSHIP_CONFLICT");
        const target = action === "claim" ? actor.userPublicId : input.ownerPublicId;
        if (target) {
          const owner = await tx.user.findFirst({ where: { ...ELIGIBLE_OWNER, publicId: target }, select: { id: true } });
          if (!owner) invalidField("ownerPublicId", "Select an active IT Staff or Administrator.");
          data.ownerUserId = owner.id;
          if (ticket.ownerUserId === null && ticket.currentStatus === "NEW") data.currentStatus = "OPEN";
        } else data.ownerUserId = null;
      } else if (action === "it-priority") {
        data.itPriority = input.itPriority;
      } else {
        data.currentStatus = nextTicketStatus(action, ticket.currentStatus, ticket.requesterResolutionConfirmedAt);
        if (action === "mark-resolved") data.requesterResolutionConfirmedAt = null;
        // Issue 6 must inject its writer. Never simulate a successful comment.
        if (action === "request-information" && !writePublicComment) throw new ApiError("INTERNAL_SERVER_ERROR");
      }
      const changed = await tx.ticket.updateMany({
        where: { id: ticket.id, deleted: false, ownerUserId: ticket.ownerUserId, currentStatus: ticket.currentStatus, requesterResolutionConfirmedAt: ticket.requesterResolutionConfirmedAt }, data,
      });
      if (changed.count !== 1) throw new ApiError(conflict);
      if (action === "request-information") {
        await writePublicComment!(tx, { ticketId: ticket.id, authorUserId: actor.userId, content: input.content! });
      }
      const updated = await tx.ticket.findUnique({ where: { id: ticket.id }, include: TICKET_DTO_INCLUDE });
      if (!updated) throw new ApiError("NOT_FOUND");
      return toTicketDTO(updated);
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (record(error) && error.code === "P2034") throw new ApiError(conflict);
    throw error;
  }
}
