import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { ActivityTimeline } from "../../src/modules/Actions/ActivityTimeline.js";
import { ticket, action, staff, paged } from "./fixtures.js";
const { request, auth } = vi.hoisted(() => ({ request: vi.fn(), auth: { user: { role: "IT_STAFF" } } }));
vi.mock("../../src/auth/useAuthenticatedApi.js", () => ({ useAuthenticatedApi: () => request }));
vi.mock("../../src/auth/AuthProvider.js", () => ({ useAuth: () => auth }));
it("Action history requests oldest-first ten, appends Load More; Ticket filter maps category and renders Requester advisory truthfully", async () => {
  auth.user.role = "IT_STAFF";
  const event = { publicId: "event-1", ticketPublicId: ticket.publicId, action: "ACTION_CREATED", performedBy: { ...staff, isSystem: false }, createdAt: ticket.createdAt };
  request.mockImplementation(async (path, init) => {
    const query = new URL(path, "http://localhost").searchParams;
    const second = query.get("pageNumber") === "2";
    return paged([{ ...event, publicId: second ? "event-2" : "event-1", action: second ? "ACTION_STARTED" : "ACTION_CREATED" }], init, 11, second ? 2 : 1);
  });
  const user = userEvent.setup();
  const rendered = render(<MemoryRouter><ActivityTimeline ticketPublicId={ticket.publicId} actionPublicId={action.publicId} /></MemoryRouter>);
  expect(await screen.findByText("Alex Staff created an Action.")).toBeInTheDocument();
  expect(request.mock.calls[0][0]).toContain("sort=createdAt%3Aasc&pageNumber=1&pageSize=10");
  await user.click(screen.getByRole("button", { name: "Load More" }));
  expect(await screen.findByText("Alex Staff started an Action.")).toBeInTheDocument();
  expect(screen.getByText("Alex Staff created an Action.")).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument(); rendered.unmount();
  request.mockReset(); request.mockImplementation(async (_path, init) => paged([{ ...event, action: "REQUESTER_RESOLUTION_CONFIRMED", performedBy: { ...staff, name: "Requester", role: "REQUESTER" } }], init));
  render(<MemoryRouter><ActivityTimeline ticketPublicId={ticket.publicId} /></MemoryRouter>);
  expect(await screen.findByText("Requester confirmed the problem appears resolved.")).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Activity category"), "Ticket Workflow");
  await waitFor(() => expect(JSON.parse(new URL(request.mock.calls.at(-1)![0], "http://localhost").searchParams.get("filters")!)).toEqual([{ field: "category", condition: "EQUAL", value: "Ticket Workflow" }]));
});

it("Requester performs no internal read; Load More failure keeps prior events and retries the same page", async () => {
  auth.user.role = "REQUESTER"; request.mockReset();
  const rendered = render(<MemoryRouter><ActivityTimeline ticketPublicId={ticket.publicId} /></MemoryRouter>);
  expect(request).not.toHaveBeenCalled(); expect(screen.queryByRole("heading", { name: "Activity" })).not.toBeInTheDocument();
  rendered.unmount(); auth.user.role = "IT_STAFF";
  let failed = false;
  request.mockImplementation(async (path, init) => {
    const second = new URL(path, "http://localhost").searchParams.get("pageNumber") === "2";
    if (second && !failed) { failed = true; throw new Error("private database details"); }
    return paged([{ publicId: second ? "event-2" : "event-1", ticketPublicId: ticket.publicId, action: second ? "ACTION_STARTED" : "ACTION_CREATED", performedBy: { ...staff, isSystem: false }, createdAt: ticket.createdAt }], init, 11, second ? 2 : 1);
  });
  const user = userEvent.setup(); render(<MemoryRouter><ActivityTimeline ticketPublicId={ticket.publicId} actionPublicId={action.publicId} /></MemoryRouter>);
  await screen.findByText("Alex Staff created an Action.");
  await user.click(screen.getByRole("button", { name: "Load More" }));
  expect(screen.getByText("Alex Staff created an Action.")).toBeInTheDocument();
  expect(screen.queryByText("private database details")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Alex Staff started an Action.")).toBeInTheDocument();
  expect(request.mock.calls.at(-1)![0]).toContain("pageNumber=2");
});

it("Action references do not invent assignment changes; migration renders snapshots without invented transitions", async () => {
  auth.user.role = "IT_STAFF"; request.mockReset();
  request.mockImplementation(async (_path, init) => paged([
    { publicId: "created", ticketPublicId: ticket.publicId, action: "ACTION_CREATED", performedBy: { ...staff, isSystem: false }, actionTaken: { publicId: action.publicId, previousAssignedTo: null, assignedTo: null }, createdAt: ticket.createdAt },
    { publicId: "migration", ticketPublicId: ticket.publicId, action: "MIGRATED_TICKET_SNAPSHOT", performedBy: { ...staff, isSystem: true }, assignment: { previousAssignedTo: null, assignedTo: staff }, statusChange: { previousStatus: null, status: "OPEN" }, priorityChange: { previousPriority: null, priority: "HIGH" }, createdAt: ticket.createdAt },
  ], init));
  render(<MemoryRouter><ActivityTimeline ticketPublicId={ticket.publicId} /></MemoryRouter>);
  await screen.findByText("Alex Staff created an Action.");
  expect(screen.queryByText("Assignee: Unassigned to Unassigned.")).not.toBeInTheDocument();
  expect(screen.getByText("Owner at migration: Alex Staff.")).toBeInTheDocument();
  expect(screen.getByText("Status at migration: OPEN.")).toBeInTheDocument();
  expect(screen.getByText("IT Priority at migration: HIGH.")).toBeInTheDocument();
});
