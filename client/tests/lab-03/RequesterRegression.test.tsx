import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import App from "../../src/App.js";
import { clearAccessToken } from "../../src/auth/authTransport.js";

const USER = {
  publicId: "70000000-0000-4000-8000-000000000001",
  name: "Alice Auth",
  email: "alice.auth@example.test",
  role: "REQUESTER",
  isActive: true,
  mustChangePassword: false,
  sessionStage: "FULL",
} as const;

const PUBLIC_ID = "05a214b4-b957-4ed7-a58e-73f4392b35ec";

const TICKET = {
  publicId: PUBLIC_ID,
  ticketNumber: "TKT-20260820-A81F3C9D7B21",
  requesterId: 3,
  requesterPublicId: USER.publicId,
  requesterName: USER.name,
  requesterEmail: USER.email,
  categoryId: 4,
  categoryName: "Network",
  relatedSystemId: 5,
  relatedSystemName: "VPN",
  summary: "Cannot connect to campus VPN",
  description: "The VPN client fails after entering my credentials.",
  requestedPriority: "HIGH",
  itPriority: "HIGH",
  currentStatus: "RESOLVED",
  owner: null,
  requesterResolutionConfirmedAt: null,
  attachments: [],
  createdBy: USER.email,
  createdAt: "2026-08-20T08:14:32.000Z",
  updatedBy: USER.email,
  updatedAt: "2026-08-20T08:14:32.000Z",
  deleted: false,
} as const;

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function stubRequesterApi(overrides: (url: string, init: RequestInit | undefined) => Response | undefined = () => undefined) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const override = overrides(url, init);
    if (override !== undefined) return override;
    if (url.endsWith("/api/auth/refresh")) return jsonResponse({ accessToken: "memory-token", expiresIn: 600 });
    if (url.endsWith("/api/auth/me")) return jsonResponse(USER);
    if (url.endsWith("/api/categories")) return jsonResponse([{ id: 4, name: "Network", isActive: true, deleted: false }]);
    if (url.endsWith("/api/related-systems")) return jsonResponse([{ id: 5, name: "VPN", isActive: true, deleted: false }]);
    if (url.includes("/api/users/me/tickets?") && init?.method !== "POST") {
      return jsonResponse([], 200, { "X-Pagination": JSON.stringify({ pageNumber: 1, pageSize: 10, totalItems: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false }) });
    }
    if (url.endsWith(`/api/users/me/tickets/${PUBLIC_ID}`) && init?.method !== "POST") return jsonResponse(TICKET);
    if (url.endsWith("/api/users/me/tickets")) return jsonResponse({ ...TICKET, currentStatus: "NEW" }, 201);
    return jsonResponse({ ...TICKET, currentStatus: "NEW" });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
}

afterEach(() => {
  clearAccessToken(false);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

describe("authenticated Requester regression", () => {
  it("uses AuthProvider identity and new Ticket routes without legacy selector/header state @issue-4", async () => {
    const { calls } = stubRequesterApi();
    render(<MemoryRouter initialEntries={["/tickets"]}><App /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
    expect(screen.queryByText("Change Requester", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("Development Requester", { exact: true })).not.toBeInTheDocument();
    expect(sessionStorage.getItem("toktickit.requester")).toBeNull();
    await waitFor(() => expect(calls.some(({ url }) => url.includes("/api/users/me/tickets?"))).toBe(true));
    for (const call of calls) {
      expect(new Headers(call.init?.headers).has("X-Requester-Id")).toBe(false);
    }
  });

  it("keeps generated Ticket fields out of authenticated create payload @issue-4", async () => {
    const { calls } = stubRequesterApi();
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/tickets/new"]}><App /></MemoryRouter>);

    await screen.findByRole("heading", { name: "Create Ticket" });
    await user.selectOptions(await screen.findByLabelText(/^Category/), "4");
    await user.selectOptions(screen.getByLabelText(/^Related System/), "5");
    await user.selectOptions(screen.getByLabelText(/^Requested Priority/), "HIGH");
    await user.type(screen.getByLabelText(/^Summary/), TICKET.summary);
    await user.type(screen.getByLabelText(/^Description/), TICKET.description);
    await user.click(screen.getByRole("button", { name: "Submit Ticket" }));

    await waitFor(() => expect(calls.some(({ url, init }) => url.endsWith("/api/users/me/tickets") && init?.method === "POST")).toBe(true));
    const create = calls.find(({ url, init }) => url.endsWith("/api/users/me/tickets") && init?.method === "POST");
    const body = JSON.parse(String(create?.init?.body)) as Record<string, unknown>;
    expect(body).toEqual({ categoryId: 4, relatedSystemId: 5, requestedPriority: "HIGH", summary: TICKET.summary, description: TICKET.description, attachmentIds: [] });
    expect(body).not.toHaveProperty("requesterId");
    expect(body).not.toHaveProperty("ticketNumber");
    expect(body).not.toHaveProperty("createdAt");
    expect(new Headers(create?.init?.headers).get("Authorization")).toBe("Bearer memory-token");
  });

  it("posts Looks Resolved through authenticated requester action and shows confirmation @issue-4", async () => {
    const actionCalls: string[] = [];
    stubRequesterApi((url, init) => {
      if (init?.method === "POST" && url.endsWith(`/api/users/me/tickets/${PUBLIC_ID}/looks-resolved`)) {
        actionCalls.push(url);
        return jsonResponse({ ...TICKET, requesterResolutionConfirmedAt: "2026-08-20T09:00:00.000Z" });
      }
      return undefined;
    });
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={[`/tickets/${PUBLIC_ID}`]}><App /></MemoryRouter>);

    await screen.findByRole("heading", { name: TICKET.ticketNumber });
    expect(screen.getByLabelText("Current Status")).toHaveTextContent("RESOLVED");
    await user.click(screen.getByRole("button", { name: "Problem appears resolved" }));
    await waitFor(() => expect(actionCalls).toEqual([`/api/users/me/tickets/${PUBLIC_ID}/looks-resolved`]));
    expect(await screen.findByText("You confirmed that the problem appears resolved.", { exact: true })).toBeInTheDocument();
  });

  it("shows local reload recovery when a requester action conflicts @issue-4", async () => {
    let detailCalls = 0;
    stubRequesterApi((url, init) => {
      if (url.endsWith(`/api/users/me/tickets/${PUBLIC_ID}`) && init?.method !== "POST") {
        detailCalls += 1;
        return jsonResponse({ ...TICKET, currentStatus: "NEW" });
      }

      if (url.endsWith(`/api/users/me/tickets/${PUBLIC_ID}/cancel`) && init?.method === "POST") {
        return jsonResponse(
          { statusCode: 409, code: "OWNERSHIP_CONFLICT", message: "Conflict", error: "Conflict" },
          409,
        );
      }

      return undefined;
    });
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={[`/tickets/${PUBLIC_ID}`]}><App /></MemoryRouter>);

    await screen.findByRole("heading", { name: TICKET.ticketNumber });
    await user.click(screen.getByRole("button", { name: "Cancel Ticket" }));

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel Ticket" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Ticket ownership changed while you were viewing it.",
    );
    await user.click(within(dialog).getByRole("button", { name: "Reload Ticket" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(detailCalls).toBe(2));
  });
});
