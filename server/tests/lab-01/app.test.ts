import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../src/app";

// Lab 01 has no routes yet; this only proves the Express app boots and that
// Vitest + Supertest are wired up.
describe("express app", () => {
  it("responds to requests", async () => {
    const response = await request(app).get("/");

    expect(response.status).toBe(404);
  });
});
