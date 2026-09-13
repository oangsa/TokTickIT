import { describe, expect, it } from "vitest";

import { SessionInvalidError, SessionService } from "../../src/services/sessionService.js";

interface SessionFakePrisma {
  userSession: {
    create: (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
    findUnique: () => Promise<Record<string, unknown> | null>;
    update: (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
    updateMany: (args: { data: Record<string, unknown> }) => Promise<{ count: number }>;
  };
  $transaction: <T>(callback: (tx: SessionFakePrisma) => Promise<T>) => Promise<T>;
  $queryRaw: () => Promise<Array<{ id: unknown }>>;
}

function fakePrisma() {
  let row: Record<string, unknown> | null = null;
  let queryCount = 0;
  const prisma: SessionFakePrisma = {
    userSession: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        row = { ...data, revokedAt: null, previousRefreshTokenHash: null, previousRefreshValidUntil: null };
        return row;
      },
      findUnique: async () => row,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        row = { ...(row as Record<string, unknown>), ...data };
        return row;
      },
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        if (row) row = { ...row, ...data };
        return { count: row ? 1 : 0 };
      },
    },
    $transaction: async <T>(callback: (tx: SessionFakePrisma) => Promise<T>) => callback(prisma),
    $queryRaw: async () => {
      queryCount += 1;
      return row ? [{ id: row.id }] : [];
    },
  };
  return {
    ...prisma,
    getRow: () => row,
    getQueryCount: () => queryCount,
  };
}

describe("UNIT-04 SessionService @issue-2", () => {
  it("stores only refresh hashes and rotates current token", async () => {
    const prisma = fakePrisma();
    const service = new SessionService(prisma as never);
    const created = await service.create({
      userId: 7,
      stage: "FULL",
      rememberMe: false,
      now: new Date("2026-09-13T00:00:00.000Z"),
    });
    expect(created.session.refreshTokenHash).not.toBe(created.refreshToken);
    const rotated = await service.refresh(created.refreshToken, new Date("2026-09-13T00:01:00.000Z"));
    expect(rotated.refreshToken).not.toBe(created.refreshToken);
    expect(rotated.session.previousRefreshTokenHash).toBe(created.session.refreshTokenHash);
  });

  it("rescues the immediately previous token at the exact deadline, then revokes stale reuse", async () => {
    const prisma = fakePrisma();
    const service = new SessionService(prisma as never);
    const created = await service.create({
      userId: 7,
      stage: "FULL",
      rememberMe: true,
      now: new Date("2026-09-13T00:00:00.000Z"),
    });
    const first = await service.refresh(created.refreshToken, new Date("2026-09-13T00:01:00.000Z"));
    const rescued = await service.refresh(created.refreshToken, new Date("2026-09-13T00:01:30.000Z"));
    expect(rescued.refreshToken).not.toBe(first.refreshToken);
    await expect(service.refresh(created.refreshToken, new Date("2026-09-13T00:01:31.000Z"))).rejects.toBeInstanceOf(SessionInvalidError);
  });

  it("rejects malformed refresh tokens before any UUID query", async () => {
    const prisma = fakePrisma();
    const service = new SessionService(prisma as never);
    const malformedTokens = [
      "not-a-refresh-token",
      "20000000-0000-4000-8000-000000000001",
      "20000000-0000-4000-8000-000000000001.secret.extra",
      `${"-".repeat(36)}.secret`,
      "200000000000-4000-8000-000000000001.secret",
      "20000000-0000-4000-8000-00000000000g.secret",
      "20000000-0000-5000-8000-000000000001.secret",
      "20000000-0000-4000-8000-000000000001.",
    ];

    for (const token of malformedTokens) {
      await expect(service.refresh(token)).rejects.toBeInstanceOf(SessionInvalidError);
      await service.revokeByToken(token);
    }
    expect(prisma.getQueryCount()).toBe(0);
  });

  it("does not revoke a session when the UUID is paired with a wrong secret", async () => {
    const prisma = fakePrisma();
    const service = new SessionService(prisma as never);
    const created = await service.create({
      userId: 7,
      stage: "FULL",
      rememberMe: false,
      now: new Date("2026-09-13T00:00:00.000Z"),
    });

    await service.revokeByToken(`${created.session.id}.fake-secret`, new Date("2026-09-13T00:00:01.000Z"));
    await expect(service.refresh(created.refreshToken, new Date("2026-09-13T00:00:02.000Z"))).resolves.toBeTruthy();
  });

  it("ignores Remember Me for restricted sessions and expires at the exact boundary", async () => {
    const prisma = fakePrisma();
    const service = new SessionService(prisma as never);
    const created = await service.create({
      userId: 7,
      stage: "PASSWORD_CHANGE_REQUIRED",
      rememberMe: true,
      now: new Date("2026-09-13T00:00:00.000Z"),
    });

    expect(created.session.rememberMe).toBe(false);
    expect(created.session.absoluteExpiresAt).toEqual(new Date("2026-09-13T00:15:00.000Z"));
    await expect(service.refresh(created.refreshToken, new Date("2026-09-13T00:15:00.000Z"))).rejects.toBeInstanceOf(SessionInvalidError);
  });
});
