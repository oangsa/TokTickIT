import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import {
  ApiResponseError,
  InvalidRequesterContextError,
  MasterDataItem,
  PaginationMetadata,
  TicketListItem,
  readPaginationHeader,
} from "../api.js";
import { Badge } from "../components/Badge.js";
import { Button } from "../components/Button.js";
import { Card } from "../components/Card.js";
import { EmptyState } from "../components/EmptyState.js";
import { ErrorState } from "../components/ErrorState.js";
import { FilterChip } from "../components/FilterChip.js";
import { Modal } from "../components/Modal.js";
import { PageHeader } from "../components/PageHeader.js";
import { Pagination } from "../components/Pagination.js";
import { Select } from "../components/Select.js";
import { Skeleton } from "../components/Skeleton.js";
import { TextInput } from "../components/TextInput.js";
import { useRequesterApi } from "../requester/useRequesterApi.js";
import { ticketDate } from "../tickets/ticketDate.js";
import {
  EMPTY_FILTERS,
  FILTER_FIELDS,
  FilterSelection,
  INITIAL_QUERY,
  PRIORITY_OPTIONS,
  SEARCH_DEBOUNCE_MS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  TicketQuery,
  buildTicketListSearch,
  filterCount,
  hasActiveQuery,
  readTicketQuery,
  selectedFilters,
  writeTicketQuery,
} from "../tickets/ticketListQuery.js";

/*
 * My Tickets (ui-spec Sections 13-19, 30.3, 32).
 *
 * The committed query lives in the URL, so a reload, the Back button, and a
 * shared address all restore the same list. `searchInput` is the only
 * uncommitted state: it becomes part of the query after
 * SEARCH_DEBOUNCE_MS of inactivity.
 */

type LoadState = "loading" | "loaded" | "invalid";

/*
 * The pagination metadata, tagged with the request it answered.
 *
 * The tag is what lets the total be held across a fetch without ever being
 * mistaken for a fresh one. It cannot be replaced by the `loading` flag: that
 * flag is set in this screen's own effect, and a child's effects flush before
 * its parent's, so `Pagination` would run one clamp against the previous
 * query's total before the flag arrived.
 */
interface LoadedPagination {
  request: string;
  metadata: PaginationMetadata;
}

const PRIORITY_VARIANT = {
  LOW: "pale",
  MEDIUM: "medium",
  HIGH: "strong",
} as const;

const SKELETON_ROWS = 5;

/*
 * The three columns ui-spec Section 16.3 hides below 768px. Bootstrap's `md`
 * breakpoint is exactly that cut -- deliberately not the `lg` (992px) the
 * shell uses elsewhere.
 */
const SECONDARY_COLUMN = "d-none d-md-table-cell";

function readSelection(select: HTMLSelectElement): string[] {
  return Array.from(select.selectedOptions, (option) => option.value);
}

export default function MyTickets() {
  const navigate = useNavigate();
  const callApi = useRequesterApi();
  const [params, setParams] = useSearchParams();

  const query = useMemo(() => readTicketQuery(params), [params]);
  /*
   * The query as the API receives it. It is both what the effect sends and the
   * tag the held pagination carries, so "which request does this total describe"
   * is answered by one value rather than by two that could drift apart.
   */
  const request = useMemo(() => buildTicketListSearch(query), [query]);

  const [searchInput, setSearchInput] = useState(query.search);
  const [items, setItems] = useState<TicketListItem[]>([]);
  const [pagination, setPagination] = useState<LoadedPagination | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  /* Non-null means the filter modal is open, and is also the draft itself. */
  const [filterDraft, setFilterDraft] = useState<FilterSelection | null>(null);
  const [categories, setCategories] = useState<MasterDataItem[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<MasterDataItem[]>([]);

  /*
   * The only writer of the committed query, so no caller can forget the page
   * reset ui-spec Section 13.3 requires. The debounced search replaces its
   * entry once a search is already committed: pushing one per typing pause
   * would make Back walk the search letter by letter. The first commit still
   * pushes, or the entry it replaced would be the unsearched list itself and
   * Back would leave the screen rather than clear the search.
   */
  const commitQuery = useCallback(
    (next: TicketQuery, replace = false) => {
      setParams(writeTicketQuery(next), { replace });
    },
    [setParams],
  );

  /* Filter option names, and the labels the applied chips use. */
  useEffect(() => {
    let ignore = false;

    async function load(): Promise<void> {
      try {
        const [loadedCategories, loadedSystems] = await Promise.all([
          callApi<MasterDataItem[]>("/api/categories"),
          callApi<MasterDataItem[]>("/api/related-systems"),
        ]);

        if (!ignore) {
          setCategories(loadedCategories);
          setRelatedSystems(loadedSystems);
        }
      } catch {
        /*
         * Reference data only names the filter choices. Losing it must not take
         * the Ticket list down with it, so the filter options stay empty and
         * the list keeps its own state.
         */
        if (!ignore) {
          setCategories([]);
          setRelatedSystems([]);
        }
      }
    }

    void load();

    return () => {
      ignore = true;
    };
  }, [callApi]);

  /*
   * What the debounce below last sent. The committed query can also change
   * underneath the box -- Back, Forward, or a pasted address -- and the box has
   * to follow it, or the debounce would read the restored search as a stale
   * value and immediately commit the empty box over it. Comparing against this
   * rather than against `query.search` keeps that resync from rewriting the box
   * mid-keystroke when the change is the debounce's own commit landing.
   */
  const committedSearch = useRef(query.search);

  useEffect(() => {
    if (query.search !== committedSearch.current) {
      committedSearch.current = query.search;
      setSearchInput(query.search);
    }
  }, [query.search]);

  useEffect(() => {
    /* Already committed, and the guard also stops a commit/re-run loop. */
    if (searchInput.trim() === query.search) {
      return;
    }

    const timer = setTimeout(() => {
      committedSearch.current = searchInput.trim();
      commitQuery({ ...query, search: searchInput.trim(), pageNumber: 1 }, query.search !== "");
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchInput, query, commitQuery]);

  /*
   * AC-36. `callApi` changes identity with the Requester, so this is the one
   * effect that fires on a scope change and not on an ordinary query change:
   * the previous Requester's count must be gone before anything of the new
   * scope renders. `RequesterGuard` also unmounts this screen on a Requester
   * change, which would drop the state anyway; the rule is stated here rather
   * than left resting on that, so a future change to the guard cannot quietly
   * turn a held total into a cross-scope leak.
   */
  useEffect(() => {
    setPagination(null);
  }, [callApi]);

  useEffect(() => {
    let ignore = false;

    /*
     * Rows are cleared before the request rather than after it: stale rows
     * under a new query are visibly wrong, and the skeleton belongs in their
     * place. `pagination` is deliberately kept, tagged with the request it
     * answered. Dropping it collapsed the page list from "1 2 3 … 40" to a
     * single "1" and back on every fetch -- the layout jump ui-spec 19.1 asks
     * the mounted controls to avoid -- while the tag keeps the held total from
     * being stated as a range or acted on as a clamp.
     */
    setItems([]);
    setLoadState("loading");

    async function load(): Promise<void> {
      try {
        let metadata: PaginationMetadata | null = null;

        const data = await callApi<TicketListItem[]>(`/api/tickets?${request}`, {
          onResponse: (response) => {
            metadata = readPaginationHeader(response.headers.get("X-Pagination"));
          },
        });

        if (ignore) {
          return;
        }

        setItems(data);
        setPagination(metadata === null ? null : { request, metadata });
        setLoadState("loaded");
      } catch (error) {
        if (ignore) {
          return;
        }

        /*
         * `useRequesterApi` has already cleared the context and `RequesterGuard`
         * is unmounting this subtree; navigating to the error page would race it.
         */
        if (error instanceof InvalidRequesterContextError) {
          return;
        }

        /*
         * A rejected query is the user's to correct, so it stays on the page
         * with the toolbar usable (ui-spec Section 35). Everything else is a
         * page-level failure and goes to the global error experience
         * (Section 19.4).
         */
        if (error instanceof ApiResponseError && error.status === 400) {
          setLoadState("invalid");
          return;
        }

        navigate("/error", { state: { status: 500 } });
      }
    }

    void load();

    return () => {
      ignore = true;
    };
    /*
     * `query` is deliberately absent: the effect reads only `request`, which is
     * derived from it. Depending on both refetched whenever an address changed
     * without changing the API request -- `/tickets` and `/tickets?pageNumber=1`
     * build the same one.
     */
  }, [callApi, request, navigate]);

  const loading = loadState === "loading";
  const appliedCount = filterCount(query);
  const queryActive = hasActiveQuery(query);
  /*
   * True while the held total belongs to a request other than the one on
   * screen -- across a fetch, and before the first one answers. Derived at
   * render time, never from `loadState`: `Pagination`'s clamp is a child effect
   * and would run once against the previous query's total before an
   * effect-assigned flag could reach it.
   */
  const stale = pagination === null || pagination.request !== request;
  /* Held across a fetch so the page list keeps its shape; see `stale`. */
  const totalItems = pagination?.metadata.totalItems ?? 0;
  /*
   * No total arrived at all -- a proxy dropped or mangled `X-Pagination`, and
   * `readPaginationHeader` answered null. The rows are then the only evidence
   * on screen, and they have to answer the two questions the total would have.
   * Reading the derived zero as a real count answered both wrong: a Requester
   * with no Tickets was told "No tickets found. Try changing your search or
   * filters" over an empty query, and a full page of rows lost every pagination
   * control because the mount guard below saw a total of zero.
   */
  const countless = loadState === "loaded" && pagination === null;
  /*
   * "No tickets yet" is a claim about the Requester, not about this page of
   * this query, so it needs the total as well as an inactive query: page 5 of
   * three unfiltered Tickets is empty without the Requester being.
   */
  const trulyEmpty =
    !queryActive && (countless ? items.length === 0 : !stale && totalItems === 0);
  /*
   * A page past the last one answers 200 with an empty array (BR-38), so this
   * page is being corrected rather than displayed: `Pagination` reports its
   * clamp back through `onPageChange` on the next effect. The guard mirrors the
   * one the control itself uses -- a genuinely empty result set has
   * `totalItems: 0` and every page of it is equally empty, so it is not a
   * correction and must keep its own empty state.
   */
  const correctingPage =
    !stale &&
    pagination !== null &&
    pagination.metadata.totalItems > 0 &&
    query.pageNumber > pagination.metadata.totalPages;

  /*
   * One always-mounted live region (ui-spec 29.7), the same pattern
   * `RequesterSelection` uses and for the same reason: a `role="status"` node
   * inserted into the DOM with its text already present is announced
   * inconsistently, because assistive technology reports mutations to a region
   * already in the accessibility tree. The region stays put and only its text
   * changes.
   *
   * It also owns the result announcement now that `Pagination` is no longer a
   * live region of its own. The rejected-query state is left to `ErrorState`'s
   * `role="alert"`; announcing it here too would announce it twice.
   */
  /*
   * The header, not the row count, is the authority on how many Tickets the
   * query found -- one page of ten out of forty-seven announces forty-seven.
   * `readPaginationHeader` still returns null for a header a proxy dropped or
   * mangled, and announcing "0 tickets" over rendered rows would contradict
   * the screen, so the rows answer for themselves in that one case.
   */
  const announcedCount = !stale && pagination !== null ? pagination.metadata.totalItems : items.length;
  const announcement =
    loadState === "loading"
      ? "Loading tickets"
      : loadState === "loaded"
        ? `${announcedCount} ticket${announcedCount === 1 ? "" : "s"}`
        : "";

  const filterLabels = useMemo(() => {
    const byId = (rows: MasterDataItem[]) =>
      new Map(rows.map((row) => [String(row.id), row.name] as const));

    return {
      categoryId: byId(categories),
      relatedSystemId: byId(relatedSystems),
    };
  }, [categories, relatedSystems]);

  function chipLabel(field: (typeof FILTER_FIELDS)[number], value: string): string {
    if (field === "categoryId" || field === "relatedSystemId") {
      return filterLabels[field].get(value) ?? value;
    }

    return value;
  }

  function removeFilterValue(field: (typeof FILTER_FIELDS)[number], value: string): void {
    commitQuery({
      ...query,
      [field]: query[field].filter((entry) => entry !== value),
      pageNumber: 1,
    });
  }

  function clearFilters(): void {
    setSearchInput("");
    /* Sort survives: ui-spec Section 14.5 clears the query, not the ordering. */
    commitQuery({ ...query, ...EMPTY_FILTERS, search: "", pageNumber: 1 });
  }

  /*
   * Recovery from a rejected query, which `clearFilters` cannot provide. The
   * parameter at fault may be one the toolbar cannot reach -- `pageSize`,
   * `pageNumber`, or an unknown `sort` from a hand-edited or shared address --
   * and the pagination control that would correct it is not rendered while the
   * error is showing. Clearing only the search and filters would then rebuild
   * the identical address, so nothing would refetch and the button would do
   * nothing at all. Every parameter goes back to its default instead.
   */
  function resetQuery(): void {
    setSearchInput("");
    commitQuery(INITIAL_QUERY);
  }

  function applyFilters(): void {
    if (filterDraft === null) {
      return;
    }

    commitQuery({ ...query, ...filterDraft, pageNumber: 1 });
    setFilterDraft(null);
  }

  const columns = [
    { label: "Ticket Number", secondary: false },
    { label: "Summary", secondary: false },
    { label: "Category", secondary: true },
    { label: "Related System", secondary: true },
    { label: "Priority", secondary: false },
    { label: "Status", secondary: false },
    { label: "Created At", secondary: true },
  ];

  return (
    <>
      <PageHeader
        title="My Tickets"
        subtitle="View and manage your support requests."
        actions={
          <Button variant="primary" onClick={() => navigate("/tickets/new")}>
            + Create Ticket
          </Button>
        }
      />

      <Card>
        <div className="d-flex flex-wrap align-items-end gap-3">
          <div className="flex-grow-1" style={{ minWidth: "16rem" }}>
            <TextInput
              label="Search"
              type="search"
              value={searchInput}
              maxLength={200}
              placeholder="Search by ticket number, summary, or description..."
              helpText="Search ticket number, summary, or description"
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>

          <div className="mb-3">
            {/*
              * Not disabled during a fetch. Disabling a focused control moves
              * focus to `<body>`, and this screen fetches on every search
              * pause -- so a keyboard user was thrown out of the toolbar every
              * 400ms while typing. Nothing here needs the guard: `commitQuery`
              * only writes the URL, and the list effect discards the superseded
              * response through its `ignore` flag.
              */}
            <Button variant="secondary" onClick={() => setFilterDraft(selectedFilters(query))}>
              Filters{appliedCount > 0 ? ` (${appliedCount})` : ""}
            </Button>
          </div>

          <div style={{ minWidth: "14rem" }}>
            <Select
              label="Sort by"
              value={query.sort}
              onChange={(event) => commitQuery({ ...query, sort: event.target.value, pageNumber: 1 })}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {queryActive ? (
          <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
            {FILTER_FIELDS.flatMap((field) =>
              query[field].map((value) => (
                <FilterChip
                  key={`${field}:${value}`}
                  label={chipLabel(field, value)}
                  removeLabel={`Remove filter ${chipLabel(field, value)}`}
                  onRemove={() => removeFilterValue(field, value)}
                />
              )),
            )}

            <Button variant="tertiary" className="ms-auto" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        ) : null}

        {/* Skeleton rows are decorative, so the screen owns the announcement. */}
        <p role="status" className="visually-hidden">
          {announcement}
        </p>

        {loadState === "invalid" ? (
          <ErrorState
            title="This search could not be run."
            description="Reset the search, filters, sorting, and page size, then try again."
            onRetry={resetQuery}
            retryLabel="Reset Search"
          />
        ) : (
          <>
            <div>
              <table className="table tt-table align-middle mb-0">
                <thead>
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column.label}
                        scope="col"
                        className={column.secondary ? SECONDARY_COLUMN : undefined}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {loading
                    ? Array.from({ length: SKELETON_ROWS }, (_unused, row) => (
                        <tr key={`skeleton-${row}`}>
                          {columns.map((column) => (
                            <td
                              key={column.label}
                              className={column.secondary ? SECONDARY_COLUMN : undefined}
                            >
                              <Skeleton height="1.25rem" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : items.map((item) => (
                        /*
                         * The whole row opens Ticket Detail (ui-spec 16.1), but the
                         * row is not the control. A focusable `<tr>` carrying an
                         * `aria-label` and a hand-rolled Enter/Space handler
                         * announced itself as a row, not as something activatable,
                         * and a `role` that would fix that cannot go on a `<tr>`
                         * without breaking the table's own row semantics.
                         *
                         * The Ticket Number cell holds a real `<Link>` instead: it
                         * is in the tab order, carries the link role, activates on
                         * Enter natively, and offers a URL to open in a new tab.
                         * ui-spec 16.2 allows exactly this -- "activatable with
                         * Enter/Space where the chosen implementation pattern
                         * supports it". The row keeps `onClick` as a pointer
                         * convenience, and `.tt-row:focus-within` draws the focus
                         * ring around the row when the link inside it is focused.
                         */
                        <tr
                          key={item.publicId}
                          className="tt-row"
                          onClick={() => navigate(`/tickets/${item.publicId}`)}
                        >
                          <td>
                            {/*
                              * The visible Ticket Number is contained in the
                              * accessible name, so WCAG 2.5.3 Label in Name holds
                              * for anyone speaking what they can see.
                              */}
                            <Link
                              className="tt-row-link"
                              to={`/tickets/${item.publicId}`}
                              aria-label={`Open ticket ${item.ticketNumber}`}
                            >
                              {item.ticketNumber}
                            </Link>
                          </td>
                          <td>{item.summary}</td>
                          <td className={SECONDARY_COLUMN}>{item.categoryName}</td>
                          <td className={SECONDARY_COLUMN}>{item.relatedSystemName}</td>
                          <td>
                            {/* Never colour alone: the level is always spelled out. */}
                            <Badge variant={PRIORITY_VARIANT[item.requestedPriority]}>
                              {item.requestedPriority}
                            </Badge>
                          </td>
                          <td>
                            <Badge variant="pale">{item.currentStatus}</Badge>
                          </td>
                          <td className={SECONDARY_COLUMN}>{ticketDate(item.createdAt)}</td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>

            {!loading && items.length === 0 && !correctingPage ? (
              trulyEmpty ? (
                <EmptyState
                  title="No tickets yet."
                  description="Create your first support ticket."
                  action={
                    <Button variant="primary" onClick={() => navigate("/tickets/new")}>
                      Create Ticket
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  title="No tickets found."
                  description="Try changing your search or filters."
                  action={
                    <Button variant="secondary" onClick={clearFilters}>
                      Clear Filters
                    </Button>
                  }
                />
              )
            ) : null}

            {/*
              * Hidden on a total of zero, not on a row count of zero: an empty
              * result set has an empty state that owns the whole card, and
              * "Showing 0-0 of 0" beneath it would contradict it. A page past
              * the last one is also rowless but has a real total, and there the
              * controls must stay -- `Pagination` reports its own clamp back
              * through `onPageChange`, which is what moves a shared or restored
              * `?pageNumber=5` onto the last real page. Unmounting it on the
              * row count would strand that address on "No tickets found" with
              * no control left to correct it.
              *
              * During a fetch the controls stay in place so the surrounding
              * structure does not jump (Section 19.1), and they stay *enabled*.
              * They were previously wrapped in `<fieldset disabled={loading}>`,
              * which drops focus to `<body>` every time it flips -- once per
              * search pause on this screen. The guard bought nothing: a page
              * click only writes the URL, the list effect discards the
              * superseded response through its `ignore` flag, and `pending`
              * already stops `Pagination` from stating a range or acting on a
              * clamp computed from a total it is about to replace.
              *
              * `countless` is the one case that reads the row count instead:
              * with no header there is no total to be zero, and the rows are
              * the only thing left to decide on. `stale` is still true there,
              * so the control renders without a range and without a clamp --
              * it can page nothing it cannot vouch for, but Rows per page
              * still works and the rows keep a control beneath them.
              */}
            {loadState === "loaded" && (countless ? items.length === 0 : totalItems === 0) ? null : (
            <Pagination
              pageNumber={query.pageNumber}
              pageSize={query.pageSize}
              totalItems={totalItems}
              pending={stale}
              /*
               * A correction replaces the address it corrects. Pushing would
               * leave the out-of-range entry behind, and Back would land on it,
               * clamp again, and push again -- a page the user can never
               * navigate back past. A Previous/Next/page-number click is never
               * a correction, so it still pushes.
               */
              onPageChange={(pageNumber) => commitQuery({ ...query, pageNumber }, correctingPage)}
              onPageSizeChange={(pageSize) => commitQuery({ ...query, pageSize, pageNumber: 1 })}
            />
            )}
          </>
        )}
      </Card>

      <Modal
        open={filterDraft !== null}
        title="Filters"
        onClose={() => setFilterDraft(null)}
        footer={
          <div className="d-flex justify-content-between w-100">
            {/* Reset clears the draft only, and never fetches (Section 14.3). */}
            <Button variant="tertiary" onClick={() => setFilterDraft(EMPTY_FILTERS)}>
              Reset
            </Button>

            <div className="d-flex gap-2">
              <Button variant="secondary" onClick={() => setFilterDraft(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={applyFilters}>
                Apply
              </Button>
            </div>
          </div>
        }
      >
        <Select
          label="Category"
          multiple
          size={4}
          value={filterDraft?.categoryId ?? []}
          onChange={(event) =>
            setFilterDraft((draft) =>
              draft === null ? draft : { ...draft, categoryId: readSelection(event.target) },
            )
          }
        >
          {categories.map((category) => (
            <option key={category.id} value={String(category.id)}>
              {category.name}
            </option>
          ))}
        </Select>

        <Select
          label="Related System"
          multiple
          size={4}
          value={filterDraft?.relatedSystemId ?? []}
          onChange={(event) =>
            setFilterDraft((draft) =>
              draft === null ? draft : { ...draft, relatedSystemId: readSelection(event.target) },
            )
          }
        >
          {relatedSystems.map((system) => (
            <option key={system.id} value={String(system.id)}>
              {system.name}
            </option>
          ))}
        </Select>

        <Select
          label="Requested Priority"
          multiple
          size={3}
          value={filterDraft?.requestedPriority ?? []}
          onChange={(event) =>
            setFilterDraft((draft) =>
              draft === null ? draft : { ...draft, requestedPriority: readSelection(event.target) },
            )
          }
        >
          {PRIORITY_OPTIONS.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </Select>

        <Select
          label="Status"
          multiple
          size={2}
          value={filterDraft?.currentStatus ?? []}
          onChange={(event) =>
            setFilterDraft((draft) =>
              draft === null ? draft : { ...draft, currentStatus: readSelection(event.target) },
            )
          }
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>
      </Modal>
    </>
  );
}
