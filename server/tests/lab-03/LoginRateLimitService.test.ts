import { describe, expect, it } from "vitest";

import {
  GLOBAL_FAILURE_LIMIT,
  normalizeLoginEmail,
  PAIR_FAILURE_LIMIT,
  RATE_LIMIT_BLOCK_MS,
  RATE_LIMIT_WINDOW_MS,
} from "../../src/services/loginRateLimitService.js";

describe("LoginRateLimitService @issue-2", () => {
  it("exposes the exact PostgreSQL-backed limits and normalization", () => {
    expect(normalizeLoginEmail(" Alice@Example.COM ")).toBe("alice@example.com");
    expect(PAIR_FAILURE_LIMIT).toBe(5);
    expect(GLOBAL_FAILURE_LIMIT).toBe(30);
    expect(RATE_LIMIT_WINDOW_MS).toBe(15 * 60 * 1000);
    expect(RATE_LIMIT_BLOCK_MS).toBe(15 * 60 * 1000);
  });
});
