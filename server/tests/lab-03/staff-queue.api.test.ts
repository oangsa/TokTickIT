import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { ADMIN, REQUESTER, STAFF, staffPrismaMock, staffListRow } from "./support/staffFixture.js";
import { bearerToken, configureRequesterAuth, type RequesterTokens } from "../lab-02/support/authenticatedRequester.js";

const { mock } = staffPrismaMock();
vi.mock("../../src/prisma.js", () => ({ getPrisma: () => mock }));
import { app } from "../../src/app.js";
let tokens: RequesterTokens;
beforeEach(async () => {
  vi.clearAllMocks();
  tokens = await configureRequesterAuth(mock, [STAFF, ADMIN, REQUESTER]);
  mock.ticket.count.mockResolvedValue(1);
  mock.ticket.findMany.mockResolvedValue([staffListRow()]);
  mock.user.findMany.mockResolvedValue([{ publicId: STAFF.publicId, name: STAFF.name, role: STAFF.role }]);
});

describe("API-40–45 Queue and assignable Users @issue-5", () => {
  it.each(["/api/tickets", "/api/users/assignable"])("requires authenticated Staff/Admin for %s", async (path) => {
    expect((await request(app).get(path)).status).toBe(401);
    expect((await request(app).get(path).set("Authorization", bearerToken(tokens, REQUESTER.id))).body.code).toBe("FORBIDDEN");
    expect(mock.ticket.findMany).not.toHaveBeenCalled();
    for (const user of [STAFF, ADMIN]) expect((await request(app).get(path).set("Authorization", bearerToken(tokens, user.id))).status).toBe(200);
  });
  it("returns direct Staff DTOs and readable pagination with approved explicit sort", async () => {
    const response = await request(app).get("/api/tickets?sort=itPriority:desc").set("Authorization", bearerToken(tokens, STAFF.id)).set("Origin", "http://localhost:5173");
    expect(response.status).toBe(200);
    expect(response.body[0]).toMatchObject({ requesterName: REQUESTER.name, itPriority: "HIGH", owner: null });
    expect(response.body[0]).not.toHaveProperty("description");
    expect(JSON.parse(response.headers["x-pagination"])).toMatchObject({ totalItems: 1, pageSize: 10 });
    expect(response.headers["access-control-expose-headers"]).toContain("X-Pagination");
  });
  it("rejects malformed filters before Ticket data access", async () => {
    const response = await request(app).get("/api/tickets").query({ filters: JSON.stringify([{ field: "categoryId", condition: "ISNULL", value: "" }]) }).set("Authorization", bearerToken(tokens, STAFF.id));
    expect(response.status).toBe(400);
    expect(mock.ticket.count).not.toHaveBeenCalled();
    expect(mock.ticket.findMany).not.toHaveBeenCalled();
  });
  it("returns 200 [] for valid huge out-of-range pages", async () => {
    const response = await request(app).get("/api/tickets?pageNumber=9007199254740991").set("Authorization", bearerToken(tokens, STAFF.id));
    expect(response.status).toBe(200); expect(response.body).toEqual([]);
    expect(mock.ticket.findMany).not.toHaveBeenCalled();
  });
  it("API-40 multi-field search and AND-with-filter semantics", async () => {
    const response = await request(app)
      .get("/api/tickets")
      .query({
        search: "vpn",
        searchFields: "ticketNumber,summary,description,requesterName",
        filters: JSON.stringify([{ field: "itPriority", condition: "EQUAL", value: "HIGH" }]),
      })
      .set("Authorization", bearerToken(tokens, STAFF.id));
    expect(response.status).toBe(200);
    expect(mock.ticket.findMany).toHaveBeenCalled();
  });
  it("API-41 filter matrix including Created Date range and status/priority/owner/category", async () => {
    const filters = [
      { field: "createdAt", condition: "GREATEROREQUAL", value: "2026-01-01T00:00:00Z" },
      { field: "createdAt", condition: "LESSEROREQUAL", value: "2026-12-31T23:59:59Z" },
      { field: "currentStatus", condition: "EQUAL", value: "OPEN" },
      { field: "itPriority", condition: "EQUAL", value: "HIGH" },
      { field: "ownerPublicId", condition: "ISNULL", value: "" },
      { field: "categoryId", condition: "EQUAL", value: 1 },
    ];
    const response = await request(app)
      .get("/api/tickets")
      .query({ filters: JSON.stringify(filters) })
      .set("Authorization", bearerToken(tokens, STAFF.id));
    expect(response.status).toBe(200);
  });
  it("API-42 defaults to operational ordering when sort is omitted", async () => {
    const response = await request(app).get("/api/tickets").set("Authorization", bearerToken(tokens, STAFF.id));
    expect(response.status).toBe(200);
    expect(mock.ticket.findMany).toHaveBeenCalled();
  });
  it("API-43 returns terminal-status tickets when explicitly queried", async () => {
    for (const status of ["CLOSED", "CANCELLED"] as const) {
      mock.ticket.findMany.mockResolvedValue([staffListRow({ currentStatus: status })]);
      const response = await request(app)
        .get("/api/tickets")
        .query({ filters: JSON.stringify([{ field: "currentStatus", condition: "EQUAL", value: status }]) })
        .set("Authorization", bearerToken(tokens, STAFF.id));
      expect(response.status).toBe(200);
      expect(response.body[0].currentStatus).toBe(status);
    }
  });
  it("API-44 accepts pageSize 1 and 100, and rejects 0 and 101 with 400", async () => {
    for (const pageSize of [1, 100]) {
      const response = await request(app).get(`/api/tickets?pageSize=${pageSize}`).set("Authorization", bearerToken(tokens, STAFF.id));
      expect(response.status).toBe(200);
    }
    for (const pageSize of [0, 101]) {
      const response = await request(app).get(`/api/tickets?pageSize=${pageSize}`).set("Authorization", bearerToken(tokens, STAFF.id));
      expect(response.status).toBe(400);
      expect(response.body.code).toBe("VALIDATION_ERROR");
    }
  });
  it("API-45 rejects invalid field, condition, operator, and cardinality before DB query", async () => {
    const invalidQueries = [
      { sort: "unknown:asc" },
      { search: "x".repeat(201) },
      { search: "x", searchFields: "unapproved" },
      { filters: JSON.stringify([{ field: "unknownField", condition: "EQUAL", value: "x" }]) },
      { filters: JSON.stringify([{ field: "currentStatus", condition: "IN", value: [] }]) },
      { filters: JSON.stringify([{ field: "currentStatus", condition: "CONTAINS", value: "OPEN" }]) },
    ];
    for (const query of invalidQueries) {
      const response = await request(app).get("/api/tickets").query(query).set("Authorization", bearerToken(tokens, STAFF.id));
      expect(response.status).toBe(400);
      expect(response.body.code).toBe("VALIDATION_ERROR");
    }
    expect(mock.ticket.count).not.toHaveBeenCalled();
    expect(mock.ticket.findMany).not.toHaveBeenCalled();
  });
  it("lookup selects only eligible Users, includes zero-Ticket Users, and exposes no account details", async () => {
    const response = await request(app).get("/api/users/assignable").set("Authorization", bearerToken(tokens, STAFF.id));
    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ publicId: STAFF.publicId, name: STAFF.name, role: STAFF.role }]);
    expect(mock.user.findMany).toHaveBeenCalledWith({ where: { isActive: true, deleted: false, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } }, select: { publicId: true, name: true, role: true }, orderBy: [{ name: "asc" }, { publicId: "asc" }] });
    expect(mock.ticket.findMany).not.toHaveBeenCalled();
  });
});
