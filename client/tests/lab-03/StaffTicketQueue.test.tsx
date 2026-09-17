import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiResponseError } from "../../src/api.js";
import StaffTicketQueue from "../../src/pages/StaffTicketQueue.js";
const { callApi } = vi.hoisted(() => ({ callApi: vi.fn() }));
vi.mock("../../src/auth/useAuthenticatedApi.js", () => ({ useAuthenticatedApi: () => callApi }));
vi.mock("../../src/auth/AuthProvider.js", () => ({ useAuth: () => ({ user: { role: "IT_STAFF" } }) }));
beforeEach(() => {
  callApi.mockReset();
  callApi.mockImplementation(async (path: string, options?: { onResponse?: (response: Response) => void }) => {
    if (path.startsWith("/api/tickets?")) options?.onResponse?.(new Response(null, { headers: { "X-Pagination": JSON.stringify({ totalItems: 0, pageNumber: 1, pageSize: 10, totalPages: 0, hasNextPage: false, hasPreviousPage: false }) } }));
    return [];
  });
});
const queueCalls = () => callApi.mock.calls.filter(([path]) => path.startsWith("/api/tickets?"));
describe("UI-13–14 Queue controls @issue-5", () => {
  it("UI-13 renders desktop table columns, loading state, explicit unassigned, and empty vs no-results", async () => {
    let resolveCall: ((items: unknown[]) => void) | undefined;
    callApi.mockImplementation(async (path: string, options?: { onResponse?: (response: Response) => void }) => {
      if (!path.startsWith("/api/tickets?")) return [];
      options?.onResponse?.(new Response(null, { headers: { "X-Pagination": JSON.stringify({ totalItems: 1, pageNumber: 1, pageSize: 10, totalPages: 1, hasNextPage: false, hasPreviousPage: false }) } }));
      return new Promise((res) => { resolveCall = res; });
    });
    const { unmount } = render(<MemoryRouter><StaffTicketQueue /></MemoryRouter>);
    expect(screen.getByRole("status", { name: "Loading Tickets" })).toBeInTheDocument();
    resolveCall!([{
      publicId: "20000000-0000-4000-8000-000000000011",
      ticketNumber: "TK-20260916-0001",
      requesterName: "Test Requester",
      categoryId: 1,
      categoryName: "Support",
      summary: "VPN Outage",
      requestedPriority: "MEDIUM",
      itPriority: "HIGH",
      currentStatus: "OPEN",
      owner: null,
      createdAt: "2026-09-16T00:00:00Z",
      updatedAt: "2026-09-16T00:00:00Z",
    }]);
    await screen.findAllByText("TK-20260916-0001");
    const table = screen.getByRole("table");
    for (const heading of ["Ticket Number", "Summary / Category", "IT Priority", "Status", "Owner", "Created"]) {
      expect(within(table).getByRole("columnheader", { name: heading })).toBeInTheDocument();
    }
    expect(within(table).getByText("Unassigned")).toBeInTheDocument();
    expect(within(table).getByText("HIGH")).toBeInTheDocument();
    expect(within(table).getByText("OPEN")).toBeInTheDocument();
    unmount();

    // No-results state when filters applied
    callApi.mockImplementation(async (path: string, options?: { onResponse?: (response: Response) => void }) => {
      options?.onResponse?.(new Response(null, { headers: { "X-Pagination": JSON.stringify({ totalItems: 0, pageNumber: 1, pageSize: 10, totalPages: 0, hasNextPage: false, hasPreviousPage: false }) } }));
      return [];
    });
    const filteredRender = render(<MemoryRouter><StaffTicketQueue /></MemoryRouter>);
    expect(await screen.findByText(/No Tickets match your search or filters/)).toBeInTheDocument();
    filteredRender.unmount();
  });
  it("pages populated results and resets paging when page size changes", async () => {
    callApi.mockImplementation(async (path: string, options?: { onResponse?: (response: Response) => void }) => {
      if (!path.startsWith("/api/tickets?")) return [];
      const query = new URL(path, "http://test").searchParams;
      const pageNumber = Number(query.get("pageNumber"));
      const pageSize = Number(query.get("pageSize"));
      options?.onResponse?.(new Response(null, { headers: { "X-Pagination": JSON.stringify({ totalItems: 21, pageNumber, pageSize, totalPages: Math.ceil(21 / pageSize), hasNextPage: pageNumber * pageSize < 21, hasPreviousPage: pageNumber > 1 }) } }));
      return [{ publicId: "20000000-0000-4000-8000-000000000011", ticketNumber: "TK-20260916-0001", requesterName: "Test Requester", categoryId: 1, categoryName: "Support", summary: `Page ${pageNumber} fixture`, requestedPriority: "MEDIUM", itPriority: "HIGH", currentStatus: "OPEN", owner: null, createdAt: "2026-09-16T00:00:00Z", updatedAt: "2026-09-16T00:00:00Z" }];
    });
    render(<MemoryRouter><StaffTicketQueue /></MemoryRouter>);
    await screen.findAllByText("Page 1 fixture");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findAllByText("Page 2 fixture");
    expect(screen.queryByText("Page 1 fixture")).not.toBeInTheDocument();
    expect(new URL(queueCalls().at(-1)![0], "http://test").searchParams.get("pageNumber")).toBe("2");
    await userEvent.selectOptions(screen.getByLabelText("Rows per page"), "20");
    await screen.findAllByText("Page 1 fixture");
    expect(new URL(queueCalls().at(-1)![0], "http://test").searchParams.get("pageSize")).toBe("20");
  });
  it("commits terminal exclusions initially and Clear Filters exposes all", async () => {
    render(<MemoryRouter><StaffTicketQueue /></MemoryRouter>);
    await screen.findByText(/No Tickets match/);
    expect(JSON.parse(new URL(queueCalls()[0][0], "http://test").searchParams.get("filters")!)).toEqual([{ field: "currentStatus", condition: "NOTEQUAL", value: "CLOSED" }, { field: "currentStatus", condition: "NOTEQUAL", value: "CANCELLED" }]);
    await userEvent.click(screen.getByRole("button", { name: "Clear Filters" }));
    await screen.findByText("No Tickets are currently available.");
    expect(new URL(queueCalls().at(-1)![0], "http://test").searchParams.get("filters")).toBe("[]");
  });
  it("keeps draft Reset/Cancel separate from Apply", async () => {
    render(<MemoryRouter><StaffTicketQueue /></MemoryRouter>);
    await screen.findByText(/No Tickets match/);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Filters (2)" }));
    await user.click(screen.getByRole("button", { name: "Reset" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(queueCalls()).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Filters (2)" }));
    await user.selectOptions(screen.getByLabelText("Status", { exact: true }), "CLOSED");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(queueCalls()).toHaveLength(2));
    expect(JSON.parse(new URL(queueCalls()[1][0], "http://test").searchParams.get("filters")!)).toEqual([{ field: "currentStatus", condition: "EQUAL", value: "CLOSED" }]);
  });
  it("debounces search across four fields and resets page for sort", async () => {
    render(<MemoryRouter><StaffTicketQueue /></MemoryRouter>);
    await screen.findByText(/No Tickets match/);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Search Tickets"), "vpn");
    await waitFor(() => expect(new URL(queueCalls().at(-1)![0], "http://test").searchParams.get("search")).toBe("vpn"));
    expect(new URL(queueCalls().at(-1)![0], "http://test").searchParams.get("searchFields")).toBe("ticketNumber,summary,description,requesterName");
    await user.selectOptions(screen.getByLabelText("Sort"), "itPriority:desc");
    await waitFor(() => expect(new URL(queueCalls().at(-1)![0], "http://test").searchParams.get("sort")).toBe("itPriority:desc"));
    expect(new URL(queueCalls().at(-1)![0], "http://test").searchParams.get("pageNumber")).toBe("1");
  });
  it("keeps invalid search on Queue and recovers with Reset Search", async () => {
    callApi.mockImplementation(async (path: string, options?: { onResponse?: (response: Response) => void }) => {
      if (!path.startsWith("/api/tickets?")) return [];
      const query = new URL(path, "http://test").searchParams;
      options?.onResponse?.(new Response(null, { headers: { "X-Pagination": JSON.stringify({ totalItems: 0, pageNumber: 1, pageSize: 10, totalPages: 0, hasNextPage: false, hasPreviousPage: false }) } }));
      if (query.get("search")?.length === 201) throw new ApiResponseError(400, "VALIDATION_ERROR", []);
      return [];
    });
    render(<MemoryRouter initialEntries={["/staff/tickets"]}><Routes><Route path="/staff/tickets" element={<StaffTicketQueue />} /><Route path="/error" element={<p>Error page</p>} /></Routes></MemoryRouter>);
    await screen.findByText(/No Tickets match/);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Search Tickets"), "x".repeat(201));
    expect(await screen.findByText("This search could not be run.")).toBeInTheDocument();
    expect(screen.getByLabelText("Search Tickets")).toBeInTheDocument();
    expect(screen.queryByText("Error page")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Ticket pagination" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Reset Search" }));
    await waitFor(() => expect(screen.queryByText("This search could not be run.")).toBeNull());
    expect(screen.getByLabelText("Search Tickets")).toHaveValue("");
    await user.type(screen.getByLabelText("Search Tickets"), "vpn");
    await waitFor(() => expect(new URL(queueCalls().at(-1)![0], "http://test").searchParams.get("search")).toBe("vpn"));
    expect(screen.queryByText("This search could not be run.")).toBeNull();
  });
});
