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

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: expect.any(Number), name: "Account and Access" },
      { id: expect.any(Number), name: "Hardware" },
      { id: expect.any(Number), name: "Software" },
      { id: expect.any(Number), name: "Network" },
    ]);
    const ids = res.body.map((c: { id: number }) => c.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });
});
