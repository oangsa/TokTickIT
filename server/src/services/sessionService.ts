import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { Prisma, PrismaClient, UserSession } from "../generated/prisma/client.js";

export const RESTRICTED_SESSION_MS = 15 * 60 * 1000;
export const FULL_SESSION_MS = 8 * 60 * 60 * 1000;
export const REMEMBER_IDLE_MS = 30 * 24 * 60 * 60 * 1000;
export const REMEMBER_ABSOLUTE_MS = 90 * 24 * 60 * 60 * 1000;
export const PREVIOUS_REFRESH_WINDOW_MS = 30 * 1000;

export class SessionInvalidError extends Error {}

export const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REFRESH_SECRET_PATTERN = /^[A-Za-z0-9_-]+$/;

export function isValidSessionId(value: string): boolean {
  return SESSION_ID_PATTERN.test(value);
}

export interface SessionTokenResult {
  session: UserSession;
  refreshToken: string;
}

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function createRefreshToken(sessionId: string): string {
  return `${sessionId}.${randomBytes(32).toString("base64url")}`;
}

function parseSessionId(token: unknown): string | null {
  if (typeof token !== "string") {
    return null;
  }

  const match = /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([A-Za-z0-9_-]+)$/i.exec(token);
  return match && REFRESH_SECRET_PATTERN.test(match[2] as string) ? match[1] as string : null;
}

function expiryForSession(input: { stage: "FULL" | "PASSWORD_CHANGE_REQUIRED"; rememberMe: boolean; createdAt: Date }): Date {
  if (input.stage === "PASSWORD_CHANGE_REQUIRED") {
    return new Date(input.createdAt.getTime() + RESTRICTED_SESSION_MS);
  }
  return new Date(
    input.createdAt.getTime() +
      (input.rememberMe ? REMEMBER_ABSOLUTE_MS : FULL_SESSION_MS),
  );
}

function sessionExpired(session: UserSession, now: Date): boolean {
  if (session.revokedAt !== null || now >= session.absoluteExpiresAt) {
    return true;
  }
  if (session.stage === "FULL" && session.rememberMe) {
    return now.getTime() >= session.lastUsedAt.getTime() + REMEMBER_IDLE_MS;
  }
  return false;
}

export class SessionService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: {
    userId: number;
    stage: "FULL" | "PASSWORD_CHANGE_REQUIRED";
    rememberMe: boolean;
    now?: Date;
    userAgent?: string;
    ipAddress?: string;
  }, client: Pick<Prisma.TransactionClient, "userSession"> = this.prisma): Promise<SessionTokenResult> {
    const now = input.now ?? new Date();
    const id = randomUUID();
    const refreshToken = createRefreshToken(id);
    const session = await client.userSession.create({
      data: {
        id,
        userId: input.userId,
        stage: input.stage,
        rememberMe: input.stage === "FULL" && input.rememberMe,
        refreshTokenHash: hashRefreshToken(refreshToken),
        createdAt: now,
        lastUsedAt: now,
        absoluteExpiresAt: expiryForSession({
          stage: input.stage,
          rememberMe: input.stage === "FULL" && input.rememberMe,
          createdAt: now,
        }),
        userAgent: input.userAgent?.slice(0, 512),
        ipAddress: input.ipAddress?.slice(0, 64),
      },
    });
    return { session, refreshToken };
  }

  async refresh(token: string, now = new Date()): Promise<SessionTokenResult> {
    const sessionId = parseSessionId(token);
    if (!sessionId) {
      throw new SessionInvalidError();
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM user_session WHERE id = ${sessionId}::uuid FOR UPDATE
      `;
      const session = await tx.userSession.findUnique({ where: { id: sessionId } });
      if (!session || sessionExpired(session, now)) {
        if (session && session.revokedAt === null) {
          await tx.userSession.update({
            where: { id: session.id },
            data: { revokedAt: now, revokeReason: "expired" },
          });
        }
        return null;
      }

      const presentedHash = hashRefreshToken(token);
      const isCurrent = presentedHash === session.refreshTokenHash;
      const isPrevious =
        presentedHash === session.previousRefreshTokenHash &&
        session.previousRefreshValidUntil !== null &&
        now.getTime() <= session.previousRefreshValidUntil.getTime();

      if (!isCurrent && !isPrevious) {
        await tx.userSession.update({
          where: { id: session.id },
          data: { revokedAt: now, revokeReason: "refresh_reuse" },
        });
        return null;
      }

      const refreshToken = createRefreshToken(session.id);
      const rotated = await tx.userSession.update({
        where: { id: session.id },
        data: {
          previousRefreshTokenHash: session.refreshTokenHash,
          previousRefreshValidUntil: new Date(now.getTime() + PREVIOUS_REFRESH_WINDOW_MS),
          refreshTokenHash: hashRefreshToken(refreshToken),
          lastUsedAt: now,
        },
      });
      return { session: rotated, refreshToken };
    });

    /* Return only after the transaction commits, so reuse/expiry revocation is durable. */
    if (result === null) {
      throw new SessionInvalidError();
    }
    return result;
  }

  async findActive(sessionId: string, now = new Date()): Promise<UserSession | null> {
    if (!isValidSessionId(sessionId)) {
      return null;
    }
    const session = await this.prisma.userSession.findUnique({ where: { id: sessionId } });
    if (!session || sessionExpired(session, now)) {
      return null;
    }
    return session;
  }

  async revokeByToken(token: string, now = new Date()): Promise<void> {
    const sessionId = parseSessionId(token);
    if (!sessionId) {
      return;
    }

    const presentedHash = hashRefreshToken(token);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM user_session WHERE id = ${sessionId}::uuid FOR UPDATE
      `;
      const session = await tx.userSession.findUnique({ where: { id: sessionId } });
      if (!session || session.revokedAt !== null) {
        return;
      }

      const currentMatches = presentedHash === session.refreshTokenHash;
      const previousMatches = presentedHash === session.previousRefreshTokenHash &&
        session.previousRefreshValidUntil !== null &&
        now.getTime() <= session.previousRefreshValidUntil.getTime();
      if (!currentMatches && !previousMatches) {
        return;
      }

      await tx.userSession.update({
        where: { id: session.id },
        data: { revokedAt: now, revokeReason: "logout" },
      });
    });
  }

  async revokeSession(sessionId: string, reason: string, now = new Date()): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: now, revokeReason: reason.slice(0, 100) },
    });
  }

  async revokeAllForUser(userId: number, reason: string, now = new Date()): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now, revokeReason: reason.slice(0, 100) },
    });
  }
}

export function refreshTokenHash(token: string): string {
  return hashRefreshToken(token);
}

export type SessionTransaction = Prisma.TransactionClient;
