import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import UserManagement, { type UserListItem } from "../../src/modules/Users/UserManagement.js";
import App from "../../src/App.js";
import { clearAccessToken } from "../../src/auth/authTransport.js";

const { callApi, auth } = vi.hoisted(() => ({
  callApi: vi.fn(),
  auth: { user: { publicId: "admin-1", name: "Admin Lead", role: "ADMINISTRATOR" } },
}));

vi.mock("../../src/auth/useAuthenticatedApi.js", () => ({
  useAuthenticatedApi: () => callApi,
}));
vi.mock("../../src/auth/AuthProvider.js", () => ({
  useAuth: () => auth,
}));

const mockUsers: UserListItem[] = [
  {
    publicId: "u-1",
    name: "Alice Requester",
    email: "alice@example.test",
    role: "REQUESTER",
    isActive: true,
  },
  {
    publicId: "u-2",
    name: "Bob Staff",
    email: "bob@example.test",
    role: "IT_STAFF",
    isActive: true,
  },
  {
    publicId: "u-3",
    name: "Charlie Admin",
    email: "charlie@example.test",
    role: "ADMINISTRATOR",
    isActive: false,
  },
];

function renderUserManagement() {
  return render(
    <MemoryRouter initialEntries={["/admin/users"]}>
      <Routes>
        <Route path="/admin/users" element={<UserManagement />} />
        <Route path="/admin/users/:publicId" element={<div>View User Page</div>} />
        <Route path="/admin/users/:publicId/edit" element={<div>Edit User Page</div>} />
        <Route path="/admin/users/new" element={<div>Create User Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("UserManagement page @issue-6", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = { publicId: "admin-1", name: "Admin Lead", role: "ADMINISTRATOR" };
    callApi.mockImplementation(async (path: string, init?: any) => {
      if (path.startsWith("/api/admin/users")) {
        init?.onResponse?.({
          headers: new Headers({
            "X-Pagination": JSON.stringify({
              pageNumber: 1,
              pageSize: 10,
              totalItems: 3,
              totalPages: 1,
              hasPreviousPage: false,
              hasNextPage: false,
            }),
          }),
        });
        return {
          items: mockUsers,
          pagination: {
            pageNumber: 1,
            pageSize: 10,
            totalItems: 3,
            totalPages: 1,
          },
        };
      }
      return [];
    });
  });

  describe("UI-26 User Management table, search, role filter, and pagination", () => {
    it("renders table with required columns, user rows, and Edit and View actions", async () => {
      renderUserManagement();
      expect(await screen.findByTestId("user-row-u-1")).toBeInTheDocument();

      // Column headers
      expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Email" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Role" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();

      // User rows
      const table = within(screen.getByTestId("user-table"));
      expect(table.getByText("alice@example.test")).toBeInTheDocument();
      expect(table.getByText("Bob Staff")).toBeInTheDocument();
      expect(table.getByText("bob@example.test")).toBeInTheDocument();
      expect(table.getByText("Charlie Admin")).toBeInTheDocument();

      // View links
      const viewLinks = table.getAllByRole("link", { name: "View" });
      expect(viewLinks.length).toBe(3);
      expect(viewLinks[0]).toHaveAttribute("href", "/admin/users/u-1");

      // Edit links
      const editLinks = table.getAllByRole("link", { name: "Edit" });
      expect(editLinks.length).toBe(3);
      expect(editLinks[0]).toHaveAttribute("href", "/admin/users/u-1/edit");

      // Create User button
      expect(screen.getByRole("link", { name: "Create User" })).toHaveAttribute(
        "href",
        "/admin/users/new",
      );

      // Clicking row navigates to View User Page
      await userEvent.click(table.getByText("Alice Requester"));
      expect(await screen.findByText("View User Page")).toBeInTheDocument();
    });

    it("searches users by name or email on form submission", async () => {
      renderUserManagement();
      expect(await screen.findByTestId("user-row-u-1")).toBeInTheDocument();

      const searchInput = screen.getByLabelText(/search users by name or email/i);
      await userEvent.type(searchInput, "Alice");
      await userEvent.click(screen.getByRole("button", { name: "Search" }));

      await waitFor(() => {
        expect(callApi).toHaveBeenCalledWith(
          expect.stringContaining("search=Alice&searchFields=name%2Cemail"),
          expect.anything(),
        );
      });
    });

    it("filters users by role via modal dropdown selection", async () => {
      renderUserManagement();
      expect(await screen.findByTestId("user-row-u-1")).toBeInTheDocument();

      const filterButton = screen.getByRole("button", { name: /filter/i });
      await userEvent.click(filterButton);

      const roleSelect = screen.getByLabelText(/filter by role/i);
      await userEvent.selectOptions(roleSelect, "IT_STAFF");

      const applyButton = screen.getByRole("button", { name: /apply/i });
      await userEvent.click(applyButton);

      await waitFor(() => {
        expect(callApi).toHaveBeenCalledWith(
          expect.stringContaining(
            "filters=%5B%7B%22field%22%3A%22role%22%2C%22condition%22%3A%22EQUAL%22%2C%22value%22%3A%22IT_STAFF%22%7D%5D",
          ),
          expect.anything(),
        );
      });

      // Filter chip should be visible
      expect(screen.getByText(/role:\s*it staff/i)).toBeInTheDocument();

      // Removing filter chip clears the filter
      const removeChipBtn = screen.getByRole("button", { name: /remove filter role/i });
      await userEvent.click(removeChipBtn);

      await waitFor(() => {
        expect(callApi).toHaveBeenLastCalledWith(
          expect.not.stringContaining("filters="),
          expect.anything(),
        );
      });
    });

    it("sorts users by column header click", async () => {
      renderUserManagement();
      expect(await screen.findByTestId("user-row-u-1")).toBeInTheDocument();

      const nameHeader = screen.getByRole("columnheader", { name: /name/i });
      await userEvent.click(nameHeader);

      await waitFor(() => {
        expect(callApi).toHaveBeenCalledWith(
          expect.stringContaining("sort=name%3Adesc"),
          expect.anything(),
        );
      });
    });

    it("never renders delete action for users", async () => {
      renderUserManagement();
      expect(await screen.findByTestId("user-row-u-1")).toBeInTheDocument();

      expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    });

    it("displays empty state when no users match", async () => {
      callApi.mockImplementation(async (path: string, init?: any) => {
        if (path.startsWith("/api/admin/users")) {
          init?.onResponse?.({
            headers: new Headers({
              "X-Pagination": JSON.stringify({
                pageNumber: 1,
                pageSize: 10,
                totalItems: 0,
                totalPages: 1,
                hasPreviousPage: false,
                hasNextPage: false,
              }),
            }),
          } as Response);
          return [];
        }
        return [];
      });

      renderUserManagement();
      expect(await screen.findByText("No users found.")).toBeInTheDocument();
    });

    it("displays error alert when fetch fails", async () => {
      callApi.mockImplementation(async () => {
        throw new Error("Network error");
      });

      renderUserManagement();
      expect(
        await screen.findByText("Failed to load users. Please check your connection and try again."),
      ).toBeInTheDocument();
    });
  });

  describe("UI-37 Security hygiene in user list", () => {
    it("never exposes password hashes, tokens, or credential fields", async () => {
      renderUserManagement();
      expect(await screen.findByTestId("user-row-u-1")).toBeInTheDocument();

      expect(screen.queryByText(/argon2/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/password/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/token/i)).not.toBeInTheDocument();
    });
  });
});
