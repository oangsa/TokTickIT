import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "../helpers/AuthenticatedRequesterApp.js";

function stubApi() {
  const fetchMock = vi.fn(async (input: string | URL, _init?: RequestInit) => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => (String(input).includes("/tickets?") ? [] : []),
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requester selector removal", () => {
  it("does not render the former selector route or persist requester identity", () => {
    stubApi();

    render(
      <MemoryRouter initialEntries={["/requesters"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.queryByText(/Development Requester/i)).not.toBeInTheDocument();
    expect(sessionStorage.getItem("toktickit.requester")).toBeNull();
  });

  it("uses the authenticated ticket transport without the requester header", async () => {
    const fetchMock = stubApi();

    render(
      <MemoryRouter initialEntries={["/tickets"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const ticketCall = fetchMock.mock.calls.find(([input]) => String(input).includes("/api/users/me/tickets?"));

    expect(ticketCall).toBeDefined();
    expect(new Headers(ticketCall?.[1]?.headers).get("Authorization")).toBe("Bearer test-access-token");
    expect(new Headers(ticketCall?.[1]?.headers).get("X-Requester-Id")).toBeNull();
  });
});
