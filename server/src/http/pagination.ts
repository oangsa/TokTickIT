import type { Response } from "express";

/*
 * Collection pagination metadata (api-spec Section 9.13, BR-40).
 *
 * The values travel in the `X-Pagination` response header rather than in the
 * body, so the body stays a plain array of the resource DTO. `cors.ts` already
 * exposes `X-Pagination` and `X-Request-Id`, and `transport.ts` already applies
 * `Cache-Control: no-store` and `Vary: Origin`, so a collection route only has
 * to supply the value.
 */

export interface PaginationMetadata {
  pageNumber: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export function buildPaginationMetadata(
  pageNumber: number,
  pageSize: number,
  totalItems: number,
): PaginationMetadata {
  const totalPages = Math.ceil(totalItems / pageSize);

  return {
    pageNumber,
    pageSize,
    totalItems,
    totalPages,
    /*
     * An empty result set has zero pages, so neither neighbour exists even
     * though `pageNumber` is still 1. A page past the last one keeps
     * `hasPreviousPage: true`, which is what lets the client walk back.
     */
    hasPreviousPage: totalPages > 0 && pageNumber > 1,
    hasNextPage: pageNumber < totalPages,
  };
}

export function setPaginationHeader(res: Response, metadata: PaginationMetadata): void {
  res.setHeader("X-Pagination", JSON.stringify(metadata));
}
