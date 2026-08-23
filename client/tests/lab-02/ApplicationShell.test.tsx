import { describe, it, expect, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { ComponentProps } from "react";
import App from "../../src/App.js";
import {
  REQUESTER_STORAGE_KEY,
  StoredRequester,
} from "../../src/requester/requesterStorage.js";

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

afterEach(() => sessionStorage.clear());

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

    await userEvent.click(screen.getByRole("button", { name: "Change Requester" }));

    expect(sessionStorage.getItem(REQUESTER_STORAGE_KEY)).toBeNull();
    expect(screen.getByRole("heading", { name: /Select a Development Requester/i })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveFocus();
    expect(screen.queryByText(ALICE.name)).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "My Tickets" })).not.toBeInTheDocument();
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
  it("renders the safe generic error and ignores backend-supplied text", () => {
    renderAt({ pathname: "/error", state: { title: "DB timeout at 10.0.0.4" } }, ALICE);

    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back" })).toHaveClass("btn-outline-secondary");
    expect(screen.queryByText(/DB timeout/)).not.toBeInTheDocument();
  });

  // AC-61 and ui-spec Section 27.4: Back is resolved from the requester context,
  // never from browser history and never from a caller-supplied `backPath`.
  it("sends Back to /tickets when a valid Requester context exists", () => {
    renderAt({ pathname: "/error", state: { status: 404 } }, ALICE);

    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/tickets");
  });

  it("sends Back to /requesters when no Requester context exists", () => {
    renderAt({ pathname: "/error", state: { status: 404 } });

    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/requesters");
  });

  it("ignores a caller-supplied backPath rather than following it", () => {
    renderAt({ pathname: "/error", state: { status: 404, backPath: "https://evil.example/" } }, ALICE);

    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/tickets");
  });
});
