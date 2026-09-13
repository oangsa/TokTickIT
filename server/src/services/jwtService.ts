import { randomUUID } from "node:crypto";

import { jwtVerify, SignJWT } from "jose";
import { errors as JoseErrors } from "jose";

export const ACCESS_TOKEN_SECONDS = 10 * 60;

export interface AccessTokenClaims {
  sub: string;
  sid: string;
  jti: string;
  iat: number;
  exp: number;
}

function secretBytes(secret: string | undefined): Uint8Array {
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export class JwtService {
  constructor(private readonly secret = process.env.JWT_SECRET) {}

  async sign(input: { userPublicId: string; sessionId: string; now?: Date }): Promise<string> {
    const now = input.now ?? new Date();
    const issuedAt = Math.floor(now.getTime() / 1000);

    return new SignJWT({
      sub: input.userPublicId,
      sid: input.sessionId,
      jti: randomUUID(),
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + ACCESS_TOKEN_SECONDS)
      .sign(secretBytes(this.secret));
  }

  async verify(token: string, now = new Date()): Promise<AccessTokenClaims> {
    try {
      const { payload } = await jwtVerify(token, secretBytes(this.secret), {
        algorithms: ["HS256"],
        currentDate: now,
      });
      const allowed = new Set(["sub", "sid", "jti", "iat", "exp"]);
      if (
        Object.keys(payload).some((key) => !allowed.has(key)) ||
        typeof payload.sub !== "string" ||
        typeof payload.sid !== "string" ||
        typeof payload.jti !== "string" ||
        typeof payload.iat !== "number" ||
        typeof payload.exp !== "number"
      ) {
        throw new Error("Invalid access token claims");
      }
      return {
        sub: payload.sub,
        sid: payload.sid,
        jti: payload.jti,
        iat: payload.iat,
        exp: payload.exp,
      };
    } catch (error) {
      if (error instanceof JoseErrors.JWTExpired) {
        throw new AccessTokenExpiredError();
      }
      throw new InvalidAccessTokenError();
    }
  }
}

export class AccessTokenExpiredError extends Error {}
export class InvalidAccessTokenError extends Error {}
