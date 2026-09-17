import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { readPaginationHeader, type PaginationMetadata } from "../api.js";
import { useAuthenticatedApi } from "../auth/useAuthenticatedApi.js";
import { Badge } from "../components/Badge.js";
import { Button } from "../components/Button.js";
import { Card } from "../components/Card.js";
import { PageHeader } from "../components/PageHeader.js";
import { Pagination } from "../components/Pagination.js";
import { statusLabel } from "../tickets/staffTickets.js";
import type { UserRole } from "../auth/authTypes.js";

export interface UserListItem {
  publicId: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export default function UserManagement() {
  const callApi = useAuthenticatedApi();

  const [users, setUsers] = useState<UserListItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search input & applied search
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  // Role filter
  const [roleFilter, setRoleFilter] = useState<string>("");

  const generation = useRef(0);

  const fetchUsers = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("pageNumber", String(page));
    params.set("pageSize", String(pageSize));
    params.set("sort", "name:asc");

    if (appliedSearch) {
      params.set("search", appliedSearch);
      params.set("searchFields", "name,email");
    }

    if (roleFilter) {
      params.set(
        "filters",
        JSON.stringify([{ field: "role", condition: "EQUAL", value: roleFilter }]),
      );
    }

    try {
      let paginationMeta: PaginationMetadata | null = null;
      const res = await callApi<
        | UserListItem[]
        | {
            items: UserListItem[];
            pagination: { pageNumber: number; pageSize: number; totalPages: number; totalItems: number };
          }
      >(`/api/admin/users?${params.toString()}`, {
        onResponse: (response) => {
          paginationMeta = readPaginationHeader(response.headers.get("X-Pagination"));
        },
      });

      if (current === generation.current) {
        const items = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
        const pagination = paginationMeta ?? (Array.isArray(res) ? null : res?.pagination);
        setUsers(items);
        setTotalItems(pagination?.totalItems ?? items.length);
      }
    } catch {
      if (current === generation.current) {
        setError("Failed to load users. Please check your connection and try again.");
      }
    } finally {
      if (current === generation.current) {
        setLoading(false);
      }
    }
  }, [callApi, page, pageSize, appliedSearch, roleFilter]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(searchTerm.trim());
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPage(1);
    setRoleFilter(e.target.value);
  };

  return (
    <div className="tt-user-management">
      <PageHeader
        title="User Management"
        eyebrow="Administration"
        actions={
          <Link to="/admin/users/new" className="btn btn-primary">
            + Create User
          </Link>
        }
      />

      <Card>
        {/* Search & Filter Controls */}
        <div className="row g-3 mb-4">
          <div className="col-12 col-md-8">
            <form onSubmit={handleSearchSubmit} className="d-flex gap-2">
              <input
                type="search"
                className="form-control"
                placeholder="Search by name or email…"
                aria-label="Search users by name or email"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Button type="submit" variant="secondary">
                Search
              </Button>
            </form>
          </div>
          <div className="col-12 col-md-4">
            <select
              className="form-select"
              aria-label="Filter by role"
              value={roleFilter}
              onChange={handleRoleChange}
            >
              <option value="">Any Role</option>
              <option value="REQUESTER">Requester</option>
              <option value="IT_STAFF">IT Staff</option>
              <option value="ADMINISTRATOR">Administrator</option>
            </select>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <p role="status" className="text-secondary py-3">
            Loading users…
          </p>
        ) : null}

        {/* Error State */}
        {!loading && error ? (
          <div className="alert alert-danger" role="alert">
            <p className="mb-2">{error}</p>
            <Button variant="secondary" onClick={() => void fetchUsers()}>
              Retry
            </Button>
          </div>
        ) : null}

        {/* Empty State */}
        {!loading && !error && users.length === 0 ? (
          <p className="text-secondary py-4 text-center" data-testid="empty-users">
            No users found.
          </p>
        ) : null}

        {/* Users Table */}
        {!loading && !error && users.length > 0 ? (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0" data-testid="user-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-end">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.publicId} data-testid={`user-row-${user.publicId}`}>
                    <td className="fw-medium">{user.name}</td>
                    <td className="text-break">{user.email}</td>
                    <td>
                      <Badge>{statusLabel(user.role)}</Badge>
                    </td>
                    <td>
                      {user.isActive ? (
                        <Badge variant="pale">Active</Badge>
                      ) : (
                        <Badge variant="neutral">Inactive</Badge>
                      )}
                    </td>
                    <td className="text-end">
                      <Link
                        to={`/admin/users/${user.publicId}/edit`}
                        className="btn btn-sm btn-outline-secondary"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* Pagination */}
        {!loading && totalItems > 0 ? (
          <div className="mt-4">
            <Pagination
              pageNumber={page}
              pageSize={pageSize}
              totalItems={totalItems}
              onPageChange={(newPage) => setPage(newPage)}
              onPageSizeChange={(newPageSize) => {
                setPageSize(newPageSize);
                setPage(1);
              }}
            />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
