import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { assertLab3TargetEnvironment } from "../../src/databaseTargetGuard.js";
import { resolveAllowedOrigins } from "../../src/middleware/cors.js";

const GUARDED_TARGET_ENV = {
  NODE_ENV: "test",
  TEST_DATABASE_URL: "postgresql://lab3:lab3@localhost:5432/toktickit_lab3_test",
  DATABASE_URL: "postgresql://lab3:lab3@localhost:5432/toktickit_lab3_test",
  DIRECT_URL: "postgresql://lab3:lab3@localhost:5432/toktickit_lab3_test",
  LAB3_BASELINE_DATABASE_URL: "postgresql://app:app@localhost:5432/toktickit_dev",
  LAB3_BASELINE_DIRECT_URL: "postgresql://app:app@localhost:5432/toktickit_dev",
};

describe("auth transport @issue-2", () => {
  it("API-54 accepts only an explicit disposable Lab 3 target @issue-2", () => {
    expect(assertLab3TargetEnvironment(GUARDED_TARGET_ENV)).toBe(
      GUARDED_TARGET_ENV.TEST_DATABASE_URL,
    );
    expect(() =>
      assertLab3TargetEnvironment({
        ...GUARDED_TARGET_ENV,
        DATABASE_URL: GUARDED_TARGET_ENV.TEST_DATABASE_URL,
        DIRECT_URL: GUARDED_TARGET_ENV.TEST_DATABASE_URL,
        LAB3_BASELINE_DATABASE_URL: GUARDED_TARGET_ENV.TEST_DATABASE_URL,
      }),
    ).toThrow();
    expect(() =>
      assertLab3TargetEnvironment({
        ...GUARDED_TARGET_ENV,
        TEST_DATABASE_URL: "postgresql://lab3:lab3@localhost:5432/toktickit_dev",
        DATABASE_URL: "postgresql://lab3:lab3@localhost:5432/toktickit_dev",
        DIRECT_URL: "postgresql://lab3:lab3@localhost:5432/toktickit_dev",
      }),
    ).toThrow();
  });

  it("API-54 fails closed when NODE_ENV is absent and no origin is configured @issue-2", () => {
    expect(() => resolveAllowedOrigins({})).toThrow();
  });

  it("API-54 allows exact origin and exposes safe transport headers @issue-2", async () => {
    const response = await request(app).options("/api/auth/refresh").set("Origin", "http://localhost:5173");
    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(response.headers["access-control-allow-headers"]).toContain("Authorization");
    expect(response.headers["access-control-expose-headers"]).toContain("X-Pagination");
    expect(response.headers["access-control-expose-headers"]).toContain("X-Request-Id");
    expect(response.headers["access-control-allow-origin"]).not.toBe("*");
  });

  it("API-54 rejects cookie mutation from an unapproved origin @issue-2", async () => {
    const response = await request(app).post("/api/auth/refresh").set("Origin", "https://evil.example");
    expect(response.status).toBe(403);
    expect(response.body.code).toBe("FORBIDDEN");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
  });

  it("API-54 replaces malformed correlation IDs and keeps responses no-store @issue-2", async () => {
    const response = await request(app)
      .get("/api/health")
      .set("X-Request-Id", "not-a-uuid");

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(response.headers["cache-control"]).toBe("no-store");
  });
});
