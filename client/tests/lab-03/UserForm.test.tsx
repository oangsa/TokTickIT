import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";
import CreateUser from "../../src/pages/CreateUser.js";
import EditUser from "../../src/pages/EditUser.js";
import { ApiResponseError } from "../../src/api.js";
import { NavigationGuardProvider } from "../../src/navigation/NavigationGuard.js";

const { callApi, auth, logout } = vi.hoisted(() => ({
  callApi: vi.fn(),
  auth: { user: { publicId: "admin-1", name: "Admin Lead", role: "ADMINISTRATOR" } },
  logout: vi.fn(),
}));

vi.mock("../../src/auth/useAuthenticatedApi.js", () => ({
  useAuthenticatedApi: () => callApi,
}));
vi.mock("../../src/auth/AuthProvider.js", () => ({
  useAuth: () => ({ ...auth, logout }),
}));

function renderUserPage(initialEntry: string) {
  // Match the existing data-router harness: Node Request cannot consume
  // jsdom AbortSignal. These mocked API tests have no router loaders to abort.
  const NativeRequest = globalThis.Request;
  vi.stubGlobal("Request", class TestRequest extends NativeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      super(input, init === undefined ? undefined : { ...init, signal: undefined });
    }
  });
  const router = createMemoryRouter([{
    element: <NavigationGuardProvider enableHistoryBlocking><Outlet /></NavigationGuardProvider>,
    children: [
      { path: "/admin/users/new", element: <CreateUser /> },
      { path: "/admin/users/:publicId/edit", element: <EditUser /> },
      { path: "/admin/users", element: <div>User List Page</div> },
      { path: "/login", element: <div>Login Page</div> },
    ],
  }], { initialEntries: [initialEntry] });
  return render(<RouterProvider router={router} />);
}

function renderCreateUser() {
  return renderUserPage("/admin/users/new");
}

function renderEditUser(publicId = "user-2") {
  return renderUserPage(`/admin/users/${publicId}/edit`);
}

describe("UserForm tests (CreateUser and EditUser) @issue-6", () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = { publicId: "admin-1", name: "Admin Lead", role: "ADMINISTRATOR" };
  });

  describe("UI-27 Create User CommonForm and one-time password view", () => {
    it("submits valid user and presents one-time initial password panel with Copy button", async () => {
      callApi.mockImplementation(async (path: string, init?: any) => {
        if (path === "/api/admin/users" && init?.method === "POST") {
          return {
            user: { publicId: "user-new", name: "New Colleague", email: "new@example.test", role: "IT_STAFF", isActive: true },
            initialPassword: "<INITIAL_PASSWORD>",
          };
        }
        return {};
      });

      renderCreateUser();
      expect(screen.getByRole("heading", { name: "Create User" })).toBeInTheDocument();
      expect(screen.getByText("Create an account for TokTickIT.")).toBeInTheDocument();
      expect(screen.queryByText("User Management")).not.toBeInTheDocument();

      await userEvent.type(screen.getByLabelText(/^Name/i), "New Colleague");
      await userEvent.type(screen.getByLabelText(/^Email/i), "new@example.test");
      await userEvent.selectOptions(screen.getByLabelText(/Role/i), "IT_STAFF");

      await userEvent.click(screen.getByRole("button", { name: "Create User" }));

      expect(callApi).toHaveBeenCalledWith("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New Colleague",
          email: "new@example.test",
          role: "IT_STAFF",
          isActive: true,
        }),
      });

      // Successful creation displays initial password panel
      expect(await screen.findByRole("heading", { name: "User Created Successfully" })).toBeInTheDocument();
      const passwordInput = screen.getByLabelText("One-time initial password");
      expect(passwordInput).toHaveValue("<INITIAL_PASSWORD>");

      // Copy button
      const copyBtn = screen.getByRole("button", { name: /copy/i });
      expect(copyBtn).toBeInTheDocument();
      await userEvent.click(copyBtn);

      // Done button navigates to /admin/users
      const doneBtn = screen.getByRole("button", { name: "Done" });
      await userEvent.click(doneBtn);
      expect(await screen.findByText("User List Page")).toBeInTheDocument();
    });

    it("maps duplicate email error response to email field error", async () => {
      callApi.mockImplementation(async (path: string, init?: any) => {
        if (path === "/api/admin/users" && init?.method === "POST") {
          throw new ApiResponseError(409, "DUPLICATE_EMAIL", []);
        }
        return {};
      });

      renderCreateUser();

      await userEvent.type(screen.getByLabelText(/^Name/i), "Alice Duplicate");
      await userEvent.type(screen.getByLabelText(/^Email/i), "existing@example.test");
      await userEvent.click(screen.getByRole("button", { name: "Create User" }));

      expect(
        await screen.findByText("A user with this email address already exists."),
      ).toBeInTheDocument();
    });
  });

  describe("UI-28 Edit User fields, self-safety, and session confirmations", () => {
    it("confirms case-only self email change and logs out after saving", async () => {
      callApi.mockImplementation(async (_path: string, init?: RequestInit) => ({
        publicId: "admin-1", name: "Admin Lead",
        email: init?.method === "PATCH" ? "Admin@example.test" : "admin@example.test",
        role: "ADMINISTRATOR", isActive: true,
      }));
      renderEditUser("admin-1");
      await screen.findByRole("heading", { name: "Edit Admin Lead" });
      const email = screen.getByLabelText(/^Email/i);
      await userEvent.clear(email);
      await userEvent.type(email, "Admin@example.test");
      await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));
      const modal = await screen.findByRole("dialog");
      expect(modal).toHaveTextContent("Change user email?");
      expect(logout).not.toHaveBeenCalled();
      await userEvent.click(within(modal).getByRole("button", { name: "Confirm" }));
      await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
      expect(callApi).toHaveBeenCalledWith("/api/admin/users/admin-1", expect.objectContaining({
        method: "PATCH", body: JSON.stringify({ name: "Admin Lead", email: "Admin@example.test", role: "ADMINISTRATOR", isActive: true }),
      }));
    });

    it("loads and displays target user details", async () => {
      callApi.mockImplementation(async (path: string) => {
        if (path === "/api/admin/users/user-2") {
          return {
            publicId: "user-2",
            name: "Bob Staff",
            email: "bob@example.test",
            role: "IT_STAFF",
            isActive: true,
          };
        }
        return {};
      });

      renderEditUser("user-2");
      expect(await screen.findByRole("heading", { name: "Edit Bob Staff" })).toBeInTheDocument();

      expect(screen.getByLabelText(/^Name/i)).toHaveValue("Bob Staff");
      expect(screen.getByLabelText(/^Email/i)).toHaveValue("bob@example.test");
      expect(screen.getByLabelText(/Role/i)).toHaveValue("IT_STAFF");
      expect(screen.getByLabelText(/^Active/i)).toBeChecked();
    });

    it("enforces self-safety when administrator edits their own profile", async () => {
      callApi.mockImplementation(async (path: string) => {
        if (path === "/api/admin/users/admin-1") {
          return {
            publicId: "admin-1",
            name: "Admin Lead",
            email: "admin@example.test",
            role: "ADMINISTRATOR",
            isActive: true,
          };
        }
        return {};
      });

      renderEditUser("admin-1");
      expect(await screen.findByRole("heading", { name: "Edit Admin Lead" })).toBeInTheDocument();

      // Info banner explains self-restrictions
      expect(
        screen.getByText(/You cannot change your own role or deactivate your own account/i),
      ).toBeInTheDocument();

      // Role and Active controls are disabled for self
      expect(screen.getByLabelText(/Role/i)).toBeDisabled();
      expect(screen.getByLabelText(/^Active/i)).toBeDisabled();

      // Reset initial password button is not available for self
      expect(screen.queryByRole("button", { name: "Set New Initial Password" })).not.toBeInTheDocument();
      expect(
        screen.getByText(/An Administrator cannot reset their own initial password/i),
      ).toBeInTheDocument();
    });

    it("prompts session-affecting confirmation modal on role change or deactivation", async () => {
      callApi.mockImplementation(async (path: string, init?: any) => {
        if (path === "/api/admin/users/user-2" && (!init || init.method === undefined)) {
          return {
            publicId: "user-2",
            name: "Bob Staff",
            email: "bob@example.test",
            role: "IT_STAFF",
            isActive: true,
          };
        }
        if (path === "/api/admin/users/user-2" && init?.method === "PATCH") {
          return {
            publicId: "user-2",
            name: "Bob Staff",
            email: "bob@example.test",
            role: "REQUESTER",
            isActive: true,
          };
        }
        return {};
      });

      renderEditUser("user-2");
      expect(await screen.findByRole("heading", { name: "Edit Bob Staff" })).toBeInTheDocument();

      // Change role from IT_STAFF to REQUESTER
      await userEvent.selectOptions(screen.getByLabelText(/Role/i), "REQUESTER");
      await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

      // Modal prompt appears
      const modal = await screen.findByRole("dialog");
      expect(modal).toHaveTextContent(/Change user role\?/i);
      expect(modal).toHaveTextContent(/All active sessions for this User will end/i);

      // Confirm
      await userEvent.click(within(modal).getByRole("button", { name: "Confirm" }));

      await waitFor(() => {
        expect(callApi).toHaveBeenCalledWith(
          "/api/admin/users/user-2",
          expect.objectContaining({
            method: "PATCH",
            body: JSON.stringify({
              name: "Bob Staff",
              email: "bob@example.test",
              role: "REQUESTER",
              isActive: true,
            }),
          }),
        );
      });
    });

    it("prompts confirmation modal on email change before sending PATCH", async () => {
      callApi.mockImplementation(async (path: string, init?: any) => {
        if (path === "/api/admin/users/user-2" && (!init || init.method === undefined)) {
          return {
            publicId: "user-2",
            name: "Bob Staff",
            email: "bob@example.test",
            role: "IT_STAFF",
            isActive: true,
          };
        }
        if (path === "/api/admin/users/user-2" && init?.method === "PATCH") {
          return {
            publicId: "user-2",
            name: "Bob Staff",
            email: "bob.new@example.test",
            role: "IT_STAFF",
            isActive: true,
          };
        }
        return {};
      });

      renderEditUser("user-2");
      expect(await screen.findByRole("heading", { name: "Edit Bob Staff" })).toBeInTheDocument();

      const emailInput = screen.getByLabelText(/Email/i);
      await userEvent.clear(emailInput);
      await userEvent.type(emailInput, "bob.new@example.test");
      await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

      // Modal prompt appears
      const modal = await screen.findByRole("dialog");
      expect(modal).toHaveTextContent(/Change user email\?/i);
      expect(modal).toHaveTextContent(/All active sessions for this User will end/i);

      // Confirm sends PATCH
      await userEvent.click(within(modal).getByRole("button", { name: "Confirm" }));

      await waitFor(() => {
        expect(callApi).toHaveBeenCalledWith(
          "/api/admin/users/user-2",
          expect.objectContaining({
            method: "PATCH",
            body: JSON.stringify({
              name: "Bob Staff",
              email: "bob.new@example.test",
              role: "IT_STAFF",
              isActive: true,
            }),
          }),
        );
      });
    });

    it("preserves unsaved edits after failed PATCH", async () => {
      callApi.mockImplementation(async (path: string, init?: any) => {
        if (path === "/api/admin/users/user-2" && (!init || init.method === undefined)) {
          return {
            publicId: "user-2",
            name: "Original Name",
            email: "bob@example.test",
            role: "IT_STAFF",
            isActive: true,
          };
        }
        if (path === "/api/admin/users/user-2" && init?.method === "PATCH") {
          throw new ApiResponseError(500, "INTERNAL_SERVER_ERROR", []);
        }
        return {};
      });

      renderEditUser("user-2");
      expect(await screen.findByRole("heading", { name: "Edit Original Name" })).toBeInTheDocument();

      const nameInput = screen.getByLabelText(/^Name/i);
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, "Unsaved Change");

      await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

      // Error banner appears
      expect(await screen.findByText(/The request failed \(HTTP 500\)/i)).toBeInTheDocument();

      // Unsaved change is NOT wiped back to Original Name
      expect(nameInput).toHaveValue("Unsaved Change");
    });

    it("distinguishes DUPLICATE_EMAIL from other 409 conflicts", async () => {
      callApi.mockImplementation(async (path: string, init?: any) => {
        if (path === "/api/admin/users/user-2" && (!init || init.method === undefined)) {
          return {
            publicId: "user-2",
            name: "Bob Staff",
            email: "bob@example.test",
            role: "IT_STAFF",
            isActive: true,
          };
        }
        if (path === "/api/admin/users/user-2" && init?.method === "PATCH") {
          throw new ApiResponseError(409, "CONFLICT", []);
        }
        return {};
      });

      renderEditUser("user-2");
      expect(await screen.findByRole("heading", { name: "Edit Bob Staff" })).toBeInTheDocument();

      const nameInput = screen.getByLabelText(/^Name/i);
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, "Bob Updated");

      await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

      // Conflict message is displayed in form error banner, NOT email field
      expect(await screen.findByText(/The request failed \(HTTP 409\)/i)).toBeInTheDocument();
      expect(screen.queryByText(/A user with this email address already exists/i)).not.toBeInTheDocument();
    });
  });

  describe("UI-29 Set New Initial Password UI", () => {
    it("confirms and resets initial password, presenting one-time password view", async () => {
      callApi.mockImplementation(async (path: string, init?: any) => {
        if (path === "/api/admin/users/user-2" && (!init || init.method === undefined)) {
          return {
            publicId: "user-2",
            name: "Bob Staff",
            email: "bob@example.test",
            role: "IT_STAFF",
            isActive: true,
          };
        }
        if (path === "/api/admin/users/user-2/initial-password" && init?.method === "POST") {
          return {
            initialPassword: "<RESET_INITIAL_PASSWORD>",
          };
        }
        return {};
      });

      renderEditUser("user-2");
      expect(await screen.findByRole("heading", { name: "Edit Bob Staff" })).toBeInTheDocument();

      // Click Set New Initial Password
      await userEvent.click(screen.getByRole("button", { name: "Set New Initial Password" }));

      const modal = await screen.findByRole("dialog");
      expect(modal).toHaveTextContent("Set a new initial password?");
      expect(modal).toHaveTextContent(/All active sessions for this User will end/i);

      // Confirm reset
      await userEvent.click(within(modal).getByRole("button", { name: "Set New Initial Password" }));

      expect(callApi).toHaveBeenCalledWith("/api/admin/users/user-2/initial-password", {
        method: "POST",
      });

      // Displays one-time reset password panel
      expect(await screen.findByTestId("reset-initial-password-panel")).toBeInTheDocument();
      expect(screen.getByLabelText("One-time initial password")).toHaveValue("<RESET_INITIAL_PASSWORD>");

      // Done button dismisses panel
      await userEvent.click(screen.getByRole("button", { name: "Done" }));
      expect(screen.queryByTestId("reset-initial-password-panel")).not.toBeInTheDocument();
    });
  });

  describe("UI-31 Dirty Create/Edit User NavigationGuard", () => {
    it("leaves immediately when form is untouched", async () => {
      renderCreateUser();
      expect(screen.getByRole("heading", { name: "Create User" })).toBeInTheDocument();

      // Untouched Cancel button
      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(await screen.findByText("User List Page")).toBeInTheDocument();
    });

    it("triggers discard confirmation modal when form is dirty, allows keep editing or discard", async () => {
      renderCreateUser();
      expect(screen.getByRole("heading", { name: "Create User" })).toBeInTheDocument();

      // Make form dirty
      await userEvent.type(screen.getByLabelText(/^Name/i), "Draft Name");

      // Cancel button triggers modal
      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

      const modal = await screen.findByRole("dialog");
      expect(modal).toHaveTextContent("Discard unsaved changes?");

      // Click Keep Editing -> stays on page
      await userEvent.click(within(modal).getByRole("button", { name: "Keep Editing" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByLabelText(/^Name/i)).toHaveValue("Draft Name");

      // Click Cancel again -> click Discard Changes
      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
      const modalAgain = await screen.findByRole("dialog");
      await userEvent.click(within(modalAgain).getByRole("button", { name: "Discard" }));

      expect(await screen.findByText("User List Page")).toBeInTheDocument();
    });

    it("preserves dirty-navigation protection on EditUser even after password reset", async () => {
      callApi.mockImplementation(async (path: string, init?: any) => {
        if (path === "/api/admin/users/user-2" && (!init || init.method === undefined)) {
          return {
            publicId: "user-2",
            name: "Bob Staff",
            email: "bob@example.test",
            role: "IT_STAFF",
            isActive: true,
          };
        }
        if (path === "/api/admin/users/user-2/initial-password" && init?.method === "POST") {
          return { initialPassword: "<RESET_INITIAL_PASSWORD>" };
        }
        return {};
      });

      renderEditUser("user-2");
      expect(await screen.findByRole("heading", { name: "Edit Bob Staff" })).toBeInTheDocument();

      // Edit name to make form dirty
      const nameInput = screen.getByLabelText(/^Name/i);
      await userEvent.type(nameInput, " Modified");

      // Reset password
      await userEvent.click(screen.getByRole("button", { name: "Set New Initial Password" }));
      const resetModal = await screen.findByRole("dialog");
      await userEvent.click(within(resetModal).getByRole("button", { name: "Set New Initial Password" }));

      // Password panel is now open
      expect(await screen.findByTestId("reset-initial-password-panel")).toBeInTheDocument();

      // Click Cancel button on the page -> dirty discard modal MUST still appear!
      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
      const discardModal = await screen.findByRole("dialog");
      expect(discardModal).toHaveTextContent("Discard unsaved changes?");
      await userEvent.click(within(discardModal).getByRole("button", { name: "Discard" }));
      expect(await screen.findByText("User List Page")).toBeInTheDocument();
    });

    it("resets a blocked route change on Keep Editing and guards the next navigation", async () => {
      renderCreateUser();
      await userEvent.type(screen.getByLabelText(/^Name/i), "Draft Name");
      await userEvent.click(screen.getByRole("link", { name: "Back to Users" }));
      await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Keep Editing" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByLabelText(/^Name/i)).toHaveValue("Draft Name");
      await userEvent.click(screen.getByRole("link", { name: "Back to Users" }));
      await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Discard" }));
      expect(await screen.findByText("User List Page")).toBeInTheDocument();
    });
  });
});
