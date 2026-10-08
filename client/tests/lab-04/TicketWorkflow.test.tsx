import { beforeEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import StaffTicketDetail from "../../src/modules/Tickets/Staff/StaffTicketDetail.js";
import { ApiResponseError, type ApiRequestInit } from "../../src/api.js";
import { ticket, action, staff, paged } from "./fixtures.js";
const { callApi, auth } = vi.hoisted(() => ({ callApi: vi.fn(), auth: { user: { publicId: "", role: "IT_STAFF" } } }));
vi.mock("../../src/auth/useAuthenticatedApi.js", () => ({ useAuthenticatedApi: () => callApi, useAuthenticatedBlob: () => vi.fn() }));
vi.mock("../../src/auth/AuthProvider.js", () => ({ useAuth: () => auth }));
let current = { ...ticket, currentStatus: "IN_PROGRESS" as typeof ticket.currentStatus, itPriority: "HIGH" as const, requesterResolutionConfirmedAt: null };
let actions = [{ ...action, status: "COMPLETED" as typeof action.status }];
beforeEach(() => {
  vi.clearAllMocks(); auth.user = staff;
  current = { ...ticket, currentStatus: "IN_PROGRESS", itPriority: "HIGH", requesterResolutionConfirmedAt: null };
  actions = [{ ...action, status: "COMPLETED" }];
  callApi.mockImplementation(async (path: string, init?: ApiRequestInit) => {
    if (path.includes("/actions")) return paged(actions, init);
    if (path.includes("/activity")) return paged([], init);
    if (path.includes("/comments") || path.includes("/internal-notes")) return { items: [], pagination: { pageNumber: 1, pageSize: 10, totalItems: 0, totalPages: 0 } };
    return current;
  });
});
function show() { render(<MemoryRouter initialEntries={[`/staff/tickets/${ticket.publicId}`]}><Routes><Route path="/staff/tickets/:publicId" element={<StaffTicketDetail />} /></Routes></MemoryRouter>); }
it("UI-07 Admin non-owner has Claim/Priority/Cancel but no owner-only lifecycle or reassignment", async () => {
  auth.user = { publicId: "admin", role: "ADMINISTRATOR" }; current = { ...current, owner: null, currentStatus: "NEW" };
  show(); await screen.findByRole("heading", { name: ticket.ticketNumber });
  expect(screen.getByRole("button", { name: "Claim Ticket" })).toBeEnabled();
  expect(screen.getByLabelText("IT Priority")).toBeEnabled();
  expect(screen.getByRole("button", { name: "Cancel Ticket" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Start Work" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Change Owner" })).not.toBeInTheDocument();
});
it.each(["PLANNED", "IN_PROGRESS", "migrated only", "zero"])("UI-07 known %s dataset prevents obvious resolution", async (dataset) => {
  actions = dataset === "zero" ? [] : [{ ...action, status: dataset === "migrated only" ? "COMPLETED" : dataset as typeof action.status, isMigrated: dataset === "migrated only" }];
  show(); await screen.findByRole("heading", { name: ticket.ticketNumber });
  await waitFor(() => expect(screen.getByRole("button", { name: "Mark Resolved" })).toBeDisabled());
  expect(screen.getByText(/Migrated historical Actions do not count as new work/)).toBeVisible();
});
it.each(["PLANNED", "IN_PROGRESS"] as const)("UI-07 filtered open %s Actions still prevent resolution", async (status) => {
  actions = [{ ...action, status }];
  show(); const user = userEvent.setup();
  await screen.findByRole("heading", { name: ticket.ticketNumber });
  await waitFor(() => expect(screen.getByRole("button", { name: "Mark Resolved" })).toBeDisabled());
  await user.click(screen.getByRole("button", { name: /^Filters/ }));
  const dialog = screen.getByRole("dialog", { name: "Filter Actions" });
  await user.selectOptions(within(dialog).getByLabelText("Status"), status);
  await user.click(within(dialog).getByRole("button", { name: "Apply" }));
  await screen.findByRole("button", { name: `Remove filter Status: ${status}` });
  await screen.findByRole("table", { name: "Actions Taken" });
  expect(screen.getByRole("button", { name: "Mark Resolved" })).toBeDisabled();
  expect(screen.getByText(/Migrated historical Actions do not count as new work/)).toBeVisible();
});
it("UI-07 stale gate gives explanatory Refresh without success, then retries and refreshes summary/Actions/Activity", async () => {
  const original = callApi.getMockImplementation()!; let reject = true;
  callApi.mockImplementation(async (path: string, init?: ApiRequestInit) => {
    if (path.endsWith("/mark-resolved")) {
      if (reject) throw new ApiResponseError(409, "INVALID_STATUS_TRANSITION", []);
      current = { ...current, currentStatus: "RESOLVED" }; return current;
    }
    return original(path, init);
  });
  show(); const user = userEvent.setup();
  await screen.findByRole("heading", { name: ticket.ticketNumber });
  await user.click(screen.getByRole("button", { name: "Mark Resolved" }));
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Mark Resolved" }));
  expect(screen.queryByText("Ticket updated.")).not.toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("Migrated historical Actions do not count as new work");
  await user.click(screen.getByRole("button", { name: "Refresh Ticket" }));
  reject = false;
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Mark Resolved" }));
  await screen.findByText("Ticket updated.");
  expect(screen.getByText("RESOLVED", { exact: true })).toBeVisible();
  expect(callApi.mock.calls.filter(([path, init]) => path === `/api/tickets/${ticket.publicId}` && !init?.method).length).toBeGreaterThanOrEqual(3);
  expect(callApi.mock.calls.filter(([path]) => path.includes("/actions?")).length).toBeGreaterThanOrEqual(2);
  expect(callApi.mock.calls.filter(([path]) => path.includes("/activity?")).length).toBeGreaterThanOrEqual(2);
});
it("UI-07 Request Information conflict refresh preserves entered message", async () => {
  current = { ...current, currentStatus: "OPEN" }; const original = callApi.getMockImplementation()!;
  callApi.mockImplementation(async (path: string, init?: ApiRequestInit) => {
    if (path.endsWith("/request-information")) throw new ApiResponseError(409, "INVALID_STATUS_TRANSITION", []);
    return original(path, init);
  });
  show(); const user = userEvent.setup(); await screen.findByRole("heading", { name: ticket.ticketNumber });
  await user.click(screen.getByRole("button", { name: "Request Information" }));
  await user.type(screen.getByLabelText("Message *"), "Keep these diagnostic details");
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Request Information" }));
  await user.click(screen.getByRole("button", { name: "Refresh Ticket" }));
  expect(screen.getByLabelText("Message *")).toHaveValue("Keep these diagnostic details");
  expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Request Information" })).toBeEnabled();
});
it.each([
  ["IT_STAFF", "ownership"], ["ADMINISTRATOR", "ownership"],
  ["IT_STAFF", "status"], ["ADMINISTRATOR", "status"],
] as const)("UI-07 %s Request Information refresh preserves draft but blocks retry after %s changes", async (role, change) => {
  auth.user = { ...staff, role }; current = { ...current, currentStatus: "OPEN" };
  const original = callApi.getMockImplementation()!;
  callApi.mockImplementation(async (path: string, init?: ApiRequestInit) => {
    if (path.endsWith("/request-information")) {
      current = change === "ownership"
        ? { ...current, owner: { ...staff, publicId: "other-owner" } }
        : { ...current, currentStatus: "WAITING_FOR_REQUESTER" };
      throw new ApiResponseError(change === "ownership" ? 403 : 409, change === "ownership" ? "FORBIDDEN" : "INVALID_STATUS_TRANSITION", []);
    }
    return original(path, init);
  });
  show(); const user = userEvent.setup(); await screen.findByRole("heading", { name: ticket.ticketNumber });
  await user.click(screen.getByRole("button", { name: "Request Information" }));
  const message = screen.getByLabelText("Message *");
  await user.type(message, "Keep these diagnostic details");
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Request Information" }));
  await user.click(screen.getByRole("button", { name: "Refresh Ticket" }));
  expect(message).toHaveValue("Keep these diagnostic details");
  expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Request Information" })).toBeDisabled();
  await act(async () => { fireEvent.submit(message.closest("form")!); });
  expect(callApi.mock.calls.filter(([path]) => path.endsWith("/request-information"))).toHaveLength(1);
  expect(screen.queryByText("Ticket updated.")).not.toBeInTheDocument();
});
it("UI-07 refreshed open Action gate blocks pending resolution confirmation", async () => {
  const original = callApi.getMockImplementation()!;
  callApi.mockImplementation(async (path: string, init?: ApiRequestInit) => {
    if (path.endsWith("/mark-resolved")) {
      actions = [{ ...action, status: "PLANNED" }];
      throw new ApiResponseError(409, "INVALID_STATUS_TRANSITION", []);
    }
    return original(path, init);
  });
  show(); const user = userEvent.setup(); await screen.findByRole("heading", { name: ticket.ticketNumber });
  await user.click(screen.getByRole("button", { name: "Mark Resolved" }));
  const dialog = screen.getByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Mark Resolved" }));
  await user.click(screen.getByRole("button", { name: "Refresh Ticket" }));
  await screen.findByRole("table", { name: "Actions Taken" });
  expect(within(dialog).getByRole("button", { name: "Mark Resolved" })).toBeDisabled();
  expect(screen.queryByText("Ticket updated.")).not.toBeInTheDocument();
});
