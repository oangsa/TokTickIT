import type { LookupDefinition } from "../components/Common/Lookup/types.js";
import type { AuthContextValue } from "../auth/AuthProvider.js";
import { fetchCollection } from "../collections/fetchCollection.js";
import { actionApiPath, type UserSummary } from "../modules/Actions/types.js";

type ReferencedUser = Pick<UserSummary, "publicId" | "name" | "role">;
export function actionUserLookup(request: AuthContextValue["request"], ticketPublicId: string, requester: boolean, reference: "assignedTo" | "performedBy"): LookupDefinition<ReferencedUser> {
  return {
    title: `Select ${reference === "assignedTo" ? "Assigned To" : "Performed By"}`,
    columns: [{ key: "name", label: "Name" }, { key: "role", label: "Role", render: (_value, row) => row.role === "IT_STAFF" ? "IT Staff" : row.role === "ADMINISTRATOR" ? "Administrator" : "Requester" }],
    getValue: (row) => row.publicId, getDisplayValue: (row) => row.name,
    searchPlaceholder: "Search referenced users", emptyMessage: "No referenced users", noMatchMessage: "No matching users", defaultSortKey: "name", defaultSortDir: "asc",
    fetchData: async (params) => {
      const query = new URLSearchParams({ reference, sort: `${params.sortBy ?? "name"}:${params.sortDir ?? "asc"}`, pageNumber: String(params.page), pageSize: String(params.limit) });
      if (params.searchTerm.trim()) { query.set("search", params.searchTerm.trim()); query.set("searchFields", "name"); }
      return fetchCollection<ReferencedUser>(request, `${actionApiPath(ticketPublicId, requester)}/filter-users?${query}`);
    },
  };
}
