import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { act, render, renderHook, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { ComponentProps } from "react";
import App from "../../src/App.js";
import { setViewportWidth } from "../setup.js";
import {
  REQUESTER_STORAGE_KEY,
  StoredRequester,
} from "../../src/requester/requesterStorage.js";
import { RequesterProvider } from "../../src/requester/RequesterProvider.js";
import { useRequesterApi } from "../../src/requester/useRequesterApi.js";
import { ApiRequestInit, InvalidRequesterContextError } from "../../src/api.js";
import { RECOVERY_STORAGE_KEY } from "../../src/tickets/createTicketDraft.js";

const ALICE: StoredRequester = { id: 1, name: "Alice Example" };

type Entry = NonNullable<ComponentProps<typeof MemoryRouter>["initialEntries"]>[number];

function renderAt(entry: Entry, requester?: StoredRequester) {
  if (requester) {
    sessionStorage.setItem(REQUESTER_STORAGE_KEY, JSON.stringify(requester));
  }

  return render(
    <MemoryRouter initialEntries={[entry]}>
      <App />
    </MemoryRouter>,
  );
}

/*
 * `/error` honours its status only on a live client-side navigation (ui-spec
 * Section 27.1), so these tests must arrive the way the application does rather
 * than mounting `/error` as the router's own initial entry.
 */
function ErrorNavigationButton({ state }: { state: unknown }) {
  const navigate = useNavigate();

  return <button onClick={() => navigate("/error", { state })}>Go to error</button>;
}

async function renderErrorVia(state: unknown, requester?: StoredRequester) {
  if (requester) {
    sessionStorage.setItem(REQUESTER_STORAGE_KEY, JSON.stringify(requester));
  }

  render(
    <MemoryRouter initialEntries={["/requesters"]}>
      <ErrorNavigationButton state={state} />
      <App />
    </MemoryRouter>,
  );

  await userEvent.click(screen.getByRole("button", { name: "Go to error" }));
}

function ProgrammaticNavigationButton() {
  const navigate = useNavigate();

  return <button onClick={() => navigate("/tickets/new")}>Navigate to Create Ticket</button>;
}

function renderAtWithProgrammaticNavigation(entry: Entry, requester?: StoredRequester) {
  if (requester) {
    sessionStorage.setItem(REQUESTER_STORAGE_KEY, JSON.stringify(requester));
  }

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

function renderAtWithHistory(entries: Entry[], initialIndex: number, requester?: StoredRequester) {
  if (requester) {
    sessionStorage.setItem(REQUESTER_STORAGE_KEY, JSON.stringify(requester));
  }

  return render(
    <MemoryRouter initialEntries={entries} initialIndex={initialIndex}>
      <HistoryBackButton />
      <App />
    </MemoryRouter>,
  );
}

/* RequesterSelection fetches on mount; without a stub, fetch is undefined in jsdom. */
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => [] })));
});

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
  /* Still inside React's tree here: cleanup has not unmounted the shell yet. */
  act(() => setViewportWidth(1024));
});

describe("UI-03 application shell and navigation", () => {
  it("shows the TokTickIT identity, navigation, requester name, and Change Requester", () => {
    renderAt("/tickets", ALICE);

    expect(screen.getAllByText(/TokTickIT/).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "My Tickets" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create Ticket" })).toBeInTheDocument();
    expect(screen.getByText(ALICE.name)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change Requester" })).toBeInTheDocument();
  });

  it("marks My Tickets as the current page on /tickets", () => {
    renderAt("/tickets", ALICE);

    expect(screen.getByRole("link", { name: "My Tickets" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Create Ticket" })).not.toHaveAttribute("aria-current");
  });

  it("marks Create Ticket as the current page on /tickets/new", () => {
    renderAt("/tickets/new", ALICE);

    expect(screen.getByRole("link", { name: "Create Ticket" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "My Tickets" })).not.toHaveAttribute("aria-current");
  });

  it("keeps Create Ticket current when the route has a trailing slash", () => {
    renderAt("/tickets/new/", ALICE);

    expect(screen.getByRole("link", { name: "Create Ticket" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "My Tickets" })).not.toHaveAttribute("aria-current");
  });

  it("keeps My Tickets current on a Ticket Detail route", () => {
    renderAt("/tickets/TKT-20260820-A81F3C9D7B21", ALICE);

    expect(screen.getByRole("link", { name: "My Tickets" })).toHaveAttribute("aria-current", "page");
  });

  it("renders the routed page heading inside the main landmark", () => {
    renderAt("/tickets/new", ALICE);

    const main = screen.getByRole("main");
    expect(within(main).getByRole("heading", { level: 1, name: "Create Ticket" })).toBeInTheDocument();
  });

  it("renders /error without the requester shell", () => {
    renderAt("/error", ALICE);

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "My Tickets" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change Requester" })).not.toBeInTheDocument();
  });

  it("renders /requesters without the requester shell", () => {
    renderAt("/requesters");

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change Requester" })).not.toBeInTheDocument();
  });

  it.each(["/requesters", "/error"])("still gives the standalone screen %s a main landmark", (path) => {
    renderAt(path);

    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});

describe("UI-04 requester route guard", () => {
  it.each(["/tickets", "/tickets/new", "/tickets/TKT-20260820-A81F3C9D7B21"])(
    "redirects %s to the selector before requester data renders",
    (path) => {
      renderAt(path);

      expect(screen.getByRole("heading", { name: /Select a Development Requester/i })).toBeInTheDocument();
      expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { level: 1, name: "My Tickets" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { level: 1, name: "Create Ticket" })).not.toBeInTheDocument();
    },
  );

  it.each([
    "not json",
    '{"id":"abc","name":"Alice"}',
    "{}",
    '{"id":1}',
    '{"id":0,"name":"Alice"}',
    '{"id":9007199254740992,"name":"Alice"}',
  ])(
    "treats the malformed stored context %s as absent",
    (stored) => {
      sessionStorage.setItem(REQUESTER_STORAGE_KEY, stored);
      renderAt("/tickets");

      expect(screen.getByRole("heading", { name: /Select a Development Requester/i })).toBeInTheDocument();
      expect(sessionStorage.getItem(REQUESTER_STORAGE_KEY)).toBeNull();
    },
  );

  it("redirects / to the selector when no Requester is stored", () => {
    renderAt("/");

    expect(screen.getByRole("heading", { name: /Select a Development Requester/i })).toBeInTheDocument();
  });

  it("redirects / to My Tickets when a Requester is stored", () => {
    renderAt("/", ALICE);

    const main = screen.getByRole("main");
    expect(within(main).getByRole("heading", { level: 1, name: "My Tickets" })).toBeInTheDocument();
  });

  it.each(["/nope", "/system-check"])("sends an unknown route %s to the global error page", (path) => {
    renderAt(path, ALICE);

    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});

describe("UI-05 Change Requester", () => {
  it("clears the stored context and returns to the selector without stale data", async () => {
    renderAt("/tickets", ALICE);
    /*
     * ui-spec Section 12.2 lists "Requester change" among the events that clear
     * the ambiguous-submission recovery record. Unmounting the requester
     * subtree drops in-memory state but not `sessionStorage`, so the record has
     * to be removed on the switch rather than when Create Ticket next mounts.
     */
    sessionStorage.setItem(
      RECOVERY_STORAGE_KEY,
      JSON.stringify({
        requesterId: ALICE.id,
        idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
        keyCreatedAt: Date.now(),
        payload: {
          categoryId: 4,
          relatedSystemId: 5,
          summary: "Cannot connect to campus VPN",
          requestedPriority: "HIGH",
          description: "The VPN client fails after entering my credentials.",
          attachmentIds: [],
        },
      }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Change Requester" }));

    expect(sessionStorage.getItem(REQUESTER_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(RECOVERY_STORAGE_KEY)).toBeNull();
    expect(screen.getByRole("heading", { name: /Select a Development Requester/i })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveFocus();
    expect(screen.queryByText(ALICE.name)).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "My Tickets" })).not.toBeInTheDocument();
  });

  /*
   * Focus follows a route change that replaces the whole screen, but a cold load
   * of `/requesters` must leave it where the browser put it: focusing `<main>`
   * there talks over the page title for a screen reader (Section 29.6).
   */
  it("does not steal focus on a first load of the selector", () => {
    renderAt("/requesters");

    expect(screen.getByRole("main")).not.toHaveFocus();
    expect(document.body).toHaveFocus();
  });

  /* A guard redirect is also a client-side screen replacement, so focus follows. */
  it("moves focus to the selector when the guard redirects a guarded route", () => {
    renderAt("/tickets");

    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("moves focus to the selector when browser history returns there", async () => {
    renderAtWithHistory(["/requesters", "/tickets"], 1, ALICE);

    await userEvent.click(screen.getByRole("button", { name: "Go back" }));

    expect(await screen.findByRole("heading", { name: /Select a Development Requester/i })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveFocus();
  });
});

describe("UI-32 and UI-37 accessibility foundations", () => {
  it("gives the navigation toggle an accessible name and an associated visible tooltip", async () => {
    renderAt("/tickets", ALICE);

    const toggle = screen.getByRole("button", { name: "Open navigation menu" });

    expect(toggle).toHaveAccessibleName("Open navigation menu");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    await userEvent.hover(toggle);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Open navigation menu");
    expect(tooltip).toHaveClass("tt-tip");
    expect(tooltip).toHaveStyle({ visibility: "visible" });

    await userEvent.unhover(toggle);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    act(() => toggle.focus());
    expect(toggle).toHaveFocus();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Open navigation menu");

    act(() => toggle.blur());
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("exposes the drawer state through aria-expanded and aria-controls", async () => {
    renderAt("/tickets", ALICE);

    const toggle = screen.getByRole("button", { name: "Open navigation menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle.getAttribute("aria-controls")).toBe(screen.getByRole("navigation").id);

    await userEvent.click(toggle);

    const openToggle = screen.getByRole("button", { name: "Close navigation menu" });
    expect(openToggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Close navigation menu");
  });

  it("closes the drawer on Escape and returns focus to the toggle", async () => {
    renderAt("/tickets", ALICE);

    const toggle = screen.getByRole("button", { name: "Open navigation menu" });
    await userEvent.click(toggle);
    await userEvent.keyboard("{Escape}");

    const closedToggle = screen.getByRole("button", { name: "Open navigation menu" });
    expect(closedToggle).toHaveAttribute("aria-expanded", "false");
    expect(closedToggle).toHaveFocus();
  });

  it("closes the drawer after following a navigation link", async () => {
    renderAt("/tickets", ALICE);

    await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));

    expect(screen.getByRole("button", { name: "Open navigation menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: "Open navigation menu" })).toHaveFocus();
  });

  it("closes the drawer after a route changes outside the sidebar", async () => {
    renderAtWithProgrammaticNavigation("/tickets", ALICE);

    await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    await userEvent.click(screen.getByRole("button", { name: "Navigate to Create Ticket" }));

    expect(screen.getByRole("heading", { name: "Create Ticket" })).toBeInTheDocument();
    const closedToggle = screen.getByRole("button", { name: "Open navigation menu" });
    expect(closedToggle).toHaveAttribute("aria-expanded", "false");
    expect(closedToggle).toHaveFocus();
  });

  it("takes the page behind the open drawer out of the tab order", async () => {
    renderAt("/tickets", ALICE);

    const main = screen.getByRole("main");
    expect(main).not.toHaveAttribute("inert");

    await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    expect(main).toHaveAttribute("inert");

    await userEvent.keyboard("{Escape}");
    expect(main).not.toHaveAttribute("inert");
  });

  it("closes the drawer when the viewport crosses into the desktop breakpoint", async () => {
    setViewportWidth(820);
    renderAt("/tickets", ALICE);

    const main = screen.getByRole("main");
    await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    expect(main).toHaveAttribute("inert");

    /*
     * A tablet rotating 820 -> 1180 crosses the 992px breakpoint. Above it the
     * toggle and the backdrop are `d-lg-none`, so an `inert` main would leave the
     * whole content area unreachable with nothing on screen explaining why.
     */
    act(() => setViewportWidth(1180));

    expect(screen.getByRole("button", { name: "Open navigation menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(main).not.toHaveAttribute("inert");
  });

  it("leaves the drawer alone while the viewport stays below the breakpoint", async () => {
    setViewportWidth(390);
    renderAt("/tickets", ALICE);

    await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    act(() => setViewportWidth(820));

    expect(screen.getByRole("button", { name: "Close navigation menu" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("exposes banner, navigation, main landmarks and a skip link", () => {
    renderAt("/tickets", ALICE);

    /*
     * The banner is the mobile topbar and carries the drawer toggle; it is
     * `d-lg-none`, so on desktop the shell has no banner landmark at all and
     * the brand lives inside the sidebar navigation. jsdom applies no
     * stylesheets, so both viewports render here — assert which landmark this
     * is rather than implying it exists at every width.
     */
    const banner = screen.getByRole("banner");
    expect(within(banner).getByRole("button", { name: "Open navigation menu" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();

    const main = screen.getByRole("main");
    const skipLink = screen.getByRole("link", { name: "Skip to main content" });
    expect(skipLink).toHaveAttribute("href", `#${main.id}`);
  });
});

describe("UI-31 and UI-35 global error page", () => {
  it("renders the safe generic error and ignores backend-supplied text", async () => {
    await renderErrorVia({ title: "DB timeout at 10.0.0.4" }, ALICE);

    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back" })).toHaveClass("btn-outline-secondary");
    expect(screen.queryByText(/DB timeout/)).not.toBeInTheDocument();
  });

  it("moves focus to the standalone error page after client-side navigation", async () => {
    await renderErrorVia({ status: 500 }, ALICE);

    expect(screen.getByRole("main")).toHaveFocus();
  });

  /*
   * `location.state` lives in the history entry, so the browser hands it straight
   * back on a reload. Section 27.1 requires the generic variant there regardless
   * of what the entry still carries.
   */
  it.each([403, 404, 500])(
    "falls back to the generic variant when a %s entry is restored rather than navigated to",
    (status) => {
      renderAt({ pathname: "/error", state: { status } }, ALICE);

      expect(screen.getByText("500")).toBeInTheDocument();
      expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
    },
  );

  // AC-61 and ui-spec Section 27.4: Back is resolved from the requester context,
  // never from browser history and never from a caller-supplied `backPath`.
  it.each([
    [403, "Unable to open this page.", "You do not have access to the requested resource."],
    [404, "Page not found.", "The requested resource could not be found."],
    [500, "Something went wrong.", "Please try again later."],
  ])("renders the safe %s variant copy", async (status, title, message) => {
    await renderErrorVia({ status }, ALICE);

    expect(screen.getByText(String(status))).toBeInTheDocument();
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it.each([401, 418, "404", null, "nope"])(
    "falls back to the generic 500 variant for the unrecognised status %s",
    async (status) => {
      await renderErrorVia({ status }, ALICE);

      expect(screen.getByText("500")).toBeInTheDocument();
      expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
    },
  );

  it("sends Back to /tickets when a valid Requester context exists", async () => {
    await renderErrorVia({ status: 404 }, ALICE);

    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/tickets");
  });

  it("sends Back to /requesters when no Requester context exists", async () => {
    await renderErrorVia({ status: 404 });

    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/requesters");
  });

  it("ignores a caller-supplied backPath rather than following it", async () => {
    await renderErrorVia({ status: 404, backPath: "https://evil.example/" }, ALICE);

    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/tickets");
  });
});

describe("UI-04 invalid requester context recovery", () => {
  function renderApi() {
    sessionStorage.setItem(REQUESTER_STORAGE_KEY, JSON.stringify(ALICE));

    return renderHook(() => useRequesterApi(), {
      wrapper: ({ children }) => <RequesterProvider>{children}</RequesterProvider>,
    });
  }

  it("sends the stored Requester as X-Requester-Id", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: ApiRequestInit) => ({ ok: true, status: 200, json: async () => [] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderApi();

    await act(async () => {
      await result.current("/api/categories");
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init).toBeDefined();
    expect(init?.headers?.["X-Requester-Id"]).toBe("1");
  });

  it("clears the stored context on a REQUESTER_CONTEXT_INVALID 400", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({
          statusCode: 400,
          code: "REQUESTER_CONTEXT_INVALID",
          message: "The requester context is invalid.",
          error: "Bad Request",
        }),
      })),
    );
    const { result } = renderApi();

    await act(async () => {
      await expect(result.current("/api/categories")).rejects.toBeInstanceOf(
        InvalidRequesterContextError,
      );
    });
    expect(sessionStorage.getItem(REQUESTER_STORAGE_KEY)).toBeNull();
  });

  it("leaves the stored context alone on an ordinary application 400", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({
          statusCode: 400,
          code: "BAD_REQUEST",
          message: "The request is invalid.",
          error: "Bad Request",
          details: [{ field: "summary", message: "Summary must contain 3-150 characters." }],
        }),
      })),
    );
    const { result } = renderApi();

    await act(async () => {
      await expect(result.current("/api/categories")).rejects.toThrow(Error);
      await expect(result.current("/api/categories")).rejects.not.toBeInstanceOf(
        InvalidRequesterContextError,
      );
    });
    expect(sessionStorage.getItem(REQUESTER_STORAGE_KEY)).toBe(JSON.stringify(ALICE));
  });

  it("never surfaces the backend message text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({
          statusCode: 400,
          code: "BAD_REQUEST",
          message: "The request is invalid.",
          error: "Bad Request",
          details: [{ field: "summary", message: "Summary must contain 3-150 characters." }],
        }),
      })),
    );
    const { result } = renderApi();

    let error: unknown;
    await act(async () => {
      error = await result.current("/api/categories").catch((caught) => caught);
    });
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain("Summary must contain");
  });
});
