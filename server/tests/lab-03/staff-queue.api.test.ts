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
  it("lookup selects only eligible Users, includes zero-Ticket Users, and exposes no account details", async () => {
    const response = await request(app).get("/api/users/assignable").set("Authorization", bearerToken(tokens, STAFF.id));
    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ publicId: STAFF.publicId, name: STAFF.name, role: STAFF.role }]);
    expect(mock.user.findMany).toHaveBeenCalledWith({ where: { isActive: true, deleted: false, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } }, select: { publicId: true, name: true, role: true }, orderBy: [{ name: "asc" }, { publicId: "asc" }] });
    expect(mock.ticket.findMany).not.toHaveBeenCalled();
  });
});
