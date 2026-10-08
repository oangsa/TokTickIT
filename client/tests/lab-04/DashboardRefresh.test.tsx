import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, cleanup, within } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import Dashboard from "../../src/modules/Dashboard/Dashboard.js";
const { request, actor } = vi.hoisted(() => ({ request: vi.fn(), actor: { publicId: "", role: "REQUESTER" } }));
vi.mock("../../src/auth/useAuthenticatedApi.js", () => ({ useAuthenticatedApi: () => request }));
vi.mock("../../src/auth/AuthProvider.js", () => ({ useAuth: () => ({ user: actor }) }));
const dto = (activeTickets = 8) => ({ metrics: { activeTickets, waitingForRequester: 2, resolvedTickets: 3, closedTickets: 12 }, recentTickets: [] });
function deferred<T = ReturnType<typeof dto>>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
let testId = 0;
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
  actor.publicId = `refresh-test-${++testId}`; actor.role = "REQUESTER";
  request.mockReset(); request.mockResolvedValue(dto());
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
const settle = async () => { await act(async () => { await Promise.resolve(); }); };
const tick = async (time: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(time); }); };
function mount(path = "/dashboard") { return render(<MemoryRouter initialEntries={[path]}><Dashboard /></MemoryRouter>); }
it("UI-10 timer/manual refresh is single-flight, skipped ticks never queue and requests never abort", async () => {
  mount(); await settle();
  expect(request).toHaveBeenCalledTimes(1);
  await tick(29_999); expect(request).toHaveBeenCalledTimes(1);
  const pending = deferred(); request.mockReturnValueOnce(pending.promise);
  await tick(1); expect(request).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  await tick(90_000); expect(request).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("link", { name: "Active Tickets: 8. View tickets" })).toBeInTheDocument();
  await act(async () => pending.resolve(dto(9)));
  expect(screen.getByRole("link", { name: "Active Tickets: 9. View tickets" })).toBeInTheDocument();
  expect(request).toHaveBeenCalledTimes(2);
  await tick(30_000); expect(request).toHaveBeenCalledTimes(3);
  fireEvent.click(screen.getByRole("button", { name: "Refresh" })); await settle(); expect(request).toHaveBeenCalledTimes(4);
  expect(request.mock.calls.every(([, init]) => init.cache === "no-store" && init.signal === undefined)).toBe(true);
});
it("UI-11 safe initial failure retries; background failure retains data/time; accepted success replaces both", async () => {
  request.mockRejectedValueOnce(new Error("secret backend details"));
  mount(); await settle();
  expect(screen.getByRole("alert")).toHaveTextContent("Unable to load Dashboard");
  expect(screen.queryByText("secret backend details")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry" })); await settle();
  const time = screen.getByText(/^Last updated /).textContent;
  request.mockRejectedValueOnce(new Error("background failure"));
  await tick(30_000);
  expect(screen.getByRole("alert")).toHaveTextContent("Showing last successful data");
  expect(screen.getByRole("link", { name: "Active Tickets: 8. View tickets" })).toBeInTheDocument();
  expect(screen.getByText(/^Last updated /).textContent).toBe(time);
  expect(screen.queryByLabelText("Loading Dashboard")).not.toBeInTheDocument();
  expect(screen.queryByText("Refreshing...")).not.toBeInTheDocument();
  const retry = deferred(); request.mockReturnValueOnce(retry.promise);
  fireEvent.click(screen.getByRole("button", { name: "Retry" })); await settle();
  expect(screen.getByRole("alert")).toHaveTextContent("Showing last successful data");
  expect(screen.getByRole("button", { name: "Retry" })).toBeDisabled();
  await act(async () => retry.resolve(dto(11)));
  expect(screen.getByRole("link", { name: "Active Tickets: 11. View tickets" })).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByText(/^Last updated /).textContent).not.toBe(time);
});
function visibility(value: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", { configurable: true, value });
  fireEvent(document, new Event("visibilitychange"));
}
it("UI-14 hidden pauses schedule; visible immediately revalidates and restarts; visible while pending never queues", async () => {
  mount(); await settle();
  await tick(10_000); visibility("hidden");
  await tick(90_000); expect(request).toHaveBeenCalledTimes(1);
  visibility("visible"); await settle(); expect(request).toHaveBeenCalledTimes(2);
  await tick(29_999); expect(request).toHaveBeenCalledTimes(2);
  const pending = deferred(); request.mockReturnValueOnce(pending.promise);
  await tick(1); expect(request).toHaveBeenCalledTimes(3);
  visibility("hidden"); await tick(15_000); visibility("visible"); await settle();
  expect(request).toHaveBeenCalledTimes(3);
  await act(async () => pending.resolve(dto(12)));
  expect(request).toHaveBeenCalledTimes(3);
  await tick(29_999); expect(request).toHaveBeenCalledTimes(3);
  await tick(1); expect(request).toHaveBeenCalledTimes(4);
});
it.each([29_999, 30_000, 30_001])("UI-15 cached success at age %i retains timestamp and revalidates only past boundary", async (age) => {
  const first = mount(); await settle();
  const time = screen.getByText(/^Last updated /).textContent;
  first.unmount(); await tick(age);
  const pending = deferred(); request.mockReturnValueOnce(pending.promise);
  mount();
  expect(screen.getByRole("link", { name: "Active Tickets: 8. View tickets" })).toBeInTheDocument();
  expect(screen.getByText(/^Last updated /).textContent).toBe(time);
  await settle(); expect(request).toHaveBeenCalledTimes(age > 30_000 ? 2 : 1);
  if (age > 30_000) await act(async () => pending.resolve(dto(13)));
});
function ScopeControl() {
  const navigate = useNavigate();
  return <><button onClick={() => navigate("/dashboard?recentTicketsSize=10")}>Change size</button><button onClick={() => navigate("/dashboard")}>Change back</button><Dashboard /></>;
}
it("UI-16 User and URL changes hide old data immediately and ignore late response; no persistent storage writes", async () => {
  const local = vi.spyOn(Storage.prototype, "setItem");
  const pending = deferred(); request.mockReturnValueOnce(pending.promise);
  const view = render(<MemoryRouter><ScopeControl /></MemoryRouter>);
  await settle();
  const nextUser = deferred(); request.mockReturnValueOnce(nextUser.promise);
  actor.publicId += "-other"; view.rerender(<MemoryRouter><ScopeControl /></MemoryRouter>); await settle();
  expect(screen.queryByRole("link", { name: /^Active Tickets:/ })).not.toBeInTheDocument();
  expect(request).toHaveBeenCalledTimes(1);
  await act(async () => pending.resolve(dto(99))); await settle();
  await act(async () => nextUser.resolve(dto()));
  expect(screen.queryByRole("link", { name: "Active Tickets: 99. View tickets" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Active Tickets: 8. View tickets" })).toBeInTheDocument();
  const resized = deferred(); request.mockReturnValueOnce(resized.promise);
  fireEvent.click(screen.getByRole("button", { name: "Change size" }));
  expect(screen.queryByRole("link", { name: /^Active Tickets:/ })).not.toBeInTheDocument();
  await act(async () => resized.resolve(dto(10)));
  expect(screen.getByRole("link", { name: "Active Tickets: 10. View tickets" })).toBeInTheDocument();
  expect(local).not.toHaveBeenCalled(); local.mockRestore();
});
it("UI-16 independent role change never reuses same User's previous role DTO", async () => {
  const first = mount(); await settle(); first.unmount();
  actor.role = "IT_STAFF";
  const operational = { metrics: { unassignedTickets: 1, myAssignedTickets: 2, inProgressTickets: 3, waitingForRequester: 4, highPriorityTickets: 5 }, myActions: [], recentTickets: [], urgentTickets: [] };
  request.mockResolvedValueOnce(operational);
  mount();
  expect(screen.queryByRole("link", { name: /^Active Tickets:/ })).not.toBeInTheDocument();
  await settle(); expect(screen.getByRole("link", { name: "My Assigned: 2. View tickets" })).toBeInTheDocument();
});
it("UI-16 role changes during a pending request serialize requests and reject late previous-role DTO", async () => {
  const pending = deferred(); request.mockReturnValueOnce(pending.promise);
  const first = mount(); await settle();
  actor.role = "IT_STAFF";
  const operational = { metrics: { unassignedTickets: 1, myAssignedTickets: 2, inProgressTickets: 3, waitingForRequester: 4, highPriorityTickets: 5 }, myActions: [], recentTickets: [], urgentTickets: [] };
  request.mockResolvedValueOnce(operational);
  first.rerender(<MemoryRouter><Dashboard /></MemoryRouter>); await settle();
  expect(request).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("link", { name: /^Active Tickets:/ })).not.toBeInTheDocument();
  await act(async () => pending.resolve(dto(99))); await settle();
  expect(request).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("link", { name: "Active Tickets: 99. View tickets" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "My Assigned: 2. View tickets" })).toBeInTheDocument();
});
it("UI-15 remount during background refresh shares same flight and accepts its success", async () => {
  const first = mount(); await settle();
  const pending = deferred(); request.mockReturnValueOnce(pending.promise);
  fireEvent.click(screen.getByRole("button", { name: "Refresh" })); await settle();
  first.unmount(); mount(); await settle();
  expect(request).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("link", { name: "Active Tickets: 8. View tickets" })).toBeInTheDocument();
  await act(async () => pending.resolve(dto(19)));
  expect(screen.getByRole("link", { name: "Active Tickets: 19. View tickets" })).toBeInTheDocument();
});

it("UI-16 abandoned URL response never replaces or populates another URL scope", async () => {
  render(<MemoryRouter initialEntries={["/dashboard"]}><ScopeControl /></MemoryRouter>); await settle();
  const abandoned = deferred(); request.mockReturnValueOnce(abandoned.promise);
  fireEvent.click(screen.getByRole("button", { name: "Change size" })); await settle();
  expect(screen.queryByRole("link", { name: /^Active Tickets:/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Change back" })); await settle();
  expect(screen.getByRole("link", { name: "Active Tickets: 8. View tickets" })).toBeInTheDocument();
  await act(async () => abandoned.resolve(dto(99)));
  expect(screen.queryByRole("link", { name: "Active Tickets: 99. View tickets" })).not.toBeInTheDocument();
  expect(request).toHaveBeenCalledTimes(2);
  request.mockResolvedValueOnce(dto(14));
  fireEvent.click(screen.getByRole("button", { name: "Change size" })); await settle();
  expect(request).toHaveBeenCalledTimes(3);
  expect(screen.getByRole("link", { name: "Active Tickets: 14. View tickets" })).toBeInTheDocument();
});

it.each(["URL", "User", "role"])("UI-16 %s round-trip rejects abandoned flight and fetches current scope without overlap", async (context) => {
  const pending = deferred(); request.mockReturnValueOnce(pending.promise);
  const current = deferred(); request.mockReturnValueOnce(current.promise);
  const view = render(<MemoryRouter initialEntries={["/dashboard"]}><ScopeControl /></MemoryRouter>); await settle();
  const originalUser = actor.publicId;
  if (context === "URL") fireEvent.click(screen.getByRole("button", { name: "Change size" }));
  else {
    if (context === "User") actor.publicId += "-other";
    else actor.role = "IT_STAFF";
    view.rerender(<MemoryRouter initialEntries={["/dashboard"]}><ScopeControl /></MemoryRouter>);
  }
  await settle();
  if (context === "URL") fireEvent.click(screen.getByRole("button", { name: "Change back" }));
  else {
    actor.publicId = originalUser; actor.role = "REQUESTER";
    view.rerender(<MemoryRouter initialEntries={["/dashboard"]}><ScopeControl /></MemoryRouter>);
  }
  await settle();
  expect(request).toHaveBeenCalledTimes(1);
  await act(async () => pending.resolve(dto(99))); await settle();
  expect(screen.queryByRole("link", { name: "Active Tickets: 99. View tickets" })).not.toBeInTheDocument();
  expect(screen.queryByText(/^Last updated /)).not.toBeInTheDocument();
  expect(request).toHaveBeenCalledTimes(2);
  await act(async () => current.resolve(dto(14)));
  expect(screen.getByRole("link", { name: "Active Tickets: 14. View tickets" })).toBeInTheDocument();
  view.unmount(); mount(); await settle();
  expect(request).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("link", { name: "Active Tickets: 14. View tickets" })).toBeInTheDocument();
});

it.each(["REQUESTER", "IT_STAFF", "ADMINISTRATOR"])("UI-08/09 %s initial loading preserves metric cards and compact table rows", async (role) => {
  actor.role = role;
  const loaded = role === "REQUESTER" ? dto() : { metrics: { unassignedTickets: 0, myAssignedTickets: 0, inProgressTickets: 0, waitingForRequester: 0, highPriorityTickets: 0 }, myActions: [], recentTickets: [], urgentTickets: [] };
  const pending = deferred<typeof loaded>(); request.mockReturnValueOnce(pending.promise);
  mount(); await settle();
  const loading = screen.getByRole("status", { name: "Loading Dashboard" });
  const labels = role === "REQUESTER" ? ["Active Tickets", "Waiting for Me", "Resolved", "Closed"] : ["Unassigned", "My Assigned", "In Progress", "Waiting for Requester", "High Priority"];
  const metrics = within(loading).getByRole("group", { name: "Dashboard metrics" });
  for (const label of labels) expect(within(metrics).getByText(label)).toBeInTheDocument();
  expect(within(metrics).queryByRole("link")).not.toBeInTheDocument();
  const titles = role === "REQUESTER" ? ["Recently Updated"] : ["My Actions Taken", "Recently Updated Tickets", "Urgent Tickets"];
  for (const title of titles) {
    const table = within(loading).getByRole("table", { name: title });
    expect(within(table).getAllByRole("row")).toHaveLength(6); // Header + default top-five skeleton rows.
    expect(within(table).getByRole("columnheader", { name: title === "My Actions Taken" ? "Description" : "Ticket Number" })).toBeInTheDocument();
  }
  expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
  await act(async () => pending.resolve(loaded));
  expect(screen.queryByRole("status", { name: "Loading Dashboard" })).not.toBeInTheDocument();
});
