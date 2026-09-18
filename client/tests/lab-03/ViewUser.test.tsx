import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { ApiResponseError } from "../../src/api.js";
import ViewUser from "../../src/pages/ViewUser.js";

const { callApi } = vi.hoisted(() => ({ callApi: vi.fn() }));

vi.mock("../../src/auth/useAuthenticatedApi.js", () => ({
  useAuthenticatedApi: () => callApi,
}));

vi.mock("../../src/auth/AuthProvider.js", () => ({
  useAuth: () => ({
    user: {
      publicId: "admin-1",
      email: "admin@toktick.it",
      name: "Admin Lead",
      role: "ADMINISTRATOR",
    },
  }),
}));

function renderViewUser(publicId = "user-2") {
  return render(
    <MemoryRouter initialEntries={[`/admin/users/${publicId}`]}>
      <Routes>
        <Route path="/admin/users" element={<div>User Management List</div>} />
        <Route path="/admin/users/:publicId" element={<ViewUser />} />
        <Route path="/admin/users/:publicId/edit" element={<div>Edit User Page</div>} />
        <Route path="/error" element={<div>Error Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ViewUser page @issue-6", () => {
  beforeEach(() => {
    callApi.mockReset();
  });

  it("renders user details in disabled form controls with edit and back links", async () => {
    callApi.mockResolvedValueOnce({
      publicId: "user-2",
      name: "Bob Staff",
      email: "bob@example.test",
      role: "IT_STAFF",
      isActive: true,
    });

    renderViewUser("user-2");

    expect(await screen.findByRole("heading", { name: "Bob Staff" })).toBeInTheDocument();
    expect(screen.getByText("User Detail")).toBeInTheDocument();

    // Check action links
    const backLink = screen.getByRole("link", { name: "Back to Users" });
    expect(backLink).toHaveAttribute("href", "/admin/users");

    const editLink = screen.getByRole("link", { name: "Edit User" });
    expect(editLink).toHaveAttribute("href", "/admin/users/user-2/edit");

    // Form inputs should be populated and disabled (mode="view")
    const nameInput = screen.getByLabelText("Name");
    expect(nameInput).toHaveValue("Bob Staff");
    expect(nameInput).toBeDisabled();

    const emailInput = screen.getByLabelText("Email");
    expect(emailInput).toHaveValue("bob@example.test");
    expect(emailInput).toBeDisabled();

    const roleSelect = screen.getByLabelText("Role");
    expect(roleSelect).toHaveValue("IT_STAFF");
    expect(roleSelect).toBeDisabled();

    const activeSwitch = screen.getByLabelText("Active");
    expect(activeSwitch).toBeChecked();
    expect(activeSwitch).toBeDisabled();

    // No submit button should be rendered in mode="view"
    expect(screen.queryByRole("button", { name: /save|create/i })).not.toBeInTheDocument();
  });

  it("handles 404 not found by navigating to error page", async () => {
    callApi.mockRejectedValueOnce(
      new ApiResponseError(404, "NOT_FOUND", []),
    );

    renderViewUser("unknown-user");

    expect(await screen.findByText("Error Page")).toBeInTheDocument();
  });

  it("displays error with retry button on unexpected load failure", async () => {
    callApi.mockRejectedValueOnce(new Error("Network disconnect"));

    renderViewUser("user-2");

    expect(await screen.findByText("Failed to load user details.")).toBeInTheDocument();

    callApi.mockResolvedValueOnce({
      publicId: "user-2",
      name: "Bob Staff",
      email: "bob@example.test",
      role: "IT_STAFF",
      isActive: true,
    });

    await userEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(await screen.findByRole("heading", { name: "Bob Staff" })).toBeInTheDocument();
  });
});
