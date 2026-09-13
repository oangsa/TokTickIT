import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../src/app.js";

describe("auth error contract @issue-2", () => {
  it("keeps unknown routes in the centralized envelope", async () => {
    const response = await request(app).get("/api/no-such-route");
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ statusCode: 401, code: "UNAUTHENTICATED", error: "Unauthorized" });
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
    expect(response.headers["cache-control"]).toBe("no-store");
  });
});
