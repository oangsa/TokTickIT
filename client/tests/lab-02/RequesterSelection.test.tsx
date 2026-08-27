import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";

import App from "../../src/App.js";
import { ApiRequestInit } from "../../src/api.js";
import { REQUESTER_STORAGE_KEY } from "../../src/requester/requesterStorage.js";
import { mswServer } from "../setup.js";

const REQUESTERS = [
  {
    id: 1,
    name: "Alice Johnson",
    email: "alice.johnson@example.com",
    isActive: true,
    deleted: false,
    createdBy: "seed",
    createdAt: "2026-08-20T01:00:00.000Z",
    updatedBy: "seed",
    updatedAt: "2026-08-20T01:00:00.000Z",
  },
  {
    id: 2,
    name: "Bob Smith",
    email: "bob.smith@example.com",
    isActive: true,
    deleted: false,
    createdBy: "seed",
    createdAt: "2026-08-20T01:00:00.000Z",
    updatedBy: "seed",
    updatedAt: "2026-08-20T01:00:00.000Z",
  },
];

function stubJson(body: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn(
    async (_url: string, _init?: ApiRequestInit) => ({ ok, status, headers: new Headers(), json: async () => body }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderSelection() {
  return render(
    <MemoryRouter initialEntries={["/requesters"]}>
      <App />
    </MemoryRouter>,
  );
}

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("UI-01 Development Requester Selection", () => {
  it("loads the bootstrap response through the pinned MSW HTTP boundary", async () => {
    /* jsdom's AbortSignal belongs to a different realm than Node fetch. */
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(undefined as unknown as AbortSignal);
    mswServer.use(
      http.get(/\/api\/requesters$/, () => HttpResponse.json(REQUESTERS)),
    );

    renderSelection();

    expect(await screen.findByRole("option", { name: "Alice Johnson" })).toBeInTheDocument();
  });

  it("announces loading and disables Continue before the requesters arrive", () => {
    vi.stubGlobal("fetch", () => new Promise(() => {}));
    renderSelection();

    expect(screen.getByRole("status")).toHaveTextContent(/Loading Development Requesters/);
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("keeps one live region mounted across the load so the change is announced", async () => {
    // A role="status" node inserted with its text already present is announced
    // inconsistently; the region has to outlive the state change.
    stubJson(REQUESTERS);
    renderSelection();

    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("Loading Development Requesters");

    await screen.findByRole("combobox");
    expect(screen.getByRole("status")).toBe(region);
    expect(region).toHaveTextContent("2 Development Requesters loaded");
  });

  it("states that this is a testing mechanism and not authentication", async () => {
    stubJson(REQUESTERS);
    renderSelection();

    /* Settle the load so the state update lands inside the test, not after it. */
    await screen.findByRole("combobox");
    expect(screen.getByText(/not authentication/)).toBeInTheDocument();
  });

  it("lists the active Requester names only", async () => {
    stubJson(REQUESTERS);
    renderSelection();

    await screen.findByRole("combobox");
    expect(screen.getByRole("option", { name: "Alice Johnson" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Bob Smith" })).toBeInTheDocument();
    expect(screen.queryByText(/alice.johnson@example.com/)).toBeNull();
  });

  it("sends no X-Requester-Id header on the bootstrap request", async () => {
    const fetchMock = stubJson(REQUESTERS);
    renderSelection();

    await screen.findByRole("combobox");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/requesters$/);
    expect(init).toBeDefined();
    expect(init?.headers).not.toHaveProperty("X-Requester-Id");
  });

  it("keeps Continue disabled until a Requester is selected", async () => {
    stubJson(REQUESTERS);
    renderSelection();

    const combobox = await screen.findByRole("combobox");
    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect(continueButton).toBeDisabled();

    await userEvent.selectOptions(combobox, "1");
    expect(continueButton).toBeEnabled();
  });

  it("shows the empty state with Retry and no dropdown when nothing is active", async () => {
    stubJson([]);
    renderSelection();

    await screen.findByText("No active Development Requesters are available.");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
  });

  it("shows a safe failure state with Retry", async () => {
    stubJson(
      {
        statusCode: 500,
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
        error: "Internal Server Error",
      },
      false,
      500,
    );
    renderSelection();

    await screen.findByText("Development Requesters could not be loaded.");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByText(/An unexpected error occurred/)).toBeNull();
  });

  it("recovers when Retry succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("The request failed (HTTP 500)."))
      .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers(), json: async () => REQUESTERS });
    vi.stubGlobal("fetch", fetchMock);
    renderSelection();

    await screen.findByRole("button", { name: "Retry" });
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("combobox")).toBeInTheDocument();
  });

  it("stores the selection, navigates to /tickets, and shows the name in the shell", async () => {
    stubJson(REQUESTERS);
    renderSelection();

    await userEvent.selectOptions(await screen.findByRole("combobox"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(JSON.parse(sessionStorage.getItem(REQUESTER_STORAGE_KEY)!)).toEqual({
      id: 1,
      name: "Alice Johnson",
    });
    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
    expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
  });
});
