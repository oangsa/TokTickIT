import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createMemoryRouter,
  MemoryRouter,
  RouterProvider,
  useNavigate,
} from "react-router-dom";
import type { ComponentProps } from "react";

import App from "../helpers/AuthenticatedRequesterApp.js";
import { setViewportWidth } from "../setup.js";

type Entry = NonNullable<ComponentProps<typeof MemoryRouter>["initialEntries"]>[number];

const TICKET = {
  publicId: "0f0e8a9f-6d9e-4a1a-9f0e-1b2c3d4e5f60",
  ticketNumber: "TKT-20260820-A81F3C9D7B21",
  requesterId: 3,
  requesterName: "Alice Johnson",
  requesterEmail: "alice.johnson@example.com",
  categoryId: 1,
  categoryName: "Network",
  relatedSystemId: 5,
  relatedSystemName: "VPN",
  summary: "VPN disconnects every ten minutes",
  description: "The VPN client drops the tunnel roughly ten minutes after connecting.",
  requestedPriority: "HIGH",
  currentStatus: "NEW",
  attachments: [],
  createdBy: "alice.johnson@example.com",
  createdAt: "2026-08-20T02:00:00.000Z",
  updatedBy: "alice.johnson@example.com",
  updatedAt: "2026-08-21T02:00:00.000Z",
  deleted: false,
};

function stubApi() {
  const fetchMock = vi.fn(async (input: string | URL, _init?: RequestInit) => {
    const url = String(input);
    const isDetail = url.includes("/api/users/me/tickets/") && !url.includes("/attachments");

    return {
      ok: true,
      status: 200,
      headers: new Headers(
        isDetail
          ? undefined
          : {
              "X-Pagination": JSON.stringify({
                pageNumber: 1,
                pageSize: 10,
                totalItems: 0,
                totalPages: 0,
                hasPreviousPage: false,
                hasNextPage: false,
              }),
            },
      ),
      json: async () => (isDetail ? TICKET : []),
    };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderAt(entry: Entry) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <App />
    </MemoryRouter>,
  );
}

function ProgrammaticNavigationButton() {
  const navigate = useNavigate();
  return <button onClick={() => navigate("/tickets/new")}>Navigate to Create Ticket</button>;
}

function renderAtWithProgrammaticNavigation(entry: Entry) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ProgrammaticNavigationButton />
      <App />
    </MemoryRouter>,
  );
}

function HistoryBackButton() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>Go back</button>;
}

function renderDataRouterWithHistory(entries: Entry[], initialIndex: number) {
  const NativeRequest = globalThis.Request;
  vi.stubGlobal(
    "Request",
    class TestRequest extends NativeRequest {
      constructor(input: RequestInfo | URL, init?: RequestInit) {
        super(input, init === undefined ? undefined : { ...init, signal: undefined });
      }
    },
  );

  const router = createMemoryRouter(
    [
      {
        path: "*",
        element: (
          <>
            <HistoryBackButton />
            <App enableHistoryBlocking />
          </>
        ),
      },
    ],
    { initialEntries: entries, initialIndex },
  );

  render(<RouterProvider router={router} />);
}

beforeEach(() => {
  stubApi();
});

afterEach(() => {
  vi.unstubAllGlobals();
  act(() => setViewportWidth(1024));
});

describe("authenticated application shell and navigation", () => {
  it("shows the brand and authenticated requester navigation without a selector", () => {
    renderAt("/tickets");

    expect(screen.getAllByText(/TokTickIT/).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "My Tickets" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create Ticket" })).toBeInTheDocument();
    expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change Requester" })).not.toBeInTheDocument();
    expect(screen.queryByText("Development Requester", { exact: true })).not.toBeInTheDocument();
    expect(sessionStorage.getItem("toktickit.requester")).toBeNull();
  });

  it("uses the AuthProvider bearer and never sends X-Requester-Id", async () => {
    const fetchMock = stubApi();
    renderAt("/tickets");

    await screen.findByRole("heading", { name: "My Tickets" });
    const ticketCall = fetchMock.mock.calls.find(([input]) => String(input).includes("/api/users/me/tickets?"));

    expect(ticketCall).toBeDefined();
    const headers = new Headers(ticketCall?.[1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer test-access-token");
    expect(headers.get("X-Requester-Id")).toBeNull();
  });

  it("marks the selected navigation page for list, create, and detail routes", () => {
    const cases: [string, string][] = [
      ["/tickets", "My Tickets"],
      ["/tickets/new", "Create Ticket"],
      ["/tickets/new/", "Create Ticket"],
      ["/tickets/TKT-20260820-A81F3C9D7B21", "My Tickets"],
    ];

    for (const [path, current] of cases) {
      renderAt(path);
      expect(screen.getByRole("link", { name: current })).toHaveAttribute("aria-current", "page");
      document.body.innerHTML = "";
    }
  });

  it("keeps standalone errors outside the authenticated shell and rejects the old route", () => {
    renderAt("/error");
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument();

    document.body.innerHTML = "";
    renderAt("/requesters");
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.queryByText(/Development Requester/i)).not.toBeInTheDocument();
  });

  it("sends unknown routes to the safe standalone 404 page", () => {
    renderAt("/nope");
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});

describe("authenticated shell drawer and accessibility", () => {
  it("gives the navigation toggle a name and a visible tooltip", async () => {
    renderAt("/tickets");
    const toggle = screen.getByRole("button", { name: "Open navigation menu" });

    expect(toggle).toHaveAccessibleName("Open navigation menu");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await userEvent.hover(toggle);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Open navigation menu");
    await userEvent.unhover(toggle);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("exposes drawer state and focuses the first navigation link", async () => {
    renderAt("/tickets");
    const toggle = screen.getByRole("button", { name: "Open navigation menu" });
    const navigation = screen.getByRole("navigation", { name: "Main" });

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", navigation.id);
    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Close navigation menu" })).toHaveAttribute("aria-expanded", "true");
    expect(within(navigation).getByRole("link", { name: "Create Ticket" })).toHaveFocus();
  });

  it("closes the drawer on Escape, navigation, and an outside route change", async () => {
    renderAtWithProgrammaticNavigation("/tickets");
    const toggle = screen.getByRole("button", { name: "Open navigation menu" });
    await userEvent.click(toggle);
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Open navigation menu" })).toHaveFocus();

    await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    await userEvent.click(within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: "Create Ticket" }));
    expect(screen.getByRole("button", { name: "Open navigation menu" })).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    await userEvent.click(screen.getByRole("button", { name: "Navigate to Create Ticket" }));
    expect(screen.getByRole("heading", { name: "Create Ticket" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open navigation menu" })).toHaveAttribute("aria-expanded", "false");
  });

  it("removes the main content from the tab order while the drawer is open", async () => {
    renderAt("/tickets");
    const main = screen.getByRole("main");
    await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    expect(main).toHaveAttribute("inert");
    await userEvent.keyboard("{Escape}");
    expect(main).not.toHaveAttribute("inert");
  });

  it("closes on a desktop breakpoint and keeps open below it", async () => {
    setViewportWidth(820);
    renderAt("/tickets");
    await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    act(() => setViewportWidth(1180));
    expect(screen.getByRole("button", { name: "Open navigation menu" })).toHaveAttribute("aria-expanded", "false");

    cleanup();
    setViewportWidth(390);
    renderAt("/tickets");
    await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    act(() => setViewportWidth(820));
    expect(screen.getByRole("button", { name: "Close navigation menu" })).toHaveAttribute("aria-expanded", "true");
  });

  it("exposes banner, navigation, main, and skip-link landmarks", () => {
    renderAt("/tickets");
    const main = screen.getByRole("main");
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute("href", `#${main.id}`);
  });
});

describe("dirty navigation protection", () => {
  it("blocks browser history until the authenticated requester confirms discard", async () => {
    renderDataRouterWithHistory(["/tickets", "/tickets/new"], 1);

    await userEvent.type(await screen.findByLabelText(/^Summary/), "Draft summary");
    await userEvent.click(screen.getByRole("button", { name: "Go back" }));
    expect(screen.getByRole("dialog", { name: "Discard this Ticket?" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByRole("dialog", { name: "Discard this Ticket?" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Go back" }));
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
  });
});
