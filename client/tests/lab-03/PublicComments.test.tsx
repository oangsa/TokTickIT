import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PublicComments, type RootPublicCommentDTO, type PublicCommentDTO } from "../../src/modules/Tickets/components/PublicComments.js";
import { ApiResponseError } from "../../src/api.js";

const { callApi, auth } = vi.hoisted(() => ({
  callApi: vi.fn(),
  auth: { user: { publicId: "user-1", name: "Alice", role: "REQUESTER" } },
}));

vi.mock("../../src/auth/useAuthenticatedApi.js", () => ({
  useAuthenticatedApi: () => callApi,
}));
vi.mock("../../src/auth/AuthProvider.js", () => ({
  useAuth: () => auth,
}));

const mockRootComments: RootPublicCommentDTO[] = [
  {
    publicId: "root-2",
    content: "Newer root comment\nWith multiple lines",
    author: { publicId: "user-2", name: "Bob", role: "IT_STAFF" },
    parentCommentPublicId: null,
    replyTo: null,
    depth: 0,
    replyCount: 4,
    replies: [
      {
        publicId: "reply-2-1",
        content: "First preview reply",
        author: { publicId: "user-1", name: "Alice", role: "REQUESTER" },
        parentCommentPublicId: "root-2",
        replyTo: { commentPublicId: "root-2", userPublicId: "user-2", name: "Bob" },
        depth: 1,
        createdAt: "2026-09-17T09:05:00Z",
      },
      {
        publicId: "reply-2-2",
        content: "Second preview reply",
        author: { publicId: "user-2", name: "Bob", role: "IT_STAFF" },
        parentCommentPublicId: "root-2",
        replyTo: { commentPublicId: "reply-2-1", userPublicId: "user-1", name: "Alice" },
        depth: 2,
        createdAt: "2026-09-17T09:10:00Z",
      },
      {
        publicId: "reply-2-3",
        content: "Third preview reply",
        author: { publicId: "user-3", name: "Charlie", role: "ADMINISTRATOR" },
        parentCommentPublicId: "root-2",
        replyTo: { commentPublicId: "reply-2-2", userPublicId: "user-2", name: "Bob" },
        depth: 2,
        createdAt: "2026-09-17T09:15:00Z",
      },
    ],
    createdAt: "2026-09-17T09:00:00Z",
  },
  {
    publicId: "root-1",
    content: "Older root comment with <script>alert('xss')</script> & <b>bold</b> tag",
    author: { publicId: "user-1", name: "Alice", role: "REQUESTER" },
    parentCommentPublicId: null,
    replyTo: null,
    depth: 0,
    replyCount: 0,
    replies: [],
    createdAt: "2026-09-17T08:00:00Z",
  },
];

describe("PublicComments component @issue-6", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = { publicId: "user-1", name: "Alice", role: "REQUESTER" };
    callApi.mockImplementation(async (path: string) => {
      if (path.includes("/comments?")) {
        return mockRootComments;
      }
      return [];
    });
  });

  describe("UI-23 Root composer and lazy root list", () => {
    it("does not duplicate a page boundary when another user posts between page requests", async () => {
      const roots = Array.from({ length: 11 }, (_, index) => ({
        ...mockRootComments[1],
        publicId: `root-${index}`,
        content: `Comment ${index}`,
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
        // A new root at the front moves the old tenth root onto page two.
        return secondPage ? roots.slice(9) : roots.slice(0, 10);
      });

      render(<PublicComments ticketPublicId="tkt-1" />);
      await screen.findByText("Comment 0");
      await userEvent.click(screen.getByRole("button", { name: "Load more comments" }));
      await screen.findByText("Comment 10");
      expect(screen.getAllByTestId("comment-root-9")).toHaveLength(1);
      expect(screen.getAllByRole("article")).toHaveLength(11);
      expect(screen.queryByRole("button", { name: "Load more comments" })).not.toBeInTheDocument();
    });

    it("renders root composer with character counter and enforces 1-2000 boundaries", async () => {
      render(<PublicComments ticketPublicId="tkt-1" />);
      await screen.findByText(/Newer root comment/);

      const input = screen.getByLabelText("Add a comment");
      const postBtn = screen.getByRole("button", { name: "Post Comment" });

      // Initially empty: Post button disabled, counter at 0 / 2000
      expect(postBtn).toBeDisabled();
      expect(screen.getByText("0 / 2000")).toBeInTheDocument();

      // Whitespace only: Post button disabled
      await userEvent.type(input, "   ");
      expect(postBtn).toBeDisabled();

      // Valid text: Post button enabled, counter updates
      await userEvent.clear(input);
      await userEvent.type(input, "Valid root comment");
      expect(postBtn).toBeEnabled();
      expect(screen.getByText("18 / 2000")).toBeInTheDocument();
    });

    it("posts new root comment, displays at top, and clears input", async () => {
      const newComment: PublicCommentDTO = {
        publicId: "root-new",
        content: "Freshly posted comment",
        author: { publicId: "user-1", name: "Alice", role: "REQUESTER" },
        parentCommentPublicId: null,
        replyTo: null,
        depth: 0,
        createdAt: "2026-09-17T10:00:00Z",
      };

      callApi.mockImplementation(async (path: string, init?: any) => {
        if (path === "/api/tickets/tkt-1/comments" && init?.method === "POST") {
          return newComment;
        }
        return mockRootComments;
      });

      const onAdded = vi.fn();
      render(<PublicComments ticketPublicId="tkt-1" onCommentAdded={onAdded} />);
      await screen.findByText(/Newer root comment/);

      const input = screen.getByLabelText("Add a comment");
      await userEvent.type(input, "Freshly posted comment");
      await userEvent.click(screen.getByRole("button", { name: "Post Comment" }));

      expect(callApi).toHaveBeenCalledWith("/api/tickets/tkt-1/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Freshly posted comment" }),
      });

      expect(await screen.findByText("Freshly posted comment")).toBeInTheDocument();
      expect(input).toHaveValue("");
      expect(onAdded).toHaveBeenCalledTimes(1);
    });

    it("retains draft on submission error and displays error alert", async () => {
      callApi.mockImplementation(async (path: string, init?: any) => {
        if (path === "/api/tickets/tkt-1/comments" && init?.method === "POST") {
          throw new ApiResponseError(500, "SERVER_ERROR", []);
        }
        return mockRootComments;
      });

      render(<PublicComments ticketPublicId="tkt-1" />);
      await screen.findByText(/Newer root comment/);

      const input = screen.getByLabelText("Add a comment");
      await userEvent.type(input, "Important comment to retain");
      await userEvent.click(screen.getByRole("button", { name: "Post Comment" }));

      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(input).toHaveValue("Important comment to retain");
    });

    it("orders root comments newest-first", async () => {
      render(<PublicComments ticketPublicId="tkt-1" />);
      await screen.findByText(/Newer root comment/);

      const renderedComments = screen.getAllByRole("article");
      // root-2 (newer) should appear before root-1 (older)
      expect(renderedComments[0]).toHaveTextContent("Newer root comment");
    });

    it("loads more root comments on pagination click without destroying existing threads", async () => {
      const page2Roots: RootPublicCommentDTO[] = [
        {
          publicId: "root-3",
          content: "Page 2 root comment",
          author: { publicId: "user-3", name: "Charlie", role: "ADMINISTRATOR" },
          parentCommentPublicId: null,
          replyTo: null,
          depth: 0,
          replyCount: 0,
          replies: [],
          createdAt: "2026-09-17T07:00:00Z",
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
          return mockRootComments;
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
          return page2Roots;
        }
        return [];
      });

      render(<PublicComments ticketPublicId="tkt-1" />);
      await screen.findByText(/Newer root comment/);

      const loadMoreBtn = await screen.findByRole("button", { name: /load more comments/i });
      await userEvent.click(loadMoreBtn);

      // Both page 1 comments and page 2 comment should now be in the document
      expect(await screen.findByText("Page 2 root comment")).toBeInTheDocument();
      expect(screen.getByText(/Newer root comment/)).toBeInTheDocument();
      expect(screen.getByText(/Older root comment/)).toBeInTheDocument();
    });
  });

  describe("UI-24 & UI-37 Reply preview, depth-2 presentation, and safe plain text", () => {
    it("renders up to 3 preview replies and shows View X more replies button", async () => {
      render(<PublicComments ticketPublicId="tkt-1" />);
      await screen.findByText(/Newer root comment/);

      // 3 preview replies should be rendered
      expect(screen.getByText("First preview reply")).toBeInTheDocument();
      expect(screen.getByText("Second preview reply")).toBeInTheDocument();
      expect(screen.getByText("Third preview reply")).toBeInTheDocument();

      // View more button should show remaining count: 4 total - 3 previews = 1 remaining
      expect(screen.getByRole("button", { name: /View 1 more reply/i })).toBeInTheDocument();
    });

    it("expands replies via View More button and deduplicates against previews", async () => {
      const allReplies: PublicCommentDTO[] = [
        ...mockRootComments[0].replies,
        {
          publicId: "reply-2-4",
          content: "Fourth reply loaded via pagination",
          author: { publicId: "user-1", name: "Alice", role: "REQUESTER" },
          parentCommentPublicId: "root-2",
          replyTo: { commentPublicId: "reply-2-3", userPublicId: "user-3", name: "Charlie" },
          depth: 2,
          createdAt: "2026-09-17T09:20:00Z",
        },
      ];

      callApi.mockImplementation(async (path: string, init?: any) => {
        if (path.includes("/comments/root-2/replies")) {
          init?.onResponse?.({
            headers: new Headers({
              "X-Pagination": JSON.stringify({
                pageNumber: 1,
                pageSize: 5,
                totalItems: 4,
                totalPages: 1,
                hasPreviousPage: false,
                hasNextPage: false,
              }),
            }),
          } as Response);
          return allReplies;
        }
        return mockRootComments;
      });

      render(<PublicComments ticketPublicId="tkt-1" />);
      await screen.findByText(/Newer root comment/);

      const viewMoreBtn = screen.getByRole("button", { name: /View 1 more reply/i });
      await userEvent.click(viewMoreBtn);

      expect(await screen.findByText("Fourth reply loaded via pagination")).toBeInTheDocument();
      // Ensure existing previews were not duplicated
      expect(screen.getAllByText("First preview reply")).toHaveLength(1);
    });

    it("fetches successive pages for threads with >50 replies and provides retry control on failure", async () => {
      const rootWith51: RootPublicCommentDTO = {
        publicId: "root-51",
        content: "Root with many replies",
        author: { publicId: "user-1", name: "Alice", role: "REQUESTER" },
        parentCommentPublicId: null,
        replyTo: null,
        depth: 0,
        replyCount: 51,
        replies: [
          {
            publicId: "reply-preview-1",
            content: "Preview reply 1",
            author: { publicId: "user-2", name: "Bob", role: "IT_STAFF" },
            parentCommentPublicId: "root-51",
            replyTo: null,
            depth: 1,
            createdAt: "2026-09-17T09:01:00Z",
          },
        ],
        createdAt: "2026-09-17T09:00:00Z",
      };

      const page1Replies: PublicCommentDTO[] = Array.from({ length: 50 }, (_, i) => ({
        publicId: `reply-${i + 1}`,
        content: `Reply number ${i + 1}`,
        author: { publicId: "user-2", name: "Bob", role: "IT_STAFF" },
        parentCommentPublicId: "root-51",
        replyTo: null,
        depth: 1,
        createdAt: `2026-09-17T09:01:${String(i % 60).padStart(2, "0")}Z`,
      }));

      const page2Replies: PublicCommentDTO[] = [
        {
          publicId: "reply-51",
          content: "Reply number 51",
          author: { publicId: "user-3", name: "Charlie", role: "ADMINISTRATOR" },
          parentCommentPublicId: "root-51",
          replyTo: null,
          depth: 1,
          createdAt: "2026-09-17T09:02:00Z",
        },
      ];

      let failPage2Once = true;

      callApi.mockImplementation(async (path: string, init?: any) => {
        if (path.includes("/comments?")) {
          return [rootWith51];
        }
        if (path.includes("/comments/root-51/replies?pageNumber=1")) {
          init?.onResponse?.({
            headers: new Headers({
              "X-Pagination": JSON.stringify({
                pageNumber: 1,
                pageSize: 50,
                totalItems: 51,
                totalPages: 2,
                hasPreviousPage: false,
                hasNextPage: true,
              }),
            }),
          } as Response);
          return page1Replies;
        }
        if (path.includes("/comments/root-51/replies?pageNumber=2")) {
          if (failPage2Once) {
            failPage2Once = false;
            throw new ApiResponseError(500, "INTERNAL_SERVER_ERROR", []);
          }
          init?.onResponse?.({
            headers: new Headers({
              "X-Pagination": JSON.stringify({
                pageNumber: 2,
                pageSize: 50,
                totalItems: 51,
                totalPages: 2,
                hasPreviousPage: true,
                hasNextPage: false,
              }),
            }),
          } as Response);
          return page2Replies;
        }
        return [];
      });

      render(<PublicComments ticketPublicId="tkt-1" />);
      await screen.findByText("Root with many replies");

      // Initial view more button: 51 total - 1 preview = 50 remaining
      const viewMoreBtn = screen.getByRole("button", { name: /View 50 more replies/i });
      await userEvent.click(viewMoreBtn);

      // Page 1 loaded: shows reply 50, and View 1 more reply remains!
      expect(await screen.findByText("Reply number 50")).toBeInTheDocument();
      const viewMorePage2 = await screen.findByRole("button", { name: /View 1 more reply/i });

      // Click to load page 2, which fails
      await userEvent.click(viewMorePage2);
      expect(await screen.findByText("Failed to load replies.")).toBeInTheDocument();
      const retryBtn = screen.getByRole("button", { name: "Retry" });

      // Click retry -> page 2 succeeds
      await userEvent.click(retryBtn);
      expect(await screen.findByText("Reply number 51")).toBeInTheDocument();
      // View more button is now gone
      expect(screen.queryByRole("button", { name: /View .* more repl/i })).not.toBeInTheDocument();
    });

    it("opens inline reply composer and submits reply with target metadata", async () => {
      const newReply: PublicCommentDTO = {
        publicId: "reply-new",
        content: "Replying to first preview",
        author: { publicId: "user-1", name: "Alice", role: "REQUESTER" },
        parentCommentPublicId: "root-2",
        replyTo: { commentPublicId: "reply-2-1", userPublicId: "user-1", name: "Alice" },
        depth: 2,
        createdAt: "2026-09-17T09:25:00Z",
      };

      callApi.mockImplementation(async (path: string, init?: any) => {
        if (path.includes("/comments/reply-2-1/replies") && init?.method === "POST") {
          return newReply;
        }
        return mockRootComments;
      });

      render(<PublicComments ticketPublicId="tkt-1" />);
      await screen.findByText("First preview reply");

      const replyButtons = screen.getAllByRole("button", { name: "Reply" });
      // Click reply on reply-2-1
      await userEvent.click(replyButtons[1]);

      const replyInput = await screen.findByLabelText(/Reply to Alice/i);
      await userEvent.type(replyInput, "Replying to first preview");
      const replyForm = replyInput.closest("form")!;
      await userEvent.click(within(replyForm).getByRole("button", { name: "Reply" }));

      expect(callApi).toHaveBeenCalledWith("/api/tickets/tkt-1/comments/reply-2-1/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Replying to first preview" }),
      });

      expect(await screen.findByText("Replying to first preview")).toBeInTheDocument();
    });

    it("renders @Name mention for depth-2 replies", async () => {
      render(<PublicComments ticketPublicId="tkt-1" />);
      await screen.findByText("Second preview reply");

      // reply-2-2 replyTo is Alice
      expect(screen.getByText("@Alice")).toBeInTheDocument();
      // reply-2-3 replyTo is Bob
      expect(screen.getByText("@Bob")).toBeInTheDocument();
    });

    it("renders HTML/script tags as plain escaped text and preserves newlines", async () => {
      render(<PublicComments ticketPublicId="tkt-1" />);
      await screen.findByText(/Older root comment/);

      // The text containing script and bold tags should render as text content, not DOM elements
      expect(document.querySelector("script")).toBeNull();
      expect(document.querySelector("b#test")).toBeNull();
      expect(screen.getByText(/<script>alert\('xss'\)<\/script>/)).toBeInTheDocument();
      expect(screen.getByText(/<b>bold<\/b>/)).toBeInTheDocument();

      // Multiline text should be present
      expect(screen.getByText(/Newer root comment\s+With multiple lines/)).toBeInTheDocument();
    });

    it("never displays edit or delete actions on any comment", async () => {
      render(<PublicComments ticketPublicId="tkt-1" />);
      await screen.findByText(/Newer root comment/);

      expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
    });
  });
});
