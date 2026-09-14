import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "../../src/App.js";
import { authenticatedRequest, clearAccessToken, getAccessToken, refreshAccessToken, setAccessToken } from "../../src/auth/authTransport.js";

function response(body: unknown, status = 200): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  clearAccessToken(false);
  vi.unstubAllGlobals();
});

describe("Issue 3 AuthProvider", () => {
  it("UI-01 holds protected routes during bootstrap and loads identity after refresh @issue-3", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ accessToken: "memory-token", expiresIn: 600 }))
      .mockResolvedValueOnce(response({ publicId: "u-1", name: "Alice", email: "alice@example.com", role: "REQUESTER", isActive: true, mustChangePassword: false, sessionStage: "FULL" }));
    vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter initialEntries={["/tickets"]}><App /></MemoryRouter>);
    expect(screen.queryByText("My Tickets")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("heading", { name: "My Tickets" })).toBeInTheDocument());
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/api/auth/refresh");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("/api/auth/me");
    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(sessionStorage.getItem("accessToken")).toBeNull();
  });

  it("UI-08 coordinates concurrent expired requests through one refresh and one retry @issue-3", async () => {
    let dataRequests = 0;
    let refreshRequests = 0;
    const lockRequest = vi.fn(async (_name: string, _options: { ifAvailable?: boolean }, callback: (lock: object | null) => Promise<string | null>) => callback({}));
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const path = String(input).replace(/^https?:\/\/[^/]+/, "");
      if (path === "/api/data") {
        dataRequests += 1;
        return Promise.resolve(dataRequests <= 2
          ? response({ code: "ACCESS_TOKEN_EXPIRED" }, 401)
          : response({ ok: true }));
      }
      if (path === "/api/auth/refresh") {
        refreshRequests += 1;
        return Promise.resolve(response({ accessToken: "fresh-token", expiresIn: 600 }));
      }
      return Promise.resolve(response(undefined, 404));
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", { locks: { request: lockRequest } });
    setAccessToken("expired-token", 600, false);

    const results = await Promise.all([
      authenticatedRequest<{ ok: boolean }>("/api/data"),
      authenticatedRequest<{ ok: boolean }>("/api/data"),
    ]);

    expect(results).toEqual([{ ok: true }, { ok: true }]);
    expect(refreshRequests).toBe(1);
    expect(dataRequests).toBe(4);
    expect(lockRequest).toHaveBeenCalledTimes(1);
  });

  it("UI-08 bounds refresh requests and preserves the bearer on transient failure @issue-3", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ code: "INTERNAL_SERVER_ERROR" }, 500));
    vi.stubGlobal("fetch", fetchMock);
    setAccessToken("expired-token", 600, false);

    await expect(refreshAccessToken("expired-token")).rejects.toMatchObject({ status: 500 });
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ signal: expect.any(Object) }));
    expect(getAccessToken()).toBe("expired-token");
  });

  it("UI-08 clears the bearer only for an invalid refresh session @issue-3", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ code: "SESSION_INVALID" }, 401));
    vi.stubGlobal("fetch", fetchMock);
    setAccessToken("expired-token", 600, false);

    await expect(refreshAccessToken("expired-token")).rejects.toMatchObject({ code: "SESSION_INVALID" });
    expect(getAccessToken()).toBeNull();
  });

  it("UI-08 uses the approved BroadcastChannel name for remote session updates @issue-3", async () => {
    class FakeBroadcastChannel {
      static instances: FakeBroadcastChannel[] = [];
      readonly name: string;
      readonly messages: unknown[] = [];
      private listener: ((event: MessageEvent) => void) | null = null;

      constructor(name: string) {
        this.name = name;
        FakeBroadcastChannel.instances.push(this);
      }

      addEventListener(_type: string, listener: (event: MessageEvent) => void): void {
        this.listener = listener;
      }

      postMessage(message: unknown): void {
        this.messages.push(message);
      }

      emit(message: unknown): void {
        this.listener?.({ data: message } as MessageEvent);
      }
    }

    vi.resetModules();
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    const transport = await import("../../src/auth/authTransport.js");
    const listener = vi.fn();
    const unsubscribe = transport.subscribeAuthEvents(listener);
    transport.setAccessToken("memory-only", 600);
    expect(FakeBroadcastChannel.instances[0]?.name).toBe("toktickit-auth");
    expect(FakeBroadcastChannel.instances[0]?.messages[0]).toMatchObject({ type: "ACCESS_UPDATED", accessToken: "memory-only" });
    expect(FakeBroadcastChannel.instances[0]?.messages[0]).toMatchObject({ accessToken: "memory-only" });
    FakeBroadcastChannel.instances[0]?.emit({ type: "ACCESS_UPDATED", expiresIn: 600 });
    expect(transport.getAccessToken()).toBe("memory-only");
    FakeBroadcastChannel.instances[0]?.emit({ type: "LOGOUT" });
    expect(listener).toHaveBeenCalledWith({ type: "LOGOUT" });
    transport.clearAccessToken(false);
    unsubscribe();
  });

  it("UI-08 shares one ephemeral refresh result across browser realms @issue-3", async () => {
    class FakeBroadcastChannel {
      static instances: FakeBroadcastChannel[] = [];
      private listener: ((event: MessageEvent) => void) | null = null;

      constructor(readonly name: string) {
        FakeBroadcastChannel.instances.push(this);
      }

      addEventListener(_type: string, listener: (event: MessageEvent) => void): void {
        this.listener = listener;
      }

      postMessage(message: unknown): void {
        queueMicrotask(() => {
          for (const instance of FakeBroadcastChannel.instances) {
            if (instance !== this) instance.listener?.({ data: message } as MessageEvent);
          }
        });
      }
    }

    let lockHeld = false;
    const lockRequest = vi.fn(async (_name: string, options: { ifAvailable?: boolean }, callback: (lock: object | null) => Promise<string | null>) => {
      if (lockHeld && options.ifAvailable) return callback(null);
      lockHeld = true;
      try {
        return await callback({});
      } finally {
        lockHeld = false;
      }
    });
    let dataRequests = 0;
    let refreshRequests = 0;
    let settleRefresh!: (value: Response) => void;
    const pendingRefresh = new Promise<Response>((resolve) => {
      settleRefresh = resolve;
    });
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const path = String(input).replace(/^https?:\/\/[^/]+/, "");
      if (path === "/api/data") {
        dataRequests += 1;
        return Promise.resolve(dataRequests <= 2 ? response({ code: "ACCESS_TOKEN_EXPIRED" }, 401) : response({ ok: true }));
      }
      if (path === "/api/auth/refresh") {
        refreshRequests += 1;
        return pendingRefresh;
      }
      return Promise.resolve(response(undefined, 404));
    });

    vi.resetModules();
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    vi.stubGlobal("navigator", { locks: { request: lockRequest } });
    vi.stubGlobal("fetch", fetchMock);
    const transportA = await import("../../src/auth/authTransport.js");
    vi.resetModules();
    const transportB = await import("../../src/auth/authTransport.js");
    transportA.subscribeAuthEvents(() => {});
    transportB.subscribeAuthEvents(() => {});
    transportA.beginAuthSession();
    transportA.setAccessToken("old-token", 600);
    await waitFor(() => expect(transportB.getAccessToken()).toBe("old-token"));
    transportA.setAccessToken("expired-token", 600, false);
    transportB.setAccessToken("expired-token", 600, false);

    const requests = [
      transportA.authenticatedRequest<{ ok: boolean }>("/api/data"),
      transportB.authenticatedRequest<{ ok: boolean }>("/api/data"),
    ];
    await waitFor(() => expect(lockRequest).toHaveBeenCalledTimes(2));
    expect(refreshRequests).toBe(1);
    settleRefresh(response({ accessToken: "fresh-token", expiresIn: 600 }));

    await expect(Promise.all(requests)).resolves.toEqual([{ ok: true }, { ok: true }]);
    expect(refreshRequests).toBe(1);
    expect(transportB.getAccessToken()).toBe("fresh-token");
    transportA.clearAccessToken(false);
    transportB.clearAccessToken(false);
  });

  it("UI-08 abandons a retry when a newer browser session arrives during refresh @issue-3", async () => {
    class FakeBroadcastChannel {
      static instances: FakeBroadcastChannel[] = [];
      private listener: ((event: MessageEvent) => void) | null = null;

      constructor(readonly name: string) {
        FakeBroadcastChannel.instances.push(this);
      }

      addEventListener(_type: string, listener: (event: MessageEvent) => void): void {
        this.listener = listener;
      }

      postMessage(_message: unknown): void {}

      emit(message: unknown): void {
        this.listener?.({ data: message } as MessageEvent);
      }
    }

    let settleRefresh!: (value: Response) => void;
    const pendingRefresh = new Promise<Response>((resolve) => {
      settleRefresh = resolve;
    });
    let dataRequests = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const path = String(input).replace(/^https?:\/\/[^/]+/, "");
      if (path === "/api/data") {
        dataRequests += 1;
        return Promise.resolve(dataRequests === 1
          ? response({ code: "ACCESS_TOKEN_EXPIRED" }, 401)
          : response({ ok: true }));
      }
      if (path === "/api/auth/refresh") return pendingRefresh;
      return Promise.resolve(response(undefined, 404));
    });

    vi.resetModules();
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    vi.stubGlobal("fetch", fetchMock);
    const transport = await import("../../src/auth/authTransport.js");
    transport.subscribeAuthEvents(() => {});
    transport.setAccessToken("old-token", 600);

    const request = transport.authenticatedRequest<{ ok: boolean }>("/api/data");
    await waitFor(() => expect(fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/api/auth/refresh")).length).toBe(1));

    FakeBroadcastChannel.instances[0]?.emit({ type: "ACCESS_UPDATED", sessionId: "new-session", sessionStartedAt: Date.now() + 1000 });
    settleRefresh(response({ accessToken: "stale-refresh", expiresIn: 600 }));

    await expect(request).rejects.toMatchObject({ code: "ACCESS_TOKEN_EXPIRED" });
    expect(dataRequests).toBe(1);
    expect(transport.getAccessToken()).toBeNull();
  });
});
