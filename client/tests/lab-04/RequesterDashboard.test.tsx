import { afterEach, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../../src/App.js";
import { clearAccessToken } from "../../src/auth/authTransport.js";
import { ticket } from "./fixtures.js";
const dto = { metrics: { activeTickets: 8, waitingForRequester: 2, resolvedTickets: 3, closedTickets: 12 }, recentTickets: [] };
afterEach(() => { clearAccessToken(false); vi.unstubAllGlobals(); });
it("UI-08 Dashboard home shows authoritative accessible cards, status drills and compact bounded recent list", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input);
    const body = path.includes("/auth/refresh") ? { accessToken: "test-token", expiresIn: 600 } : path.includes("/auth/me") ? { publicId: "requester-dashboard-ui", name: "Requester", email: "requester@example.test", role: "REQUESTER", isActive: true, mustChangePassword: false, sessionStage: "FULL" } : path.includes("/dashboard") ? dto : [];
    return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);
  expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  expect(await screen.findByRole("link", { name: "Active Tickets: 8. View tickets" })).toHaveAttribute("href", "/tickets?currentStatus=NEW%2COPEN%2CIN_PROGRESS%2CWAITING_FOR_REQUESTER%2CREOPENED");
  expect(screen.getByRole("link", { name: "Waiting for Me: 2. View tickets" })).toHaveAttribute("href", "/tickets?currentStatus=WAITING_FOR_REQUESTER");
  expect(screen.getByRole("link", { name: "Resolved: 3. View tickets" })).toHaveAttribute("href", "/tickets?currentStatus=RESOLVED");
  expect(screen.getByRole("link", { name: "Closed: 12. View tickets" })).toHaveAttribute("href", "/tickets?currentStatus=CLOSED");
  expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  expect(screen.getByText("No recent tickets")).toBeInTheDocument();
  expect(screen.getByText("Your recently updated tickets will appear here.")).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText("Recently Updated list size"), "10");
  await waitFor(() => expect(fetchMock.mock.calls.some(([path]) => String(path).includes("recentTicketsSize=10"))).toBe(true));
});
it("UI-08 Recently Updated keeps server order and exposes no sorting controls", async () => {
  const recentTickets = [
    { ...ticket, publicId: "recent-zulu", ticketNumber: "TKT-Z", summary: "Zulu" },
    { ...ticket, publicId: "recent-alpha", ticketNumber: "TKT-A", summary: "Alpha" },
  ];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input);
    const body = path.includes("/auth/refresh") ? { accessToken: "test-token", expiresIn: 600 } : path.includes("/auth/me") ? { publicId: "requester-dashboard-order", name: "Requester", email: "requester@example.test", role: "REQUESTER", isActive: true, mustChangePassword: false, sessionStage: "FULL" } : { ...dto, recentTickets };
    return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
  }));
  render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>);
  await screen.findByRole("link", { name: "Active Tickets: 8. View tickets" });
  const table = screen.getByRole("table", { name: "Recently Updated" });
  for (const header of within(table).getAllByRole("columnheader")) {
    expect(header).not.toHaveAttribute("aria-sort");
    expect(header).not.toHaveAttribute("tabindex");
  }
  await userEvent.click(within(table).getByRole("columnheader", { name: "Summary" }));
  expect(within(table).getByRole("columnheader", { name: "Summary" })).not.toHaveAttribute("aria-sort");
  expect(within(table).getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell")[1].textContent)).toEqual(["Zulu", "Alpha"]);
});
