import { readPaginationHeader, type PaginationMetadata } from "../api.js";
import type { AuthContextValue } from "../auth/AuthProvider.js";
import type { IFetchResult } from "../components/Maintain/DataTable.js";

export async function fetchCollection<T>(request: AuthContextValue["request"], path: string): Promise<IFetchResult<T>> {
  let pagination: PaginationMetadata | null = null;
  const data = await request<T[]>(path, { onResponse: (response) => { pagination = readPaginationHeader(response.headers.get("X-Pagination")); } });
  // A missing header cannot be treated as an unbounded successful first page.
  const metadata = pagination as PaginationMetadata | null;
  if (!Array.isArray(data) || !metadata) throw new Error("Collection could not be loaded. Please retry.");
  return { data, total: metadata.totalItems, totalPages: metadata.totalPages, currentPage: metadata.pageNumber,
    hasNext: metadata.hasNextPage, hasPrevious: metadata.hasPreviousPage };
}
