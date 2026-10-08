import { afterEach, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../../src/App.js";
import { clearAccessToken } from "../../src/auth/authTransport.js";
import { staff, ticket, action } from "./fixtures.js";
afterEach(() => { clearAccessToken(false); vi.unstubAllGlobals(); });
it.each(["IT_STAFF", "ADMINISTRATOR"] as const)("UI-09 %s shared Dashboard links use Queue JSON filters and role paths", async (role) => {
  const dto = { metrics: { unassignedTickets: 4, myAssignedTickets: 3, inProgressTickets: 2, waitingForRequester: 1, highPriorityTickets: 5 }, myActions: [{ ...action, ticketNumber: ticket.ticketNumber, activityAt: action.createdAt }], recentTickets: [{ ...ticket, itPriority: "HIGH" }], urgentTickets: [{ ...ticket, itPriority: "HIGH" }] };
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input);
    const body = path.includes("/auth/refresh") ? { accessToken: "test-token", expiresIn: 600 } : path.includes("/auth/me") ? { ...staff, publicId: `dashboard-${role}`, role, isActive: true, mustChangePassword: false, sessionStage: "FULL" } : path.includes("/dashboard") ? dto : [];
    return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>);
  const high = await screen.findByRole("link", { name: "High Priority: 5. View tickets" });
  const target = new URL(high.getAttribute("href")!, "http://localhost");
  expect(target.pathname).toBe(role === "IT_STAFF" ? "/staff/tickets" : "/admin/tickets");
  expect(JSON.parse(target.searchParams.get("filters")!)).toEqual([{ field: "currentStatus", condition: "NOTEQUAL", value: "CLOSED" }, { field: "currentStatus", condition: "NOTEQUAL", value: "CANCELLED" }, { field: "itPriority", condition: "EQUAL", value: "HIGH" }]);
  for (const title of ["My Actions Taken", "Recently Updated Tickets", "Urgent Tickets"]) expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  const tables = screen.getAllByRole("table");
  for (const table of tables) {
    for (const header of within(table).getAllByRole("columnheader")) {
      expect(header).not.toHaveAttribute("aria-sort");
      expect(header).not.toHaveAttribute("tabindex");
    }
    const header = within(table).getAllByRole("columnheader")[0];
    await userEvent.click(header);
    expect(header).not.toHaveAttribute("aria-sort");
  }
  for (const table of tables) expect(within(table).getByText("2026-10-01, 07:00")).toBeInTheDocument();
  const base = role === "IT_STAFF" ? "/staff/tickets" : "/admin/tickets";
  expect(within(tables[0]).getByRole("link", { name: action.description })).toHaveAttribute("href", `${base}/${ticket.publicId}/actions/${action.publicId}`);
  for (const table of tables.slice(1)) expect(within(table).getByRole("link", { name: ticket.ticketNumber })).toHaveAttribute("href", `${base}/${ticket.publicId}`);
  await userEvent.click(high);
  await waitFor(() => expect(fetchMock.mock.calls.some(([path]) => {
    const url = new URL(String(path), "http://localhost");
    return url.pathname === "/api/tickets" && url.searchParams.get("filters")?.includes('"HIGH"');
  })).toBe(true));
});
