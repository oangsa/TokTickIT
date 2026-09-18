import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { ApiResponseError } from "../api.js";
import { useAuth } from "../auth/AuthProvider.js";
import { useAuthenticatedApi } from "../auth/useAuthenticatedApi.js";
import { Button } from "../components/Button.js";
import { Card } from "../components/Card.js";
import { UserForm } from "../components/UserForm.js";
import { Modal } from "../components/Modal.js";
import { PageHeader } from "../components/PageHeader.js";
import { useManagedForm } from "../forms/useManagedForm.js";
import { USER_FORM_RULES, type UserFormValues } from "../constants/forms/user.js";
import { useNavigationGuard, type NavigationAction } from "../navigation/NavigationGuard.js";

const editUserSchema = z.object({
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

interface UserDetailDTO {
  publicId: string;
  name: string;
  email: string;
  role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
  isActive: boolean;
}

export default function EditUser() {
  const { publicId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, logout } = useAuth();
  const callApi = useAuthenticatedApi();
  const { register, allowNavigation, cancelNavigation } = useNavigationGuard();

  const [targetUser, setTargetUser] = useState<UserDetailDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Initial password reset state
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [newInitialPassword, setNewInitialPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Role/Deactivation confirmation modal state
  const [pendingValues, setPendingValues] = useState<UserFormValues | null>(null);
  const [confirmActionModal, setConfirmActionModal] = useState<{
    title: string;
    message: string;
  } | null>(null);

  // Dirty navigation guard state
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const pendingNavigationRef = useRef<NavigationAction | null>(null);

  const form = useManagedForm<UserFormValues>({
    schema: editUserSchema as never,
    defaultValues: {
      name: "",
      email: "",
      role: "REQUESTER",
      isActive: true,
    },
  });
  const { reset } = form;

  const isSelf = Boolean(
    currentUser && targetUser && currentUser.publicId.toLowerCase() === targetUser.publicId.toLowerCase(),
  );

  const dirty = form.formState.isDirty;

  const requestDiscard = useCallback((action: NavigationAction): void => {
    pendingNavigationRef.current = action;
    setConfirmDiscard(true);
  }, []);

  useEffect(() => {
    return register({ dirty, onBlockedNavigation: requestDiscard });
  }, [dirty, register, requestDiscard]);

  const loadUser = useCallback(async () => {
    if (!publicId) return;
    setLoading(true);
    setLoadError(null);

    try {
      const data = await callApi<UserDetailDTO>(`/api/admin/users/${encodeURIComponent(publicId)}`);
      setTargetUser(data);
      reset({
        name: data.name,
        email: data.email,
        role: data.role,
        isActive: data.isActive,
      });
    } catch (err) {
      if (err instanceof ApiResponseError && (err.status === 404 || err.status === 403)) {
        navigate("/error", { state: { status: err.status } });
        return;
      }
      setLoadError("Failed to load user details.");
    } finally {
      setLoading(false);
    }
  }, [callApi, publicId, navigate, reset]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

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

  const executeSave = async (values: UserFormValues) => {
    if (!targetUser) return;
    setSubmitting(true);
    form.setFormError(undefined);
    setSuccessMessage(null);

    const emailChanged = values.email.trim() !== targetUser.email;

    try {
      const updated = await callApi<UserDetailDTO>(
        `/api/admin/users/${encodeURIComponent(targetUser.publicId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: values.name.trim(),
            email: values.email.trim(),
            role: values.role,
            isActive: values.isActive,
          }),
        },
      );

      form.reset(values);
      setTargetUser(updated);

      if (isSelf && emailChanged) {
        // Self email changed revokes current session, redirect to login
        await logout();
        navigate("/login", { replace: true });
        return;
      }

      setSuccessMessage("User updated successfully.");
    } catch (err) {
      if (err instanceof ApiResponseError && err.code === "DUPLICATE_EMAIL") {
        form.setError("email", {
          type: "manual",
          message: "A user with this email address already exists.",
        });
      } else if (err instanceof ApiResponseError && err.status === 409) {
        form.setFormError(err.message || "Conflict: This change cannot be made.");
      } else if (err instanceof ApiResponseError) {
        form.setFormError(err.message || "Failed to update user.");
      } else {
        form.setFormError("Failed to update user.");
      }
    } finally {
      setSubmitting(false);
      setPendingValues(null);
      setConfirmActionModal(null);
    }
  };

  const handleFormSubmit = async (values: UserFormValues) => {
    if (!targetUser) return;

    const emailChanged = values.email.trim() !== targetUser.email;
    const roleChanged = values.role !== targetUser.role;
    const deactivated = targetUser.isActive && !values.isActive;

    if (roleChanged) {
      setPendingValues(values);
      setConfirmActionModal({
        title: "Change user role?",
        message:
          "All active sessions for this User will end and their assigned tickets may be affected.",
      });
      return;
    }

    if (deactivated) {
      setPendingValues(values);
      setConfirmActionModal({
        title: "Deactivate user account?",
        message:
          "All active sessions for this User will end and they will be unassigned from tickets.",
      });
      return;
    }

    if (emailChanged) {
      setPendingValues(values);
      setConfirmActionModal({
        title: "Change user email?",
        message: "All active sessions for this User will end.",
      });
      return;
    }

    await executeSave(values);
  };

  const handleResetPassword = async () => {
    if (!targetUser) return;
    setResettingPassword(true);

    try {
      const res = await callApi<{ initialPassword: string }>(
        `/api/admin/users/${encodeURIComponent(targetUser.publicId)}/initial-password`,
        {
          method: "POST",
        },
      );

      setConfirmResetOpen(false);
      setNewInitialPassword(res.initialPassword);
    } catch (err) {
      if (err instanceof ApiResponseError) {
        form.setFormError(err.message || "Failed to reset initial password.");
      }
    } finally {
      setResettingPassword(false);
    }
  };

  const handleCopyPassword = async () => {
    if (!newInitialPassword) return;
    try {
      await navigator.clipboard.writeText(newInitialPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
    }
  };

  if (loading) {
    return (
      <div className="tt-edit-user">
        <PageHeader title="Edit User" eyebrow="User Management" actions={<Link to="/admin/users">Back to Users</Link>} />
        <p role="status" className="text-secondary py-3">
          Loading user details…
        </p>
      </div>
    );
  }

  if (loadError || !targetUser) {
    return (
      <div className="tt-edit-user">
        <PageHeader title="Edit User" eyebrow="User Management" actions={<Link to="/admin/users">Back to Users</Link>} />
        <div className="alert alert-danger" role="alert">
          <p className="mb-2">{loadError || "User not found."}</p>
          <Button variant="secondary" onClick={() => void loadUser()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="tt-edit-user">
      <PageHeader
        title={`Edit ${targetUser.name}`}
        eyebrow="User Management"
        actions={<Link to="/admin/users">Back to Users</Link>}
      />

      {successMessage ? (
        <div className="alert alert-success alert-dismissible fade show" role="status">
          {successMessage}
        </div>
      ) : null}

      <div className="d-flex flex-column gap-4">
        {/* User Details Form Card */}
        <Card title="User Information">
          {isSelf ? (
            <div className="alert alert-info mb-3">
              You are editing your own administrator profile. You cannot change your own role or
              deactivate your own account.
            </div>
          ) : null}

          <UserForm
            mode="edit"
            form={form}
            isSelf={isSelf}
            onSubmit={handleFormSubmit}
            onCancel={handleCancel}
            submitting={submitting}
            submitDisabled={submitting}
            cancelDisabled={submitting}
          />
        </Card>

        {/* Account Security Card */}
        <Card title="Account Security">
          {newInitialPassword ? (
            <div data-testid="reset-initial-password-panel">
              <div className="alert alert-success mb-3">
                Initial password has been reset.
              </div>

              <div className="mb-3">
                <label htmlFor="edit-one-time-password" className="form-label fw-semibold">
                  New Initial Password
                </label>
                <div className="input-group mb-2" style={{ maxWidth: "420px" }}>
                  <input
                    id="edit-one-time-password"
                    type="text"
                    readOnly
                    className="form-control font-monospace"
                    value={newInitialPassword}
                    aria-label="One-time initial password"
                  />
                  <Button
                    variant="secondary"
                    onClick={handleCopyPassword}
                    aria-label={copied ? "Password copied" : "Copy initial password"}
                  >
                    {copied ? "Password copied!" : "Copy"}
                  </Button>
                </div>
                <p className="text-secondary small mb-0">
                  This password is shown only once. The User must change it at next login.
                </p>
              </div>

              <Button variant="secondary" onClick={() => setNewInitialPassword(null)}>
                Done
              </Button>
            </div>
          ) : (
            <div>
              <p className="text-secondary mb-3">
                Set a new initial password for this User. The User will be signed out and must
                change it the next time they sign in.
              </p>

              {isSelf ? (
                <p className="text-muted small fst-italic mb-0">
                  An Administrator cannot reset their own initial password.
                </p>
              ) : (
                <Button
                  variant="destructive"
                  onClick={() => setConfirmResetOpen(true)}
                  disabled={submitting}
                >
                  Set New Initial Password
                </Button>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Role Change / Deactivation Confirmation Modal */}
      <Modal
        open={confirmActionModal !== null}
        title={confirmActionModal?.title ?? "Confirm Action"}
        onClose={() => setConfirmActionModal(null)}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={submitting}
              onClick={() => setConfirmActionModal(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              busy={submitting}
              onClick={() => pendingValues && void executeSave(pendingValues)}
            >
              Confirm
            </Button>
          </>
        }
      >
        <p className="mb-0">{confirmActionModal?.message}</p>
      </Modal>

      {/* Reset Password Confirmation Modal */}
      <Modal
        open={confirmResetOpen}
        title="Set a new initial password?"
        onClose={() => !resettingPassword && setConfirmResetOpen(false)}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={resettingPassword}
              onClick={() => setConfirmResetOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              busy={resettingPassword}
              onClick={handleResetPassword}
            >
              Set New Initial Password
            </Button>
          </>
        }
      >
        <p className="mb-2">All active sessions for this User will end.</p>
        <p className="mb-0 text-secondary small">The new password will be shown once.</p>
      </Modal>

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
    </div>
  );
}
