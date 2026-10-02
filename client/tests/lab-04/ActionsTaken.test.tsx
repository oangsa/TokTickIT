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
