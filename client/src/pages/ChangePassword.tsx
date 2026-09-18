import { Check, Circle } from "lucide-react";
import { z } from "zod";
import { useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { AUTH_FORM_RULES, CHANGE_PASSWORD_FORM_SECTIONS, type ChangePasswordFormValues } from "../constants/forms/auth.js";
import { CommonForm } from "../components/CommonForm.js";
import { Card } from "../components/Card.js";
import { PageHeader } from "../components/PageHeader.js";
import { useManagedForm } from "../forms/useManagedForm.js";
import { ApiResponseError } from "../api.js";
import { AuthStatus, useAuth } from "../auth/AuthProvider.js";

const PASSWORD_REQUIREMENTS = [
  { label: `At least ${AUTH_FORM_RULES.password.minLength} characters`, test: (value: string) => Array.from(value).length >= AUTH_FORM_RULES.password.minLength, message: `Password must be at least ${AUTH_FORM_RULES.password.minLength} characters.`, visual: true },
  { label: `No more than ${AUTH_FORM_RULES.password.maxLength} characters`, test: (value: string) => Array.from(value).length <= AUTH_FORM_RULES.password.maxLength, message: `Password must be no more than ${AUTH_FORM_RULES.password.maxLength} characters.`, visual: false },
  { label: "At least one uppercase letter (A–Z)", test: (value: string) => /[A-Z]/.test(value), message: "Password needs an uppercase letter.", visual: true },
  { label: "At least one lowercase letter (a–z)", test: (value: string) => /[a-z]/.test(value), message: "Password needs a lowercase letter.", visual: true },
  { label: "At least one number", test: (value: string) => /\p{Nd}/u.test(value), message: "Password needs a number.", visual: true },
  { label: "At least one symbol (not a space)", test: (value: string) => /[\p{P}\p{S}]/u.test(value), message: "Password needs a symbol.", visual: true },
];

function passwordSchema(restricted: boolean) {
  const password = PASSWORD_REQUIREMENTS.reduce((schema, rule) => schema.refine(rule.test, rule.message), z.string());
  const shape = restricted ? { newPassword: password, confirmPassword: z.string().min(1, "Confirm your new password.") } : { currentPassword: z.string().min(1, "Current password is required."), newPassword: password, confirmPassword: z.string().min(1, "Confirm your new password.") };
  let schema = z.object(shape).refine((values) => values.newPassword === values.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match." });
  if (!restricted) schema = schema.refine((values) => values.currentPassword !== values.newPassword, { path: ["newPassword"], message: "New password must differ from the current password." });
  return schema;
}

function changeError(error: unknown): string {
  if (error instanceof ApiResponseError && error.code === "AUTHENTICATION_FAILED") return "Current password is incorrect.";
  if (error instanceof ApiResponseError && error.code === "SESSION_INVALID") return "Your session is no longer valid. Please sign in again.";
  return "Unable to change password right now. Please try again.";
}

export default function ChangePassword() {
  const { passwordChangeCompleted, sessionEnded, status } = useAuth();
  if (status === AuthStatus.BOOTSTRAPPING) return <main id="tt-main" tabIndex={-1} className="tt-bootstrap" aria-busy="true"><div className="tt-bootstrap__panel"><p className="text-center">Loading…</p></div></main>;
  if (status === AuthStatus.ANONYMOUS) return <Navigate to="/login" replace state={passwordChangeCompleted ? { message: "Password changed successfully. Please sign in again." } : sessionEnded ? { message: "Your session has expired. Please sign in again." } : undefined} />;

  return <ChangePasswordForm key={status === AuthStatus.PASSWORD_CHANGE_REQUIRED ? "restricted" : "full"} restricted={status === AuthStatus.PASSWORD_CHANGE_REQUIRED} />;
}

function ChangePasswordForm({ restricted }: { restricted: boolean }) {
  const { changePassword } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const form = useManagedForm<ChangePasswordFormValues>({
    schema: passwordSchema(restricted) as never,
    defaultValues: restricted ? { newPassword: "", confirmPassword: "" } : { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const newPassword = form.watch("newPassword");
  const hasValidated = Boolean(newPassword && newPassword.length > 0) || form.formState.isSubmitted;
  const requirements = PASSWORD_REQUIREMENTS
    .filter((rule) => rule.visual)
    .map((rule) => {
      const met = Boolean(newPassword && newPassword.length > 0 && rule.test(newPassword));
      return { label: rule.label, met };
    });

  const sections = restricted
    ? CHANGE_PASSWORD_FORM_SECTIONS.map((section) => ({ ...section, fields: section.fields.filter((field) => field.name !== "currentPassword") }))
    : CHANGE_PASSWORD_FORM_SECTIONS;
  const visibleFields = new Set(sections.flatMap((section) => section.fields.map((field) => String(field.name))));

  async function submit(values: ChangePasswordFormValues): Promise<void> {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await changePassword(values);
      navigate("/login", { replace: true, state: { message: "Password changed successfully. Please sign in again." } });
    } catch (error) {
      form.mapServerErrors(error, visibleFields, changeError(error));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return <main id="tt-main" tabIndex={-1} className="tt-bootstrap"><div className="tt-bootstrap__panel"><Card><PageHeader title="Change Password" subtitle={restricted ? "You must choose a new password before continuing." : "Update your password for this account."} /><CommonForm form={form} sections={sections} onSubmit={submit} showCancelButton={false} submitLabel="Change Password" submitting={submitting} ariaLabel="Change Password"><section aria-labelledby="password-requirements-title" className="mb-3">
    <h2 id="password-requirements-title" className="visually-hidden">Password requirements</h2>
    <ul className="list-unstyled small mb-0" aria-live="polite" aria-atomic="false">
      {requirements.map(({ label, met }) => {
        const stateClass = met ? "text-success" : hasValidated ? "text-danger" : "text-secondary";
        return (
          <li key={label} className={`d-flex align-items-start gap-2 mb-1 ${stateClass}`}>
            {met ? (
              <Check size={16} className="flex-shrink-0 mt-1" aria-hidden="true" focusable="false" />
            ) : (
              <Circle size={16} className="flex-shrink-0 mt-1" aria-hidden="true" focusable="false" />
            )}
            <span><span className="visually-hidden">{met ? "Met: " : "Not met: "}</span>{label}</span>
          </li>
        );
      })}
    </ul>
  </section></CommonForm></Card></div></main>;
}

export { passwordSchema };
