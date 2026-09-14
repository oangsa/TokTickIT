import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import App from "../../src/App.js";
import { clearAccessToken } from "../../src/auth/authTransport.js";

function response(body: unknown, status = 200): Response { return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }); }

afterEach(() => { clearAccessToken(false); vi.unstubAllGlobals(); });

describe("Issue 3 Login", () => {
  it("UI-02 submits documented credentials and Remember Me, then routes by identity @issue-3", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ code: "SESSION_INVALID" }, 401))
      .mockResolvedValueOnce(response({ accessToken: "token", expiresIn: 600 }))
      .mockResolvedValueOnce(response({ publicId: "u-1", name: "Alice", email: "alice@example.com", role: "REQUESTER", isActive: true, mustChangePassword: false, sessionStage: "FULL" }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/login"]}><App /></MemoryRouter>);
    await user.type(await screen.findByLabelText("Email *"), "alice@example.com");
    await user.type(screen.getByLabelText("Password *"), "Password1!");
    await user.click(screen.getByLabelText("Remember me"));
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
    const loginCall = fetchMock.mock.calls.find((call) => String(call[0]).endsWith("/api/auth/login"));
    expect(JSON.parse(String((loginCall?.[1] as RequestInit).body))).toEqual({ email: "alice@example.com", password: "Password1!", rememberMe: true });
  });

  it("UI-03 keeps rate-limit feedback safe and generic @issue-3", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ code: "SESSION_INVALID" }, 401))
      .mockResolvedValueOnce(response({ code: "RATE_LIMITED" }, 429));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/login"]}><App /></MemoryRouter>);
    await user.type(await screen.findByLabelText("Email *"), "alice@example.com");
    await user.type(screen.getByLabelText("Password *"), "Password1!");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Too many login attempts. Try again later.", { exact: true })).toBeInTheDocument();
  });
});
