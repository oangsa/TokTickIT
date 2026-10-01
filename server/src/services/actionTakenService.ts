import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import { ApiError } from "../http/errors.js";
import { buildPaginationMetadata } from "../http/pagination.js";
import { parseActionQuery } from "./actionTakenQueryValidator.js";
import { ACTION_DETAIL_INCLUDE, ACTION_LIST_SELECT, toActionDTO, toActionListDTO, type ActionTakenDTO } from "./actionTakenRepresentation.js";
import { WAIT_ATTEMPTS, WAIT_POLL_MS } from "./createTicketFlow.js";
import { hashIdempotencyRequest } from "./idempotencyRequest.js";
import { IdempotencyService, type ClaimInput } from "./idempotencyService.js";
import { buildFilter, buildOrderBy, buildWhere } from "./queryBuilder.js";
import { invalidField, PUBLIC_ID_PATTERN, record } from "./staffQueueQueryValidator.js";
import { ELIGIBLE_OWNER } from "./staffTicketReadService.js";
import { FencedOutError } from "./ticketService.js";
import type { TicketActor } from "./ticketWorkflowService.js";

type Transaction = Prisma.TransactionClient;
export function normalizedText(value: unknown, field: string, max = 2000, nullable = false, blankToNull = false): string | null {
  if (nullable && (value === undefined || value === null)) return null;
  if (typeof value !== "string") invalidField(field);
  const text = value.trim();
  if (!text && blankToNull) return null;
  if (!text || [...text].length > max) invalidField(field);
  return text;
}
function bodyRecord(value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!record(value)) invalidField("body");
  for (const field of Object.keys(value)) if (!fields.includes(field)) invalidField(field);
  return value;
}
function followUp(body: Record<string, unknown>) {
  if (typeof body.followUpRequired !== "boolean") invalidField("followUpRequired");
  if (body.followUpNote != null && typeof body.followUpNote !== "string") invalidField("followUpNote");
  return { followUpRequired: body.followUpRequired, followUpNote: body.followUpRequired ? normalizedText(body.followUpNote, "followUpNote") : null };
}
function attachmentIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((id: unknown) => typeof id !== "string" || !PUBLIC_ID_PATTERN.test(id))) invalidField("attachmentIds");
  const ids = value.map((id: string) => id.toLowerCase());
  if (new Set(ids).size !== ids.length) invalidField("attachmentIds");
  return ids.sort();
}
function assigneeId(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !PUBLIC_ID_PATTERN.test(value)) invalidField("assignedToUserPublicId");
  return value.toLowerCase();
}
export function parseActionCreate(value: unknown) {
  const body = bodyRecord(value, ["description", "assignedToUserPublicId", "followUpRequired", "followUpNote", "attachmentNotes", "attachmentIds"]);
  return { description: normalizedText(body.description, "description")!, assignedToUserPublicId: assigneeId(body.assignedToUserPublicId),
    ...followUp(body), attachmentNotes: normalizedText(body.attachmentNotes, "attachmentNotes", 2000, true, true), attachmentIds: attachmentIds(body.attachmentIds) };
}
export function parseActionEdit(value: unknown) {
  const body = bodyRecord(value, ["description", "result", "followUpRequired", "followUpNote", "attachmentNotes", "attachmentIds", "expectedVersion"]);
  return { description: normalizedText(body.description, "description")!, ...followUp(body), attachmentIds: attachmentIds(body.attachmentIds), expectedVersion: expectedVersion(body.expectedVersion),
    ...(Object.hasOwn(body, "result") ? { result: normalizedText(body.result, "result", 2000, true) } : {}),
    ...(Object.hasOwn(body, "attachmentNotes") ? { attachmentNotes: normalizedText(body.attachmentNotes, "attachmentNotes", 2000, true, true) } : {}) };
}
export function requireActionKey(value: unknown): string {
  if (typeof value !== "string" || !PUBLIC_ID_PATTERN.test(value)) invalidField("Idempotency-Key");
  return value.toLowerCase();
}
export type ActionLifecycle = "start" | "complete" | "cancel";
export function actionTransition(status: string, operation: ActionLifecycle) {
  if (status === "PLANNED" && operation === "start") return "IN_PROGRESS" as const;
  if (status === "IN_PROGRESS" && operation === "complete") return "COMPLETED" as const;
  if ((status === "PLANNED" || status === "IN_PROGRESS") && operation === "cancel") return "CANCELLED" as const;
  throw new ApiError("INVALID_ACTION_TRANSITION");
}
export function expectedVersion(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) invalidField("expectedVersion");
  return value;
}
export function parseActionLifecycle(operation: ActionLifecycle, value: unknown) {
  const fields = operation === "complete" ? ["expectedVersion", "result", "followUpRequired", "followUpNote"] : operation === "cancel" ? ["expectedVersion", "cancellationReason"] : ["expectedVersion"];
  const body = bodyRecord(value, fields);
  const version = expectedVersion(body.expectedVersion);
  return operation === "complete" ? { expectedVersion: version, result: normalizedText(body.result, "result")!, ...followUp(body) }
    : operation === "cancel" ? { expectedVersion: version, cancellationReason: normalizedText(body.cancellationReason, "cancellationReason", 500)! } : { expectedVersion: version };
}
function requireStaff(actor: TicketActor) {
  if (actor.role !== "IT_STAFF" && actor.role !== "ADMINISTRATOR") throw new ApiError("FORBIDDEN");
}
export class ActionTakenService {
  constructor(private readonly prisma: PrismaClient) {}
  private async write<T>(callback: (tx: Transaction) => Promise<T>): Promise<T> {
    try { return await this.prisma.$transaction(callback); }
    catch (error) {
      if (record(error) && (error.code === "P2034" || (record(error.meta) && ["40001", "40P01"].includes(String(error.meta.code))))) throw new ApiError("CONFLICT");
      throw error;
    }
  }
  async ticket(database: Transaction | PrismaClient, actor: TicketActor, ticketPublicId: string, lock = false) {
    if (!PUBLIC_ID_PATTERN.test(ticketPublicId)) throw new ApiError("NOT_FOUND");
    // Prisma has no row-lock API. A shared lock freezes parent state/owner until mutation commits.
    if (lock) await database.$queryRaw`SELECT id FROM ticket WHERE public_id = ${ticketPublicId.toLowerCase()}::uuid AND deleted = false FOR SHARE`;
    const ticket = await database.ticket.findFirst({ where: { publicId: ticketPublicId.toLowerCase(), deleted: false, ...(actor.role === "REQUESTER" ? { requesterId: actor.userId } : {}) }, select: { id: true, publicId: true, currentStatus: true, ownerUserId: true } });
    if (!ticket) throw new ApiError("NOT_FOUND");
    return ticket;
  }
  async detail(actor: TicketActor, ticketPublicId: string, actionPublicId: string) {
    const ticket = await this.ticket(this.prisma, actor, ticketPublicId);
    if (!PUBLIC_ID_PATTERN.test(actionPublicId)) throw new ApiError("NOT_FOUND");
    const action = await this.prisma.actionTaken.findFirst({ where: { ticketId: ticket.id, publicId: actionPublicId.toLowerCase() }, include: ACTION_DETAIL_INCLUDE });
    if (!action) throw new ApiError("NOT_FOUND");
    return toActionDTO(action);
  }
  async list(actor: TicketActor, ticketPublicId: string, input: unknown) {
    const query = parseActionQuery(input);
    return this.prisma.$transaction(async (tx) => {
      const ticket = await this.ticket(tx, actor, ticketPublicId);
      const where = buildWhere({ base: [{ ticketId: ticket.id }], search: query.search }) as Prisma.ActionTakenWhereInput;
      for (const expression of query.filters) {
        const relation = expression.field === "assignedToUserPublicId" ? "assignedTo" : expression.field === "performedByUserPublicId" ? "performedBy" : null;
        const fragment = !relation ? buildFilter(expression) : expression.condition === "ISNULL" ? { [relation]: null }
          : expression.condition === "ISNOTNULL" ? { [relation]: { isNot: null } } : { [relation]: { is: buildFilter({ ...expression, field: "publicId" }) } };
        (where.AND as Prisma.ActionTakenWhereInput[]).push(fragment);
      }
      const totalItems = await tx.actionTaken.count({ where });
      const skip = (query.pageNumber - 1) * query.pageSize;
      const rows = skip < totalItems ? await tx.actionTaken.findMany({ where, select: ACTION_LIST_SELECT, orderBy: buildOrderBy(query.order), skip, take: query.pageSize }) : [];
      return { items: rows.map(toActionListDTO), pagination: buildPaginationMetadata(query.pageNumber, query.pageSize, totalItems) };
    }, { isolationLevel: "RepeatableRead" });
  }
  private async mutable(tx: Transaction, actor: TicketActor, ticketPublicId: string, actionPublicId: string) {
    const ticket = await this.ticket(tx, actor, ticketPublicId, true);
    if (!PUBLIC_ID_PATTERN.test(actionPublicId)) throw new ApiError("NOT_FOUND");
    // Serializes no-op assignments too: their expectedVersion check observes a locked current row.
    await tx.$queryRaw`SELECT id FROM action_taken WHERE ticket_id = ${ticket.id} AND public_id = ${actionPublicId.toLowerCase()}::uuid FOR UPDATE`;
    const action = await tx.actionTaken.findFirst({ where: { ticketId: ticket.id, publicId: actionPublicId.toLowerCase() }, include: ACTION_DETAIL_INCLUDE });
    if (!action) throw new ApiError("NOT_FOUND");
    return { ticket, action };
  }
  private async update(tx: Transaction, actor: TicketActor, action: { id: number; version: number; status: Prisma.ActionTakenWhereInput["status"] }, data: Prisma.ActionTakenUncheckedUpdateManyInput) {
    const changed = await tx.actionTaken.updateMany({ where: { id: action.id, version: action.version, status: action.status }, data: { ...data, version: { increment: 1 }, updatedBy: actor.email, updatedAt: new Date() } });
    if (changed.count !== 1) throw new ApiError("CONFLICT");
  }
  private async activity(tx: Transaction, actor: TicketActor, ticketId: number, actionTakenId: number, action: "ACTION_STARTED" | "ACTION_COMPLETED" | "ACTION_CANCELLED" | "ACTION_UPDATED" | "ACTION_ASSIGNED" | "ACTION_REASSIGNED" | "ACTION_UNASSIGNED", assignment?: { previousAssignedToUserId: number | null; assignedToUserId: number | null }) {
    await tx.ticketActivity.create({ data: { ticketId, performedByUserId: actor.userId, action, createdBy: actor.email, updatedBy: actor.email,
      actionTaken: { create: { actionTakenId, ...assignment } } } });
  }
  private async updatedDto(tx: Transaction, id: number) {
    const row = await tx.actionTaken.findFirst({ where: { id }, include: ACTION_DETAIL_INCLUDE });
    if (!row) throw new ApiError("INTERNAL_SERVER_ERROR");
    return { id, dto: toActionDTO(row) };
  }
  async lifecycle(actor: TicketActor, ticketPublicId: string, actionPublicId: string, operation: ActionLifecycle, value: unknown, keyValue: unknown) {
    requireStaff(actor);
    await this.detail(actor, ticketPublicId, actionPublicId);
    const body = parseActionLifecycle(operation, value);
    const key = requireActionKey(keyValue);
    const path = `/api/tickets/${ticketPublicId.toLowerCase()}/actions/${actionPublicId.toLowerCase()}/${operation}`;
    return this.idempotent(actor, path, key, body, async (tx) => {
      const { ticket, action } = await this.mutable(tx, actor, ticketPublicId, actionPublicId);
      const assignee = actor.userId === action.assignedToUserId;
      const owner = actor.userId === ticket.ownerUserId;
      const creator = actor.userId === action.creatorUserId;
      // An unassigned Start has no assignee to authorize; its state error is checked below.
      if (operation === "start" ? action.assignedToUserId !== null && !assignee : operation === "complete" ? !assignee && !owner : !assignee && !owner && !creator) {
        // Impossible operations retain their lifecycle-state error.
        actionTransition(action.status, operation);
        throw new ApiError("FORBIDDEN");
      }
      if (action.version !== body.expectedVersion) throw new ApiError("CONFLICT");
      const status = actionTransition(action.status, operation);
      if (operation === "start" && action.assignedToUserId === null) throw new ApiError("INVALID_ACTION_TRANSITION");
      const now = new Date();
      const { expectedVersion: _version, ...fields } = body;
      await this.update(tx, actor, action, { ...fields, status,
        ...(operation === "start" ? { startedAt: now } : operation === "complete" ? { completedAt: now, performedByUserId: actor.userId } : { cancelledAt: now }) });
      await this.activity(tx, actor, ticket.id, action.id, operation === "start" ? "ACTION_STARTED" : operation === "complete" ? "ACTION_COMPLETED" : "ACTION_CANCELLED");
      return this.updatedDto(tx, action.id);
    }, false);
  }
  async assign(actor: TicketActor, ticketPublicId: string, actionPublicId: string, value: unknown) {
    requireStaff(actor);
    const body = bodyRecord(value, ["assignedToUserPublicId", "expectedVersion"]);
    const version = expectedVersion(body.expectedVersion);
    const publicId = assigneeId(body.assignedToUserPublicId);
    return this.write(async (tx) => {
      const { ticket, action } = await this.mutable(tx, actor, ticketPublicId, actionPublicId);
      if (action.version !== version) throw new ApiError("CONFLICT");
      if (action.status === "COMPLETED" || action.status === "CANCELLED") throw new ApiError("INVALID_ACTION_TRANSITION");
      if (publicId === (action.assignedTo?.publicId ?? null)) return toActionDTO(action);
      const assignedToUserId = await this.assignee(tx, publicId);
      await this.update(tx, actor, action, { assignedToUserId });
      await this.activity(tx, actor, ticket.id, action.id, assignedToUserId === null ? "ACTION_UNASSIGNED" : action.assignedToUserId === null ? "ACTION_ASSIGNED" : "ACTION_REASSIGNED",
        { previousAssignedToUserId: action.assignedToUserId, assignedToUserId });
      return (await this.updatedDto(tx, action.id)).dto;
    });
  }
  async edit(actor: TicketActor, ticketPublicId: string, actionPublicId: string, value: unknown) {
    requireStaff(actor);
    const body = parseActionEdit(value);
    return this.write(async (tx) => {
      const { ticket, action } = await this.mutable(tx, actor, ticketPublicId, actionPublicId);
      const terminal = action.status === "COMPLETED" || action.status === "CANCELLED";
      if (!terminal && ![action.creatorUserId, action.assignedToUserId, ticket.ownerUserId].includes(actor.userId)) throw new ApiError("FORBIDDEN");
      if (action.version !== body.expectedVersion) throw new ApiError("CONFLICT");
      if (terminal) throw new ApiError("INVALID_ACTION_TRANSITION");
      const files = await this.attachments(tx, ticket.id, body.attachmentIds);
      const { attachmentIds: _ids, expectedVersion: _version, ...fields } = body;
      await this.update(tx, actor, action, fields);
      const existing = await tx.actionTakenAttachment.findMany({ where: { actionTakenId: action.id }, select: { attachmentId: true } });
      const current = new Set(existing.map((join) => join.attachmentId));
      const removed = [...current].filter((id) => !files.includes(id));
      const added = files.filter((id) => !current.has(id));
      if (removed.length) await tx.actionTakenAttachment.deleteMany({ where: { actionTakenId: action.id, attachmentId: { in: removed } } });
      if (added.length) await tx.actionTakenAttachment.createMany({ data: added.map((attachmentId) => ({ actionTakenId: action.id, attachmentId, createdBy: actor.email, updatedBy: actor.email })) });
      await this.activity(tx, actor, ticket.id, action.id, "ACTION_UPDATED");
      return (await this.updatedDto(tx, action.id)).dto;
    });
  }
  private async assignee(tx: Transaction, publicId: string | null) {
    if (publicId === null) return null;
    await tx.$queryRaw`SELECT id FROM "user" WHERE public_id = ${publicId}::uuid FOR SHARE`;
    const user = await tx.user.findFirst({ where: { ...ELIGIBLE_OWNER, publicId }, select: { id: true } });
    if (!user) invalidField("assignedToUserPublicId");
    return user.id;
  }
  private async attachments(tx: Transaction, ticketId: number, ids: string[]) {
    if (!ids.length) return [];
    // Lock evidence against concurrent removal; bytes are never loaded.
    await tx.$queryRaw`SELECT id FROM attachment WHERE ticket_id = ${ticketId} AND storage_key = ANY(${ids}::uuid[]) FOR SHARE`;
    const files = await tx.attachment.findMany({ where: { ticketId, storageKey: { in: ids }, deleted: false, removalReason: null }, select: { id: true } });
    if (files.length !== ids.length) throw new ApiError("NOT_FOUND");
    return files.map((file) => file.id);
  }
  private async idempotent(actor: TicketActor, path: string, key: string, body: unknown, mutation: (tx: Transaction) => Promise<{ id: number; dto: ActionTakenDTO }>, create: boolean) {
    const idempotency = new IdempotencyService(this.prisma);
    const input: Omit<ClaimInput, "now"> = { userId: actor.userId, actor: actor.email, method: "POST", resourcePath: path, key, requestHash: hashIdempotencyRequest("POST", path, body) };
    for (let round = 0; round < 3; round++) {
      let resolution = await idempotency.resolve({ ...input, now: new Date() });
      for (let attempt = 0; resolution.kind === "WAIT" && attempt < WAIT_ATTEMPTS; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, WAIT_POLL_MS));
        resolution = await idempotency.resolve({ ...input, now: new Date() });
      }
      if (resolution.kind === "CONFLICT") throw new ApiError("IDEMPOTENCY_CONFLICT");
      if (resolution.kind === "REPLAY_ACTION") {
        const row = await this.prisma.actionTaken.findFirst({ where: { id: resolution.actionTakenId, ticket: { publicId: path.split("/")[3], deleted: false } }, include: ACTION_DETAIL_INCLUDE });
        if (!row) throw new ApiError("NOT_FOUND");
        return { status: 200, action: toActionDTO(row) };
      }
      if (resolution.kind !== "OWNED") throw new ApiError("INTERNAL_SERVER_ERROR");
      const owned = resolution;
      try {
        const action = await this.write(async (tx) => {
          if (!await idempotency.lockAndVerify(tx, { ...input, processingStartedAt: owned.processingStartedAt })) throw new FencedOutError();
          const result = await mutation(tx);
          await idempotency.complete(tx, { recordId: owned.recordId, result: { actionTakenId: result.id }, now: new Date(), actor: actor.email });
          return result.dto;
        });
        return { status: create ? 201 : 200, action };
      } catch (error) {
        if (error instanceof FencedOutError) continue;
        await idempotency.release({ ...input, processingStartedAt: owned.processingStartedAt });
        throw error;
      }
    }
    throw new ApiError("INTERNAL_SERVER_ERROR");
  }
  async create(actor: TicketActor, ticketPublicId: string, value: unknown, keyValue: unknown) {
    requireStaff(actor);
    await this.ticket(this.prisma, actor, ticketPublicId);
    const body = parseActionCreate(value);
    const key = requireActionKey(keyValue);
    const path = `/api/tickets/${ticketPublicId.toLowerCase()}/actions`;
    return this.idempotent(actor, path, key, body, async (tx) => {
      const ticket = await this.ticket(tx, actor, ticketPublicId, true);
      if (!["OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"].includes(ticket.currentStatus)) throw new ApiError("INVALID_ACTION_TRANSITION");
      const assignedToUserId = await this.assignee(tx, body.assignedToUserPublicId);
      const files = await this.attachments(tx, ticket.id, body.attachmentIds);
      const { attachmentIds: _ids, assignedToUserPublicId: _assignee, ...fields } = body;
      const now = new Date();
      const row = await tx.actionTaken.create({ data: { ...fields, ticketId: ticket.id, creatorUserId: actor.userId, assignedToUserId, status: "PLANNED", version: 1,
        createdAt: now, updatedAt: now, createdBy: actor.email, updatedBy: actor.email,
        attachments: { create: files.map((attachmentId) => ({ attachmentId, createdBy: actor.email, updatedBy: actor.email })) } }, include: ACTION_DETAIL_INCLUDE });
      await tx.ticketActivity.create({ data: { ticketId: ticket.id, performedByUserId: actor.userId, action: "ACTION_CREATED", createdBy: actor.email, updatedBy: actor.email,
        actionTaken: { create: { actionTakenId: row.id } } } });
      return { id: row.id, dto: toActionDTO(row) };
    }, true);
  }
}
