import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { AuthService } from "../../../src/services/authService.js";
import { verifyPassword } from "../../../src/services/passwordService.js";
import { SessionInvalidError, SessionService, refreshTokenHash } from "../../../src/services/sessionService.js";
import { ipBucketHash, pairBucketHash } from "../../../src/services/loginRateLimitService.js";
import { deployMigrations, resetTestSchema, runSeed } from "../../lab-02/postgres/testDatabase.js";
import { assertLab3TestDatabase, createTestPrisma, type Lab3TestTarget } from "./testDatabase.js";

const SEED_CREDENTIALS_PATH = resolve(process.cwd(), ".local/lab3-seed-credentials.json");
const SEEDED_USERS = [
  { email: "alice.johnson@example.com", role: "REQUESTER" },
  { email: "iris.patel@example.com", role: "IT_STAFF" },
  { email: "morgan.admin@example.com", role: "ADMINISTRATOR" },
] as const;

function readSeedCredentials(): Record<string, string> | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(SEED_CREDENTIALS_PATH, "utf8"));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  } catch {
    return null;
  }
}

async function hasUsableSeededUsers(prisma: PrismaClient, credentials: Record<string, string> | null): Promise<boolean> {
  if (!credentials) {
    return false;
  }

  try {
    const users = await prisma.user.findMany({
      where: { email: { in: SEEDED_USERS.map((user) => user.email) } },
    });
    if (users.length !== SEEDED_USERS.length || users.some((user) => !user.mustChangePassword)) {
      return false;
    }
    return (await Promise.all(SEEDED_USERS.map(async (seededUser) => {
      const user = users.find((candidate) => candidate.email === seededUser.email);
      const password = credentials[seededUser.email];
      return user !== undefined && password !== undefined && await verifyPassword(user.passwordHash, password);
    }))).every(Boolean);
  } catch {
    return false;
  }
}

describe.sequential("Lab 3 PostgreSQL auth sessions @issue-2", () => {
  let target: Lab3TestTarget;
  let prisma: PrismaClient;

  beforeAll(async () => {
    target = assertLab3TestDatabase();
    prisma = createTestPrisma(target);
    if (!await hasUsableSeededUsers(prisma, readSeedCredentials())) {
      /* Lab 2 PostgreSQL regression fixtures intentionally rebuild the shared
       * disposable target. Restore a clean Lab 3 seed before this file's
       * session cases start so the tests remain independent of file order. */
      await prisma.$disconnect();
      await resetTestSchema(target);
      await deployMigrations(target);
      await runSeed(target);
      prisma = createTestPrisma(target);
    }
  });

  afterAll(async () => prisma?.$disconnect());

  it("PG-04 persists Argon2id and refresh hashes without plaintext columns @issue-2", async () => {
    const user = await prisma.user.findFirst({ where: { deleted: false } });
    if (!user) throw new Error("Seeded User required for PostgreSQL auth test");

    const sessionService = new SessionService(prisma);
    const created = await sessionService.create({
      userId: user.id,
      stage: "FULL",
      rememberMe: false,
      now: new Date("2026-09-13T00:00:00.000Z"),
    });

    try {
      const persisted = await prisma.userSession.findUnique({ where: { id: created.session.id } });
      expect(user.passwordHash).toMatch(/^\$argon2id\$/);
      expect(persisted?.refreshTokenHash).toBe(refreshTokenHash(created.refreshToken));
      expect(persisted?.refreshTokenHash).not.toBe(created.refreshToken);
      const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_session'
      `;
      expect(columns.map((column) => column.column_name)).not.toContain("refresh_token");
    } finally {
      await prisma.userSession.deleteMany({ where: { id: created.session.id } });
    }
  });

  it("PG-05 persists rotation, exact deadlines, previous-token rescue, logout, and all-session revocation @issue-2", async () => {
    const user = await prisma.user.findFirst({ where: { deleted: false } });
    if (!user) throw new Error("Seeded User required for PostgreSQL session test");

    const sessionService = new SessionService(prisma);
    const createdAt = new Date("2026-09-13T00:00:00.000Z");
    const sessionIds: string[] = [];

    const createSession = async (input: {
      stage: "FULL" | "PASSWORD_CHANGE_REQUIRED";
      rememberMe: boolean;
      now?: Date;
    }) => {
      const result = await sessionService.create({ userId: user.id, ...input, now: input.now ?? createdAt });
      sessionIds.push(result.session.id);
      return result;
    };

    try {
      const rotating = await createSession({ stage: "FULL", rememberMe: false });
      const firstRotation = await sessionService.refresh(
        rotating.refreshToken,
        new Date(createdAt.getTime() + 1_000),
      );
      const afterFirstRotation = await prisma.userSession.findUnique({ where: { id: rotating.session.id } });
      expect(afterFirstRotation).toMatchObject({
        previousRefreshTokenHash: refreshTokenHash(rotating.refreshToken),
        refreshTokenHash: refreshTokenHash(firstRotation.refreshToken),
      });
      expect(afterFirstRotation?.previousRefreshValidUntil).toEqual(
        new Date(createdAt.getTime() + 31_000),
      );

      const rescued = await sessionService.refresh(
        rotating.refreshToken,
        new Date(createdAt.getTime() + 31_000),
      );
      expect(rescued.refreshToken).not.toBe(firstRotation.refreshToken);
      expect((await prisma.userSession.findUnique({ where: { id: rotating.session.id } }))?.revokedAt).toBeNull();
      await expect(sessionService.refresh(
        rotating.refreshToken,
        new Date(createdAt.getTime() + 32_000),
      )).rejects.toBeInstanceOf(SessionInvalidError);
      expect((await prisma.userSession.findUnique({ where: { id: rotating.session.id } }))?.revokeReason).toBe("refresh_reuse");

      const restricted = await createSession({ stage: "PASSWORD_CHANGE_REQUIRED", rememberMe: true });
      const restrictedRow = await prisma.userSession.findUnique({ where: { id: restricted.session.id } });
      expect(restrictedRow).toMatchObject({
        rememberMe: false,
        absoluteExpiresAt: new Date(createdAt.getTime() + 15 * 60 * 1000),
      });
      await expect(sessionService.refresh(
        restricted.refreshToken,
        new Date(createdAt.getTime() + 15 * 60 * 1000),
      )).rejects.toBeInstanceOf(SessionInvalidError);

      const full = await createSession({ stage: "FULL", rememberMe: false });
      await expect(sessionService.refresh(
        full.refreshToken,
        new Date(createdAt.getTime() + 8 * 60 * 60 * 1000),
      )).rejects.toBeInstanceOf(SessionInvalidError);

      const rememberIdle = await createSession({ stage: "FULL", rememberMe: true });
      await expect(sessionService.refresh(
        rememberIdle.refreshToken,
        new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000),
      )).rejects.toBeInstanceOf(SessionInvalidError);

      const rememberAbsolute = await createSession({ stage: "FULL", rememberMe: true });
      const touched = await sessionService.refresh(
        rememberAbsolute.refreshToken,
        new Date(createdAt.getTime() + 20 * 24 * 60 * 60 * 1000),
      );
      await expect(sessionService.refresh(
        touched.refreshToken,
        new Date(createdAt.getTime() + 90 * 24 * 60 * 60 * 1000),
      )).rejects.toBeInstanceOf(SessionInvalidError);

      const logout = await createSession({ stage: "FULL", rememberMe: false });
      await sessionService.revokeByToken(logout.refreshToken, new Date(createdAt.getTime() + 1_000));
      expect((await prisma.userSession.findUnique({ where: { id: logout.session.id } }))?.revokeReason).toBe("logout");

      const allOne = await createSession({ stage: "FULL", rememberMe: false });
      const allTwo = await createSession({ stage: "FULL", rememberMe: false });
      await sessionService.revokeAllForUser(user.id, "logout_all", new Date(createdAt.getTime() + 2_000));
      const allRows = await prisma.userSession.findMany({ where: { id: { in: [allOne.session.id, allTwo.session.id] } } });
      expect(allRows.every((row) => row.revokeReason === "logout_all")).toBe(true);
    } finally {
      await prisma.userSession.deleteMany({ where: { id: { in: sessionIds } } });
    }
  });

  it("DATA-03 seeded active role Users authenticate through the local credential handoff @issue-2", async () => {
    const parsed: unknown = JSON.parse(readFileSync(SEED_CREDENTIALS_PATH, "utf8"));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("Seed credential handoff file must contain an object");
    }
    const credentials = parsed as Record<string, unknown>;
    expect(statSync(SEED_CREDENTIALS_PATH).mode & 0o777).toBe(0o600);

    const seededUserRows = await prisma.user.findMany({
      where: { email: { in: SEEDED_USERS.map((user) => user.email) } },
      select: { id: true },
    });
    const seededUserIds = seededUserRows.map((user) => user.id);
    const loginIp = "203.0.113.201";
    await prisma.userSession.deleteMany({ where: { userId: { in: seededUserIds } } });
    await prisma.loginRateLimitBucket.deleteMany({
      where: {
        OR: [
          { scope: "IP", bucketKeyHash: ipBucketHash(loginIp) },
          {
            scope: "EMAIL_IP",
            bucketKeyHash: {
              in: SEEDED_USERS.map((user) => pairBucketHash(user.email, loginIp)),
            },
          },
        ],
      },
    });

    process.env.JWT_SECRET = randomBytes(32).toString("base64url");

    const auth = new AuthService(prisma);
    const sessionIds: string[] = [];
    try {
      for (const seededUser of SEEDED_USERS) {
        const password = credentials[seededUser.email];
        expect(typeof password).toBe("string");
        const result = await auth.login({
          email: seededUser.email,
          password: password as string,
          rememberMe: true,
          ipAddress: loginIp,
        });
        const sessionId = result.refreshToken.split(".")[0]!;
        sessionIds.push(sessionId);
        const session = await prisma.userSession.findUnique({ where: { id: sessionId } });
        expect(session).toMatchObject({ stage: "PASSWORD_CHANGE_REQUIRED", rememberMe: false });
        const user = await prisma.user.findUnique({ where: { email: seededUser.email } });
        expect(user?.role).toBe(seededUser.role);
        expect(user?.mustChangePassword).toBe(true);
        await auth.logoutByRefreshToken(result.refreshToken);
      }
    } finally {
      await prisma.userSession.deleteMany({
        where: {
          OR: [
            { id: { in: sessionIds } },
            { userId: { in: seededUserIds } },
          ],
        },
      });
      await prisma.loginRateLimitBucket.deleteMany({
        where: {
          OR: [
            { scope: "IP", bucketKeyHash: ipBucketHash(loginIp) },
            {
              scope: "EMAIL_IP",
              bucketKeyHash: {
                in: SEEDED_USERS.map((user) => pairBucketHash(user.email, loginIp)),
              },
            },
          ],
        },
      });
    }
  });
});
