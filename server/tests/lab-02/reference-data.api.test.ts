import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const prismaMock = vi.hoisted(() => ({
  developmentRequester: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  category: { findMany: vi.fn() },
}));

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => prismaMock }));

import { app } from "../../src/app.js";

const ALICE = {
  id: 1,
  name: "Alice Johnson",
  email: "alice.johnson@example.com",
  isActive: true,
  deleted: false,
  createdBy: "seed",
  createdAt: new Date("2026-08-20T01:00:00.000Z"),
  updatedBy: "seed",
  updatedAt: new Date("2026-08-20T01:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.developmentRequester.findMany.mockResolvedValue([ALICE]);
  prismaMock.developmentRequester.findFirst.mockResolvedValue(ALICE);
  prismaMock.category.findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// API-03 (`GET /api/categories` returning the full `CategoryDTO`) is owned by
// Issue #21 and is deliberately not covered here.
describe("GET /api/requesters (API-02)", () => {
  it("returns a raw 200 array without an X-Requester-Id header", async () => {
    const res = await request(app).get("/api/requesters");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns the full DevelopmentRequesterDTO shape", async () => {
    const res = await request(app).get("/api/requesters");

    expect(res.status).toBe(200);
    expect(res.body[0]).toEqual({
      ...ALICE,
      createdAt: "2026-08-20T01:00:00.000Z",
      updatedAt: "2026-08-20T01:00:00.000Z",
    });
    expect(Object.keys(res.body[0]).sort()).toEqual(
      [
        "createdAt",
        "createdBy",
        "deleted",
        "email",
        "id",
        "isActive",
        "name",
        "updatedAt",
        "updatedBy",
      ].sort(),
    );
  });

  it("asks Prisma for active, non-deleted rows only", async () => {
    await request(app).get("/api/requesters");

    expect(prismaMock.developmentRequester.findMany).toHaveBeenCalledWith({
      where: { deleted: false, isActive: true },
      orderBy: { id: "asc" },
    });
  });

  it("returns an empty array when no active Requester exists", async () => {
    prismaMock.developmentRequester.findMany.mockResolvedValue([]);

    const res = await request(app).get("/api/requesters");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("is not served outside development and test", async () => {
    // The response carries full DevelopmentRequesterDTOs, names and emails
    // included, with no requester context required. api-spec Section 1 confines
    // that to development/test networks and Section 3.4 is explicit that CORS
    // is not an API boundary, so the restriction is enforced by the route.
    vi.stubEnv("NODE_ENV", "production");

    const res = await request(app).get("/api/requesters");

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
    expect(prismaMock.developmentRequester.findMany).not.toHaveBeenCalled();

    vi.unstubAllEnvs();
  });
});
