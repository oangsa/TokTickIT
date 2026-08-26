import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useNavigate } from "react-router-dom";

import App from "../../src/App.js";
import { PaginationMetadata } from "../../src/api.js";
import { REQUESTER_STORAGE_KEY, StoredRequester } from "../../src/requester/requesterStorage.js";
import { SEARCH_DEBOUNCE_MS } from "../../src/tickets/ticketListQuery.js";
import { setViewportWidth } from "../setup.js";

/*
 * UI-15 to UI-22, UI-32, and UI-37 (AC-24, AC-28-34, AC-38-39).
 *
 * The list request is the only one whose response headers matter, because it
 * is the only caller that passes `onResponse` -- that is where `X-Pagination`
 * is read from.
 */

const ALICE: StoredRequester = { id: 1, name: "Alice Example" };
const BOB: StoredRequester = { id: 2, name: "Bob Example" };

function masterRow(id: number, name: string) {
  return {
    id,
    name,
    isActive: true,
    deleted: false,
    createdBy: "seed",
    createdAt: "2026-08-20T01:00:00.000Z",
    updatedBy: "seed",
    updatedAt: "2026-08-20T01:00:00.000Z",
  };
}

const CATEGORIES = [masterRow(1, "Network"), masterRow(2, "Hardware")];
const SYSTEMS = [masterRow(5, "VPN"), masterRow(6, "Printer")];

/* Exactly TicketListItemDTO: no Description, Requester, Attachment, or audit field. */
function ticket(overrides: Record<string, unknown> = {}) {
  return {
    publicId: "0f0e8a9f-6d9e-4a1a-9f0e-1b2c3d4e5f60",
    ticketNumber: "TKT-20260820-A81F3C9D7B21",
    categoryId: 1,
    categoryName: "Network",
    relatedSystemId: 5,
    relatedSystemName: "VPN",
    summary: "VPN disconnects every ten minutes",
    requestedPriority: "HIGH",
    currentStatus: "NEW",
    createdAt: "2026-08-20T02:00:00.000Z",
    ...overrides,
  };
}

function meta(overrides: Partial<PaginationMetadata> = {}): PaginationMetadata {
  return {
    pageNumber: 1,
    pageSize: 10,
    totalItems: 1,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
    ...overrides,
  };
}

interface ListResult {
  ok?: boolean;
  status?: number;
  body?: unknown;
  pagination?: PaginationMetadata | null;
}

interface StubbedCall {
  url: string;
  init?: { method?: string; headers?: Record<string, string> };
}

const DEFAULT_LIST: ListResult = { body: [ticket()], pagination: meta() };

/*
 * Routes by path so reference data and the list can be arranged separately.
 * `list` may return a Promise, which leaves the list request pending -- that is
 * how the Requester-switch case holds one scope's response open across a change.
 */
function stubApi(list: () => ListResult | Promise<ListResult> = () => DEFAULT_LIST) {
  const calls: StubbedCall[] = [];

  const fetchMock = vi.fn(async (url: string, init?: StubbedCall["init"]) => {
    calls.push({ url, init });

    if (url.includes("/api/categories")) {
      return { ok: true, status: 200, headers: new Headers(), json: async () => CATEGORIES };
    }

    if (url.includes("/api/related-systems")) {
      return { ok: true, status: 200, headers: new Headers(), json: async () => SYSTEMS };
    }

    if (url.includes("/api/requesters")) {
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => [
          { ...masterRow(ALICE.id, ALICE.name), email: "alice@example.com" },
          { ...masterRow(BOB.id, BOB.name), email: "bob@example.com" },
        ],
      };
    }

    const result = await list();
    const headers = new Headers();

    if (result.pagination !== null && result.pagination !== undefined) {
      headers.set("X-Pagination", JSON.stringify(result.pagination));
    }

    return {
      ok: result.ok ?? true,
      status: result.status ?? 200,
      headers,
      json: async () => result.body ?? [],
    };
  });

  vi.stubGlobal("fetch", fetchMock);
  return { calls };
}

function listCalls(calls: StubbedCall[]): StubbedCall[] {
  return calls.filter((call) => call.url.includes("/api/tickets?"));
}

function lastListQuery(calls: StubbedCall[]): URLSearchParams {
  const requests = listCalls(calls);
  return new URLSearchParams(requests[requests.length - 1].url.split("?")[1]);
}

function renderMyTickets(requester: StoredRequester = ALICE, entry = "/tickets") {
  sessionStorage.setItem(REQUESTER_STORAGE_KEY, JSON.stringify(requester));

  return render(
    <MemoryRouter initialEntries={[entry]}>
      <App />
    </MemoryRouter>,
  );
}

function HistoryBackButton() {
  const navigate = useNavigate();

  return <button onClick={() => navigate(-1)}>Go back</button>;
}

/* Back and Forward change the committed query without the toolbar touching it. */
function renderMyTicketsWithHistory(entries: string[], initialIndex: number) {
  sessionStorage.setItem(REQUESTER_STORAGE_KEY, JSON.stringify(ALICE));

  return render(
    <MemoryRouter initialEntries={entries} initialIndex={initialIndex}>
      <HistoryBackButton />
      <App />
    </MemoryRouter>,
  );
}

function rowFor(ticketNumber: string): HTMLElement {
  return screen.getByRole("row", { name: `Open ticket ${ticketNumber}` });
}

beforeEach(() => {
  setViewportWidth(1440);
});

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("UI-15 My Tickets loading and stale-scope prevention", () => {
  it("shows the table structure and a loading status before the rows arrive", async () => {
    let release: (result: ListResult) => void = () => undefined;
    stubApi(() => new Promise<ListResult>((resolve) => (release = resolve)));

    renderMyTickets();

    expect(screen.getByRole("status")).toHaveTextContent("Loading tickets");
    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Ticket Number",
      "Summary",
      "Category",
      "Related System",
      "Priority",
      "Status",
      "Created At",
    ]);
    expect(screen.queryByText("TKT-20260820-A81F3C9D7B21")).toBeNull();

    await act(async () => {
      release(DEFAULT_LIST);
    });

    expect(await screen.findByText("TKT-20260820-A81F3C9D7B21")).toBeInTheDocument();
    /*
     * The region stays mounted and only its text changes (ui-spec 29.7). A
     * `role="status"` node inserted with its text already present is announced
     * inconsistently, so unmounting it between states would make the loading
     * announcement above unreliable rather than merely redundant.
     */
    expect(screen.getByRole("status")).toHaveTextContent("1 ticket");
  });

  it("never claims a result range while the rows are still in flight", async () => {
    let release: (result: ListResult) => void = () => undefined;
    stubApi(() => new Promise<ListResult>((resolve) => (release = resolve)));

    renderMyTickets();

    /*
     * The controls stay in place during the fetch so the structure does not
     * jump (ui-spec 19.1), but the caller has cleared the counts, so the range
     * derived from them would read "Showing 0–0 of 0" underneath the skeleton
     * rows and contradict them.
     */
    const nav = screen.getByRole("navigation", { name: "Ticket pagination" });

    expect(nav.textContent).not.toMatch(/Showing/);
    expect(nav.textContent).not.toMatch(/Page \d+ of/);

    await act(async () => {
      release({
        body: [ticket()],
        pagination: meta({ pageSize: 10, totalItems: 47, totalPages: 5, hasNextPage: true }),
      });
    });

    expect(await screen.findByText(/Showing 1–10 of 47/)).toBeInTheDocument();
  });

  it("never renders a previous Requester's rows once the Requester changes", async () => {
    let release: (result: ListResult) => void = () => undefined;
    stubApi(() => new Promise<ListResult>((resolve) => (release = resolve)));

    renderMyTickets();

    await userEvent.click(screen.getByRole("button", { name: "Change Requester" }));

    /* Alice's answer lands after the switch; it must reach nothing. */
    await act(async () => {
      release({ body: [ticket({ ticketNumber: "TKT-20260820-ALICEONLY001" })], pagination: meta() });
    });

    expect(screen.queryByText("TKT-20260820-ALICEONLY001")).toBeNull();
  });
});

describe("UI-16 My Tickets empty and no-results states", () => {
  it("offers Create Ticket when the Requester has no Tickets at all", async () => {
    stubApi(() => ({ body: [], pagination: meta({ totalItems: 0, totalPages: 0 }) }));

    renderMyTickets();

    expect(await screen.findByText("No tickets yet.")).toBeInTheDocument();
    expect(screen.getByText("Create your first support ticket.")).toBeInTheDocument();
    expect(screen.queryByText("No tickets found.")).toBeNull();
  });

  it("offers Clear Filters when an active query returns nothing", async () => {
    stubApi(() => ({ body: [], pagination: meta({ totalItems: 0, totalPages: 0 }) }));

    renderMyTickets(ALICE, "/tickets?search=nothing");

    expect(await screen.findByText("No tickets found.")).toBeInTheDocument();
    expect(screen.getByText("Try changing your search or filters.")).toBeInTheDocument();
    expect(screen.queryByText("No tickets yet.")).toBeNull();
  });

  /*
   * A proxy can strip `X-Pagination`, and then there is no total at all. The
   * derived zero that stood in for one answered both of the questions the total
   * owns wrong: a Requester with nothing was told to change a search they never
   * ran, and a full page of rows lost every pagination control.
   */
  it("still names the true-empty state when no pagination header arrives", async () => {
    stubApi(() => ({ body: [], pagination: null }));

    renderMyTickets();

    expect(await screen.findByText("No tickets yet.")).toBeInTheDocument();
    expect(screen.queryByText("No tickets found.")).toBeNull();
  });

  it("keeps the pagination controls under rows that arrived without a header", async () => {
    stubApi(() => ({ body: [ticket()], pagination: null }));

    renderMyTickets();

    expect(await screen.findByRole("row", { name: "Open ticket TKT-20260820-A81F3C9D7B21" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Ticket pagination" })).toBeInTheDocument();
    /* No total to vouch for, so no range is claimed over the rows. */
    expect(screen.queryByText(/Showing/)).toBeNull();
  });
});

describe("UI-17 My Tickets failure and invalid-query states", () => {
  it("sends a page-level failure to the global error experience", async () => {
    stubApi(() => ({ ok: false, status: 500, body: { code: "INTERNAL_SERVER_ERROR" } }));

    renderMyTickets();

    expect(await screen.findByRole("heading", { name: "Something went wrong." })).toBeInTheDocument();
    /* Safe copy only: no backend message and no Ticket data. */
    expect(screen.queryByText("TKT-20260820-A81F3C9D7B21")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Main" })).toBeNull();
  });

  it("keeps a rejected query on the page instead of navigating away", async () => {
    stubApi(() => ({
      ok: false,
      status: 400,
      body: { code: "VALIDATION_ERROR", details: [{ field: "pageSize", message: "invalid" }] },
    }));

    renderMyTickets(ALICE, "/tickets?pageSize=999");

    expect(await screen.findByText("This search could not be run.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Something went wrong." })).toBeNull();
  });

  it("recovers from a rejected parameter the toolbar cannot reach", async () => {
    /*
     * `pageSize` is rejected, and the pagination control that would correct it
     * is not rendered while the error is showing. Recovery that only cleared
     * the search and filters would rebuild the identical address, so it would
     * issue no request at all and the state would never leave the screen.
     */
    const { calls } = stubApi(() =>
      lastListQuery(calls).get("pageSize") === "999"
        ? {
            ok: false,
            status: 400,
            body: { code: "VALIDATION_ERROR", details: [{ field: "pageSize", message: "invalid" }] },
          }
        : DEFAULT_LIST,
    );

    renderMyTickets(ALICE, "/tickets?pageSize=999");

    await screen.findByText("This search could not be run.");

    await userEvent.click(screen.getByRole("button", { name: "Reset Search" }));

    await waitFor(() => expect(lastListQuery(calls).get("pageSize")).toBe("10"));
    expect(await screen.findByText("TKT-20260820-A81F3C9D7B21")).toBeInTheDocument();
    expect(screen.queryByText("This search could not be run.")).toBeNull();
  });
});

describe("UI-18 My Tickets search debounce and query mapping", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function advance(ms: number): Promise<void> {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  /*
   * `userEvent` deadlocks under Vitest's fake timers -- it hangs on a bare
   * input with no application code involved -- so the debounce is driven with
   * the change event it actually listens to. No case may advance anywhere near
   * the 8 s `AbortSignal.timeout` inside `apiFetch`, which is faked here too.
   */
  function typeSearch(value: string): void {
    fireEvent.change(screen.getByLabelText("Search"), { target: { value } });
  }

  it("waits for 400 ms of inactivity, then sends exactly one search request", async () => {
    const { calls } = stubApi();

    renderMyTickets();
    await advance(0);

    expect(listCalls(calls)).toHaveLength(1);

    typeSearch("vpn");
    await advance(SEARCH_DEBOUNCE_MS - 1);
    expect(listCalls(calls)).toHaveLength(1);

    await advance(1);
    expect(listCalls(calls)).toHaveLength(2);

    const query = lastListQuery(calls);
    expect(query.get("search")).toBe("vpn");
    expect(query.get("searchFields")).toBe("ticketNumber,summary,description");
    expect(query.get("pageNumber")).toBe("1");
  });

  it("restarts the window when typing resumes before the boundary", async () => {
    const { calls } = stubApi();

    renderMyTickets();
    await advance(0);

    typeSearch("vp");
    await advance(300);
    typeSearch("vpn");
    await advance(300);

    expect(listCalls(calls)).toHaveLength(1);

    await advance(100);

    expect(listCalls(calls)).toHaveLength(2);
    expect(lastListQuery(calls).get("search")).toBe("vpn");
  });

  it("keeps a committed search when the user navigates back to it", async () => {
    /*
     * The box is uncommitted state, so an address change it did not cause has
     * to reach it. Left alone it still reads empty after Back, and the
     * debounce then commits that empty box over the search just restored.
     */
    const { calls } = stubApi();

    renderMyTicketsWithHistory(["/tickets?search=vpn", "/tickets"], 1);
    await advance(0);

    expect(screen.getByLabelText("Search")).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    await advance(0);

    expect(screen.getByLabelText("Search")).toHaveValue("vpn");
    expect(lastListQuery(calls).get("search")).toBe("vpn");

    /* Well past the debounce boundary: nothing re-commits an empty search. */
    await advance(SEARCH_DEBOUNCE_MS * 2);

    expect(lastListQuery(calls).get("search")).toBe("vpn");
  });

  it("resets the page when a new search is committed", async () => {
    const { calls } = stubApi(() => ({
      body: [ticket()],
      pagination: meta({ pageNumber: 3, totalItems: 47, totalPages: 5, hasPreviousPage: true, hasNextPage: true }),
    }));

    renderMyTickets(ALICE, "/tickets?pageNumber=3");
    await advance(0);

    expect(lastListQuery(calls).get("pageNumber")).toBe("3");

    typeSearch("vpn");
    await advance(SEARCH_DEBOUNCE_MS);

    expect(lastListQuery(calls).get("pageNumber")).toBe("1");
  });
});

describe("UI-19 My Tickets filter draft, cancel, reset, and apply", () => {
  async function openFilters() {
    await userEvent.click(screen.getByRole("button", { name: /^Filters/ }));
    return screen.getByRole("dialog", { name: "Filters" });
  }

  it("offers all four multi-select filters", async () => {
    stubApi();
    renderMyTickets();
    await screen.findByText("TKT-20260820-A81F3C9D7B21");

    const dialog = await openFilters();

    for (const label of ["Category", "Related System", "Requested Priority", "Status"]) {
      expect(within(dialog).getByLabelText(label)).toHaveAttribute("multiple");
    }
  });

  it("discards draft changes on Cancel and fetches nothing", async () => {
    const { calls } = stubApi();
    renderMyTickets();
    await screen.findByText("TKT-20260820-A81F3C9D7B21");

    const dialog = await openFilters();
    await userEvent.selectOptions(within(dialog).getByLabelText("Category"), ["1"]);
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(listCalls(calls)).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();

    /* Reopening shows the committed selection, not the discarded draft. */
    const reopened = await openFilters();
    expect(within(reopened).getByRole("option", { name: "Network" })).not.toBeDisabled();
    expect((within(reopened).getByLabelText("Category") as HTMLSelectElement).selectedOptions).toHaveLength(0);
  });

  it("clears the draft on Reset without fetching", async () => {
    const { calls } = stubApi();
    renderMyTickets();
    await screen.findByText("TKT-20260820-A81F3C9D7B21");

    const dialog = await openFilters();
    await userEvent.selectOptions(within(dialog).getByLabelText("Category"), ["1"]);
    await userEvent.click(within(dialog).getByRole("button", { name: "Reset" }));

    expect((within(dialog).getByLabelText("Category") as HTMLSelectElement).selectedOptions).toHaveLength(0);
    expect(listCalls(calls)).toHaveLength(1);
  });

  it("commits the draft on Apply, resets the page, and fetches once", async () => {
    const { calls } = stubApi(() => ({
      body: [ticket()],
      pagination: meta({ pageNumber: 2, totalItems: 47, totalPages: 5, hasPreviousPage: true, hasNextPage: true }),
    }));
    renderMyTickets(ALICE, "/tickets?pageNumber=2");
    await screen.findByText("TKT-20260820-A81F3C9D7B21");

    const dialog = await openFilters();
    await userEvent.selectOptions(within(dialog).getByLabelText("Category"), ["1"]);
    await userEvent.selectOptions(within(dialog).getByLabelText("Requested Priority"), ["HIGH"]);
    await userEvent.click(within(dialog).getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(listCalls(calls)).toHaveLength(2));

    const query = lastListQuery(calls);
    expect(query.get("pageNumber")).toBe("1");
    expect(JSON.parse(query.get("filters") ?? "[]")).toEqual([
      { field: "categoryId", condition: "IN", value: ["1"] },
      { field: "requestedPriority", condition: "IN", value: ["HIGH"] },
    ]);
  });
});

describe("UI-20 My Tickets filter count, chips, and Clear Filters", () => {
  it("counts applied values and labels each chip with its master name", async () => {
    stubApi();
    renderMyTickets(ALICE, "/tickets?categoryId=1&relatedSystemId=5");

    expect(await screen.findByRole("button", { name: "Filters (2)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove filter Network" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove filter VPN" })).toBeInTheDocument();
  });

  it("removes one chip, resets the page, and keeps the other filter", async () => {
    const { calls } = stubApi(() => ({
      body: [ticket()],
      pagination: meta({ pageNumber: 2, totalItems: 47, totalPages: 5, hasPreviousPage: true, hasNextPage: true }),
    }));
    renderMyTickets(ALICE, "/tickets?categoryId=1&relatedSystemId=5&pageNumber=2");
    await screen.findByText("TKT-20260820-A81F3C9D7B21");

    await userEvent.click(screen.getByRole("button", { name: "Remove filter Network" }));

    await waitFor(() => expect(listCalls(calls)).toHaveLength(2));

    const query = lastListQuery(calls);
    expect(query.get("pageNumber")).toBe("1");
    expect(JSON.parse(query.get("filters") ?? "[]")).toEqual([
      { field: "relatedSystemId", condition: "IN", value: ["5"] },
    ]);
  });

  it("clears the search and filters while preserving the sort", async () => {
    const { calls } = stubApi();
    renderMyTickets(ALICE, "/tickets?search=vpn&categoryId=1&sort=summary:asc");
    await screen.findByText("TKT-20260820-A81F3C9D7B21");

    /* Available with results on screen, not only on a no-results page. */
    await userEvent.click(screen.getByRole("button", { name: "Clear Filters" }));

    await waitFor(() => expect(listCalls(calls)).toHaveLength(2));

    const query = lastListQuery(calls);
    expect(query.get("search")).toBeNull();
    expect(query.get("filters")).toBeNull();
    expect(query.get("sort")).toBe("summary:asc");
    expect(query.get("pageNumber")).toBe("1");
  });
});

describe("UI-21 My Tickets sort options", () => {
  const options: Array<[string, string]> = [
    ["Newest", "createdAt:desc"],
    ["Oldest", "createdAt:asc"],
    ["Ticket Number A–Z", "ticketNumber:asc"],
    ["Ticket Number Z–A", "ticketNumber:desc"],
    ["Summary A–Z", "summary:asc"],
    ["Summary Z–A", "summary:desc"],
    ["Priority High to Low", "requestedPriority:desc"],
    ["Priority Low to High", "requestedPriority:asc"],
  ];

  it("offers exactly the required options", async () => {
    stubApi();
    renderMyTickets();
    await screen.findByText("TKT-20260820-A81F3C9D7B21");

    expect(
      within(screen.getByLabelText("Sort by"))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(options.map(([label]) => label));
  });

  it.each(options)("maps %s to the API sort %s", async (label, sort) => {
    const { calls } = stubApi();
    renderMyTickets();
    await screen.findByText("TKT-20260820-A81F3C9D7B21");

    await userEvent.selectOptions(screen.getByLabelText("Sort by"), [sort]);

    await waitFor(() => expect(lastListQuery(calls).get("sort")).toBe(sort));
    expect(screen.getByLabelText("Sort by")).toHaveValue(sort);
    expect(label).toBeTruthy();
  });
});

describe("UI-22 My Tickets pagination and list projection", () => {
  it("keeps the page list in place across a refetch rather than collapsing it", async () => {
    /*
     * Zeroing the total for the length of the fetch collapsed `pageCount` to 1,
     * so the list went "1 2 3 4 5" -> "1" -> "1 2 3 4 5" on every sort, filter,
     * or page change. That is the layout jump ui-spec 19.1 asks the controls
     * that stay mounted to avoid.
     */
    let served = 0;
    stubApi(() => {
      served += 1;

      if (served === 1) {
        return {
          body: [ticket()],
          pagination: meta({ pageSize: 10, totalItems: 47, totalPages: 5, hasNextPage: true }),
        };
      }

      return new Promise<ListResult>(() => undefined);
    });

    renderMyTickets();
    await screen.findByText(/Showing 1–10 of 47/);

    const nav = screen.getByRole("navigation", { name: "Ticket pagination" });
    const pageNumbers = () =>
      within(nav)
        .getAllByRole("button", { name: /^\d+$/ })
        .map((button) => button.textContent);

    expect(pageNumbers()).toEqual(["1", "2", "3", "4", "5"]);

    await userEvent.selectOptions(screen.getByLabelText("Sort by"), ["createdAt:asc"]);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Loading tickets"));

    expect(pageNumbers()).toEqual(["1", "2", "3", "4", "5"]);
    /* The shape is held; the exact range is not, because those rows are gone. */
    expect(nav.textContent).not.toMatch(/Showing/);
  });

  it("does not clamp a restored page against the previous query's total", async () => {
    /*
     * The cost of holding the total across a fetch: for that window it belongs
     * to the previous query. Here it says two pages while the address being
     * fetched asks for page five, so an unguarded clamp would commit page two
     * and discard the page-five response that was already in flight.
     */
    let served = 0;
    const { calls } = stubApi(() => {
      served += 1;

      if (served === 1) {
        return {
          body: [ticket()],
          pagination: meta({ pageSize: 10, totalItems: 15, totalPages: 2, hasNextPage: true }),
        };
      }

      return new Promise<ListResult>(() => undefined);
    });

    renderMyTicketsWithHistory(["/tickets?pageNumber=5", "/tickets"], 1);
    await screen.findByText(/Showing 1–10 of 15/);

    await userEvent.click(screen.getByRole("button", { name: "Go back" }));

    await waitFor(() => expect(listCalls(calls)).toHaveLength(2));
    expect(lastListQuery(calls).get("pageNumber")).toBe("5");

    /* A clamp would show up as a third request carrying pageNumber=2. */
    await act(async () => {
      await Promise.resolve();
    });

    expect(listCalls(calls)).toHaveLength(2);
    expect(lastListQuery(calls).get("pageNumber")).toBe("5");
  });

  it("renders the range from X-Pagination rather than the row count", async () => {
    stubApi(() => ({
      body: [ticket()],
      pagination: meta({ pageSize: 10, totalItems: 47, totalPages: 5, hasNextPage: true }),
    }));

    renderMyTickets();

    expect(await screen.findByText(/Showing 1–10 of 47/)).toBeInTheDocument();
  });

  it("requests the next page and the chosen page size", async () => {
    const { calls } = stubApi(() => ({
      body: [ticket()],
      pagination: meta({ pageSize: 10, totalItems: 47, totalPages: 5, hasNextPage: true }),
    }));

    renderMyTickets();
    await screen.findByText("TKT-20260820-A81F3C9D7B21");

    await userEvent.click(screen.getByRole("button", { name: /Next/ }));
    await waitFor(() => expect(lastListQuery(calls).get("pageNumber")).toBe("2"));

    await userEvent.selectOptions(screen.getByLabelText("Rows per page"), ["20"]);
    await waitFor(() => expect(lastListQuery(calls).get("pageSize")).toBe("20"));
    /* A page-size change starts again from the first page. */
    expect(lastListQuery(calls).get("pageNumber")).toBe("1");
  });

  it("returns a page past the last one to the last real page", async () => {
    /*
     * BR-38 makes this a 200 with an empty array, so the row count alone cannot
     * tell it apart from a genuinely empty result. Only the total can: a shared
     * or restored `?pageNumber=5` has to keep the pagination controls, whose
     * clamp reports the correction back, instead of settling on "No tickets
     * found" with nothing left to correct it.
     */
    let requested = 0;

    /* Page 5 of a 3-page result is empty; page 3 is the last one that has rows. */
    const { calls } = stubApi(() => {
      requested += 1;

      return requested === 1
        ? { body: [], pagination: meta({ pageNumber: 5, totalItems: 25, totalPages: 3, hasPreviousPage: true }) }
        : {
            body: [ticket()],
            pagination: meta({ pageNumber: 3, totalItems: 25, totalPages: 3, hasPreviousPage: true }),
          };
    });

    renderMyTickets(ALICE, "/tickets?pageNumber=5");

    await waitFor(() => expect(lastListQuery(calls).get("pageNumber")).toBe("3"));
    expect(await screen.findByText("TKT-20260820-A81F3C9D7B21")).toBeInTheDocument();
    expect(screen.queryByText("No tickets found.")).toBeNull();
    expect(screen.getByRole("navigation", { name: "Ticket pagination" })).toBeInTheDocument();
  });

  it("lets Back leave a page that had to be corrected", async () => {
    /*
     * The clamp corrects the address, so it has to replace it. Pushing would
     * leave `?pageNumber=5` behind, and Back would land on it, clamp again, and
     * push again -- an entry the user can never navigate back past.
     */
    let requested = 0;

    const { calls } = stubApi(() => {
      requested += 1;

      return requested === 1
        ? { body: [], pagination: meta({ pageNumber: 5, totalItems: 25, totalPages: 3, hasPreviousPage: true }) }
        : {
            body: [ticket()],
            pagination: meta({ pageNumber: 3, totalItems: 25, totalPages: 3, hasPreviousPage: true }),
          };
    });

    renderMyTicketsWithHistory(["/tickets?search=vpn", "/tickets?pageNumber=5"], 1);

    await waitFor(() => expect(lastListQuery(calls).get("pageNumber")).toBe("3"));

    fireEvent.click(screen.getByRole("button", { name: "Go back" }));

    await waitFor(() => expect(lastListQuery(calls).get("search")).toBe("vpn"));
    expect(screen.getByLabelText("Search")).toHaveValue("vpn");
  });

  it("offers the five approved page sizes", async () => {
    stubApi(() => ({ body: [ticket()], pagination: meta({ totalItems: 47, totalPages: 5 }) }));

    renderMyTickets();
    await screen.findByText("TKT-20260820-A81F3C9D7B21");

    expect(
      within(screen.getByLabelText("Rows per page"))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["10", "20", "30", "50", "100"]);
  });

  it("renders a row from the bounded projection alone", async () => {
    stubApi();
    renderMyTickets();

    const row = await screen.findByRole("row", { name: /Open ticket TKT-20260820-A81F3C9D7B21/ });

    expect(within(row).getByText("VPN disconnects every ten minutes")).toBeInTheDocument();
    expect(within(row).getByText("Network")).toBeInTheDocument();
    expect(within(row).getByText("VPN")).toBeInTheDocument();
    expect(within(row).getByText("2026-08-20")).toBeInTheDocument();
  });

  /*
   * The Ticket Number carries the `Asia/Bangkok` business date (BR-01-03), so
   * Created At has to be read on the same calendar. Slicing the UTC date off
   * the ISO string made the two halves of one row disagree for the seven hours
   * a day the calendars differ: 18:00Z on the 26th is already the 27th in
   * Bangkok, which is the date the Ticket Number states.
   */
  it("dates a row on the same calendar its Ticket Number was issued on", async () => {
    stubApi(() => ({
      body: [
        ticket({
          ticketNumber: "TKT-20260827-A81F3C9D7B21",
          createdAt: "2026-08-26T18:00:00.000Z",
        }),
      ],
      pagination: meta(),
    }));

    renderMyTickets();

    const row = await screen.findByRole("row", { name: /Open ticket TKT-20260827-A81F3C9D7B21/ });

    expect(within(row).getByText("2026-08-27")).toBeInTheDocument();
    expect(within(row).queryByText("2026-08-26")).toBeNull();
  });
});

describe("UI-32 and UI-37 My Tickets accessibility", () => {
  it("names every column header for assistive technology", async () => {
    stubApi();
    renderMyTickets();
    await screen.findByText("TKT-20260820-A81F3C9D7B21");

    for (const header of screen.getAllByRole("columnheader")) {
      expect(header).toHaveAttribute("scope", "col");
    }
  });

  it("opens Ticket Detail by click, Enter, and Space", async () => {
    stubApi();

    for (const activate of [
      async (row: HTMLElement) => userEvent.click(row),
      async (row: HTMLElement) => {
        row.focus();
        await userEvent.keyboard("{Enter}");
      },
      async (row: HTMLElement) => {
        row.focus();
        await userEvent.keyboard(" ");
      },
    ]) {
      const view = renderMyTickets();
      await screen.findByText("TKT-20260820-A81F3C9D7B21");

      const row = rowFor("TKT-20260820-A81F3C9D7B21");
      expect(row).toHaveAttribute("tabindex", "0");

      await activate(row);

      expect(await screen.findByRole("heading", { name: "Ticket Detail" })).toBeInTheDocument();
      view.unmount();
      sessionStorage.clear();
    }
  });

  it("spells out Priority and Status instead of relying on colour", async () => {
    stubApi(() => ({ body: [ticket({ requestedPriority: "MEDIUM" })], pagination: meta() }));

    renderMyTickets();

    const row = await screen.findByRole("row", { name: /Open ticket/ });
    expect(within(row).getByText("MEDIUM")).toBeInTheDocument();
    expect(within(row).getByText("NEW")).toBeInTheDocument();
  });

  it("gives the chip remove control an accessible name and a visible tooltip", async () => {
    stubApi();
    renderMyTickets(ALICE, "/tickets?categoryId=1");
    await screen.findByText("TKT-20260820-A81F3C9D7B21");

    const remove = screen.getByRole("button", { name: "Remove filter Network" });

    await userEvent.hover(remove);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Remove filter Network");
  });
});
