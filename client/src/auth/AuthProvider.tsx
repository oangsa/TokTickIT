import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { ApiResponseError } from "../api.js";
import { AUTH_FORM_RULES } from "../constants/forms/auth.js";
import type { ChangePasswordFormValues } from "../constants/forms/auth.js";
import { clearRecovery } from "../modules/Tickets/createTicketDraft.js";
import {
  authenticatedRequest,
  authenticatedBlobRequest,
  beginAuthSession,
  broadcastLogout,
  clearAccessToken,
  getAccessToken,
  getAuthSessionId,
  isInvalidSessionError,
  publicAuthRequest,
  refreshAccessToken,
  setAccessToken,
  subscribeAuthEvents,
  type AuthEvent,
  type AuthenticatedRequestInit,
} from "./authTransport.js";
import type { AuthTokenDTO, CurrentUserDTO, LoginCredentials, UserRole } from "./authTypes.js";

export const AuthStatus = {
  BOOTSTRAPPING: "BOOTSTRAPPING",
  ANONYMOUS: "ANONYMOUS",
  PASSWORD_CHANGE_REQUIRED: "PASSWORD_CHANGE_REQUIRED",
  AUTHENTICATED: "AUTHENTICATED",
} as const;
export type AuthStatus = (typeof AuthStatus)[keyof typeof AuthStatus];

export interface AuthState {
  status: AuthStatus;
  user: CurrentUserDTO | null;
}

export interface AuthContextValue {
  status: AuthStatus;
  authState: AuthStatus;
  state: AuthState;
  user: CurrentUserDTO | null;
  currentUser: CurrentUserDTO | null;
  isAuthenticated: boolean;
  passwordChangeCompleted: boolean;
  sessionEnded: boolean;
  login: (credentials: LoginCredentials) => Promise<CurrentUserDTO>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  changePassword: (values: ChangePasswordFormValues) => Promise<void>;
  refresh: () => Promise<CurrentUserDTO | null>;
  request: <T>(path: string, init?: AuthenticatedRequestInit) => Promise<T>;
  requestBlob: (path: string, init?: AuthenticatedRequestInit) => Promise<Blob>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

function validUser(value: unknown): value is CurrentUserDTO {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.publicId === "string" && typeof candidate.name === "string" && typeof candidate.email === "string" && candidate.isActive === true && typeof candidate.mustChangePassword === "boolean" && (candidate.role === "REQUESTER" || candidate.role === "IT_STAFF" || candidate.role === "ADMINISTRATOR") && (candidate.sessionStage === "FULL" || candidate.sessionStage === "PASSWORD_CHANGE_REQUIRED");
}

function roleHome(role: UserRole): string {
  if (role === "REQUESTER") return "/tickets";
  if (role === "IT_STAFF") return "/staff/tickets";
  return "/admin/users";
}

export { roleHome };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(AuthStatus.BOOTSTRAPPING);
  const [user, setUser] = useState<CurrentUserDTO | null>(null);
  const [passwordChangeCompleted, setPasswordChangeCompleted] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const bootstrapStarted = useRef(false);
  const authEpoch = useRef(0);

  const loadCurrentUser = useCallback(async (): Promise<CurrentUserDTO | null> => {
    const tokenAtStart = getAccessToken();
    const sessionIdAtStart = getAuthSessionId();
    const epochAtStart = authEpoch.current;
    if (!tokenAtStart) {
      setUser(null);
      setStatus(AuthStatus.ANONYMOUS);
      return null;
    }
    const current = await authenticatedRequest<CurrentUserDTO>("/api/auth/me");
    if (epochAtStart !== authEpoch.current || tokenAtStart !== getAccessToken() || sessionIdAtStart !== getAuthSessionId()) return null;
    if (!validUser(current)) throw new Error("The authentication identity response is invalid.");
    setUser(current);
    setStatus(current.sessionStage === "PASSWORD_CHANGE_REQUIRED" ? AuthStatus.PASSWORD_CHANGE_REQUIRED : AuthStatus.AUTHENTICATED);
    return current;
  }, []);

  const finishAnonymous = useCallback(() => {
    authEpoch.current += 1;
    clearAccessToken(false);
    clearRecovery();
    setUser(null);
    setStatus(AuthStatus.ANONYMOUS);
  }, []);

  const refresh = useCallback(async (): Promise<CurrentUserDTO | null> => {
    const epochAtStart = authEpoch.current;
    const tokenAtStart = getAccessToken();
    const sessionIdAtStart = getAuthSessionId();
    try {
      const refreshed = sessionIdAtStart === null
        ? await refreshAccessToken(tokenAtStart)
        : await refreshAccessToken(tokenAtStart, sessionIdAtStart);
      if (epochAtStart !== authEpoch.current) {
        return null;
      }
      if (refreshed === null) return null;
      return await loadCurrentUser();
    } catch (error) {
      if (
        epochAtStart === authEpoch.current &&
        sessionIdAtStart === getAuthSessionId() &&
        (tokenAtStart === null || isInvalidSessionError(error))
      ) finishAnonymous();
      return null;
    }
  }, [finishAnonymous, loadCurrentUser]);

  useEffect(() => {
    const unsubscribe = subscribeAuthEvents((event: AuthEvent) => {
      if (event.type === "SESSION_ENDED") {
        setSessionEnded(true);
        finishAnonymous();
        return;
      }
      if (event.type === "LOGOUT") {
        setSessionEnded(false);
        finishAnonymous();
        return;
      }
      if (event.type === "ACCESS_UPDATED") {
        // Each tab keeps its own bearer in memory. A tab that did not perform
        // the login/refresh receives the ephemeral bearer update and then loads
        // the authoritative identity.
        const wasAuthenticated = status === AuthStatus.AUTHENTICATED || status === AuthStatus.PASSWORD_CHANGE_REQUIRED;
        authEpoch.current += 1;
        void (async () => {
          try {
            if (!wasAuthenticated) {
              setUser(null);
              setStatus(AuthStatus.BOOTSTRAPPING);
              if (!getAccessToken()) {
                const refreshed = event.sessionId === undefined
                  ? await refreshAccessToken(null)
                  : await refreshAccessToken(null, event.sessionId);
                if (refreshed === null) return;
              }
            }
            await loadCurrentUser();
          } catch (error) {
            if (!wasAuthenticated || isInvalidSessionError(error)) finishAnonymous();
          }
        })();
      }
    });

    if (!bootstrapStarted.current) {
      bootstrapStarted.current = true;
      void (async () => {
        const epochAtStart = authEpoch.current;
        try {
          const token = await refreshAccessToken(null);
          if (epochAtStart !== authEpoch.current) {
            return;
          }
          if (token === null) {
            finishAnonymous();
            return;
          }
          const sessionIdAtStart = getAuthSessionId();
          const current = await loadCurrentUser();
          if (current === null) {
            if (sessionIdAtStart !== getAuthSessionId()) return;
            if (getAccessToken()) {
              const retried = await loadCurrentUser();
              if (retried !== null) return;
            }
            if (sessionIdAtStart !== getAuthSessionId()) return;
            finishAnonymous();
          }
        } catch {
          if (epochAtStart === authEpoch.current) finishAnonymous();
        }
      })();
    }
    return unsubscribe;
  }, [finishAnonymous, loadCurrentUser, status]);

  const login = useCallback(async (credentials: LoginCredentials): Promise<CurrentUserDTO> => {
    const body: LoginCredentials = {
      email: credentials.email,
      password: credentials.password,
      rememberMe: credentials.rememberMe,
    };
    const result = await publicAuthRequest<AuthTokenDTO>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!result || typeof result.accessToken !== "string") throw new Error("The authentication response is invalid.");
    authEpoch.current += 1;
    beginAuthSession();
    setAccessToken(result.accessToken, result.expiresIn);
    const loginEpoch = authEpoch.current;
    const loginSessionId = getAuthSessionId();
    try {
      const current = await loadCurrentUser();
      if (!current) throw new Error("The authentication identity response is invalid.");
      setPasswordChangeCompleted(false);
      setSessionEnded(false);
      return current;
    } catch (error) {
      if (loginEpoch === authEpoch.current && loginSessionId === getAuthSessionId()) finishAnonymous();
      throw error;
    }
  }, [finishAnonymous, loadCurrentUser]);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await publicAuthRequest<void>("/api/auth/logout", { method: "POST" });
    } catch (error) {
      if (error instanceof ApiResponseError && (error.status === 401 || error.code === "SESSION_INVALID" || error.code === "UNAUTHENTICATED")) {
        setPasswordChangeCompleted(false);
        setSessionEnded(false);
        broadcastLogout();
        finishAnonymous();
        return;
      }
      throw error;
    }
    setPasswordChangeCompleted(false);
    setSessionEnded(false);
    broadcastLogout();
    finishAnonymous();
  }, [finishAnonymous]);

  const logoutAll = useCallback(async (): Promise<void> => {
    await authenticatedRequest<void>("/api/auth/logout-all", { method: "POST" });
    setPasswordChangeCompleted(false);
    setSessionEnded(false);
    broadcastLogout();
    finishAnonymous();
  }, [finishAnonymous]);

  const changePassword = useCallback(async (values: ChangePasswordFormValues): Promise<void> => {
    const epochAtStart = authEpoch.current;
    const sessionIdAtStart = getAuthSessionId();
    const body: { currentPassword?: string; newPassword: string } = { newPassword: values.newPassword };
    if (status === AuthStatus.AUTHENTICATED) body.currentPassword = values.currentPassword;
    try {
      await authenticatedRequest<void>("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (epochAtStart !== authEpoch.current || sessionIdAtStart !== getAuthSessionId()) return;
    } catch (error) {
      if (error instanceof ApiResponseError && error.code === "PASSWORD_CHANGE_REQUIRED") {
        try {
          if (epochAtStart === authEpoch.current && sessionIdAtStart === getAuthSessionId()) await loadCurrentUser();
        } catch {
          if (epochAtStart === authEpoch.current && sessionIdAtStart === getAuthSessionId()) finishAnonymous();
        }
      }
      throw error;
    }
    setPasswordChangeCompleted(true);
    setSessionEnded(false);
    broadcastLogout();
    finishAnonymous();
  }, [finishAnonymous, loadCurrentUser, status]);

  const request = useCallback(async <T,>(path: string, init?: AuthenticatedRequestInit): Promise<T> => {
    const epochAtStart = authEpoch.current;
    const sessionIdAtStart = getAuthSessionId();
    try {
      return await authenticatedRequest<T>(path, init);
    } catch (error) {
      if (error instanceof ApiResponseError && error.code === "PASSWORD_CHANGE_REQUIRED") {
        try {
          if (epochAtStart === authEpoch.current && sessionIdAtStart === getAuthSessionId()) await loadCurrentUser();
        } catch {
          if (epochAtStart === authEpoch.current && sessionIdAtStart === getAuthSessionId()) finishAnonymous();
        }
      }
      throw error;
    }
  }, [finishAnonymous, loadCurrentUser]);

  const requestBlob = useCallback(async (path: string, init?: AuthenticatedRequestInit): Promise<Blob> => {
    const epochAtStart = authEpoch.current;
    const sessionIdAtStart = getAuthSessionId();
    try {
      return await authenticatedBlobRequest(path, init);
    } catch (error) {
      if (error instanceof ApiResponseError && error.code === "PASSWORD_CHANGE_REQUIRED") {
        try {
          if (epochAtStart === authEpoch.current && sessionIdAtStart === getAuthSessionId()) await loadCurrentUser();
        } catch {
          if (epochAtStart === authEpoch.current && sessionIdAtStart === getAuthSessionId()) finishAnonymous();
        }
      }
      throw error;
    }
  }, [finishAnonymous, loadCurrentUser]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    authState: status,
    state: { status, user },
    user,
    currentUser: user,
    isAuthenticated: status === AuthStatus.AUTHENTICATED || status === AuthStatus.PASSWORD_CHANGE_REQUIRED,
    passwordChangeCompleted,
    sessionEnded,
    login,
    logout,
    logoutAll,
    changePassword,
    refresh,
    request,
    requestBlob,
  }), [changePassword, login, logout, logoutAll, passwordChangeCompleted, refresh, request, requestBlob, sessionEnded, status, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (value === null) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}

export { ApiResponseError, AUTH_FORM_RULES };
export type { AuthTokenDTO, CurrentUserDTO, LoginCredentials, UserRole } from "./authTypes.js";

export default AuthProvider;
