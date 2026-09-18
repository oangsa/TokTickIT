import { z } from "zod";
import { useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { LOGIN_FORM_SECTIONS, type LoginFormValues } from "../constants/forms/auth.js";
import { CommonForm } from "../components/CommonForm.js";
import { Card } from "../components/Card.js";
import { BrandMark } from "../components/BrandMark.js";
import { SuccessMessage } from "../components/SuccessMessage.js";
import { useManagedForm } from "../forms/useManagedForm.js";
import { ApiResponseError } from "../api.js";
import { AuthStatus, roleHome, useAuth } from "../auth/AuthProvider.js";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
  rememberMe: z.boolean(),
});

const LOGIN_FIELDS = new Set(["email", "password", "rememberMe"]);

function loginError(error: unknown): string {
  if (error instanceof ApiResponseError) {
    if (error.code === "AUTHENTICATION_FAILED" || error.code === "UNAUTHENTICATED") return "Invalid email or password.";
    if (error.code === "RATE_LIMITED" || error.status === 429) return "Too many login attempts. Try again later.";
    if (error.code === "SESSION_INVALID") return "Your session is no longer valid. Please try again.";
    // Login must not expose an unexpected authentication distinction.
    if (error.status === 401) return "Invalid email or password.";
  }
  return "Unable to sign in right now. Please try again.";
}

export default function Login() {
  const { status, user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const form = useManagedForm<LoginFormValues>({
    schema: loginSchema,
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  if (status === AuthStatus.BOOTSTRAPPING) return <main id="tt-main" tabIndex={-1} className="tt-bootstrap" aria-busy="true"><div className="tt-bootstrap__panel"><p className="text-center">Loading…</p></div></main>;
  if (status === AuthStatus.AUTHENTICATED || status === AuthStatus.PASSWORD_CHANGE_REQUIRED) return <Navigate to={status === AuthStatus.PASSWORD_CHANGE_REQUIRED ? "/change-password" : user ? roleHome(user.role) : "/"} replace />;

  const state = location.state as { message?: unknown } | null;
  const notice = state?.message === "Password changed successfully. Please sign in again." || state?.message === "You have been signed out." || state?.message === "Your session has expired. Please sign in again."
    ? state.message
    : undefined;

  async function submit(values: LoginFormValues): Promise<void> {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    form.setFormError(undefined);
    try {
      const current = await login(values);
      navigate(current.sessionStage === "PASSWORD_CHANGE_REQUIRED" ? "/change-password" : roleHome(current.role), { replace: true });
    } catch (error) {
      if (error instanceof ApiResponseError && ["AUTHENTICATION_FAILED", "UNAUTHENTICATED", "RATE_LIMITED", "SESSION_INVALID"].includes(error.code ?? "")) {
        // Authentication failures intentionally collapse to fixed copy even
        // if an upstream response includes unexpected field details.
        form.setFormError(loginError(error));
      } else {
        form.mapServerErrors(error, LOGIN_FIELDS, loginError(error));
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return <main id="tt-main" tabIndex={-1} className="tt-bootstrap"><div className="tt-bootstrap__panel"><p className="tt-brand h5 justify-content-center w-100 mb-4"><BrandMark />TokTickIT</p><Card title="Sign in">{notice ? <SuccessMessage className="mb-3">{notice}</SuccessMessage> : null}<CommonForm form={form} sections={LOGIN_FORM_SECTIONS} onSubmit={submit} showCancelButton={false} submitLabel="Sign in" submitting={submitting} ariaLabel="Sign in" /></Card></div></main>;
}

export { loginSchema };
