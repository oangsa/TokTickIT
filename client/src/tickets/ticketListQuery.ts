/*
 * The My Tickets query, and its two translations: to and from the browser URL,
 * and out to the `GET /api/tickets` contract (api-spec Section 9).
 *
 * Every value stays a string. The four filter groups come out of
 * `<select multiple>` as strings, go into the URL as strings, and are converted
 * by the backend, which already accepts `"2"` for a reference field
 * (api-spec Section 9.9). Parsing them here would only add a second place to
 * get it wrong, and would quietly swallow a hand-edited URL the server should
 * be the one to reject.
 */

/* ui-spec Section 13.2. */
export const SEARCH_DEBOUNCE_MS = 400;

/* The UI always searches all three approved fields (BR-26). */
export const SEARCH_FIELDS = "ticketNumber,summary,description";

export const DEFAULT_SORT = "createdAt:desc";
export const DEFAULT_PAGE_SIZE = 10;

/* ui-spec Section 15. Every option maps to one approved API sort value. */
export const SORT_OPTIONS = [
  { id: "createdAt:desc", label: "Newest" },
  { id: "createdAt:asc", label: "Oldest" },
  { id: "ticketNumber:asc", label: "Ticket Number A–Z" },
  { id: "ticketNumber:desc", label: "Ticket Number Z–A" },
  { id: "summary:asc", label: "Summary A–Z" },
  { id: "summary:desc", label: "Summary Z–A" },
  { id: "requestedPriority:desc", label: "Priority High to Low" },
  { id: "requestedPriority:asc", label: "Priority Low to High" },
] as const;

export const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH"] as const;
export const STATUS_OPTIONS = ["NEW"] as const;

/* The four filters ui-spec Section 14.2 exposes, keyed by their API field. */
export interface FilterSelection {
  categoryId: string[];
  relatedSystemId: string[];
  requestedPriority: string[];
  currentStatus: string[];
}

export const FILTER_FIELDS = [
  "categoryId",
  "relatedSystemId",
  "requestedPriority",
  "currentStatus",
] as const;

export const EMPTY_FILTERS: FilterSelection = {
  categoryId: [],
  relatedSystemId: [],
  requestedPriority: [],
  currentStatus: [],
};

export interface TicketQuery extends FilterSelection {
  search: string;
  sort: string;
  pageNumber: number;
  pageSize: number;
}

export const INITIAL_QUERY: TicketQuery = {
  ...EMPTY_FILTERS,
  search: "",
  sort: DEFAULT_SORT,
  pageNumber: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

export function selectedFilters(query: FilterSelection): FilterSelection {
  return {
    categoryId: query.categoryId,
    relatedSystemId: query.relatedSystemId,
    requestedPriority: query.requestedPriority,
    currentStatus: query.currentStatus,
  };
}

/* ui-spec Section 14.1: the Filters button shows how many values are applied. */
export function filterCount(query: FilterSelection): number {
  return FILTER_FIELDS.reduce((total, field) => total + query[field].length, 0);
}

/* ui-spec Section 14.5: Clear Filters appears whenever a query is active. */
export function hasActiveQuery(query: TicketQuery): boolean {
  return query.search !== "" || filterCount(query) > 0;
}

function readList(params: URLSearchParams, field: string): string[] {
  const raw = params.get(field);

  return raw === null || raw === "" ? [] : raw.split(",");
}

function readNumber(params: URLSearchParams, field: string, fallback: number): number {
  const raw = params.get(field);

  return raw === null ? fallback : Number(raw);
}

export function readTicketQuery(params: URLSearchParams): TicketQuery {
  return {
    search: params.get("search") ?? "",
    categoryId: readList(params, "categoryId"),
    relatedSystemId: readList(params, "relatedSystemId"),
    requestedPriority: readList(params, "requestedPriority"),
    currentStatus: readList(params, "currentStatus"),
    sort: params.get("sort") ?? DEFAULT_SORT,
    pageNumber: readNumber(params, "pageNumber", 1),
    pageSize: readNumber(params, "pageSize", DEFAULT_PAGE_SIZE),
  };
}

/* Defaults are omitted so a first visit keeps a clean `/tickets` address. */
export function writeTicketQuery(query: TicketQuery): URLSearchParams {
  const params = new URLSearchParams();

  if (query.search !== "") {
    params.set("search", query.search);
  }

  for (const field of FILTER_FIELDS) {
    if (query[field].length > 0) {
      params.set(field, query[field].join(","));
    }
  }

  if (query.sort !== DEFAULT_SORT) {
    params.set("sort", query.sort);
  }

  if (query.pageNumber !== 1) {
    params.set("pageNumber", String(query.pageNumber));
  }

  if (query.pageSize !== DEFAULT_PAGE_SIZE) {
    params.set("pageSize", String(query.pageSize));
  }

  return params;
}

/*
 * api-spec Sections 9.3, 9.4, and 9.12. Each non-empty group becomes one `IN`
 * expression -- valid from a single value up to 100 -- so there is one code
 * path rather than an EQUAL/IN branch, and no nested OR group is ever built.
 */
export function buildTicketListSearch(query: TicketQuery): string {
  const params = new URLSearchParams();

  if (query.search !== "") {
    params.set("search", query.search);
    params.set("searchFields", SEARCH_FIELDS);
  }

  const expressions = FILTER_FIELDS.filter((field) => query[field].length > 0).map((field) => ({
    field,
    condition: "IN",
    value: query[field],
  }));

  if (expressions.length > 0) {
    params.set("filters", JSON.stringify(expressions));
  }

  params.set("sort", query.sort);
  params.set("pageNumber", String(query.pageNumber));
  params.set("pageSize", String(query.pageSize));

  return params.toString();
}
