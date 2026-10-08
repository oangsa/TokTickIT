import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { NavigationGuardProvider } from "../../src/navigation/NavigationGuard.js";
import { ActionsTaken } from "../../src/modules/Actions/ActionsTaken.js";
import { ticket, action, staff, paged } from "./fixtures.js";
const { request, auth } = vi.hoisted(() => ({ request: vi.fn(), auth: { user: { publicId: "", role: "REQUESTER" } } }));
vi.mock("../../src/auth/useAuthenticatedApi.js", () => ({ useAuthenticatedApi: () => request, useAuthenticatedBlob: () => vi.fn() }));
vi.mock("../../src/auth/AuthProvider.js", () => ({ useAuth: () => auth }));
it("Requester Actions use shared DataTable, business columns and View only, standard paged read endpoint", async () => {
  auth.user = { ...staff, role: "REQUESTER" }; request.mockImplementation(async (_path, init) => paged([action], init));
  render(<MemoryRouter><NavigationGuardProvider><ActionsTaken ticket={ticket} /></NavigationGuardProvider></MemoryRouter>);
  const table = await screen.findByRole("table", { name: "Actions Taken" });
  for (const name of ["Status", "Description", "Assigned To", "Performed By", "Created At", "Actions"]) expect(within(table).getByRole("columnheader", { name })).toBeInTheDocument();
  expect(within(table).getByRole("link", { name: "View Inspect port" })).toHaveAttribute("href", `/tickets/${ticket.publicId}/actions/${action.publicId}`);
  expect(screen.queryByRole("button", { name: /Create Action|Edit|Assign|Unassign|Start|Complete|Cancel Action/ })).not.toBeInTheDocument();
  expect(request.mock.calls[0][0]).toContain(`/api/users/me/tickets/${ticket.publicId}/actions?`);
});

it("Staff filters/search/sort/paging remain server queries; draft Cancel does not apply, dates cover entire UTC day", async () => {
  const userEvent = (await import("@testing-library/user-event")).default;
  const { waitFor } = await import("@testing-library/react");
  auth.user = staff; request.mockReset(); request.mockImplementation(async (_path, init) => paged([action], init));
  const user = userEvent.setup();
  render(<MemoryRouter><NavigationGuardProvider><ActionsTaken ticket={ticket} /></NavigationGuardProvider></MemoryRouter>);
  await screen.findByRole("table", { name: "Actions Taken" });
  await user.click(screen.getByRole("button", { name: /^Filters/ }));
  const dialog = screen.getByRole("dialog", { name: "Filter Actions" });
  await user.selectOptions(within(dialog).getByLabelText("Status"), "PLANNED");
  await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(request.mock.calls).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: /^Filters/ }));
  expect(screen.getByLabelText("Status")).toHaveValue("");
  await user.selectOptions(screen.getByLabelText("Status"), "PLANNED");
  await user.type(screen.getByLabelText("Created Date"), "2026-10-01");
  await user.click(screen.getByRole("button", { name: "Apply" }));
  await waitFor(() => expect(request.mock.calls.at(-1)![0]).toContain("filters="));
  expect(JSON.parse(new URL(request.mock.calls.at(-1)![0], "http://localhost").searchParams.get("filters")!)).toEqual([
    { field: "status", condition: "EQUAL", value: "PLANNED" },
    { field: "createdAt", condition: "GREATEROREQUAL", value: "2026-10-01T00:00:00.000Z" },
    { field: "createdAt", condition: "LESSER", value: "2026-10-02T00:00:00.000Z" },
  ]);
  await user.click(screen.getByRole("button", { name: "Remove filter Status: PLANNED" }));
  await waitFor(() => expect(JSON.parse(new URL(request.mock.calls.at(-1)![0], "http://localhost").searchParams.get("filters")!)).toHaveLength(2));
  await user.type(screen.getByRole("searchbox", { name: "Search actions" }), "rack{Enter}");
  await waitFor(() => expect(request.mock.calls.at(-1)![0]).toContain("searchFields=description%2Cresult%2CfollowUpNote%2CattachmentNotes"));
});

it("Requester Ticket Detail places Attachments then Actions before Public Comments and omits internal Activity", async () => {
  const { Route, Routes } = await import("react-router-dom");
  const { default: RequesterTicketDetail } = await import("../../src/modules/Tickets/Requester/RequesterTicketDetail.js");
  auth.user = { ...staff, role: "REQUESTER" }; request.mockReset();
  request.mockImplementation(async (path, init) => path.includes("/actions") ? paged([action], init) : path.includes("/comments") ? { items: [], pagination: { pageNumber: 1, pageSize: 10, totalPages: 0, totalItems: 0 } } : ticket);
  render(<MemoryRouter initialEntries={[`/tickets/${ticket.publicId}`]}><NavigationGuardProvider><Routes><Route path="/tickets/:publicId" element={<RequesterTicketDetail />} /></Routes></NavigationGuardProvider></MemoryRouter>);
  await screen.findByRole("heading", { name: "Actions Taken" });
  const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
  expect(headings.indexOf("Attachments")).toBeLessThan(headings.indexOf("Actions Taken"));
  expect(headings.indexOf("Actions Taken")).toBeLessThan(headings.indexOf("Public Comments"));
  expect(screen.queryByRole("heading", { name: "Activity" })).not.toBeInTheDocument();
});

it.each(["IT_STAFF", "ADMINISTRATOR", "REQUESTER"])("%s terminal Action rows expose View only", async (role) => {
  auth.user = { ...staff, role }; request.mockReset();
  request.mockImplementation(async (_path, init) => paged([{ ...action, status: "CANCELLED" }], init));
  render(<MemoryRouter><NavigationGuardProvider><ActionsTaken ticket={{ ...ticket, currentStatus: "CLOSED" }} /></NavigationGuardProvider></MemoryRouter>);
  const table = await screen.findByRole("table", { name: "Actions Taken" });
  expect(within(table).getByRole("link", { name: "View Inspect port" })).toBeInTheDocument();
  expect(within(table).queryByRole("button", { name: /Edit|Assign|Reassign|Unassign|Start|Complete|Cancel/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Create Action" })).not.toBeInTheDocument();
});

it.each([1, 100])("Creator Edit visibility for %i rows comes from list identity without per-row detail requests", async (count) => {
  const userEvent = (await import("@testing-library/user-event")).default;
  const { waitFor } = await import("@testing-library/react");
  auth.user = staff; request.mockReset();
  const { creator: _creator, ...listItem } = action;
  request.mockImplementation(async (path, init) => {
    if (!path.includes("?")) throw new Error("Detail service unavailable");
    const size = Number(new URL(path, "http://localhost").searchParams.get("pageSize"));
    return paged(Array.from({ length: Math.min(count, size) }, (_, index) => ({ ...listItem, publicId: `30000000-0000-4000-8000-${String(index).padStart(12, "0")}`, description: `Inspect port ${index}`, creatorPublicId: staff.publicId, assignedTo: null })), init, count, 1, size);
  });
  render(<MemoryRouter><NavigationGuardProvider><ActionsTaken ticket={{ ...ticket, owner: null }} /></NavigationGuardProvider></MemoryRouter>);
  const table = await screen.findByRole("table", { name: "Actions Taken" });
  expect(within(table).getAllByRole("button", { name: /^Edit Inspect port/ })).toHaveLength(Math.min(count, 10));
  if (count === 100) {
    await userEvent.setup().selectOptions(screen.getByLabelText("Rows per page"), "100");
    await waitFor(() => expect(within(screen.getByRole("table", { name: "Actions Taken" })).getAllByRole("button", { name: /^Edit Inspect port/ })).toHaveLength(100));
  }
  expect(request).toHaveBeenCalledTimes(count === 100 ? 2 : 1);
});

it.each(["REQUESTER", "IT_STAFF", "ADMINISTRATOR"])("%s can filter by historical Users outside loaded Action page", async (role) => {
  const userEvent = (await import("@testing-library/user-event")).default;
  const { waitFor } = await import("@testing-library/react");
  auth.user = { ...staff, role }; request.mockReset();
  const historical = { publicId: "10000000-0000-4000-8000-000000000003", name: "Former Staff", role: "REQUESTER" };
  request.mockImplementation(async (path, init) => path.includes("/filter-users?") ? paged([historical], init) : paged([action], init));
  const user = userEvent.setup();
  render(<MemoryRouter><NavigationGuardProvider><ActionsTaken ticket={ticket} /></NavigationGuardProvider></MemoryRouter>);
  await screen.findByRole("table", { name: "Actions Taken" });
  await user.click(screen.getByRole("button", { name: /^Filters/ }));
  const dialog = screen.getByRole("dialog", { name: "Filter Actions" });
  for (const label of ["Assigned To", "Performed By"]) {
    await user.click(within(dialog).getByRole("button", { name: `Lookup ${label}` }));
    const lookup = screen.getByRole("dialog", { name: `Select ${label}` });
    const table = await within(lookup).findByRole("table", { name: `Select ${label}` });
    await user.click(await within(table).findByRole("button", { name: "Select Former Staff" }));
    expect(within(dialog).getByLabelText(label)).toHaveValue("Former Staff");
  }
  await user.click(within(dialog).getByRole("button", { name: "Apply" }));
  await waitFor(() => expect(request.mock.calls.at(-1)![0]).toContain("filters="));
  const filters = JSON.parse(new URL(request.mock.calls.at(-1)![0], "http://localhost").searchParams.get("filters")!);
  expect(filters).toEqual(["assignedToUserPublicId", "performedByUserPublicId"].map((field) => ({ field, condition: "EQUAL", value: historical.publicId })));
  const paths = request.mock.calls.map(([path]) => path);
  expect(paths.some((path) => path.includes("/api/users/assignable"))).toBe(false);
  for (const reference of ["assignedTo", "performedBy"]) {
    expect(paths.some((path) => path.startsWith(`${role === "REQUESTER" ? "/api/users/me" : "/api"}/tickets/${ticket.publicId}/actions/filter-users?`) && new URL(path, "http://localhost").searchParams.get("reference") === reference)).toBe(true);
  }
});

it.each(["REQUESTER", "IT_STAFF", "ADMINISTRATOR"])("%s historical-user Lookups reorder rows when Role header is clicked twice", async (role) => {
  const userEvent = (await import("@testing-library/user-event")).default;
  const { waitFor } = await import("@testing-library/react");
  auth.user = { ...staff, role }; request.mockReset();
  const former = { publicId: "10000000-0000-4000-8000-000000000003", name: "Former Staff", role: "REQUESTER" };
  const administrator = { publicId: "10000000-0000-4000-8000-000000000004", name: "Administrator", role: "ADMINISTRATOR" };
  const secondStaff = { ...staff, publicId: "10000000-0000-4000-8000-000000000002", name: "Second Staff" };
  request.mockImplementation(async (path, init) => {
    if (!path.includes("/filter-users?")) return paged([action], init);
    const sort = new URL(path, "http://localhost").searchParams.get("sort");
    const rows = sort === "role:asc" ? [former, staff, secondStaff, administrator]
      : sort === "role:desc" ? [administrator, staff, secondStaff, former]
      : [administrator, staff, former, secondStaff];
    return paged(rows, init);
  });
  const user = userEvent.setup();
  render(<MemoryRouter><NavigationGuardProvider><ActionsTaken ticket={ticket} /></NavigationGuardProvider></MemoryRouter>);
  await screen.findByRole("table", { name: "Actions Taken" });
  await user.click(screen.getByRole("button", { name: /^Filters/ }));
  const dialog = screen.getByRole("dialog", { name: "Filter Actions" });
  for (const label of ["Assigned To", "Performed By"]) {
    await user.click(within(dialog).getByRole("button", { name: `Lookup ${label}` }));
    const lookup = screen.getByRole("dialog", { name: `Select ${label}` });
    await within(lookup).findByRole("table", { name: `Select ${label}` });
    for (const [direction, names] of [
      ["asc", ["Select Former Staff", "Select Alex Staff", "Select Second Staff", "Select Administrator"]],
      ["desc", ["Select Administrator", "Select Alex Staff", "Select Second Staff", "Select Former Staff"]],
    ] as const) {
      const table = within(lookup).getByRole("table", { name: `Select ${label}` });
      await user.click(within(table).getByRole("columnheader", { name: "Role" }));
      await waitFor(() => {
        const latest = new URL(request.mock.calls.at(-1)![0], "http://localhost");
        expect(latest.pathname).toBe(`${role === "REQUESTER" ? "/api/users/me" : "/api"}/tickets/${ticket.publicId}/actions/filter-users`);
        expect(latest.searchParams.get("reference")).toBe(label === "Assigned To" ? "assignedTo" : "performedBy");
        expect(latest.searchParams.get("sort")).toBe(`role:${direction}`);
        expect(within(within(lookup).getByRole("table", { name: `Select ${label}` })).getAllByRole("button", { name: /^Select / }).map((button) => button.getAttribute("aria-label"))).toEqual(names);
      });
      expect(within(lookup).queryByRole("alert")).not.toBeInTheDocument();
    }
    await user.click(within(lookup).getByRole("button", { name: "Cancel" }));
  }
});
it("UI-07 late Action page cannot overwrite newer resolution gate or report after unmount", async () => {
  const { act, waitFor } = await import("@testing-library/react");
  auth.user = staff; request.mockReset(); const gate = vi.fn();
  let release!: () => void; let pending = true;
  const held = new Promise<void>((resolve) => { release = resolve; });
  request.mockImplementation(async (_path, init) => {
    if (pending) { pending = false; await held; return paged([action], init); }
    return paged([{ ...action, status: "COMPLETED", isMigrated: false }], init);
  });
  const view = (refreshTrigger: number) => <MemoryRouter><ActionsTaken ticket={ticket} refreshTrigger={refreshTrigger} onResolutionGate={gate} /></MemoryRouter>;
  const rendered = render(view(0));
  await waitFor(() => expect(request).toHaveBeenCalledOnce());
  rendered.rerender(view(1));
  await waitFor(() => expect(gate).toHaveBeenCalledWith(true));
  await act(async () => { release(); await held; });
  expect(gate.mock.calls).toEqual([[true]]);
  pending = true;
  let releaseUnmount!: () => void;
  const unmountHeld = new Promise<void>((resolve) => { releaseUnmount = resolve; });
  request.mockImplementation(async (_path, init) => { await unmountHeld; return paged([action], init); });
  rendered.rerender(view(2));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(3));
  rendered.unmount();
  await act(async () => { releaseUnmount(); await unmountHeld; });
  expect(gate.mock.calls).toEqual([[true]]);
});
