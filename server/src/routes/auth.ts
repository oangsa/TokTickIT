import { NextFunction, Request, Response, Router } from "express";

import { ApiError } from "../http/errors.js";
import {
  clearRefreshCookie,
  readRefreshCookie,
  requireApprovedOrigin,
  requireAuthentication,
  requireFullSession,
  requestIsSecure,
  setRefreshCookie,
} from "../middleware/authentication.js";
import { getPrisma } from "../prisma.js";
import { AuthService } from "../services/authService.js";

export const authRouter = Router();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function bodyRecord(body: unknown): Record<string, unknown> {
  if (!isRecord(body)) {
    throw new ApiError("VALIDATION_ERROR");
  }
  return body;
}

function clientIp(req: Request): string {
  return req.ip || "0.0.0.0";
}

authRouter.post("/auth/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = bodyRecord(req.body);
    if (
      typeof body.email !== "string" ||
      typeof body.password !== "string" ||
      (body.rememberMe !== undefined && typeof body.rememberMe !== "boolean")
    ) {
      throw new ApiError("VALIDATION_ERROR");
    }
    const result = await new AuthService(getPrisma()).login({
      email: body.email,
      password: body.password,
      rememberMe: body.rememberMe ?? false,
      ipAddress: clientIp(req),
      userAgent: req.header("User-Agent"),
    });
    setRefreshCookie(res, result.refreshToken, {
      persistent: result.persistent,
      secure: requestIsSecure(req),
    });
    res.json(result.token);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/auth/refresh", async (req: Request, res: Response, next: NextFunction) => {
  try {
    requireApprovedOrigin(req);
    const refreshToken = readRefreshCookie(req);
    if (!refreshToken) {
      throw new ApiError("SESSION_INVALID");
    }
    const result = await new AuthService(getPrisma()).refresh(refreshToken);
    setRefreshCookie(res, result.refreshToken, {
      persistent: result.persistent,
      secure: requestIsSecure(req),
    });
    res.json(result.token);
  } catch (error) {
    next(error);
  }
});

authRouter.get(
  "/auth/me",
  requireAuthentication(),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) {
        throw new ApiError("UNAUTHENTICATED");
      }
      res.json(new AuthService(getPrisma()).currentUser(req.auth));
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post(
  "/auth/change-password",
  requireAuthentication(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) {
        throw new ApiError("UNAUTHENTICATED");
      }
      const body = bodyRecord(req.body);
      if (typeof body.newPassword !== "string") {
        throw new ApiError("VALIDATION_ERROR");
      }
      if (req.auth.stage === "FULL" && body.currentPassword !== undefined && typeof body.currentPassword !== "string") {
        throw new ApiError("VALIDATION_ERROR");
      }
      await new AuthService(getPrisma()).changePassword(req.auth, {
        currentPassword: body.currentPassword as string | undefined,
        newPassword: body.newPassword,
      });
      clearRefreshCookie(res, requestIsSecure(req));
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post("/auth/logout", async (req: Request, res: Response, next: NextFunction) => {
  try {
    requireApprovedOrigin(req);
    const refreshToken = readRefreshCookie(req);
    const service = new AuthService(getPrisma());
    if (refreshToken) {
      await service.logoutByRefreshToken(refreshToken);
    }
    clearRefreshCookie(res, requestIsSecure(req));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

authRouter.post(
  "/auth/logout-all",
  requireFullSession(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireApprovedOrigin(req);
      if (!req.auth) {
        throw new ApiError("UNAUTHENTICATED");
      }
      await new AuthService(getPrisma()).logoutAll(req.auth);
      clearRefreshCookie(res, requestIsSecure(req));
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);
