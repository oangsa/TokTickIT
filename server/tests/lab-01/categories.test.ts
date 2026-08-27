import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

// Requires the DB to be migrated and seeded first (Issue 3):
//   npx prisma migrate dev && npm run prisma:seed
describe("GET /api/categories", () => {
  it("returns the four seeded categories in id order", async () => {
    // Issue 20 guards every Lab 2 endpoint except the bootstrap, so the header
    // is resolved from the bootstrap rather than hard-coded to a seeded id.
    const requesters = await request(app).get("/api/requesters");
    expect(requesters.status).toBe(200);
    const requesterId: number = requesters.body[0].id;

    const res = await request(app)
      .get("/api/categories")
      .set("X-Requester-Id", String(requesterId));

    // Issue 21 widened this route from the Lab 1 `{ id, name }` body to the
    // full CategoryDTO (api-spec Section 6.2), so the assertion checks the
    // seeded identity rather than the exact field set. The full DTO shape is
    // owned by `tests/lab-02/reference-data.api.test.ts`.
    expect(res.status).toBe(200);
    expect(res.body.map((c: { name: string }) => c.name)).toEqual([
      "Account and Access",
      "Hardware",
      "Software",
      "Network",
    ]);
    const ids = res.body.map((c: { id: number }) => c.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });
});
