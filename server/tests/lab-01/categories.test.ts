import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  userSession: { findUnique: vi.fn() },
  category: { findMany: vi.fn() },
}));

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => prismaMock }));

import {
  bearerToken,
  configureRequesterAuth,
  testUser,
  type RequesterTokens,
} from "../lab-02/support/authenticatedRequester.js";
import { app } from "../../src/app.js";

const ALICE = testUser({ id: 1, name: "Alice Johnson", email: "alice.johnson@example.com" });
let tokens: RequesterTokens;

beforeEach(async () => {
  vi.clearAllMocks();
  tokens = await configureRequesterAuth(prismaMock, [ALICE]);
  prismaMock.category.findMany.mockResolvedValue([
    { id: 1, name: "Account and Access" },
    { id: 2, name: "Hardware" },
    { id: 3, name: "Software" },
    { id: 4, name: "Network" },
  ]);
});

// Requires the DB to be migrated and seeded first (Issue 3):
//   npx prisma migrate dev && npm run prisma:seed
describe("GET /api/categories", () => {
  it("returns the four seeded categories in id order", async () => {
    const res = await request(app)
      .get("/api/categories")
      .set("Authorization", bearerToken(tokens, ALICE.id));

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
