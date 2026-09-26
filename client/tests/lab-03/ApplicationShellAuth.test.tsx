import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import App from "../../src/App.js";
import { clearAccessToken } from "../../src/auth/authTransport.js";
import { setViewportWidth } from "../setup.js";

function response(body: unknown, status = 200): Response { return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }); }
afterEach(() => { clearAccessToken(false); vi.unstubAllGlobals(); act(() => setViewportWidth(1024)); });

describe("Issue 3 authenticated shell", () => {
  it("UI-06 shows identity, role-aware navigation, password action, and logout @issue-3", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response({ accessToken: "token", expiresIn: 600 })).mockResolvedValueOnce(response({ publicId: "u-1", name: "Bob", email: "bob@example.com", role: "IT_STAFF", isActive: true, mustChangePassword: false, sessionStage: "FULL" })).mockImplementation(async (input: RequestInfo | URL) => String(input).endsWith("/api/auth/logout") ? response(undefined, 204) : response([]));
    vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter initialEntries={["/staff/tickets"]}><App /></MemoryRouter>);
    expect(await screen.findByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("IT STAFF")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ticket Queue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Change Password/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Logout" }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("UI-07 sends wrong-role navigation to standalone safe 403 @issue-3", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ accessToken: "token", expiresIn: 600 }))
      .mockResolvedValueOnce(response({ publicId: "u-1", name: "Alice", email: "alice@example.com", role: "REQUESTER", isActive: true, mustChangePassword: false, sessionStage: "FULL" }));
    vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter initialEntries={["/staff/tickets"]}><App /></MemoryRouter>);
    expect(await screen.findByText("403")).toBeInTheDocument();
    expect(screen.getByText("You do not have access to the requested resource.")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("keeps the shell and reports logout transport failure @issue-3", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ accessToken: "token", expiresIn: 600 }))
      .mockResolvedValueOnce(response({ publicId: "u-1", name: "Bob", email: "bob@example.com", role: "IT_STAFF", isActive: true, mustChangePassword: false, sessionStage: "FULL" }))
      .mockImplementation(async (input: RequestInfo | URL) => { if (String(input).endsWith("/api/auth/logout")) throw new Error("network unavailable"); return response([]); });
    vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter initialEntries={["/staff/tickets"]}><App /></MemoryRouter>);

    expect(await screen.findByText("Bob")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Logout" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to sign out right now. Please try again.");
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it.each([
    ["REQUESTER", "/tickets", "My Tickets", ["Create Ticket"]],
    ["IT_STAFF", "/staff/tickets", "Ticket Queue", []],
    ["ADMINISTRATOR", "/admin/users", "User Management", ["Tickets"]],
  ] as const)("shows only the permitted %s navigation @issue-3", async (role, path, expectedLink, extraLinks) => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ accessToken: "token", expiresIn: 600 }))
      .mockResolvedValueOnce(response({ publicId: "u-1", name: "Role User", email: "role@example.com", role, isActive: true, mustChangePassword: false, sessionStage: "FULL" }))
      .mockImplementation(async () => response([]));
    vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);

    expect(await screen.findByRole("link", { name: expectedLink })).toBeInTheDocument();
    for (const link of extraLinks) expect(screen.getByRole("link", { name: link })).toBeInTheDocument();
    if (role === "REQUESTER") expect(screen.queryByRole("link", { name: "Ticket Queue" })).not.toBeInTheDocument();
    if (role !== "ADMINISTRATOR") expect(screen.queryByRole("link", { name: "User Management" })).not.toBeInTheDocument();
  });

  it("keeps the mobile drawer open so logout failure remains visible @issue-3", async () => {
    setViewportWidth(390);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ accessToken: "token", expiresIn: 600 }))
      .mockResolvedValueOnce(response({ publicId: "u-1", name: "Bob", email: "bob@example.com", role: "IT_STAFF", isActive: true, mustChangePassword: false, sessionStage: "FULL" }))
      .mockImplementation(async (input: RequestInfo | URL) => { if (String(input).endsWith("/api/auth/logout")) throw new Error("network unavailable"); return response([]); });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/staff/tickets"]}><App /></MemoryRouter>);

    await screen.findByText("Bob");
    await user.click(screen.getByRole("button", { name: "Open navigation menu" }));
    await user.click(screen.getByRole("button", { name: "Logout" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to sign out right now. Please try again.");
    expect(screen.getByRole("button", { name: "Close navigation menu" })).toBeInTheDocument();
  });
});
