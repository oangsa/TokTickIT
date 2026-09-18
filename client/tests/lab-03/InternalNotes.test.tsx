import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InternalNotes, type InternalNoteDTO } from "../../src/components/InternalNotes.js";
import { ApiResponseError } from "../../src/api.js";

const { callApi, auth } = vi.hoisted(() => ({
  callApi: vi.fn(),
  auth: { user: { publicId: "staff-1", name: "Staff Member", role: "IT_STAFF" } },
}));

vi.mock("../../src/auth/useAuthenticatedApi.js", () => ({
  useAuthenticatedApi: () => callApi,
}));
vi.mock("../../src/auth/AuthProvider.js", () => ({
  useAuth: () => auth,
}));

const mockNotes: InternalNoteDTO[] = [
  {
    publicId: "note-2",
    content: "Newer internal note regarding server diagnostic logs.",
    author: { publicId: "staff-1", name: "Staff Member", role: "IT_STAFF" },
    createdAt: "2026-09-17T11:00:00Z",
  },
  {
    publicId: "note-1",
    content: "Older internal note: initial inspection completed.",
    author: { publicId: "admin-1", name: "Admin Lead", role: "ADMINISTRATOR" },
    createdAt: "2026-09-17T10:00:00Z",
  },
];

describe("InternalNotes component @issue-6", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = { publicId: "staff-1", name: "Staff Member", role: "IT_STAFF" };
    callApi.mockImplementation(async (path: string) => {
      if (path.includes("/internal-notes")) {
        return mockNotes;
      }
      return [];
    });
  });

  describe("UI-25 & AC-63 Privacy warning and visibility", () => {
    it("displays prominent persistent private-warning banner", async () => {
      render(<InternalNotes ticketPublicId="tkt-1" ticketOwnerPublicId="staff-1" />);
      await screen.findByText(/Newer internal note/);

      const warning = screen.getByRole("alert");
      expect(warning).toHaveTextContent("Visible only to IT Staff and Administrators.");
      expect(warning).toHaveTextContent("Do not place information here that should be sent to the Requester.");
    });

    it("renders flat list ordered newest-first", async () => {
      render(<InternalNotes ticketPublicId="tkt-1" ticketOwnerPublicId="staff-1" />);
      await screen.findByText(/Newer internal note/);

      const notes = screen.getAllByRole("article");
      expect(notes[0]).toHaveTextContent("Newer internal note");
      expect(notes[1]).toHaveTextContent("Older internal note");
    });
  });

  describe("UI-25 Role-based authoring and validation", () => {
    it("allows IT Staff to compose and post internal note with 1-4000 char boundary", async () => {
      const newNote: InternalNoteDTO = {
        publicId: "note-new",
        content: "Investigating network gateway routes.",
        author: { publicId: "staff-1", name: "Staff Member", role: "IT_STAFF" },
        createdAt: "2026-09-17T12:00:00Z",
      };

      callApi.mockImplementation(async (path: string, init?: any) => {
        if (path === "/api/tickets/tkt-1/internal-notes" && init?.method === "POST") {
          return newNote;
        }
        return mockNotes;
      });

      const onAdded = vi.fn();
      render(<InternalNotes ticketPublicId="tkt-1" ticketOwnerPublicId="staff-1" onNoteAdded={onAdded} />);
      await screen.findByText(/Newer internal note/);

      const input = screen.getByLabelText("Add an internal note");
      const postBtn = screen.getByRole("button", { name: "Add Note" });

      // Initially empty -> button disabled
      expect(postBtn).toBeDisabled();
      expect(screen.getByText("0 / 4000")).toBeInTheDocument();

      // Type valid note
      await userEvent.type(input, "Investigating network gateway routes.");
      expect(postBtn).toBeEnabled();
      expect(screen.getByText("37 / 4000")).toBeInTheDocument();

      await userEvent.click(postBtn);

      expect(callApi).toHaveBeenCalledWith("/api/tickets/tkt-1/internal-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Investigating network gateway routes." }),
      });

      expect(await screen.findByText("Investigating network gateway routes.")).toBeInTheDocument();
      expect(input).toHaveValue("");
      expect(onAdded).toHaveBeenCalledTimes(1);
    });

    it("allows assigned Administrator owner to compose and post internal note", async () => {
      auth.user = { publicId: "admin-1", name: "Admin Owner", role: "ADMINISTRATOR" };
      render(<InternalNotes ticketPublicId="tkt-1" ticketOwnerPublicId="admin-1" />);
      await screen.findByText(/Newer internal note/);

      expect(screen.getByLabelText("Add an internal note")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Add Note" })).toBeInTheDocument();
    });

    it("restricts Administrator non-owner to read-only without rendering composer", async () => {
      auth.user = { publicId: "admin-2", name: "Admin NonOwner", role: "ADMINISTRATOR" };
      render(<InternalNotes ticketPublicId="tkt-1" ticketOwnerPublicId="staff-1" />);
      await screen.findByText(/Newer internal note/);

      // Composer should NOT be rendered
      expect(screen.queryByLabelText("Add an internal note")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Add Note" })).not.toBeInTheDocument();

      // Read-only notice should be omitted to avoid visual clutter
      expect(
        screen.queryByText(/Only IT Staff or the assigned Administrator owner can add internal notes/i),
      ).not.toBeInTheDocument();
    });

    it("retains note draft on submission error and displays alert", async () => {
      callApi.mockImplementation(async (path: string, init?: any) => {
        if (path === "/api/tickets/tkt-1/internal-notes" && init?.method === "POST") {
          throw new ApiResponseError(500, "INTERNAL_ERROR", []);
        }
        return mockNotes;
      });

      render(<InternalNotes ticketPublicId="tkt-1" ticketOwnerPublicId="staff-1" />);
      await screen.findByText(/Newer internal note/);

      const input = screen.getByLabelText("Add an internal note");
      await userEvent.type(input, "Note content to preserve");
      await userEvent.click(screen.getByRole("button", { name: "Add Note" }));

      expect(await screen.findByText(/request failed|failed to save/i)).toBeInTheDocument();
      expect(input).toHaveValue("Note content to preserve");
    });

    it("loads more notes via Load More Notes button", async () => {
      const page2Notes: InternalNoteDTO[] = [
        {
          publicId: "note-3",
          content: "Page 2 older note",
          author: { publicId: "staff-1", name: "Staff Member", role: "IT_STAFF" },
          createdAt: "2026-09-17T09:00:00Z",
        },
      ];

      callApi.mockImplementation(async (path: string, init?: any) => {
        if (path.includes("pageNumber=1")) {
          init?.onResponse?.({
            headers: new Headers({
              "X-Pagination": JSON.stringify({
                pageNumber: 1,
                pageSize: 10,
                totalItems: 3,
                totalPages: 2,
                hasPreviousPage: false,
                hasNextPage: true,
              }),
            }),
          } as Response);
          return mockNotes;
        }
        if (path.includes("pageNumber=2")) {
          init?.onResponse?.({
            headers: new Headers({
              "X-Pagination": JSON.stringify({
                pageNumber: 2,
                pageSize: 10,
                totalItems: 3,
                totalPages: 2,
                hasPreviousPage: true,
                hasNextPage: false,
              }),
            }),
          } as Response);
          return page2Notes;
        }
        return [];
      });

      render(<InternalNotes ticketPublicId="tkt-1" ticketOwnerPublicId="staff-1" />);
      await screen.findByText(/Newer internal note/);

      const loadMoreBtn = await screen.findByRole("button", { name: /load more notes/i });
      await userEvent.click(loadMoreBtn);

      expect(await screen.findByText("Page 2 older note")).toBeInTheDocument();
      expect(screen.getByText(/Newer internal note/)).toBeInTheDocument();
    });

    it("does not duplicate a page boundary when another staff member posts between requests", async () => {
      const notes = Array.from({ length: 11 }, (_, index) => ({
        ...mockNotes[0], publicId: `note-${index}`, content: `Note ${index}`,
      }));
      callApi.mockImplementation(async (path: string, options?: { onResponse?: (response: Response) => void }) => {
        const secondPage = path.includes("pageNumber=2");
        options?.onResponse?.(new Response(null, { headers: {
          "X-Pagination": JSON.stringify({
            pageNumber: secondPage ? 2 : 1, pageSize: 10,
            totalItems: secondPage ? 12 : 11, totalPages: 2,
            hasPreviousPage: secondPage, hasNextPage: !secondPage,
          }),
        } }));
        return secondPage ? notes.slice(9) : notes.slice(0, 10);
      });

      render(<InternalNotes ticketPublicId="tkt-1" ticketOwnerPublicId="staff-1" />);
      await screen.findByText("Note 0");
      await userEvent.click(screen.getByRole("button", { name: "Load more notes" }));
      await screen.findByText("Note 10");
      expect(screen.getAllByTestId("note-note-9")).toHaveLength(1);
      expect(screen.getAllByRole("article")).toHaveLength(11);
      expect(screen.queryByRole("button", { name: "Load more notes" })).not.toBeInTheDocument();
    });

    it("never provides edit or delete controls on internal notes", async () => {
      render(<InternalNotes ticketPublicId="tkt-1" ticketOwnerPublicId="staff-1" />);
      await screen.findByText(/Newer internal note/);

      expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
    });
  });
});
