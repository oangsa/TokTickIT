import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useNavigate } from "react-router-dom";
import App from "../../src/App.js";
import { clearAccessToken } from "../../src/auth/authTransport.js";

afterEach(() => { clearAccessToken(false); vi.unstubAllGlobals(); });

function ErrorLauncher() {
  const navigate = useNavigate();
  return <button onClick={() => navigate("/error", { state: { status: 403, title: "unsafe backend title" } })}>Open forbidden page</button>;
}

describe("Issue 3 safe auth errors", () => {
  it("UI-38 renders fixed safe error copy without shell or caller text @issue-3", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ code: "SESSION_INVALID" }) }));
    render(<MemoryRouter initialEntries={[{ pathname: "/error", state: { status: 403, title: "database secret" } }]}><App /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("500")).toBeInTheDocument());
    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
    expect(screen.queryByText("database secret")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("UI-38 uses the authenticated role home for Back after a live 403 navigation @issue-3", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: "token", expiresIn: 600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ publicId: "u-1", name: "Staff", email: "staff@example.com", role: "IT_STAFF", isActive: true, mustChangePassword: false, sessionStage: "FULL" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/staff/tickets"]}><ErrorLauncher /><App /></MemoryRouter>);

    await screen.findByText("Staff");
    await user.click(screen.getByRole("button", { name: "Open forbidden page" }));
    expect(await screen.findByText("403")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/staff/tickets");
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
