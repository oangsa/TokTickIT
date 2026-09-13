import { describe, expect, it } from "vitest";

import {
  hashPassword,
  TEST_ARGON2_PROFILE,
  validatePassword,
  verifyPassword,
} from "../../src/services/passwordService.js";

describe("PasswordService @issue-2", () => {
  it("accepts exact Unicode length boundaries and required composition", () => {
    expect(validatePassword("Aa1!" + "x".repeat(4))).toEqual([]);
    expect(validatePassword("Aa1!" + "x".repeat(124))).toEqual([]);
    expect(validatePassword("Aa1!" + "x".repeat(3)).length).toBeGreaterThan(0);
    expect(validatePassword("Aa1!" + "x".repeat(125)).length).toBeGreaterThan(0);
    expect(validatePassword("Aa1!😀😀😀😀")).toEqual([]);
  });

  it("does not trim and requires a non-whitespace symbol", () => {
    expect(validatePassword(" Aa1!xxx")).toEqual([]);
    expect(validatePassword("Aa1 xxx").some((error) => error.message.includes("symbol"))).toBe(true);
    expect(validatePassword("Aa1!xxx ")).toEqual([]);
  });

  it("hashes and verifies Argon2id with injected test profile", async () => {
    const hash = await hashPassword("Aa1!test", TEST_ARGON2_PROFILE);
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, "Aa1!test")).toBe(true);
    expect(await verifyPassword(hash, "Aa1!wrong")).toBe(false);
  });
});
