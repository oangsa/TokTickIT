import { randomBytes, randomUUID } from "node:crypto";

import { vi, type Mock } from "vitest";

import { JwtService } from "../../../src/services/jwtService.js";

export interface AuthTestUser {
  id: number;
  publicId: string;
  name: string;
  email: string;
  role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
  passwordHash: string;
  mustChangePassword: false;
  isActive: true;
  deleted: false;
  createdBy: string;
  createdAt: Date;
  updatedBy: string;
  updatedAt: Date;
}

interface AuthTestSession {
  id: string;
  userId: number;
  stage: "FULL";
  rememberMe: false;
  refreshTokenHash: string;
  previousRefreshTokenHash: null;
  previousRefreshValidUntil: null;
  createdAt: Date;
  lastUsedAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: null;
  revokeReason: null;
  userAgent: null;
  ipAddress: null;
}

interface AuthPrismaMock {
  user?: { findUnique: Mock };
  userSession?: { findUnique: Mock };
  [key: string]: unknown;
}

export type RequesterTokens = Map<number, string>;

const PUBLIC_ID_PREFIX = "70000000-0000-4000-8000-";

export function testUser(input: { id: number; name: string; email: string }): AuthTestUser {
  const suffix = input.id.toString(12).padStart(12, "0");
  const timestamp = new Date("2026-08-20T01:00:00.000Z");

  return {
    ...input,
    publicId: `${PUBLIC_ID_PREFIX}${suffix}`,
    role: "REQUESTER",
    passwordHash: "test-only-unused-password-hash",
    mustChangePassword: false,
    isActive: true,
    deleted: false,
    createdBy: "test",
    createdAt: timestamp,
    updatedBy: "test",
    updatedAt: timestamp,
  };
}

function ensureAuthModels(prisma: AuthPrismaMock): asserts prisma is Required<AuthPrismaMock> {
  prisma.user ??= { findUnique: vi.fn() };
  prisma.userSession ??= { findUnique: vi.fn() };
}

export async function configureRequesterAuth(
  prisma: AuthPrismaMock,
  users: AuthTestUser[],
): Promise<RequesterTokens> {
  ensureAuthModels(prisma);

  const secret = randomBytes(32).toString("base64url");
  process.env.JWT_SECRET = secret;

  const usersById = new Map(users.map((user) => [user.id, user]));
  const usersByPublicId = new Map(users.map((user) => [user.publicId, user]));
  const usersByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
  const sessions = new Map<string, AuthTestSession>();
  const tokens: RequesterTokens = new Map();
  const now = new Date();

  prisma.user.findUnique.mockImplementation(({ where }: { where: Record<string, unknown> }) => {
    if (typeof where.id === "number") return Promise.resolve(usersById.get(where.id) ?? null);
    if (typeof where.publicId === "string") {
      return Promise.resolve(usersByPublicId.get(where.publicId) ?? null);
    }
    if (typeof where.email === "string") {
      return Promise.resolve(usersByEmail.get(where.email.toLowerCase()) ?? null);
    }
    return Promise.resolve(null);
  });
  prisma.userSession.findUnique.mockImplementation(({ where }: { where: Record<string, unknown> }) =>
    Promise.resolve(typeof where.id === "string" ? sessions.get(where.id) ?? null : null),
  );

  for (const user of users) {
    const sessionId = randomUUID();
    sessions.set(sessionId, {
      id: sessionId,
      userId: user.id,
      stage: "FULL",
      rememberMe: false,
      refreshTokenHash: "test-only-unused-refresh-hash",
      previousRefreshTokenHash: null,
      previousRefreshValidUntil: null,
      createdAt: now,
      lastUsedAt: now,
      absoluteExpiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      revokedAt: null,
      revokeReason: null,
      userAgent: null,
      ipAddress: null,
    });
    tokens.set(
      user.id,
      await new JwtService(secret).sign({
        userPublicId: user.publicId,
        sessionId,
        now,
      }),
    );
  }

  return tokens;
}

export function bearerToken(tokens: RequesterTokens, userId: number): string {
  const token = tokens.get(userId);
  if (!token) {
    throw new Error(`No test access token configured for User ${userId}.`);
  }
  return `Bearer ${token}`;
}
