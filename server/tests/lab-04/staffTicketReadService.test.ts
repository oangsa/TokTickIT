import { expect, it } from "vitest";
import { listAssignableUsers } from "../../src/services/staffTicketReadService.js";
import { parseAssignableUserQuery } from "../../src/services/assignableUserQueryValidator.js";
import { staffPrismaMock } from "../lab-03/support/staffFixture.js";
it("UNIT-08 fixed eligibility ANDs role/search before count and paging", async () => {
  const { mock, prisma } = staffPrismaMock();
  mock.user.count.mockResolvedValue(0);
  const result = await listAssignableUsers(prisma, parseAssignableUserQuery({ filters: JSON.stringify([{ field: "role", condition: "EQUAL", value: "REQUESTER" }]), search: " alice ", searchFields: "name,email" }));
  expect(mock.user.count.mock.calls[0][0].where).toEqual({ AND: [
    { isActive: true, deleted: false, isSystem: false, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } },
    { OR: [{ name: { contains: "alice", mode: "insensitive" } }, { email: { contains: "alice", mode: "insensitive" } }] },
    { role: { equals: "REQUESTER" } },
  ] });
  expect(result.items).toEqual([]); expect(result.pagination.totalItems).toBe(0); expect(mock.user.findMany).not.toHaveBeenCalled();
});
