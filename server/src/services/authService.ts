import type { PrismaClient, User, UserRole } from "../generated/prisma/client.js";
import { ApiError } from "../http/errors.js";
import {
  dummyPasswordHash,
  hashPassword,
  NORMAL_ARGON2_PROFILE,
  validatePassword,
  verifyPassword,
  type Argon2Profile,
} from "./passwordService.js";
import {
  LoginRateLimitService,
  normalizeLoginEmail,
} from "./loginRateLimitService.js";
import { JwtService } from "./jwtService.js";
import { isValidSessionId, SessionInvalidError, SessionService } from "./sessionService.js";

export interface AuthTokenDTO {
  accessToken: string;
  expiresIn: 600;
}

export type SessionStage = "PASSWORD_CHANGE_REQUIRED" | "FULL";

export interface CurrentUserDTO {
  publicId: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: true;
  mustChangePassword: boolean;
  sessionStage: SessionStage;
}

export interface AuthContext {
  userId: number;
  userPublicId: string;
  email: string;
  role: UserRole;
  sessionId: string;
  stage: SessionStage;
  user: User;
}

export interface LoginInput {
  email: string;
  password: string;
  rememberMe: boolean;
  ipAddress: string;
  userAgent?: string;
  now?: Date;
}

function stageForUser(user: User): SessionStage {
  return user.mustChangePassword ? "PASSWORD_CHANGE_REQUIRED" : "FULL";
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toCurrentUserDTO(user: User, stage: SessionStage): CurrentUserDTO {
  return {
    publicId: user.publicId,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: true,
    mustChangePassword: user.mustChangePassword,
    sessionStage: stage,
  };
}

export class AuthService {
  private readonly sessions: SessionService;
  private readonly rateLimits: LoginRateLimitService;
  private readonly jwt: JwtService;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly passwordProfile: Argon2Profile = NORMAL_ARGON2_PROFILE,
  ) {
    this.sessions = new SessionService(prisma);
    this.rateLimits = new LoginRateLimitService(prisma);
    this.jwt = new JwtService();
  }

  async login(input: LoginInput): Promise<{ token: AuthTokenDTO; refreshToken: string; persistent: boolean }> {
    const now = input.now ?? new Date();
    const email = normalizeLoginEmail(input.email);

    const attempt = await this.rateLimits.runLoginAttempt(
      email,
      input.ipAddress,
      now,
      async (tx) => {
        const user = await tx.user.findUnique({ where: { email } });
        const passwordMatches = user
          ? await verifyPassword(user.passwordHash, input.password)
          : await verifyPassword(dummyPasswordHash(this.passwordProfile), input.password);

        if (!user || !user.isActive || user.deleted || !passwordMatches) {
          return null;
        }
        // Recheck the verified snapshot and hold a User write lock until the
        // session commits. Even this no-op write makes a concurrent Serializable
        // admin mutation retry rather than miss the new session in its snapshot.
        const unchanged = await tx.user.updateMany({
          where: {
            id: user.id,
            passwordHash: user.passwordHash,
            email: user.email,
            role: user.role,
            isActive: true,
            deleted: false,
            mustChangePassword: user.mustChangePassword,
            updatedAt: user.updatedAt,
          },
          data: { updatedAt: user.updatedAt },
        });
        if (unchanged.count !== 1) return null;

        const session = await this.sessions.create({
          userId: user.id,
          stage: stageForUser(user),
          rememberMe: input.rememberMe,
          now,
          userAgent: input.userAgent,
          ipAddress: input.ipAddress,
        }, tx);
        return { user, session };
      },
    );

    if (attempt.blocked) {
      throw new ApiError("RATE_LIMITED");
    }

    if (!attempt.value) {
      throw new ApiError("AUTHENTICATION_FAILED");
    }
    const { user, session } = attempt.value;
    return {
      token: {
        accessToken: await this.jwt.sign({
          userPublicId: user.publicId,
          sessionId: session.session.id,
          now,
        }),
        expiresIn: 600,
      },
      refreshToken: session.refreshToken,
      persistent: session.session.rememberMe,
    };
  }

  async refresh(refreshToken: string, now = new Date()): Promise<{ token: AuthTokenDTO; refreshToken: string; persistent: boolean }> {
    try {
      const session = await this.sessions.refresh(refreshToken, now);
      const user = await this.prisma.user.findUnique({ where: { id: session.session.userId } });
      if (!user || !user.isActive || user.deleted) {
        await this.sessions.revokeSession(session.session.id, "user_inactive", now);
        throw new SessionInvalidError();
      }
      return {
        token: {
          accessToken: await this.jwt.sign({
            userPublicId: user.publicId,
            sessionId: session.session.id,
            now,
          }),
          expiresIn: 600,
        },
        refreshToken: session.refreshToken,
        persistent: session.session.rememberMe,
      };
    } catch (error) {
      if (error instanceof SessionInvalidError) {
        throw new ApiError("SESSION_INVALID");
      }
      throw error;
    }
  }

  async context(sessionId: string, userPublicId: string, now = new Date()): Promise<AuthContext> {
    if (!isValidSessionId(sessionId) || !UUID_PATTERN.test(userPublicId)) {
      throw new ApiError("UNAUTHENTICATED");
    }
    const session = await this.sessions.findActive(sessionId, now);
    if (!session) {
      throw new ApiError("SESSION_INVALID");
    }
    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || user.publicId !== userPublicId || !user.isActive || user.deleted) {
      throw new ApiError("SESSION_INVALID");
    }
    return {
      userId: user.id,
      userPublicId: user.publicId,
      email: user.email,
      role: user.role,
      sessionId: session.id,
      stage: session.stage,
      user,
    };
  }

  currentUser(context: AuthContext): CurrentUserDTO {
    return toCurrentUserDTO(context.user, context.stage);
  }

  async changePassword(
    context: AuthContext,
    input: { currentPassword?: string; newPassword: string },
    now = new Date(),
  ): Promise<void> {
    const validation = validatePassword(input.newPassword, "newPassword");
    if (validation.length > 0) {
      throw new ApiError("VALIDATION_ERROR", validation);
    }

    if (context.stage === "FULL") {
      if (typeof input.currentPassword !== "string") {
        throw new ApiError("VALIDATION_ERROR", [
          { field: "currentPassword", message: "Current password is required." },
        ]);
      }
      if (!(await verifyPassword(context.user.passwordHash, input.currentPassword))) {
        throw new ApiError("AUTHENTICATION_FAILED");
      }
    }

    if (await verifyPassword(context.user.passwordHash, input.newPassword)) {
      throw new ApiError("VALIDATION_ERROR", [
        { field: "newPassword", message: "New password must differ from the current password." },
      ]);
    }

    const passwordHash = await hashPassword(input.newPassword, this.passwordProfile);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: context.userId },
        data: { passwordHash, mustChangePassword: false, updatedBy: context.email },
      });
      await tx.userSession.updateMany({
        where: { userId: context.userId, revokedAt: null },
        data: { revokedAt: now, revokeReason: "password_changed" },
      });
    });
  }

  async logoutAll(context: AuthContext, now = new Date()): Promise<void> {
    await this.sessions.revokeAllForUser(context.userId, "logout_all", now);
  }

  async logoutByRefreshToken(token: string, now = new Date()): Promise<void> {
    await this.sessions.revokeByToken(token, now);
  }
}

export { toCurrentUserDTO };
