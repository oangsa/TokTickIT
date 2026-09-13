import type { NextFunction, Request, RequestHandler, Response } from "express";

import { ApiError } from "../http/errors.js";
import { AuthService, type AuthContext } from "../services/authService.js";
import { AccessTokenExpiredError, InvalidAccessTokenError, JwtService } from "../services/jwtService.js";
import { getPrisma } from "../prisma.js";
import { resolveAllowedOrigins } from "../middleware/cors.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
      requesterId?: number;
      requesterEmail?: string;
    }
  }
}

export const REFRESH_COOKIE_NAME = "toktickit_refresh";

function bearerToken(req: Request): string | null {
  const value = req.header("Authorization");
  if (!value) {
    return null;
  }
  const match = /^Bearer\s+([^\s]+)$/i.exec(value);
  return match?.[1] ?? null;
}

export function readRefreshCookie(req: Request): string | null {
  const header = req.header("Cookie");
  if (!header) {
    return null;
  }
  for (const part of header.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === REFRESH_COOKIE_NAME) {
      try {
        return decodeURIComponent(value.join("="));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function setRefreshCookie(res: Response, token: string, options: { persistent: boolean; secure: boolean }): void {
  const attributes = [
    `${REFRESH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/api/auth",
    "HttpOnly",
    "SameSite=Strict",
  ];
  if (options.persistent) {
    attributes.push("Max-Age=7776000");
  }
  if (options.secure) {
    attributes.push("Secure");
  }
  res.append("Set-Cookie", attributes.join("; "));
}

export function clearRefreshCookie(res: Response, secure: boolean): void {
  const attributes = [
    `${REFRESH_COOKIE_NAME}=`,
    "Path=/api/auth",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];
  if (secure) {
    attributes.push("Secure");
  }
  res.append("Set-Cookie", attributes.join("; "));
}

function secureRequest(req: Request): boolean {
  return req.secure || req.header("X-Forwarded-Proto") === "https";
}

export function requireApprovedOrigin(req: Request): void {
  const origin = req.header("Origin");
  const allowed = resolveAllowedOrigins(process.env);
  if (!origin || !allowed.includes(origin)) {
    throw new ApiError("FORBIDDEN");
  }
}

export function requireAuthentication(): RequestHandler {
  return async (req, _res, next) => {
    try {
      const token = bearerToken(req);
      if (!token) {
        throw new ApiError("UNAUTHENTICATED");
      }
      const claims = await new JwtService().verify(token);
      const context = await new AuthService(getPrisma()).context(
        claims.sid,
        claims.sub,
        "FULL",
      );
      req.auth = context;
      req.requesterId = context.userId;
      req.requesterEmail = context.email;
      next();
    } catch (error) {
      if (error instanceof AccessTokenExpiredError) {
        next(new ApiError("ACCESS_TOKEN_EXPIRED"));
        return;
      }
      if (error instanceof InvalidAccessTokenError) {
        next(new ApiError("UNAUTHENTICATED"));
        return;
      }
      next(error);
    }
  };
}

export function requireFullSession(): RequestHandler {
  const authenticate = requireAuthentication();
  return (req, res, next) => {
    authenticate(req, res, (error?: unknown) => {
      if (error) {
        next(error);
        return;
      }
      if (!req.auth || req.auth.stage !== "FULL") {
        next(new ApiError("PASSWORD_CHANGE_REQUIRED"));
        return;
      }
      next();
    });
  };
}

export function requireRole(...roles: AuthContext["role"][]): RequestHandler {
  const full = requireFullSession();
  return (req, res, next) => {
    full(req, res, (error?: unknown) => {
      if (error) {
        next(error);
        return;
      }
      if (!req.auth || !roles.includes(req.auth.role)) {
        next(new ApiError("FORBIDDEN"));
        return;
      }
      next();
    });
  };
}

export function requestIsSecure(req: Request): boolean {
  return secureRequest(req);
}
