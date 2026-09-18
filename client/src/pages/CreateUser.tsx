import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { ApiResponseError } from "../api.js";
import { useAuthenticatedApi } from "../auth/useAuthenticatedApi.js";
import { Button } from "../components/Button.js";
import { Card } from "../components/Card.js";
import { ManagePage } from "../components/ManagePage.js";
import { OneTimePassword } from "../components/OneTimePassword.js";
import { SuccessMessage } from "../components/SuccessMessage.js";
import { UserForm } from "../components/UserForm.js";
import { Modal } from "../components/Modal.js";
import type { PageHeaderProps } from "../components/PageHeader.js";
import { useManagedForm } from "../forms/useManagedForm.js";
import { USER_FORM_RULES, USER_FORM_SECTIONS, type UserFormValues } from "../constants/forms/user.js";
import { useNavigationGuard, type NavigationAction } from "../navigation/NavigationGuard.js";

const createUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(USER_FORM_RULES.name.minLength, "Name is required.")
    .max(USER_FORM_RULES.name.maxLength, `Name must be between 1 and ${USER_FORM_RULES.name.maxLength} characters.`),
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .max(USER_FORM_RULES.email.maxLength, "Email is too long.")
    .email("Enter a valid email address."),
  role: z.enum(["REQUESTER", "IT_STAFF", "ADMINISTRATOR"]),
  isActive: z.boolean(),
});

const CREATE_USER_PAGE_HEADER = {
  title: "Create User",
  subtitle: "Create an account for TokTickIT.",
  backAction: { to: "/admin/users", label: "Back to Users" },
} satisfies PageHeaderProps;

export default function CreateUser() {
  const navigate = useNavigate();
  const callApi = useAuthenticatedApi();
  const { register, allowNavigation, cancelNavigation } = useNavigationGuard();

  const form = useManagedForm<UserFormValues>({
    schema: createUserSchema as never,
    defaultValues: {
      name: "",
      email: "",
      role: "REQUESTER",
      isActive: true,
    },
  });

  const [submitting, setSubmitting] = useState(false);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Dirty navigation guard state
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const pendingNavigationRef = useRef<NavigationAction | null>(null);

  const dirty = form.formState.isDirty && createdPassword === null;

  const requestDiscard = useCallback((action: NavigationAction): void => {
    pendingNavigationRef.current = action;
    setConfirmDiscard(true);
  }, []);

  useEffect(() => {
    return register({ dirty, onBlockedNavigation: requestDiscard });
  }, [dirty, register, requestDiscard]);

  const handleCancel = () => {
    if (dirty) {
      requestDiscard(() => allowNavigation(() => navigate("/admin/users")));
    } else {
      navigate("/admin/users");
    }
  };

  const handleKeepEditing = () => {
    cancelNavigation();
    setConfirmDiscard(false);
    pendingNavigationRef.current = null;
  };

  const handleConfirmDiscard = () => {
    setConfirmDiscard(false);
    form.reset();
    const action = pendingNavigationRef.current;
    pendingNavigationRef.current = null;
    if (action) {
      action();
    } else {
      allowNavigation(() => navigate("/admin/users"));
    }
  };

  const handleFormSubmit = async (values: UserFormValues) => {
    setSubmitting(true);
    form.setFormError(undefined);

    try {
      const res = await callApi<{
        user: { publicId: string; name: string; email: string };
        initialPassword: string;
      }>("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name.trim(),
          email: values.email.trim(),
          role: values.role,
          isActive: values.isActive,
        }),
      });

      form.reset(values);
      setCreatedPassword(res.initialPassword);
    } catch (err) {
      if (err instanceof ApiResponseError && (err.status === 409 || err.code === "DUPLICATE_EMAIL")) {
        form.setError("email", {
          type: "manual",
          message: "A user with this email address already exists.",
        });
      } else if (err instanceof ApiResponseError) {
        form.setFormError(err.message || "Failed to create user.");
      } else {
        form.setFormError("Failed to create user.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyPassword = async () => {
    if (!createdPassword) return;
    try {
      await navigator.clipboard.writeText(createdPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback if clipboard API not permitted
    }
  };

  return (
    <ManagePage header={CREATE_USER_PAGE_HEADER} className="tt-create-user">
      {createdPassword ? (
        <div data-testid="initial-password-panel">
          <Card title="User Created Successfully">
            <SuccessMessage className="mb-3">The user account has been created.</SuccessMessage>

            <OneTimePassword
              id="one-time-initial-password"
              label="Initial Password"
              value={createdPassword}
              helpText="This password is shown only once. The User must change it at first login."
              copied={copied}
              onCopy={handleCopyPassword}
            />

            <div>
              <Button
                variant="primary"
                onClick={() => {
                  setCreatedPassword(null);
                  navigate("/admin/users");
                }}
              >
                Done
              </Button>
            </div>
          </Card>
        </div>
      ) : (
        <Card title="User Information">
          <UserForm
            mode="create"
            form={form}
            onSubmit={handleFormSubmit}
            onCancel={handleCancel}
            submitting={submitting}
            submitDisabled={submitting}
            cancelDisabled={submitting}
          />
        </Card>
      )}

      {/* Discard Confirmation Modal */}
      <Modal
        open={confirmDiscard}
        title="Discard unsaved changes?"
        onClose={handleKeepEditing}
        footer={
          <>
            <Button variant="secondary" onClick={handleKeepEditing}>
              Keep Editing
            </Button>
            <Button variant="destructive" onClick={handleConfirmDiscard}>
              Discard
            </Button>
          </>
        }
      >
        <p className="mb-0">Your User changes will be lost.</p>
      </Modal>
    </ManagePage>
  );
}
