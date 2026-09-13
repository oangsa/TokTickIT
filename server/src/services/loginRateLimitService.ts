import { createHash } from "node:crypto";

import type { Prisma, PrismaClient } from "../generated/prisma/client.js";

export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const RATE_LIMIT_BLOCK_MS = 15 * 60 * 1000;
export const PAIR_FAILURE_LIMIT = 5;
export const GLOBAL_FAILURE_LIMIT = 30;

export type RateLimitScope = "EMAIL_IP" | "IP";

type RateLimitReader = Pick<PrismaClient, "loginRateLimitBucket">;

function keyHash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function normalizeLoginEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function pairBucketHash(email: string, ip: string): string {
  return keyHash(`${normalizeLoginEmail(email)}\u0000${ip.trim()}`);
}

export function ipBucketHash(ip: string): string {
  return keyHash(ip.trim());
}

export class LoginRateLimitService {
  constructor(private readonly prisma: PrismaClient) {}

  async isBlocked(email: string, ip: string, now = new Date()): Promise<boolean> {
    return this.readBlocked(this.prisma, email, ip, now);
  }

  async runLoginAttempt<T>(
    email: string,
    ip: string,
    now: Date,
    evaluate: (tx: Prisma.TransactionClient) => Promise<T | null>,
  ): Promise<{ blocked: boolean; value: T | null }> {
    const pairHash = pairBucketHash(email, ip);
    const globalHash = ipBucketHash(ip);

    return this.prisma.$transaction(async (tx) => {
      await this.lockBucket(tx, "EMAIL_IP:" + pairHash);
      await this.lockBucket(tx, "IP:" + globalHash);

      if (await this.readBlocked(tx, email, ip, now)) {
        return { blocked: true, value: null };
      }

      const value = await evaluate(tx);
      if (value === null) {
        await this.upsertFailure(tx, "EMAIL_IP", pairHash, PAIR_FAILURE_LIMIT, now);
        await this.upsertFailure(tx, "IP", globalHash, GLOBAL_FAILURE_LIMIT, now);
        return { blocked: false, value: null };
      }

      await tx.loginRateLimitBucket.deleteMany({
        where: { scope: "EMAIL_IP", bucketKeyHash: pairHash },
      });
      return { blocked: false, value };
    });
  }

  private async readBlocked(
    client: RateLimitReader,
    email: string,
    ip: string,
    now: Date,
  ): Promise<boolean> {
    const hashes = [
      { scope: "EMAIL_IP" as const, bucketKeyHash: pairBucketHash(email, ip) },
      { scope: "IP" as const, bucketKeyHash: ipBucketHash(ip) },
    ];
    const buckets = await client.loginRateLimitBucket.findMany({
      where: { OR: hashes },
      select: { blockedUntil: true },
    });
    return buckets.some((bucket) => bucket.blockedUntil !== null && now < bucket.blockedUntil);
  }

  async recordFailure(email: string, ip: string, now = new Date()): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const pairHash = pairBucketHash(email, ip);
      const globalHash = ipBucketHash(ip);
      await this.lockBucket(tx, "EMAIL_IP:" + pairHash);
      await this.lockBucket(tx, "IP:" + globalHash);
      await this.upsertFailure(tx, "EMAIL_IP", pairHash, PAIR_FAILURE_LIMIT, now);
      await this.upsertFailure(tx, "IP", globalHash, GLOBAL_FAILURE_LIMIT, now);
    });
  }

  /* Prisma cannot deserialize PostgreSQL's void return, so project the lock
   * call through a CTE and return a scalar sentinel instead. */
  private async lockBucket(tx: Prisma.TransactionClient, key: string): Promise<void> {
    await tx.$queryRaw`
      WITH advisory_lock AS (
        SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))
      )
      SELECT 1 FROM advisory_lock
    `;
  }

  async clearPair(email: string, ip: string): Promise<void> {
    await this.prisma.loginRateLimitBucket.deleteMany({
      where: { scope: "EMAIL_IP", bucketKeyHash: pairBucketHash(email, ip) },
    });
  }

  private async upsertFailure(
    tx: Prisma.TransactionClient,
    scope: RateLimitScope,
    bucketKeyHash: string,
    threshold: number,
    now: Date,
  ): Promise<void> {
    const cutoff = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);
    const blockedUntil = new Date(now.getTime() + RATE_LIMIT_BLOCK_MS);

    await tx.$executeRaw`
      INSERT INTO login_rate_limit_bucket
        (scope, bucket_key_hash, window_started_at, failure_count, blocked_until, updated_at)
      VALUES
        (${scope}::"LoginRateLimitScope", ${bucketKeyHash}, ${now}, 1, NULL, ${now})
      ON CONFLICT (scope, bucket_key_hash)
      DO UPDATE SET
        window_started_at = CASE
          WHEN login_rate_limit_bucket.window_started_at <= ${cutoff}
            THEN EXCLUDED.window_started_at
          ELSE login_rate_limit_bucket.window_started_at
        END,
        failure_count = CASE
          WHEN login_rate_limit_bucket.window_started_at <= ${cutoff}
            THEN 1
          ELSE login_rate_limit_bucket.failure_count + 1
        END,
        blocked_until = CASE
          WHEN login_rate_limit_bucket.window_started_at <= ${cutoff}
            THEN NULL
          WHEN login_rate_limit_bucket.failure_count + 1 >= ${threshold}
            THEN ${blockedUntil}
          ELSE login_rate_limit_bucket.blocked_until
        END,
        updated_at = ${now}
    `;
  }
}
