import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Pencil } from "lucide-react";

import { ApiResponseError } from "../api.js";
import { useAuth } from "../auth/AuthProvider.js";
import { useAuthenticatedApi } from "../auth/useAuthenticatedApi.js";
import { Button } from "../components/Button.js";
import { Card } from "../components/Card.js";
import { PageHeader } from "../components/PageHeader.js";
import { UserForm } from "../components/UserForm.js";

interface UserDetailDTO {
  publicId: string;
  name: string;
  email: string;
  role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
  isActive: boolean;
}

export default function ViewUser() {
  const { publicId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const callApi = useAuthenticatedApi();

  const [targetUser, setTargetUser] = useState<UserDetailDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isSelf = Boolean(
    currentUser &&
      targetUser &&
      currentUser.publicId.toLowerCase() === targetUser.publicId.toLowerCase(),
  );

  const loadUser = useCallback(async () => {
    if (!publicId) return;
    setLoading(true);
    setLoadError(null);

    try {
      const data = await callApi<UserDetailDTO>(
        `/api/admin/users/${encodeURIComponent(publicId)}`,
      );
      setTargetUser(data);
    } catch (err) {
      if (err instanceof ApiResponseError && (err.status === 404 || err.status === 403)) {
        navigate("/error", { state: { status: err.status } });
        return;
      }
      setLoadError("Failed to load user details.");
    } finally {
      setLoading(false);
    }
  }, [callApi, publicId, navigate]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  if (loading) {
    return <p role="status" className="p-3">Loading user details…</p>;
  }

  if (loadError || !targetUser) {
    return (
      <div className="tt-view-user">
        <PageHeader
          title="User Details"
          eyebrow="Administration"
          actions={
            <Link to="/admin/users" className="btn btn-outline-secondary">
              Back to Users
            </Link>
          }
        />
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
    <div className="tt-view-user">
      <PageHeader
        title={targetUser.name}
        eyebrow="User Detail"
        actions={
          <div className="d-flex gap-2">
            <Link to="/admin/users" className="btn btn-outline-secondary">
              Back to Users
            </Link>
            <Link
              to={`/admin/users/${encodeURIComponent(targetUser.publicId)}/edit`}
              className="btn btn-primary d-inline-flex align-items-center gap-1"
            >
              <Pencil size={16} aria-hidden="true" focusable="false" />
              <span>Edit User</span>
            </Link>
          </div>
        }
      />
      <Card title="User Information">
        <UserForm
          mode="view"
          values={{
            name: targetUser.name,
            email: targetUser.email,
            role: targetUser.role,
            isActive: targetUser.isActive,
          }}
          isSelf={isSelf}
        />
      </Card>
    </div>
  );
}
