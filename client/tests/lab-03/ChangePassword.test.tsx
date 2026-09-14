import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import App from "../../src/App.js";
import { clearAccessToken } from "../../src/auth/authTransport.js";

function response(body: unknown, status = 200): Response { return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }); }
afterEach(() => { clearAccessToken(false); vi.unstubAllGlobals(); });

describe("Issue 3 Change Password", () => {
  it("UI-04 shows restricted fields, validates confirmation, and requires fresh login @issue-3", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ accessToken: "restricted", expiresIn: 600 }))
      .mockResolvedValueOnce(response({ publicId: "u-1", name: "Alice", email: "alice@example.com", role: "REQUESTER", isActive: true, mustChangePassword: true, sessionStage: "PASSWORD_CHANGE_REQUIRED" }))
      .mockResolvedValueOnce(response(undefined, 204));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/change-password"]}><App /></MemoryRouter>);
    expect(await screen.findByLabelText("New Password *")).toBeInTheDocument();
    expect(screen.queryByLabelText("Current Password *")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("New Password *"), "NewPass1!");
    await user.type(screen.getByLabelText("Confirm New Password *"), "Different1!");
    await user.click(screen.getByRole("button", { name: "Change Password" }));
    expect(await screen.findByText("Passwords do not match.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await user.clear(screen.getByLabelText("Confirm New Password *"));
    await user.type(screen.getByLabelText("Confirm New Password *"), "NewPass1!");
    await user.click(screen.getByRole("button", { name: "Change Password" }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByText("Password changed successfully. Please sign in again.")).toBeInTheDocument();
    const changeCall = fetchMock.mock.calls.find((call) => String(call[0]).endsWith("/api/auth/change-password"));
    expect(JSON.parse(String((changeCall?.[1] as RequestInit).body))).toEqual({ newPassword: "NewPass1!" });
  });

  it("UI-05 submits normal-session current/new passwords and returns to fresh login @issue-3", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ accessToken: "full", expiresIn: 600 }))
      .mockResolvedValueOnce(response({ publicId: "u-1", name: "Alice", email: "alice@example.com", role: "REQUESTER", isActive: true, mustChangePassword: false, sessionStage: "FULL" }))
      .mockResolvedValueOnce(response(undefined, 204));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/change-password"]}><App /></MemoryRouter>);
    await user.type(await screen.findByLabelText("Current Password *"), "OldPass1!");
    await user.type(screen.getByLabelText("New Password *"), "NewPass2!");
    await user.type(screen.getByLabelText("Confirm New Password *"), "NewPass2!");
    await user.click(screen.getByRole("button", { name: "Change Password" }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByText("Password changed successfully. Please sign in again.")).toBeInTheDocument();
    const changeCall = fetchMock.mock.calls.find((call) => String(call[0]).endsWith("/api/auth/change-password"));
    expect(JSON.parse(String((changeCall?.[1] as RequestInit).body))).toEqual({ currentPassword: "OldPass1!", newPassword: "NewPass2!" });
  });

  it("keeps safe expiry feedback when the session ends during submission @issue-3", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ accessToken: "full", expiresIn: 600 }))
      .mockResolvedValueOnce(response({ publicId: "u-1", name: "Alice", email: "alice@example.com", role: "REQUESTER", isActive: true, mustChangePassword: false, sessionStage: "FULL" }))
      .mockResolvedValueOnce(response({ code: "SESSION_INVALID" }, 401));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/change-password"]}><App /></MemoryRouter>);

    await user.type(await screen.findByLabelText("Current Password *"), "OldPass1!");
    await user.type(screen.getByLabelText("New Password *"), "NewPass3!");
    await user.type(screen.getByLabelText("Confirm New Password *"), "NewPass3!");
    await user.click(screen.getByRole("button", { name: "Change Password" }));

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByText("Your session has expired. Please sign in again.")).toBeInTheDocument();
  });
});
