import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { NavigationGuardProvider } from "../../src/navigation/NavigationGuard.js";
import ActionDetail from "../../src/modules/Actions/ActionDetail.js";
import { ticket, action, staff, other, paged } from "./fixtures.js";
const { request, auth } = vi.hoisted(() => ({ request: vi.fn(), auth: { user: { publicId: "", name: "", role: "IT_STAFF" } } }));
vi.mock("../../src/auth/useAuthenticatedApi.js", () => ({ useAuthenticatedApi: () => request, useAuthenticatedBlob: () => vi.fn() }));
vi.mock("../../src/auth/AuthProvider.js", () => ({ useAuth: () => auth }));
export function showDetail() {
  render(<MemoryRouter initialEntries={[`/staff/tickets/${ticket.publicId}/actions/${action.publicId}`]}><NavigationGuardProvider><Routes><Route path="/staff/tickets/:ticketPublicId/actions/:actionPublicId" element={<ActionDetail />} /><Route path="/error" element={<p>Error page</p>} /></Routes></NavigationGuardProvider></MemoryRouter>);
}
it("Requester sees migrated Completed Action read-only with unknown performer and no Activity request", async () => {
  auth.user = { ...staff, role: "REQUESTER" };
  request.mockImplementation(async (path) => path.includes("/actions/") ? { ...action, status: "COMPLETED", isMigrated: true } : ticket);
  showDetail();
  expect(await screen.findByText(/Migrated Record/)).toBeInTheDocument();
  expect(screen.getByLabelText("Performed By")).toHaveValue("Unknown");
  expect(screen.getByText(/does not satisfy/)).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Attachment Notes" })).toHaveValue("Rack photo");
  for (const name of ["Edit", "Reassign", "Unassign", "Start", "Complete", "Cancel Action"]) expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Activity" })).not.toBeInTheDocument();
  expect(request.mock.calls.some(([path]) => path.includes("/activity"))).toBe(false);
});

it("Staff Start disabled when unassigned; assigned Start confirms and sends expectedVersion with stable retry key", async () => {
  auth.user = staff;
  request.mockReset(); let assigned = false;
  request.mockImplementation(async (path, init) => {
    if (path.includes("/activity")) return paged([], init);
    if (init?.method === "POST") {
      if (request.mock.calls.filter(([, options]) => options?.method === "POST").length === 1) throw new Error("Network unavailable");
      return { ...action, status: "IN_PROGRESS", version: 3 };
    }
    return path.includes("/actions/") ? { ...action, assignedTo: assigned ? staff : null } : ticket;
  });
  const user = userEvent.setup(); const view = showDetail();
  expect(await screen.findByRole("button", { name: "Start" })).toBeDisabled();
  // Re-render the public route with a fresh canonical assigned Action.
  const { cleanup } = await import("@testing-library/react"); cleanup(); assigned = true; showDetail();
  await user.click(await screen.findByRole("button", { name: "Start" }));
  const dialog = screen.getByRole("dialog", { name: "Start this Action?" });
  expect(request.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  await user.click(within(dialog).getByRole("button", { name: "Start Action" }));
  expect(await screen.findByText(/could not be completed/)).toBeInTheDocument();
  await user.click(within(dialog).getByRole("button", { name: "Start Action" }));
  const calls = request.mock.calls.filter(([, init]) => init?.method === "POST");
  expect(JSON.parse(calls[0][1].body)).toEqual({ expectedVersion: 2 });
  expect(calls[0][1].headers["Idempotency-Key"]).toBe(calls[1][1].headers["Idempotency-Key"]);
});

it("Complete validates Result/Follow-Up and sends one atomic request as current Ticket Owner", async () => {
  auth.user = staff; request.mockReset();
  request.mockImplementation(async (path, init) => {
    if (path.includes("/activity")) return paged([], init);
    if (init?.method === "POST") return { ...action, status: "COMPLETED", performedBy: staff, result: "Cable replaced", version: 3 };
    return path.includes("/actions/") ? { ...action, status: "IN_PROGRESS", assignedTo: { ...staff, publicId: "someone-else" } } : ticket;
  });
  const user = userEvent.setup(); showDetail();
  await user.click(await screen.findByRole("button", { name: "Complete" }));
  const dialog = screen.getByRole("dialog", { name: "Complete Action" });
  await user.click(within(dialog).getByRole("button", { name: "Complete Action" }));
  expect(request.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  expect(within(dialog).getByLabelText(/Result/)).toHaveAttribute("aria-invalid", "true");
  await user.type(within(dialog).getByLabelText(/Result/), "Cable replaced");
  await user.click(within(dialog).getByRole("switch", { name: "Follow-Up Required" }));
  await user.type(within(dialog).getByLabelText(/Follow-Up Note/), "Check tomorrow");
  await user.click(within(dialog).getByRole("button", { name: "Complete Action" }));
  const mutations = request.mock.calls.filter(([, init]) => init?.method === "POST");
  expect(mutations).toHaveLength(1); expect(mutations[0][0]).toMatch(/\/complete$/);
  expect(JSON.parse(mutations[0][1].body)).toEqual({ result: "Cable replaced", followUpRequired: true, followUpNote: "Check tomorrow", expectedVersion: 2 });
  expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
});

it("Complete retains an oversized Follow-Up draft but submits without it when Follow-Up is disabled", async () => {
  auth.user = staff; request.mockReset();
  request.mockImplementation(async (path, init) => {
    if (path.includes("/activity")) return paged([], init);
    if (init?.method === "POST") return { ...action, status: "COMPLETED", result: "Cable replaced", version: 3 };
    return path.includes("/actions/") ? { ...action, status: "IN_PROGRESS" } : ticket;
  });
  const user = userEvent.setup(); showDetail();
  await user.click(await screen.findByRole("button", { name: "Complete" }));
  const dialog = screen.getByRole("dialog", { name: "Complete Action" });
  await user.type(within(dialog).getByLabelText(/Result/), "Cable replaced");
  const followUp = within(dialog).getByRole("switch", { name: "Follow-Up Required" });
  await user.click(followUp);
  await user.click(within(dialog).getByLabelText(/Follow-Up Note/));
  await user.paste("x".repeat(2001));
  await user.click(followUp); await user.click(followUp);
  expect(within(dialog).getByLabelText(/Follow-Up Note/)).toHaveValue("x".repeat(2001));
  await user.click(within(dialog).getByRole("button", { name: "Complete Action" }));
  expect(within(dialog).getByLabelText(/Follow-Up Note/)).toHaveAttribute("aria-invalid", "true");
  expect(request.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  await user.click(followUp);
  expect(within(dialog).queryByLabelText(/Follow-Up Note/)).not.toBeInTheDocument();
  await user.click(within(dialog).getByRole("button", { name: "Complete Action" }));
  expect(screen.queryByRole("dialog", { name: "Complete Action" })).not.toBeInTheDocument();
  const mutation = request.mock.calls.find(([, init]) => init?.method === "POST");
  expect(mutation).toBeDefined();
  expect(JSON.parse(mutation![1].body)).toEqual({ result: "Cable replaced", followUpRequired: false, followUpNote: null, expectedVersion: 2 });
});

it("Cancel requires reason, preserves associations and hides all terminal mutation controls", async () => {
  auth.user = staff; request.mockReset();
  request.mockImplementation(async (path, init) => {
    if (path.includes("/activity")) return paged([], init);
    if (init?.method === "POST") return { ...action, status: "CANCELLED", cancellationReason: "Upstream fix", version: 3 };
    return path.includes("/actions/") ? action : ticket;
  });
  const user = userEvent.setup(); showDetail();
  await user.click(await screen.findByRole("button", { name: "Cancel Action" }));
  const dialog = screen.getByRole("dialog", { name: "Cancel Action" });
  await user.click(within(dialog).getByRole("button", { name: "Cancel Action" }));
  expect(request.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  await user.type(within(dialog).getByLabelText(/Cancellation Reason/), "Upstream fix");
  await user.click(within(dialog).getByRole("button", { name: "Cancel Action" }));
  expect(JSON.parse(request.mock.calls.find(([, init]) => init?.method === "POST")![1].body)).toEqual({ cancellationReason: "Upstream fix", expectedVersion: 2 });
  for (const name of ["Edit", "Reassign", "Unassign", "Start", "Complete", "Cancel Action"]) expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
});

it("Complete conflict retains inputs and reloads current Ticket ownership before another attempt", async () => {
  const { ApiResponseError } = await import("../../src/api.js");
  auth.user = staff; request.mockReset(); let changed = false;
  request.mockImplementation(async (path, init) => {
    if (path.includes("/activity")) return paged([], init);
    if (init?.method === "POST") { changed = true; throw new ApiResponseError(409, "CONFLICT", []); }
    return path.includes("/actions/") ? { ...action, status: "IN_PROGRESS", assignedTo: null, version: changed ? 3 : 2 } : { ...ticket, owner: changed ? null : staff };
  });
  const user = userEvent.setup(); showDetail();
  await user.click(await screen.findByRole("button", { name: "Complete" }));
  const dialog = screen.getByRole("dialog", { name: "Complete Action" });
  await user.type(within(dialog).getByLabelText(/Result/), "Preserved completion result");
  await user.click(within(dialog).getByRole("button", { name: "Complete Action" }));
  await user.click(within(dialog).getByRole("button", { name: "Reload latest" }));
  expect(within(dialog).getByLabelText(/Result/)).toHaveValue("Preserved completion result");
  expect(within(dialog).getByRole("button", { name: "Complete Action" })).toBeDisabled();
});

it.each([403, 409])("Lifecycle recovery after %i keeps refreshed Ticket permissions after the modal closes", async (status) => {
  const { ApiResponseError } = await import("../../src/api.js");
  auth.user = staff; request.mockReset(); let changed = false;
  request.mockImplementation(async (path, init) => {
    if (path.includes("/activity")) return paged([], init);
    if (init?.method === "POST") { changed = true; throw new ApiResponseError(status, status === 403 ? "FORBIDDEN" : "CONFLICT", []); }
    return path.includes("/actions/") ? { ...action, status: "IN_PROGRESS", creator: other, assignedTo: other } : { ...ticket, owner: changed ? other : staff };
  });
  const user = userEvent.setup(); showDetail();
  await user.click(await screen.findByRole("button", { name: "Complete" }));
  const dialog = screen.getByRole("dialog", { name: "Complete Action" });
  await user.type(within(dialog).getByLabelText(/Result/), "Preserved completion result");
  await user.click(within(dialog).getByRole("button", { name: "Complete Action" }));
  await user.click(await within(dialog).findByRole("button", { name: "Reload latest" }));
  expect(within(dialog).getByLabelText(/Result/)).toHaveValue("Preserved completion result");
  expect(within(dialog).getByRole("button", { name: "Complete Action" })).toBeDisabled();
  await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
  for (const name of ["Complete", "Edit", "Cancel Action"]) expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reassign" })).toBeEnabled();
});

it.each([403, 404])("Detail sends %i to the safe error route without leaking private API text", async (status) => {
  const { ApiResponseError } = await import("../../src/api.js");
  auth.user = staff; request.mockReset(); request.mockRejectedValue(new ApiResponseError(status, status === 403 ? "FORBIDDEN" : "NOT_FOUND", []));
  showDetail(); expect(await screen.findByText("Error page")).toBeInTheDocument();
  expect(screen.queryByLabelText("Description")).not.toBeInTheDocument();
});
