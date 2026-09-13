import { randomBytes } from "node:crypto";
import { decodeJwt, decodeProtectedHeader, SignJWT } from "jose";
import { describe, expect, it, beforeEach } from "vitest";

import {
  ACCESS_TOKEN_SECONDS,
  AccessTokenExpiredError,
  InvalidAccessTokenError,
  JwtService,
} from "../../src/services/jwtService.js";

describe("UNIT-03 JwtService @issue-2", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = randomBytes(32).toString("base64url");
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

  it("rejects malformed or incorrectly signed tokens and excludes role authority", async () => {
    const service = new JwtService();
    const token = await service.sign({
      userPublicId: "10000000-0000-4000-8000-000000000001",
      sessionId: "20000000-0000-4000-8000-000000000001",
    });

    await expect(new JwtService(randomBytes(32).toString("base64url")).verify(token))
      .rejects.toBeInstanceOf(InvalidAccessTokenError);
    await expect(service.verify("not-a-jwt")).rejects.toBeInstanceOf(InvalidAccessTokenError);

    const now = Math.floor(Date.now() / 1000);
    const roleToken = await new SignJWT({
      sub: "10000000-0000-4000-8000-000000000001",
      sid: "20000000-0000-4000-8000-000000000001",
      jti: randomBytes(16).toString("hex"),
      role: "ADMINISTRATOR",
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt(now)
      .setExpirationTime(now + ACCESS_TOKEN_SECONDS)
      .sign(new TextEncoder().encode(process.env.JWT_SECRET as string));

    await expect(service.verify(roleToken)).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });
});
