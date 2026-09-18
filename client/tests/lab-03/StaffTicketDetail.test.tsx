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

const ticket: StaffTicket = {
  publicId: "ticket", ticketNumber: "TKT-20260916-000000000011",
  requesterId: 1, categoryId: 1, relatedSystemId: 1, requesterName: "Requester", requesterEmail: "requester@example.test",
  categoryName: "Network", relatedSystemName: "VPN", summary: "VPN unavailable", description: "Details",
  currentStatus: "OPEN", owner: { publicId: "staff", name: "Staff", role: "IT_STAFF" },
  requestedPriority: "HIGH", itPriority: "HIGH", requesterResolutionConfirmedAt: null,
  createdAt: "2026-09-16T00:00:00Z", updatedAt: "2026-09-16T00:00:00Z", createdBy: "test", updatedBy: "test",
  deleted: false, attachments: [],
};

beforeEach(() => {
  auth.user = { publicId: "staff", role: "IT_STAFF" };
  callApi.mockImplementation(async (path: string) => {
    if (path === "/api/users/assignable") return [{ publicId: "other", name: "Other Staff", role: "IT_STAFF" }];
    if (path.includes("/comments") || path.includes("/internal-notes")) {
      return { items: [], pagination: { pageNumber: 1, pageSize: 10, totalPages: 1, totalItems: 0 } };
    }
    return ticket;
  });
});

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={["/staff/tickets/ticket"]}>
      <Routes>
        <Route path="/staff/tickets/:publicId" element={<StaffTicketDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("UI-15–20/22 Staff Detail @issue-5", () => {
  it("UI-15 groups Requester fields as read-only and restricts Admin non-owner controls", async () => {
    auth.user = { publicId: "admin", role: "ADMINISTRATOR" };
    renderDetail();
    await screen.findByRole("heading", { name: ticket.ticketNumber });
    expect(screen.getByLabelText("Requester Name")).toHaveValue("Requester");
    expect(screen.getByLabelText("Requester Name")).toBeDisabled();
    expect(screen.getByLabelText("Requested Priority")).toHaveValue("HIGH");
    expect(screen.getByLabelText("Requested Priority")).toBeDisabled();
    expect(screen.getByText("Ticket operations are read-only unless you are the assigned owner.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change Owner" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("IT Priority")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start Work" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Claim Ticket" })).not.toBeInTheDocument();
  });

  it("UI-15 enables operational controls for assigned Administrator owner", async () => {
    auth.user = { publicId: "admin", role: "ADMINISTRATOR" };
    callApi.mockImplementation(async (path: string) => path === "/api/users/assignable" ? [] : { ...ticket, owner: { publicId: "admin", name: "Admin", role: "ADMINISTRATOR" } });
    renderDetail();
    await screen.findByRole("heading", { name: ticket.ticketNumber });
    expect(screen.getByRole("button", { name: "Change Owner" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change Owner" })).not.toHaveClass("btn-sm");
    expect(screen.getByLabelText("IT Priority")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Work" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Claim Ticket" })).not.toBeInTheDocument();
  });

  it("Finding 1 regression: hides Change Owner on CLOSED and CANCELLED for IT Staff and Admin owner", async () => {
    for (const role of ["IT_STAFF", "ADMINISTRATOR"] as const) {
      for (const currentStatus of ["CLOSED", "CANCELLED"] as const) {
        auth.user = { publicId: role.toLowerCase(), role };
        callApi.mockImplementation(async () => ({
          ...ticket,
          currentStatus,
          owner: { publicId: role.toLowerCase(), name: role, role },
        }));
        const { unmount } = renderDetail();
        await screen.findByRole("heading", { name: ticket.ticketNumber });
        expect(screen.queryByRole("button", { name: "Change Owner" })).not.toBeInTheDocument();
        unmount();
      }
    }
  });

  it("UI-16 allows IT Staff to Claim unassigned Ticket without confirmation dialog", async () => {
    callApi.mockImplementation(async (path: string) => {
      if (path.endsWith("/claim")) return { ...ticket, owner: { publicId: "staff", name: "Staff", role: "IT_STAFF" } };
      return { ...ticket, owner: null };
    });
    renderDetail();
    await screen.findByRole("heading", { name: ticket.ticketNumber });
    const claimBtn = screen.getByRole("button", { name: "Claim Ticket" });
    await userEvent.click(claimBtn);
    expect(callApi).toHaveBeenCalledWith("/api/tickets/ticket/claim", { method: "POST" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Claim Ticket" })).not.toBeInTheDocument());
  });

  it("UI-16 conflict preserves current state and requires Reload Ticket", async () => {
    callApi.mockImplementation(async (path: string) => {
      if (path.endsWith("/start-work")) throw new ApiResponseError(409, "OWNERSHIP_CONFLICT", []);
      return ticket;
    });
    renderDetail();
    await screen.findByRole("heading", { name: ticket.ticketNumber });
    await userEvent.click(screen.getByRole("button", { name: "Start Work" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ticket ownership changed");
    expect(screen.getByRole("button", { name: "Start Work" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Reload Ticket" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Start Work" })).toBeEnabled());
  });

  it("UI-17 owner lookup confirms reassign and sends displayed expected owner", async () => {
    renderDetail();
    await screen.findByRole("heading", { name: ticket.ticketNumber });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Change Owner" }));
    await screen.findByRole("option", { name: "Other Staff (IT STAFF)" });
    await user.selectOptions(screen.getByLabelText("Ticket Owner"), "other");
    await user.click(screen.getByRole("button", { name: "Apply Owner" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Current owner: Staff");
    expect(dialog).toHaveTextContent("New owner: Other Staff");
    await user.click(within(dialog).getByRole("button", { name: "Reassign" }));
    await waitFor(() => expect(callApi).toHaveBeenCalledWith("/api/tickets/ticket/owner", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerPublicId: "other", expectedOwnerPublicId: "staff" }),
    }));
  });

  it("UI-17 unassign confirms side effects and sends null owner", async () => {
    renderDetail();
    await screen.findByRole("heading", { name: ticket.ticketNumber });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Change Owner" }));
    await screen.findByRole("option", { name: "Unassigned" });
    await user.selectOptions(screen.getByLabelText("Ticket Owner"), "");
    await user.click(screen.getByRole("button", { name: "Apply Owner" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("The Ticket will return to the queue without changing its current status.");
    await user.click(within(dialog).getByRole("button", { name: "Unassign" }));
    await waitFor(() => expect(callApi).toHaveBeenCalledWith("/api/tickets/ticket/owner", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerPublicId: null, expectedOwnerPublicId: "staff" }),
    }));
  });

  it("UI-18 handles IT Priority edit, busy state, success alert, and error handling", async () => {
    let resolveMutation: ((val: StaffTicket) => void) | undefined;
    callApi.mockImplementation(async (path: string) => {
      if (path.endsWith("/it-priority")) {
        return new Promise<StaffTicket>((res) => { resolveMutation = res; });
      }
      return ticket;
    });
    renderDetail();
    await screen.findByRole("heading", { name: ticket.ticketNumber });
    const user = userEvent.setup();
    const select = screen.getByLabelText("IT Priority");
    expect(select).toHaveValue("HIGH");
    await user.selectOptions(select, "LOW");
    expect(callApi).toHaveBeenCalledWith("/api/tickets/ticket/it-priority", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itPriority: "LOW" }),
    });
    expect(select).toBeDisabled();
    resolveMutation!({ ...ticket, itPriority: "LOW" });
    expect(await screen.findByText("Ticket updated.")).toBeInTheDocument();
    expect(select).toBeEnabled();

    // Error path
    callApi.mockImplementation(async (path: string) => {
      if (path.endsWith("/it-priority")) throw new ApiResponseError(409, "INVALID_STATUS_TRANSITION", []);
      return { ...ticket, itPriority: "LOW" };
    });
    await user.selectOptions(select, "MEDIUM");
    expect(await screen.findByRole("alert")).toHaveTextContent("This action is no longer valid");
    expect(screen.getByRole("button", { name: "Reload Ticket" })).toBeInTheDocument();
  });

  it("UI-19 displays only permitted semantic action controls without generic status select", async () => {
    renderDetail();
    await screen.findByRole("heading", { name: ticket.ticketNumber });
    expect(screen.queryByLabelText(/Current Status/i)).not.toBeInTheDocument();
    // In OPEN state, owner can Start Work, Request Information, Cancel Ticket
    expect(screen.getByRole("button", { name: "Start Work" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request Information" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel Ticket" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resume Work" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark Resolved" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close Ticket" })).not.toBeInTheDocument();
  });

  it("UI-20 Request Information validates message, submits to endpoint, and updates state", async () => {
    callApi.mockImplementation(async (path: string) => {
      if (path.endsWith("/request-information")) return { ...ticket, currentStatus: "WAITING_FOR_REQUESTER" };
      return ticket;
    });
    renderDetail();
    await screen.findByRole("heading", { name: ticket.ticketNumber });
    await userEvent.click(screen.getByRole("button", { name: "Request Information" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Request Information" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Message *"), "Need details");
    await userEvent.click(within(dialog).getByRole("button", { name: "Request Information" }));
    expect(callApi).toHaveBeenCalledWith("/api/tickets/ticket/request-information", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Need details" }),
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("WAITING FOR REQUESTER")).toBeInTheDocument();
    expect(screen.getByText("Ticket updated.")).toBeInTheDocument();
  });

  it("UI-22 Mark Resolved requires confirmation; Close is gated on Requester confirmation", async () => {
    callApi.mockImplementation(async (path: string) => {
      if (path.endsWith("/mark-resolved")) return { ...ticket, currentStatus: "RESOLVED", requesterResolutionConfirmedAt: null };
      if (path.endsWith("/close")) return { ...ticket, currentStatus: "CLOSED" };
      return { ...ticket, currentStatus: "IN_PROGRESS" };
    });
    renderDetail();
    await screen.findByRole("heading", { name: ticket.ticketNumber });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Mark Resolved" }));
    const resolveDialog = screen.getByRole("dialog");
    expect(resolveDialog).toHaveTextContent("The Requester will be asked to confirm");
    await user.click(within(resolveDialog).getByRole("button", { name: "Mark Resolved" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    // Without requester confirmation on RESOLVED, Close is not present
    expect(screen.queryByRole("button", { name: "Close Ticket" })).not.toBeInTheDocument();

    // With confirmation, Close is available and requires confirmation modal
    callApi.mockImplementation(async () => ({
      ...ticket,
      currentStatus: "RESOLVED",
      requesterResolutionConfirmedAt: "2026-09-16T12:00:00Z",
    }));
    renderDetail();
    const closeBtn = await screen.findByRole("button", { name: "Close Ticket" });
    await user.click(closeBtn);
    const closeDialog = screen.getByRole("dialog");
    expect(closeDialog).toHaveTextContent("The Ticket will be closed after Requester confirmation.");
    await user.click(within(closeDialog).getByRole("button", { name: "Close Ticket" }));
    await waitFor(() => expect(callApi).toHaveBeenCalledWith("/api/tickets/ticket/close", { method: "POST" }));
  });

  it("availableStaffActions helper enforces semantic rules across statuses", () => {
    expect(availableStaffActions({ ...ticket, currentStatus: "RESOLVED" }, auth.user)).not.toContain("close");
    expect(availableStaffActions({ ...ticket, currentStatus: "RESOLVED", requesterResolutionConfirmedAt: "2026-09-16T00:00:00Z" }, auth.user)).toContain("close");
    expect(availableStaffActions({ ...ticket, currentStatus: "CANCELLED" }, auth.user)).toEqual([]);
    expect(availableStaffActions({ ...ticket, currentStatus: "CLOSED" }, auth.user)).toEqual([]);
  });
});

describe("UI-21 Waiting Ticket after Requester comment @issue-6", () => {
  it("renders new Public Comment while status remains Waiting without automatic Resume", async () => {
    const waitingTicket = {
      ...ticket,
      currentStatus: "WAITING_FOR_REQUESTER" as const,
    };
    callApi.mockImplementation(async (path: string) => {
      if (path === "/api/users/assignable") return [];
      if (path.includes("/comments")) {
        return [
          {
            publicId: "c-1",
            content: "Here are the requested logs.",
            author: { publicId: "req-1", name: "Requester", role: "REQUESTER" },
            parentCommentPublicId: null,
            replyTo: null,
            depth: 0,
            replyCount: 0,
            replies: [],
            createdAt: "2026-09-17T10:00:00Z",
          },
        ];
      }
      return waitingTicket;
    });

    renderDetail();
    await screen.findByRole("heading", { name: ticket.ticketNumber });
    expect(screen.getByText("WAITING FOR REQUESTER")).toBeInTheDocument();
    expect(await screen.findByText("Here are the requested logs.")).toBeInTheDocument();

    // Verify status remains WAITING FOR REQUESTER and Resume Work button is explicitly available
    expect(screen.getByText("WAITING FOR REQUESTER")).toBeInTheDocument();
    const resumeBtn = screen.getByRole("button", { name: "Resume Work" });
    expect(resumeBtn).toBeInTheDocument();
    expect(resumeBtn).toBeEnabled();
    // No automatic call to /resume occurred
    expect(callApi).not.toHaveBeenCalledWith(expect.stringContaining("/resume"), expect.anything());
  });
});
