import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { ActionAssigneeSelection } from "../../src/modules/Actions/ActionAssigneeSelection.js";
import { action, other, paged } from "./fixtures.js";
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../../src/auth/useAuthenticatedApi.js", () => ({ useAuthenticatedApi: () => request }));
it("Reassign selects global user then confirms persisted assignment with expectedVersion; Unassign separately confirms null", async () => {
  request.mockImplementation(async (path, init) => path.includes("assignable") ? paged([other], init) : { ...action, assignedTo: other });
  const user = userEvent.setup(); const saved = vi.fn(); const close = vi.fn();
  const rendered = render(<MemoryRouter><ActionAssigneeSelection action={action} onSaved={saved} onClose={close} /></MemoryRouter>);
  await user.click((await screen.findAllByRole("button", { name: "Select Other Staff" }))[0]);
  const dialog = screen.getByRole("dialog", { name: "Assign this Action to Other Staff?" });
  expect(request.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(0);
  await user.click(within(dialog).getByRole("button", { name: "Assign" }));
  expect(JSON.parse(request.mock.calls.at(-1)![1].body)).toEqual({ assignedToUserPublicId: other.publicId, expectedVersion: 2 });
  expect(saved).toHaveBeenCalled(); rendered.unmount();
  render(<MemoryRouter><ActionAssigneeSelection action={action} unassign onSaved={saved} onClose={close} /></MemoryRouter>);
  await user.click(screen.getByRole("button", { name: "Unassign" }));
  expect(JSON.parse(request.mock.calls.at(-1)![1].body)).toEqual({ assignedToUserPublicId: null, expectedVersion: 2 });
});

it("Invalid selection reloads eligibility; conflict preserves selection and retries only after latest version", async () => {
  const { ApiResponseError } = await import("../../src/api.js");
  request.mockReset(); let attempts = 0;
  request.mockImplementation(async (path, init) => {
    if (path.includes("assignable")) return paged([other], init);
    if (init?.method === "PATCH") { attempts++; if (attempts === 1) throw new ApiResponseError(400, "VALIDATION_ERROR", []); if (attempts === 2) throw new ApiResponseError(409, "CONFLICT", []); return { ...action, assignedTo: other, version: 4 }; }
    return { ...action, version: 3 };
  });
  const user = userEvent.setup(); const saved = vi.fn();
  render(<MemoryRouter><ActionAssigneeSelection action={action} onSaved={saved} onClose={vi.fn()} /></MemoryRouter>);
  await user.click((await screen.findAllByRole("button", { name: "Select Other Staff" }))[0]);
  await user.click(screen.getByRole("button", { name: "Assign" }));
  expect(screen.getByRole("button", { name: "Assign" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Choose another User" }));
  await user.click((await screen.findAllByRole("button", { name: "Select Other Staff" }))[0]);
  expect(request.mock.calls.filter(([path]) => path.includes("assignable"))).toHaveLength(2);
  await user.click(screen.getByRole("button", { name: "Assign" }));
  await user.click(screen.getByRole("button", { name: "Reload latest" }));
  expect(screen.getByText(/Selected User: Other Staff/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Assign" }));
  expect(JSON.parse(request.mock.calls.at(-1)![1].body)).toEqual({ assignedToUserPublicId: other.publicId, expectedVersion: 3 });
  expect(saved).toHaveBeenCalled();
});
