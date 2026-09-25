import { useCallback } from "react";
import { Link } from "react-router-dom";
import { readPaginationHeader, type PaginationMetadata } from "../../api.js";
import { useAuthenticatedApi } from "../../auth/useAuthenticatedApi.js";
import { Chip } from "../../components/Common/Chip.js";
import {
  DataTable,
  type IColumn,
  type IDataTableFilterField,
  type IFetchParams,
  type IFetchResult,
} from "../../components/Maintain/DataTable.js";
import { statusLabel } from "../Tickets/staffTickets.js";
import type { UserRole } from "../../auth/authTypes.js";

export interface UserListItem {
  publicId: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

const COLUMNS: IColumn<UserListItem>[] = [
  {
    key: "name",
    label: "Name",
    sortable: true,
    render: (_val, user) => <span className="fw-medium">{user.name}</span>,
  },
  {
    key: "email",
    label: "Email",
    sortable: true,
    render: (_val, user) => <span className="text-break">{user.email}</span>,
  },
  {
    key: "role",
    label: "Role",
    sortable: false,
    render: (_val, user) => <Chip variant="outline">{statusLabel(user.role)}</Chip>,
  },
  {
    key: "status",
    label: "Status",
    sortable: false,
    render: (_val, user) =>
      user.isActive ? (
        <Chip variant="subtle">Active</Chip>
      ) : (
        <Chip variant="outline">Inactive</Chip>
      ),
  },
];

const FILTER_FIELDS: IDataTableFilterField[] = [
  {
    key: "role",
    label: "Role",
    ariaLabel: "Filter by role",
    type: "select",
    options: [
      { label: "Requester", value: "REQUESTER" },
      { label: "IT Staff", value: "IT_STAFF" },
      { label: "Administrator", value: "ADMINISTRATOR" },
    ],
  },
];

const USER_SORTS: [string, string][] = [
  ["name:asc", "Name A-Z"],
  ["name:desc", "Name Z-A"],
  ["email:asc", "Email A-Z"],
  ["email:desc", "Email Z-A"],
];

export default function UserManagement() {
  const callApi = useAuthenticatedApi();

  const fetchUsers = useCallback(
    async (params: IFetchParams): Promise<IFetchResult<UserListItem>> => {
      const queryParams = new URLSearchParams();
      queryParams.set("pageNumber", String(params.page));
      queryParams.set("pageSize", String(params.limit));

      if (params.sortBy) {
        queryParams.set("sort", `${params.sortBy}:${params.sortDir ?? "asc"}`);
      } else {
        queryParams.set("sort", "name:asc");
      }

      if (params.searchTerm) {
        queryParams.set("search", params.searchTerm);
        queryParams.set("searchFields", "name,email");
      }

      const roleFilter = params.search?.role;
      if (roleFilter) {
        queryParams.set(
          "filters",
          JSON.stringify([{ field: "role", condition: "EQUAL", value: roleFilter }]),
        );
      }

      let paginationMeta: PaginationMetadata | null = null;
      const res = await callApi<
        | UserListItem[]
        | {
            items: UserListItem[];
            pagination: {
              pageNumber: number;
              pageSize: number;
              totalPages: number;
              totalItems: number;
            };
          }
      >(`/api/admin/users?${queryParams.toString()}`, {
        onResponse: (response) => {
          paginationMeta = readPaginationHeader(response.headers.get("X-Pagination"));
        },
      });

      const items = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
      const pagination = paginationMeta ?? (Array.isArray(res) ? null : res?.pagination);

      return {
        data: items,
        total: pagination?.totalItems ?? items.length,
        totalPages: pagination?.totalPages,
        currentPage: pagination?.pageNumber,
      };
    },
    [callApi],
  );

  return (
    <div className="tt-user-management">
      <DataTable<UserListItem>
        title="User Management"
        fetchData={fetchUsers}
        columns={COLUMNS}
        renderMobileCard={(user) => (
          <article className="border rounded p-3" data-testid={`user-card-${user.publicId}`}>
            <h2 className="h6 text-break">{user.name}</h2>
            <p className="text-break mb-2">{user.email}</p>
            <div className="d-flex flex-wrap gap-2 mb-3">
              <Chip variant="outline">{statusLabel(user.role)}</Chip>
              <Chip variant={user.isActive ? "subtle" : "outline"}>
                {user.isActive ? "Active" : "Inactive"}
              </Chip>
            </div>
            <div className="d-flex gap-3">
              <Link to={`/admin/users/${user.publicId}`}>View</Link>
              <Link to={`/admin/users/${user.publicId}/edit`}>Edit</Link>
            </div>
          </article>
        )}
        filterFields={FILTER_FIELDS}
        searchLabel="Search Users"
        searchPlaceholder="Search by name or email…"
        searchAriaLabel="Search users by name or email"
        sortOptions={USER_SORTS}
        itemName="users"
        basePath="/admin/users"
        itemKey="publicId"
        createButtonLabel="Create User"
        createButtonTo="/admin/users/new"
        showCreateButton={true}
        showViewAction={true}
        showEditAction={true}
        showDeleteAction={false}
        emptyMessage="No users found."
        emptyTestId="empty-users"
        tableTestId="user-table"
        rowTestIdPrefix="user-row"
        defaultSortKey="name"
        defaultSortDir="asc"
        errorMessage="Failed to load users. Please check your connection and try again."
      />
    </div>
  );
}
