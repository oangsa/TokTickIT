import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const prismaMock = vi.hoisted(() => ({
  developmentRequester: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  category: { findMany: vi.fn() },
  relatedSystem: { findMany: vi.fn() },
}));

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => prismaMock }));

import { app } from "../../src/app.js";

const SEED_AUDIT = {
  createdBy: "seed",
  createdAt: new Date("2026-08-20T01:00:00.000Z"),
  updatedBy: "seed",
  updatedAt: new Date("2026-08-20T01:00:00.000Z"),
};

/* The serialized form of SEED_AUDIT: `res.json` renders Date as ISO-8601 UTC. */
const SEED_AUDIT_JSON = {
  createdBy: "seed",
  createdAt: "2026-08-20T01:00:00.000Z",
  updatedBy: "seed",
  updatedAt: "2026-08-20T01:00:00.000Z",
};

const HARDWARE = { id: 2, name: "Hardware", isActive: true, deleted: false, ...SEED_AUDIT };
const VPN = { id: 4, name: "VPN", isActive: true, deleted: false, ...SEED_AUDIT };

const MASTER_DTO_KEYS = [
  "createdAt",
  "createdBy",
  "deleted",
  "id",
  "isActive",
  "name",
  "updatedAt",
  "updatedBy",
].sort();

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
  prismaMock.category.findMany.mockResolvedValue([HARDWARE]);
  prismaMock.relatedSystem.findMany.mockResolvedValue([VPN]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

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

// API-03 (BR-07, BR-71-73). Issue #21 widened this route from the Lab 1
// `{ id, name }` body to the full `CategoryDTO` and moved it onto the shared
// reference-data router.
describe("GET /api/categories (API-03)", () => {
  it("requires valid requester context", async () => {
    const res = await request(app).get("/api/categories");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("REQUESTER_CONTEXT_INVALID");
    expect(prismaMock.category.findMany).not.toHaveBeenCalled();
  });

  it("returns a raw 200 array of full CategoryDTO objects", async () => {
    const res = await request(app).get("/api/categories").set("X-Requester-Id", "1");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toEqual({
      id: 2,
      name: "Hardware",
      isActive: true,
      deleted: false,
      ...SEED_AUDIT_JSON,
    });
    expect(Object.keys(res.body[0]).sort()).toEqual(MASTER_DTO_KEYS);
  });

  it("asks Prisma for active, non-deleted rows only", async () => {
    await request(app).get("/api/categories").set("X-Requester-Id", "1");

    expect(prismaMock.category.findMany).toHaveBeenCalledWith({
      where: { deleted: false, isActive: true },
      orderBy: { id: "asc" },
    });
  });

  it("returns an empty array when no active Category exists", async () => {
    prismaMock.category.findMany.mockResolvedValue([]);

    const res = await request(app).get("/api/categories").set("X-Requester-Id", "1");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// API-04 (BR-08, BR-71-73).
describe("GET /api/related-systems (API-04)", () => {
  it("requires valid requester context", async () => {
    const res = await request(app).get("/api/related-systems");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("REQUESTER_CONTEXT_INVALID");
    expect(prismaMock.relatedSystem.findMany).not.toHaveBeenCalled();
  });

  it("returns a raw 200 array of full RelatedSystemDTO objects", async () => {
    const res = await request(app).get("/api/related-systems").set("X-Requester-Id", "1");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toEqual({
      id: 4,
      name: "VPN",
      isActive: true,
      deleted: false,
      ...SEED_AUDIT_JSON,
    });
    expect(Object.keys(res.body[0]).sort()).toEqual(MASTER_DTO_KEYS);
  });

  it("asks Prisma for active, non-deleted rows only", async () => {
    await request(app).get("/api/related-systems").set("X-Requester-Id", "1");

    expect(prismaMock.relatedSystem.findMany).toHaveBeenCalledWith({
      where: { deleted: false, isActive: true },
      orderBy: { id: "asc" },
    });
  });

  it("returns an empty array when no active Related System exists", async () => {
    prismaMock.relatedSystem.findMany.mockResolvedValue([]);

    const res = await request(app).get("/api/related-systems").set("X-Requester-Id", "1");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
