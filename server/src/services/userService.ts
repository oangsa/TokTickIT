import type { Prisma, PrismaClient, User, UserRole } from "../generated/prisma/client.js";
import { ApiError } from "../http/errors.js";
import { buildPaginationMetadata, type PaginationMetadata } from "../http/pagination.js";
import { generateInitialPassword } from "./initialPasswordGenerator.js";
import {
  hashPassword,
  NORMAL_ARGON2_PROFILE,
  TEST_ARGON2_PROFILE,
} from "./passwordService.js";
import { PUBLIC_ID_PATTERN, invalidField, record } from "./staffQueueQueryValidator.js";
import type { TicketActor } from "./ticketWorkflowService.js";
import type { UserListQuery } from "./userQueryValidator.js";

export interface UserDTO {
  publicId: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserListItemDTO {
  publicId: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export interface CreateUserResponseDTO {
  user: UserDTO;
  initialPassword: string;
}

export interface ResetInitialPasswordResponseDTO {
  initialPassword: string;
}

export function toUserDTO(user: User): UserDTO {
  return {
    publicId: user.publicId,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function validateUserName(name: unknown): string {
  if (typeof name !== "string") {
    invalidField("name", "Name is required.");
  }
  const trimmed = name.trim();
  const len = [...trimmed].length;
  if (len < 1 || len > 100) {
    invalidField("name", "Name must be between 1 and 100 characters.");
  }
  return trimmed;
}

export function validateUserEmail(email: unknown): string {
  if (typeof email !== "string") {
    invalidField("email", "Email is required.");
  }
  const trimmed = email.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
  ) {
    invalidField("email", "Enter a valid email address.");
  }
  return trimmed;
}

export function validateUserRole(role: unknown): UserRole {
  if (
    typeof role !== "string" ||
    !["REQUESTER", "IT_STAFF", "ADMINISTRATOR"].includes(role)
  ) {
    invalidField("role", "Role must be REQUESTER, IT_STAFF, or ADMINISTRATOR.");
  }
  return role as UserRole;
}

export function validateIsActive(isActive: unknown): boolean {
  if (typeof isActive !== "boolean") {
    invalidField("isActive", "isActive must be a boolean.");
  }
  return isActive;
}

export async function listUsers(
  prisma: PrismaClient,
  query: UserListQuery,
): Promise<{ items: UserListItemDTO[]; pagination: PaginationMetadata }> {
  const searchConditions = query.search
    ? query.search.fields.map((f) => ({
        [f]: { contains: query.search!.term, mode: "insensitive" },
      }))
    : [];

  const filterConditions = query.filters.map((f) => ({
    [f.field]: f.value,
  }));

  const where: Prisma.UserWhereInput = {
    deleted: false,
    AND: [
      ...(searchConditions.length > 0 ? [{ OR: searchConditions }] : []),
      ...filterConditions,
    ],
  };

  const orderBy: Prisma.UserOrderByWithRelationInput[] = query.order.map((o) => ({
    [o.field]: o.direction,
  }));

  const totalItems = await prisma.user.count({ where });

  const users = await prisma.user.findMany({
    where,
    orderBy,
    skip: (query.pageNumber - 1) * query.pageSize,
    take: query.pageSize,
    select: {
      publicId: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
    },
  });

  return {
    items: users,
    pagination: buildPaginationMetadata(query.pageNumber, query.pageSize, totalItems),
  };
}

export async function getUser(prisma: PrismaClient, publicId: string): Promise<UserDTO> {
  if (!PUBLIC_ID_PATTERN.test(publicId)) {
    throw new ApiError("NOT_FOUND");
  }

  const user = await prisma.user.findFirst({
    where: { publicId, deleted: false },
  });

  if (!user) {
    throw new ApiError("NOT_FOUND");
  }

  return toUserDTO(user);
}

export async function createUser(
  prisma: PrismaClient,
  actor: TicketActor,
  body: unknown,
): Promise<CreateUserResponseDTO> {
  if (!record(body)) {
    invalidField("body");
  }

  for (const key of Object.keys(body)) {
    if (!["name", "email", "role", "isActive"].includes(key)) {
      invalidField(key, `Unknown field '${key}'.`);
    }
  }

  const name = validateUserName(body.name);
  const email = validateUserEmail(body.email);
  const role = validateUserRole(body.role);
  const isActive = body.isActive !== undefined ? validateIsActive(body.isActive) : true;

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });

  if (existing) {
    throw new ApiError("DUPLICATE_EMAIL");
  }

  const initialPassword = generateInitialPassword(16);
  const profile = process.env.NODE_ENV === "test" ? TEST_ARGON2_PROFILE : NORMAL_ARGON2_PROFILE;
  const passwordHash = await hashPassword(initialPassword, profile);

  try {
    const created = await prisma.user.create({
      data: {
        name,
        email,
        role,
        isActive,
        passwordHash,
        mustChangePassword: true,
        createdBy: actor.email,
        updatedBy: actor.email,
      },
    });

    return {
      user: toUserDTO(created),
      initialPassword,
    };
  } catch (error: unknown) {
    if (record(error) && error.code === "P2002") {
      throw new ApiError("DUPLICATE_EMAIL");
    }
    throw error;
  }
}

export async function updateUser(
  prisma: PrismaClient,
  actor: TicketActor,
  targetPublicId: string,
  body: unknown,
): Promise<UserDTO> {
  if (!PUBLIC_ID_PATTERN.test(targetPublicId)) {
    throw new ApiError("NOT_FOUND");
  }

  if (!record(body)) {
    invalidField("body");
  }

  const allowedKeys = ["name", "email", "role", "isActive"];
  const keys = Object.keys(body);
  if (keys.length === 0) {
    invalidField("body", "At least one field must be provided for update.");
  }

  for (const key of keys) {
    if (!allowedKeys.includes(key)) {
      invalidField(key, `Unknown field '${key}'.`);
    }
  }

  const name = body.name !== undefined ? validateUserName(body.name) : undefined;
  const email = body.email !== undefined ? validateUserEmail(body.email) : undefined;
  const role = body.role !== undefined ? validateUserRole(body.role) : undefined;
  const isActive = body.isActive !== undefined ? validateIsActive(body.isActive) : undefined;

  try {
    return await prisma.$transaction(
      async (tx) => {
        const target = await tx.user.findFirst({
          where: { publicId: targetPublicId, deleted: false },
        });

        if (!target) {
          throw new ApiError("NOT_FOUND");
        }

        const isSelf =
          actor.userId === target.id ||
          actor.userPublicId.toLowerCase() === target.publicId.toLowerCase();

        // Self-safety checks
        if (isSelf) {
          if (isActive === false) {
            throw new ApiError("CONFLICT", undefined, "An Administrator cannot deactivate their own account.");
          }
          if (role !== undefined && role !== target.role) {
            throw new ApiError("CONFLICT", undefined, "An Administrator cannot change their own role.");
          }
        }

        // Last active Administrator protection
        if (target.role === "ADMINISTRATOR" && target.isActive) {
          const isDemoting = role !== undefined && role !== "ADMINISTRATOR";
          const isDeactivating = isActive === false;
          if (isDemoting || isDeactivating) {
            const activeAdmins = await tx.user.count({
              where: { role: "ADMINISTRATOR", isActive: true, deleted: false },
            });
            if (activeAdmins <= 1) {
              throw new ApiError("CONFLICT", undefined, "The last active Administrator cannot be deactivated or demoted.");
            }
          }
        }

        // Email duplicate check
        if (email !== undefined && email.toLowerCase() !== target.email.toLowerCase()) {
          const dup = await tx.user.findFirst({
            where: { email: { equals: email, mode: "insensitive" }, id: { not: target.id } },
            select: { id: true },
          });
          if (dup) {
            throw new ApiError("DUPLICATE_EMAIL");
          }
        }

        const data: Prisma.UserUpdateInput = {
          updatedBy: actor.email,
        };
        if (name !== undefined) data.name = name;
        if (email !== undefined) data.email = email;
        if (role !== undefined) data.role = role;
        if (isActive !== undefined) data.isActive = isActive;

        const updated = await tx.user.update({
          where: { id: target.id },
          data,
        });

        // Coupled security side effects
        const emailChanged = email !== undefined && email.toLowerCase() !== target.email.toLowerCase();
        const roleChanged = role !== undefined && role !== target.role;
        const deactivated = isActive === false && target.isActive === true;

        if (emailChanged || roleChanged || deactivated) {
          const revokeReason = emailChanged
            ? "EMAIL_CHANGED"
            : roleChanged
              ? "ROLE_CHANGED"
              : "DEACTIVATED";

          await tx.userSession.updateMany({
            where: { userId: target.id, revokedAt: null },
            data: { revokedAt: new Date(), revokeReason },
          });
        }

        // Unassign tickets if deactivated or role demoted from owner-eligible to REQUESTER
        const demotedToRequester =
          role === "REQUESTER" &&
          (target.role === "IT_STAFF" || target.role === "ADMINISTRATOR");

        if (deactivated || demotedToRequester) {
          await tx.ticket.updateMany({
            where: { ownerUserId: target.id },
            data: { ownerUserId: null, updatedBy: actor.email },
          });
        }

        return toUserDTO(updated);
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error: unknown) {
    if (isSerializationConflict(error)) {
      throw new ApiError("CONFLICT");
    }
    if (record(error) && error.code === "P2002") {
      throw new ApiError("DUPLICATE_EMAIL");
    }
    throw error;
  }
}

export async function resetInitialPassword(
  prisma: PrismaClient,
  actor: TicketActor,
  targetPublicId: string,
): Promise<ResetInitialPasswordResponseDTO> {
  if (!PUBLIC_ID_PATTERN.test(targetPublicId)) {
    throw new ApiError("NOT_FOUND");
  }

  if (actor.userPublicId.toLowerCase() === targetPublicId.toLowerCase()) {
    throw new ApiError("CONFLICT", undefined, "An Administrator cannot reset their own initial password.");
  }

  const initialPassword = generateInitialPassword(16);
  const profile = process.env.NODE_ENV === "test" ? TEST_ARGON2_PROFILE : NORMAL_ARGON2_PROFILE;
  const passwordHash = await hashPassword(initialPassword, profile);

  try {
    return await prisma.$transaction(
      async (tx) => {
        const target = await tx.user.findFirst({
          where: { publicId: targetPublicId, deleted: false },
        });

        if (!target) {
          throw new ApiError("NOT_FOUND");
        }

        await tx.user.update({
          where: { id: target.id },
          data: {
            passwordHash,
            mustChangePassword: true,
            updatedBy: actor.email,
          },
        });

        await tx.userSession.updateMany({
          where: { userId: target.id, revokedAt: null },
          data: { revokedAt: new Date(), revokeReason: "INITIAL_PASSWORD_RESET" },
        });

        return { initialPassword };
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error: unknown) {
    if (isSerializationConflict(error)) {
      throw new ApiError("CONFLICT");
    }
    throw error;
  }
}

const TRANSIENT_CODES = new Set([
  "P2034",
  "40001",
  "40P01",
  "TransactionWriteConflict",
  "TransactionDeadlock",
]);

function isSerializationConflict(error: unknown): boolean {
  if (typeof error === "object" && error !== null) {
    const err = error as { message?: unknown; name?: unknown; code?: unknown; cause?: unknown };
    if (
      typeof err.message === "string" &&
      (err.message.includes("TransactionWriteConflict") ||
        err.message.includes("TransactionDeadlock"))
    ) {
      return true;
    }
    if (typeof err.code === "string" && TRANSIENT_CODES.has(err.code)) {
      return true;
    }
    if (typeof err.cause === "object" && err.cause !== null) {
      const cause = err.cause as { code?: unknown; originalCode?: unknown; message?: unknown };
      if (typeof cause.code === "string" && TRANSIENT_CODES.has(cause.code)) return true;
      if (typeof cause.originalCode === "string" && TRANSIENT_CODES.has(cause.originalCode)) return true;
      if (
        typeof cause.message === "string" &&
        (cause.message.includes("TransactionWriteConflict") ||
          cause.message.includes("TransactionDeadlock"))
      ) {
        return true;
      }
    }
  }
  return false;
}
