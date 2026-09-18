import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import App from "../../src/App.js";
import { clearAccessToken } from "../../src/auth/authTransport.js";

import { passwordSchema } from "../../src/pages/ChangePassword.js";

function response(body: unknown, status = 200): Response { return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }); }
afterEach(() => { clearAccessToken(false); vi.unstubAllGlobals(); });

describe("Issue 3 Change Password", () => {
  it.each([true, false])("updates requirement colors (red when validating, green when met) while typing (restricted=%s)", async (restricted) => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ accessToken: "test-session", expiresIn: 600 }))
      .mockResolvedValueOnce(response({ publicId: "u-1", name: "Alice", email: "alice@example.com", role: "REQUESTER", isActive: true, mustChangePassword: restricted, sessionStage: restricted ? "PASSWORD_CHANGE_REQUIRED" : "FULL" }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/change-password"]}><App /></MemoryRouter>);
    const input = await screen.findByLabelText("New Password *");
    const checklist = within(screen.getByRole("region", { name: "Password requirements" }));
    const items = checklist.getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(checklist.queryByText(/No more than/)).not.toBeInTheDocument();
    expect(checklist.queryByText(/Different from/)).not.toBeInTheDocument();
    items.forEach((item) => expect(item).toHaveClass("text-secondary"));

    if (!restricted) await user.type(screen.getByLabelText("Current Password *"), "OldPass1!");
    await user.type(input, "abcdefgh");
    expect(items[0]).toHaveClass("text-success");
    expect(items[1]).toHaveClass("text-danger");
    expect(items[2]).toHaveClass("text-success");
    expect(items[3]).toHaveClass("text-danger");
    expect(items[4]).toHaveClass("text-danger");

    await user.type(input, "A١ ");
    expect(items[0]).toHaveClass("text-success");
    expect(items[1]).toHaveClass("text-success");
    expect(items[2]).toHaveClass("text-success");
    expect(items[3]).toHaveClass("text-success");
    expect(items[4]).toHaveClass("text-danger");

    await user.type(input, "😀");
    items.forEach((item) => expect(item).toHaveClass("text-success"));

    await user.clear(input);
    items.forEach((item) => expect(item).toHaveClass("text-secondary"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("preserves max-length, different-password, and space allowance in passwordSchema logic", () => {
    const fullSchema = passwordSchema(false);
    const restrictedSchema = passwordSchema(true);

    // Over 128 characters rejected
    const tooLong = "Aa1!" + "x".repeat(125);
    const tooLongResult = restrictedSchema.safeParse({ newPassword: tooLong, confirmPassword: tooLong });
    expect(tooLongResult.success).toBe(false);
    if (!tooLongResult.success) {
      expect(tooLongResult.error.issues.some((i) => i.message.includes("no more than 128"))).toBe(true);
    }

    // Same as current password rejected in full session
    const sameResult = fullSchema.safeParse({ currentPassword: "Password1!", newPassword: "Password1!", confirmPassword: "Password1!" });
    expect(sameResult.success).toBe(false);
    if (!sameResult.success) {
      expect(sameResult.error.issues.some((i) => i.message.includes("must differ from the current password"))).toBe(true);
    }

    // Spaces allowed when symbol rule is satisfied
    const withSpaces = fullSchema.safeParse({ currentPassword: "OldPassword1!", newPassword: " New Pass 1! ", confirmPassword: " New Pass 1! " });
    expect(withSpaces.success).toBe(true);
  });

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
