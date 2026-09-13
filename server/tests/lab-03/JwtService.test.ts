import { decodeJwt, decodeProtectedHeader } from "jose";
import { describe, expect, it, beforeEach } from "vitest";

import { ACCESS_TOKEN_SECONDS, AccessTokenExpiredError, JwtService } from "../../src/services/jwtService.js";

describe("JwtService @issue-2", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters-long";
  });

  it("signs only approved HS256 claims for ten minutes", async () => {
    const now = new Date("2026-09-13T00:00:00.000Z");
    const token = await new JwtService().sign({
      userPublicId: "10000000-0000-4000-8000-000000000001",
      sessionId: "20000000-0000-4000-8000-000000000001",
      now,
    });
    expect(decodeProtectedHeader(token).alg).toBe("HS256");
    const claims = decodeJwt(token);
    expect(Object.keys(claims).sort()).toEqual(["exp", "iat", "jti", "sid", "sub"]);
    expect(claims.exp! - claims.iat!).toBe(ACCESS_TOKEN_SECONDS);
    expect(await new JwtService().verify(token, now)).toMatchObject({
      sub: "10000000-0000-4000-8000-000000000001",
      sid: "20000000-0000-4000-8000-000000000001",
    });
  });

  it("rejects expired access tokens with a distinct error", async () => {
    const token = await new JwtService().sign({
      userPublicId: "10000000-0000-4000-8000-000000000001",
      sessionId: "20000000-0000-4000-8000-000000000001",
      now: new Date("2020-01-01T00:00:00.000Z"),
    });
    await expect(new JwtService().verify(token)).rejects.toBeInstanceOf(AccessTokenExpiredError);
  });
});
