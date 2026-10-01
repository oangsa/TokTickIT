import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { STAFF, ADMIN, REQUESTER, staffPrismaMock } from "../lab-03/support/staffFixture.js";
import { bearerToken, configureRequesterAuth, type RequesterTokens } from "../lab-02/support/authenticatedRequester.js";

const { mock } = staffPrismaMock();
vi.mock("../../src/prisma.js", () => ({ getPrisma: () => mock }));
import { app } from "../../src/app.js";
let tokens: RequesterTokens;
beforeEach(async () => {
  vi.clearAllMocks();
  tokens = await configureRequesterAuth(mock, [STAFF, ADMIN, REQUESTER]);
  mock.user.count.mockResolvedValue(12);
  mock.user.findMany.mockResolvedValue([{ publicId: STAFF.publicId, name: STAFF.name, email: STAFF.email, role: STAFF.role }]);
});
describe("API-19/22 assignable collection", () => {
  it("returns bounded second page and pagination with email", async () => {
    const response = await request(app).get("/api/users/assignable?pageNumber=2&pageSize=5&sort=role:desc").set("Authorization", bearerToken(tokens, STAFF.id));
    expect(response.status).toBe(200);
    expect(JSON.parse(response.headers["x-pagination"])).toMatchObject({ pageNumber: 2, pageSize: 5, totalItems: 12 });
    expect(response.body[0]).toEqual({ publicId: STAFF.publicId, name: STAFF.name, email: STAFF.email, role: "IT_STAFF" });
    expect(mock.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 5, take: 5, orderBy: [{ role: "desc" }, { publicId: "asc" }] }));
  });
});
it.each([STAFF, ADMIN])("API-19 Staff/Admin role $role can use bounded collection", async (user) => {
  const response = await request(app).get("/api/users/assignable").set("Authorization", bearerToken(tokens, user.id)).set("Origin", "http://localhost:5173");
  expect(response.status).toBe(200); expect(response.headers["cache-control"]).toBe("no-store"); expect(response.headers["access-control-expose-headers"]).toContain("X-Pagination");
  expect(mock.user.count.mock.calls[0][0].where.AND[0]).toEqual({ isActive: true, deleted: false, isSystem: false, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } });
});
it("API-19 Requester access forbidden", async () => {
  expect((await request(app).get("/api/users/assignable").set("Authorization", bearerToken(tokens, REQUESTER.id))).status).toBe(403);
  expect(mock.user.count).not.toHaveBeenCalled();
});
it("API-22 trimmed insensitive name/email search AND role filter and bounded paging", async () => {
  const response = await request(app).get("/api/users/assignable").query({ search: " staff ", searchFields: "name,email", filters: JSON.stringify([{ field: "role", condition: "EQUAL", value: "IT_STAFF" }]), sort: "email:desc", pageSize: "1" }).set("Authorization", bearerToken(tokens, STAFF.id));
  expect(response.status).toBe(200);
  expect(mock.user.count.mock.calls[0][0].where.AND).toContainEqual({ OR: [{ name: { contains: "staff", mode: "insensitive" } }, { email: { contains: "staff", mode: "insensitive" } }] });
  expect(mock.user.count.mock.calls[0][0].where.AND).toContainEqual({ role: { equals: "IT_STAFF" } });
  expect(mock.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 1, orderBy: [{ email: "desc" }, { publicId: "asc" }] }));
});
it.each([{ pageSize: "101" }, { pageNumber: "0" }, { pageNumber: "1e2" }, { search: "staff" }, { searchFields: "role" }, { filters: "{" }, { sort: "createdAt:desc" }, { isSystem: "true" }, { search: ["x", "y"] }, { filters: JSON.stringify([{ field: "role", condition: "CONTAINS", value: "IT" }]) }])("API-22 malformed query %# safe 400 before count", async (query) => {
  const response = await request(app).get("/api/users/assignable").query(query).set("Authorization", bearerToken(tokens, STAFF.id));
  expect(response.status).toBe(400); expect(response.body.code).toBe("VALIDATION_ERROR"); expect(mock.user.count).not.toHaveBeenCalled();
});
it("API-22 Requester filter returns no eligible rows and huge valid page is empty", async () => {
  mock.user.count.mockResolvedValueOnce(0);
  const response = await request(app).get("/api/users/assignable").query({ filters: JSON.stringify([{ field: "role", condition: "EQUAL", value: "REQUESTER" }]) }).set("Authorization", bearerToken(tokens, STAFF.id));
  expect(response.body).toEqual([]); expect(JSON.parse(response.headers["x-pagination"]).totalItems).toBe(0);
  const huge = await request(app).get("/api/users/assignable?pageNumber=9007199254740991").set("Authorization", bearerToken(tokens, STAFF.id));
  expect(huge.status).toBe(200); expect(huge.body).toEqual([]); expect(mock.user.findMany).not.toHaveBeenCalled();
});
