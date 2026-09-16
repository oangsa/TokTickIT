import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import StaffTicketDetail from "../../src/pages/StaffTicketDetail.js";
import { ApiResponseError } from "../../src/api.js";
import { availableStaffActions, type StaffTicket } from "../../src/tickets/staffTickets.js";
const { callApi, auth } = vi.hoisted(() => ({ callApi: vi.fn(), auth: { user: { publicId: "staff", role: "IT_STAFF" } } }));
vi.mock("../../src/auth/useAuthenticatedApi.js", () => ({ useAuthenticatedApi: () => callApi, useAuthenticatedBlob: () => vi.fn() }));
vi.mock("../../src/auth/AuthProvider.js", () => ({ useAuth: () => auth }));
const ticket: StaffTicket = { publicId: "ticket", ticketNumber: "TKT-20260916-000000000011", requesterId: 1, categoryId: 1, relatedSystemId: 1, requesterName: "Requester", requesterEmail: "requester@example.test", categoryName: "Network", relatedSystemName: "VPN", summary: "VPN unavailable", description: "Details", currentStatus: "OPEN", owner: { publicId: "staff", name: "Staff", role: "IT_STAFF" }, requestedPriority: "HIGH", itPriority: "HIGH", requesterResolutionConfirmedAt: null, createdAt: "2026-09-16T00:00:00Z", updatedAt: "2026-09-16T00:00:00Z", createdBy: "test", updatedBy: "test", deleted: false, attachments: [] };
beforeEach(() => {
  auth.user = { publicId: "staff", role: "IT_STAFF" }; callApi.mockReset();
  callApi.mockImplementation(async (path: string) => path === "/api/users/assignable" ? [{ publicId: "other", name: "Other Staff", role: "IT_STAFF" }] : ticket);
});
function renderDetail() { return render(<MemoryRouter initialEntries={["/staff/tickets/ticket"]}><Routes><Route path="/staff/tickets/:publicId" element={<StaffTicketDetail />} /></Routes></MemoryRouter>); }
describe("UI-16–20/22 Staff Detail @issue-5", () => {
  it("non-owner Admin is operationally read-only and cannot Claim", async () => {
    auth.user = { publicId: "admin", role: "ADMINISTRATOR" };
    renderDetail(); await screen.findByRole("heading", { name: ticket.ticketNumber });
    expect(screen.queryByRole("button", { name: "Change Owner" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start Work" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Claim Ticket" })).not.toBeInTheDocument();
  });
  it("owner lookup confirms reassign and sends displayed expected owner", async () => {
    renderDetail(); await screen.findByRole("heading", { name: ticket.ticketNumber });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Change Owner" }));
    await screen.findByRole("option", { name: "Other Staff (IT STAFF)" });
    await user.selectOptions(screen.getByLabelText("Ticket Owner"), "other");
    await user.click(screen.getByRole("button", { name: "Apply Owner" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Current owner: Staff");
    await user.click(within(dialog).getByRole("button", { name: "Reassign" }));
    await waitFor(() => expect(callApi).toHaveBeenCalledWith("/api/tickets/ticket/owner", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ownerPublicId: "other", expectedOwnerPublicId: "staff" }) }));
  });
  it("conflict preserves current state and requires Reload Ticket", async () => {
    callApi.mockImplementation(async (path: string) => { if (path.endsWith("/start-work")) throw new ApiResponseError(409, "OWNERSHIP_CONFLICT", []); return ticket; });
    renderDetail(); await screen.findByRole("heading", { name: ticket.ticketNumber });
    await userEvent.click(screen.getByRole("button", { name: "Start Work" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ticket ownership changed");
    expect(screen.getByRole("button", { name: "Start Work" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Reload Ticket" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Start Work" })).toBeEnabled());
  });
  it("Request Information requires public message and uses semantic endpoint", async () => {
    renderDetail(); await screen.findByRole("heading", { name: ticket.ticketNumber });
    await userEvent.click(screen.getByRole("button", { name: "Request Information" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Request Information" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Message *"), "Need details");
    await userEvent.click(within(dialog).getByRole("button", { name: "Request Information" }));
    expect(callApi).toHaveBeenCalledWith("/api/tickets/ticket/request-information", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: "Need details" }) });
  });
  it("Close needs confirmation; Cancelled has no lifecycle actions", () => {
    expect(availableStaffActions({ ...ticket, currentStatus: "RESOLVED" }, auth.user)).not.toContain("close");
    expect(availableStaffActions({ ...ticket, currentStatus: "RESOLVED", requesterResolutionConfirmedAt: "2026-09-16T00:00:00Z" }, auth.user)).toContain("close");
    expect(availableStaffActions({ ...ticket, currentStatus: "CANCELLED" }, auth.user)).toEqual([]);
  });
});
