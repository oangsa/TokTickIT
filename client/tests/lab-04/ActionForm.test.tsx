import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { NavigationGuardProvider } from "../../src/navigation/NavigationGuard.js";
import { ActionForm } from "../../src/modules/Actions/ActionForm.js";
import { ticket, action, staff, paged } from "./fixtures.js";
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../../src/auth/useAuthenticatedApi.js", () => ({ useAuthenticatedApi: () => request }));
vi.mock("../../src/auth/AuthProvider.js", () => ({ useAuth: () => ({ user: staff }) }));
export function showForm(props: Partial<React.ComponentProps<typeof ActionForm>> = {}) {
  return render(<MemoryRouter><NavigationGuardProvider><ActionForm ticket={ticket} onClose={vi.fn()} onSaved={vi.fn()} {...props} /></NavigationGuardProvider></MemoryRouter>);
}
it.each(["Create", "Edit"] as const)("%s validates a retained Follow-Up Note only while Follow-Up is required", async (mode) => {
  request.mockReset(); request.mockResolvedValue(action);
  const user = userEvent.setup(); const saved = vi.fn();
  showForm({ action: mode === "Edit" ? action : undefined, onSaved: saved });
  if (mode === "Create") await user.type(screen.getByLabelText(/Description/), "Inspect cable");
  const followUp = screen.getByRole("switch", { name: "Follow-Up Required" });
  await user.click(followUp);
  await user.click(screen.getByLabelText(/Follow-Up Note/));
  await user.paste("x".repeat(2001));
  await user.click(followUp); await user.click(followUp);
  expect(screen.getByLabelText(/Follow-Up Note/)).toHaveValue("x".repeat(2001));
  const submit = screen.getByRole("button", { name: mode === "Create" ? "Create Action" : "Save Changes" });
  await user.click(submit);
  expect(screen.getByLabelText(/Follow-Up Note/)).toHaveAttribute("aria-invalid", "true");
  expect(request).not.toHaveBeenCalled();
  await user.click(followUp);
  expect(screen.queryByLabelText(/Follow-Up Note/)).not.toBeInTheDocument();
  await user.click(submit);
  expect(saved).toHaveBeenCalledWith(action);
  expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({ followUpRequired: false, followUpNote: null });
});
it("Create defaults current Staff, allows clear, validates conditional follow-up and posts eligible associations only", async () => {
  request.mockReset();
  request.mockImplementation(async (path, init) => path.includes("assignable") ? paged([staff], init) : action);
  const user = userEvent.setup(); showForm();
  expect(screen.getByLabelText("Assigned To")).toHaveValue("Alex Staff");
  expect(screen.queryByLabelText(/^Result/)).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Clear Assigned To" }));
  await user.type(screen.getByLabelText(/Description/), "Inspect cable");
  await user.click(screen.getByRole("switch", { name: "Follow-Up Required" }));
  await user.click(screen.getByRole("button", { name: "Create Action" }));
  expect(request).not.toHaveBeenCalled();
  expect(screen.getByLabelText(/Follow-Up Note/)).toHaveAttribute("aria-invalid", "true");
  await user.type(screen.getByLabelText(/Follow-Up Note/), "Recheck tomorrow");
  await user.click(screen.getByRole("button", { name: "Create Action" }));
  expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ description: "Inspect cable", assignedToUserPublicId: null, followUpRequired: true, followUpNote: "Recheck tomorrow", attachmentNotes: null, attachmentIds: [] });
  expect(request.mock.calls[0][1].headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
});

it("Edit sends expectedVersion separately from assignment, preserves draft on conflict and explicitly reloads canonical version", async () => {
  const { ApiResponseError } = await import("../../src/api.js");
  request.mockReset(); request.mockImplementation(async (path, init) => {
    if (init?.method === "PATCH") throw new ApiResponseError(409, "CONFLICT", []);
    if (path === `/api/tickets/${ticket.publicId}`) return ticket;
    return { ...action, description: "Someone else's update", version: 3 };
  });
  const user = userEvent.setup(); showForm({ action });
  expect(screen.queryByLabelText("Assigned To")).not.toBeInTheDocument();
  const description = screen.getByLabelText(/Description/);
  await user.clear(description); await user.type(description, "My local edit");
  await user.type(screen.getByLabelText("Result"), "Port inspected");
  await user.click(screen.getByRole("button", { name: "Save Changes" }));
  expect(description).toHaveValue("My local edit");
  const body = JSON.parse(request.mock.calls[0][1].body);
  expect(body.expectedVersion).toBe(2); expect(body.result).toBe("Port inspected"); expect(body).not.toHaveProperty("assignedToUserPublicId");
  await user.click(screen.getByRole("button", { name: "Reload latest" }));
  expect(description).toHaveValue("My local edit");
  expect(await screen.findByText("Someone else's update")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Save Changes" }));
  expect(JSON.parse(request.mock.calls.at(-1)![1].body).expectedVersion).toBe(3);
});

it("Attachment picker excludes pending, removed and cross-Ticket files; keeps notes separate and guards dirty close", async () => {
  request.mockReset(); request.mockResolvedValue(action);
  const file = { attachmentId: "40000000-0000-4000-8000-000000000001", ticketPublicId: ticket.publicId, originalName: "rack.png", extension: "png", mimeType: "image/png", sizeBytes: 10, removalReason: null, createdBy: "test", updatedBy: "test", createdAt: ticket.createdAt, updatedAt: ticket.updatedAt, deleted: false };
  const user = userEvent.setup(); const close = vi.fn();
  showForm({ onClose: close, ticket: { ...ticket, attachments: [file, { ...file, attachmentId: "removed", originalName: "removed.png", deleted: true }, { ...file, attachmentId: "pending", originalName: "pending.png", ticketPublicId: null }, { ...file, attachmentId: "cross", originalName: "private.png", ticketPublicId: "another-ticket" }] } });
  await user.click(screen.getByRole("button", { name: "Select existing" }));
  expect(screen.queryByRole("button", { name: /Select (removed|pending|private)/ })).not.toBeInTheDocument();
  await user.click((await screen.findAllByRole("button", { name: "Select rack.png" }))[0]);
  await user.type(screen.getByLabelText(/Description/), "Inspect");
  await user.type(screen.getByLabelText("Attachment Notes"), "Rack evidence");
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(close).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Keep Editing" }));
  await user.click(screen.getByRole("button", { name: "Create Action" }));
  expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({ attachmentNotes: "Rack evidence", attachmentIds: [file.attachmentId] });
});

it("Create preserves a rejected draft and refreshes Ticket eligibility before retrying", async () => {
  const { ApiResponseError } = await import("../../src/api.js");
  request.mockReset(); request.mockImplementation(async (_path, init) => {
    if (init?.method === "POST") throw new ApiResponseError(409, "INVALID_STATUS_TRANSITION", []);
    return { ...ticket, currentStatus: "RESOLVED" };
  });
  const user = userEvent.setup(); showForm();
  await user.type(screen.getByLabelText(/Description/), "Retained creation draft");
  await user.click(screen.getByRole("button", { name: "Create Action" }));
  await user.click(screen.getByRole("button", { name: "Refresh" }));
  expect(request).toHaveBeenCalledWith(`/api/tickets/${ticket.publicId}`);
  expect(screen.getByLabelText(/Description/)).toHaveValue("Retained creation draft");
  expect(screen.getByRole("button", { name: "Create Action" })).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent("Ticket is no longer eligible");
});

it("Create retains UUID across identical recoverable retries, changes key with input, and maps server fields", async () => {
  const { ApiResponseError } = await import("../../src/api.js");
  request.mockReset(); request.mockRejectedValue(new ApiResponseError(400, "VALIDATION_ERROR", [{ field: "description", message: "Review this description." }]));
  const user = userEvent.setup(); showForm();
  await user.type(screen.getByLabelText(/Description/), "Initial draft");
  await user.click(screen.getByRole("button", { name: "Create Action" }));
  expect(screen.getByLabelText(/Description/)).toHaveValue("Initial draft");
  expect(screen.getByLabelText(/Description/)).toHaveAttribute("aria-invalid", "true");
  await user.click(screen.getByRole("button", { name: "Create Action" }));
  expect(request.mock.calls[1][1].headers["Idempotency-Key"]).toBe(request.mock.calls[0][1].headers["Idempotency-Key"]);
  await user.type(screen.getByLabelText(/Description/), " changed");
  await user.click(screen.getByRole("button", { name: "Create Action" }));
  expect(request.mock.calls[2][1].headers["Idempotency-Key"]).not.toBe(request.mock.calls[0][1].headers["Idempotency-Key"]);
});

it("Pending Create disables local repeated submit and cancel until confirmed response", async () => {
  const { act } = await import("@testing-library/react");
  request.mockReset(); let resolve!: (value: typeof action) => void;
  request.mockImplementation(() => new Promise((done) => { resolve = done; }));
  const user = userEvent.setup(); const saved = vi.fn(); showForm({ onSaved: saved });
  await user.type(screen.getByLabelText(/Description/), "One logical creation");
  await user.dblClick(screen.getByRole("button", { name: "Create Action" }));
  expect(request).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Create Action" })).toBeDisabled();
  await act(async () => resolve(action)); expect(saved).toHaveBeenCalledWith(action);
});
