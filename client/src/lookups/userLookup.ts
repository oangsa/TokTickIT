import type { LookupDefinition } from "../components/Common/Lookup/types.js";
import type { UserRole } from "../auth/authTypes.js";
import type { AuthContextValue } from "../auth/AuthProvider.js";
import { fetchCollection } from "../collections/fetchCollection.js";
export interface AssignableUser { publicId: string; name: string; email: string; role: Exclude<UserRole, "REQUESTER"> }
export function userLookup(request: AuthContextValue["request"]): LookupDefinition<AssignableUser> {
  return { title: "Select User", columns: [
    { key: "name", label: "Name" }, { key: "email", label: "Email" },
    { key: "role", label: "Role", render: (_value, row) => row.role === "IT_STAFF" ? "IT Staff" : "Administrator" },
  ], getValue: (row) => row.publicId, getDisplayValue: (row) => row.name,
    searchPlaceholder: "Search users", emptyMessage: "No eligible users", noMatchMessage: "No matching users", defaultSortKey: "name", defaultSortDir: "asc",
    filterFields: [{ key: "role", label: "Role", type: "select", options: [{ value: "IT_STAFF", label: "IT Staff" }, { value: "ADMINISTRATOR", label: "Administrator" }] }],
    fetchData: async (params) => {
      const query = new URLSearchParams({ sort: `${params.sortBy ?? "name"}:${params.sortDir ?? "asc"}`, pageNumber: String(params.page), pageSize: String(params.limit) });
      if (params.searchTerm.trim()) { query.set("search", params.searchTerm.trim()); query.set("searchFields", "name,email"); }
      if (params.search?.role) query.set("filters", JSON.stringify([{ field: "role", condition: "EQUAL", value: params.search.role }]));
      return fetchCollection<AssignableUser>(request, `/api/users/assignable?${query}`);
    } };
}
