import { describe, it, expect, afterEach, vi } from "vitest";
import { checkSystem } from "../../src/api.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("checkSystem", () => {
  it("rejects instead of hanging when the backend never responds", async () => {
    // A backend that is "down" without refusing the connection: the request
    // opens and no response ever comes. Only the abort signal can end it —
    // drop the signal and this promise (and the UI's "Loading…") never settles.
    vi.stubGlobal(
      "fetch",
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
        }),
    );

    const realTimeout = AbortSignal.timeout.bind(AbortSignal);
    vi.spyOn(AbortSignal, "timeout").mockImplementation(() => realTimeout(50));

    await expect(checkSystem()).rejects.toThrow(/Cannot reach the TokTickIT API/);
  });
});
