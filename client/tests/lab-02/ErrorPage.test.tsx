import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { ComponentProps } from "react";
import App from "../helpers/AuthenticatedRequesterApp.js";

type Entry = NonNullable<ComponentProps<typeof MemoryRouter>["initialEntries"]>[number];

function renderAt(entry: Entry) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <App />
    </MemoryRouter>,
  );
}

/* `renderErrorVia` starts on `/requesters`, which loads the bootstrap list. */
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, headers: new Headers(), json: async () => [] })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/*
 * `/error` honours its status only on a live client-side navigation (ui-spec
 * Section 27.1), so these tests must arrive the way the application does rather
 * than mounting `/error` as the router's own initial entry.
 */
function ErrorNavigationButton({ state }: { state: unknown }) {
  const navigate = useNavigate();

  return <button onClick={() => navigate("/error", { state })}>Go to error</button>;
}

async function renderErrorVia(state: unknown) {
  render(
    <MemoryRouter initialEntries={["/tickets"]}>
      <ErrorNavigationButton state={state} />
      <App />
    </MemoryRouter>,
  );

  await userEvent.click(screen.getByRole("button", { name: "Go to error" }));
}

describe("UI-31 and UI-35 global error page", () => {
  it("renders the safe generic error and ignores backend-supplied text", async () => {
    await renderErrorVia({ title: "DB timeout at 10.0.0.4" });

    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back" })).toHaveClass("btn-outline-secondary");
    expect(screen.queryByText(/DB timeout/)).not.toBeInTheDocument();
  });

  it("moves focus to the standalone error page after client-side navigation", async () => {
    await renderErrorVia({ status: 500 });

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
      renderAt({ pathname: "/error", state: { status } });

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
    await renderErrorVia({ status });

    expect(screen.getByText(String(status))).toBeInTheDocument();
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it.each([401, 418, "404", null, "nope"])(
    "falls back to the generic 500 variant for the unrecognised status %s",
    async (status) => {
      await renderErrorVia({ status });

      expect(screen.getByText("500")).toBeInTheDocument();
      expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
    },
  );

  it("sends Back to the authenticated role home", async () => {
    await renderErrorVia({ status: 404 });

    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/tickets");
  });

  it("ignores a caller-supplied backPath rather than following it", async () => {
    await renderErrorVia({ status: 404, backPath: "https://evil.example/" });

    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/tickets");
  });
});
