import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { app } from "../../src/app.js";
import { errorHandler } from "../../src/http/errors.js";

describe("auth error contract @issue-2", () => {
  it("API-54 keeps unknown routes in the centralized envelope @issue-2", async () => {
    const response = await request(app).get("/api/no-such-route");
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ statusCode: 401, code: "UNAUTHENTICATED", error: "Unauthorized" });
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("API-54 redacts internal error details from logs and responses @issue-2", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = {
      headersSent: false,
      locals: {} as Record<string, unknown>,
      getHeader: () => "request-id",
      status: () => response,
      json: (body: unknown) => { response.body = body; return response; },
      body: undefined as unknown,
    };

    errorHandler(
      new Error("postgres://user:password@db/internal?token=secret"),
      {} as never,
      response as never,
      vi.fn(),
    );

    expect(response.body).toEqual({
      statusCode: 500,
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
      error: "Internal Server Error",
    });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.[0]).not.toContain("password");
    expect(log.mock.calls[0]?.[0]).not.toContain("secret");
    log.mockRestore();
  });
});
