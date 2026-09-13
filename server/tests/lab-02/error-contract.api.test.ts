import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import {
  bearerToken,
  configureRequesterAuth,
  testUser,
  type RequesterTokens,
} from "./support/authenticatedRequester.js";

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  userSession: { findUnique: vi.fn() },
  developmentRequester: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  category: { findMany: vi.fn() },
}));

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => prismaMock }));

import { app } from "../../src/app.js";

const ALICE = testUser({ id: 1, name: "Alice Johnson", email: "alice.johnson@example.com" });
let tokens: RequesterTokens;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  // `vi.restoreAllMocks()` in `afterEach` also resets the Prisma `vi.fn()`s,
  // so the re-arming must come after the spy setup.
  vi.clearAllMocks();
  tokens = await configureRequesterAuth(prismaMock, [ALICE]);
  prismaMock.category.findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("error contract (API-62, API-63, API-64, API-73)", () => {
  it("returns the central envelope on a 400", async () => {
    const res = await request(app)
      .post("/api/users/me/tickets")
      .set("Authorization", bearerToken(tokens, ALICE.id))
      .send({});

    // `details` is optional (api-spec Section 4.1); this validation error has
    // details because the request body is missing its required fields.
    expect(res.status).toBe(400);
    expect(Object.keys(res.body).sort()).toEqual(
      ["statusCode", "code", "message", "error", "details"].sort(),
    );
  });

  it("returns the central envelope on a 404", async () => {
    const res = await request(app)
      .get("/api/nope")
      .set("Authorization", bearerToken(tokens, ALICE.id));

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "The requested resource was not found.",
      error: "Not Found",
    });
    expect("details" in res.body).toBe(false);
  });

  it("returns a safe envelope on an unexpected 500", async () => {
    prismaMock.category.findMany.mockRejectedValue(
      new Error("connect ECONNREFUSED 127.0.0.1:5432 password=hunter2"),
    );

    const res = await request(app)
      .get("/api/categories")
      .set("Authorization", bearerToken(tokens, ALICE.id));

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      statusCode: 500,
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
      error: "Internal Server Error",
    });
    const bodyText = JSON.stringify(res.body);
    expect(bodyText).not.toContain("ECONNREFUSED");
    expect(bodyText).not.toContain("hunter2");
    expect(bodyText).not.toContain("password");
    expect(bodyText).not.toContain("at ");
  });

  it("logs only a sanitized class name for an unexpected error", async () => {
    prismaMock.category.findMany.mockRejectedValue(
      new Error("connect ECONNREFUSED 127.0.0.1:5432 password=hunter2"),
    );

    await request(app)
      .get("/api/categories")
      .set("Authorization", bearerToken(tokens, ALICE.id));

    expect(errorSpy).toHaveBeenCalled();
    const logged = errorSpy.mock.calls.map((call) => call.join(" ")).join(" ");
    expect(logged).toContain("INTERNAL_SERVER_ERROR");
    expect(logged).toContain("Error");
    expect(logged).not.toContain("ECONNREFUSED");
    expect(logged).not.toContain("hunter2");
    expect(logged).not.toContain("password");
    expect(logged).not.toContain("at ");
  });

  it("echoes a valid incoming X-Request-Id", async () => {
    const res = await request(app)
      .get("/api/health")
      .set("X-Request-Id", "4c22442d-e38d-43e5-b957-edc19111d242");

    expect(res.headers["x-request-id"]).toBe("4c22442d-e38d-43e5-b957-edc19111d242");
  });

  it("generates an X-Request-Id when the incoming value is malformed", async () => {
    const res = await request(app).get("/api/health").set("X-Request-Id", "not-a-uuid");

    expect(res.headers["x-request-id"]).toBeDefined();
    expect(res.headers["x-request-id"]).not.toBe("not-a-uuid");
    expect(res.headers["x-request-id"]).toMatch(UUID_PATTERN);
  });

  it("returns X-Request-Id on error responses too", async () => {
    const res = await request(app).get("/api/categories");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
    expect(res.headers["x-request-id"]).toBeDefined();
    expect(res.headers["x-request-id"]).toMatch(UUID_PATTERN);
  });

  it("logs only the allowlisted fields", async () => {
    await request(app).get("/api/health");

    const lastCall = logSpy.mock.calls.at(-1);
    expect(lastCall).toBeDefined();
    const entry = JSON.parse(lastCall![0] as string);
    expect(Object.keys(entry).sort()).toEqual(
      ["durationMs", "errorCode", "method", "requestId", "route", "status"].sort(),
    );
    expect(entry.route).toBe("/api/health");
  });

  it("never logs seeded sensitive markers", async () => {
    await request(app)
      .get("/api/nope")
      .query({ secret: "MARKER_QUERY" })
      .set("X-Request-Id", "4c22442d-e38d-43e5-b957-edc19111d242")
      .set("Authorization", bearerToken(tokens, ALICE.id));

    const logged = [
      ...logSpy.mock.calls.map((call) => call.join(" ")),
      ...errorSpy.mock.calls.map((call) => call.join(" ")),
    ].join(" ");
    expect(logged).not.toContain("MARKER_QUERY");
    expect(logged).not.toContain("Authorization");
    expect(logged).not.toContain("secret");
    expect(logged).not.toContain("DATABASE_URL");
  });

  it("records the central error code on a failing request", async () => {
    await request(app)
      .get("/api/nope")
      .set("Authorization", bearerToken(tokens, ALICE.id));

    const lastCall = logSpy.mock.calls.at(-1);
    const entry = JSON.parse(lastCall![0] as string);
    expect(entry.errorCode).toBe("NOT_FOUND");
    expect(entry.status).toBe(404);
  });
});
