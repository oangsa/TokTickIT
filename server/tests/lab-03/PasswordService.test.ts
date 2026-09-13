import { describe, expect, it } from "vitest";

import { generateInitialPassword } from "../../src/services/initialPasswordGenerator.js";
import {
  hashPassword,
  TEST_ARGON2_PROFILE,
  validatePassword,
  verifyPassword,
} from "../../src/services/passwordService.js";

describe("UNIT-01 PasswordService @issue-2", () => {
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
    const password = generateInitialPassword();
    const hash = await hashPassword(password, TEST_ARGON2_PROFILE);
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, password)).toBe(true);
    expect(await verifyPassword(hash, `${password}x`)).toBe(false);
  });

  it("uses the normal runtime profile by default and only uses the faster profile when injected", async () => {
    const password = generateInitialPassword();
    const normalHash = await hashPassword(password);
    const testHash = await hashPassword(password, TEST_ARGON2_PROFILE);
    const readParameters = (hash: string) => Object.fromEntries(
      hash.split("$")[3]!.split(",").map((entry) => entry.split("=")),
    );

    expect(readParameters(normalHash)).toMatchObject({ m: "32768", t: "2", p: "1" });
    expect(readParameters(testHash)).toMatchObject({ m: "8192", t: "1", p: "1" });
  });
});
