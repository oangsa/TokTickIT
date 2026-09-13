import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../src/app.js";

describe("authorization transport @issue-2", () => {
  it("API-12 rejects protected routes without a bearer token @issue-2", async () => {
    const response = await request(app).get("/api/categories");
    expect(response.status).toBe(401);
    expect(response.body.code).toBe("UNAUTHENTICATED");
  });

  it("API-12 does not accept the removed requester selector as authentication @issue-2", async () => {
    const response = await request(app).get("/api/categories").set("X-Requester-Id", "1");
    expect(response.status).toBe(401);
    expect(response.body.code).toBe("UNAUTHENTICATED");
  });
});
