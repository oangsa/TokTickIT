import { describe, expect, it, vi, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../../src/App.js";
import { clearAccessToken } from "../../src/auth/authTransport.js";

afterEach(() => { clearAccessToken(false); vi.unstubAllGlobals(); });

describe("Issue 3 accessibility", () => {
  it("UI-36 gives auth controls labels and visible tooltip labels @issue-3", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ code: "SESSION_INVALID" }) }));
    render(<MemoryRouter initialEntries={["/login"]}><App /></MemoryRouter>);
    expect(await screen.findByLabelText("Email *")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "tt-main");
    expect(screen.getByRole("main")).toHaveAttribute("tabindex", "-1");
    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(toggle).toHaveAttribute("title", "Show password");
    act(() => toggle.focus());
    await waitFor(() => expect(screen.getByRole("tooltip", { name: "Show password" })).toBeVisible());
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });
});
