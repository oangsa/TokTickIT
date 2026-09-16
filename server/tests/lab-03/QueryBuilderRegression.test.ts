import { describe, expect, it } from "vitest";
import { parseStaffQueueQuery } from "../../src/services/staffQueueQueryValidator.js";
import { staffQueueWhere, listStaffTickets } from "../../src/services/staffTicketReadService.js";
import { staffPrismaMock, staffTicketRow } from "./support/staffFixture.js";

describe("UNIT-17 Queue QueryBuilder boundary @issue-5", () => {
  it("ORs literal search fields under AND and maps public owner relations", () => {
    const where = staffQueueWhere(parseStaffQueueQuery({ search: "100%", searchFields: "summary,requesterName", filters: JSON.stringify([{ field: "ownerPublicId", condition: "ISNULL", value: "" }, { field: "itPriority", condition: "EQUAL", value: "HIGH" }]) }));
    expect(where).toEqual({ AND: [{ deleted: false }, { OR: [{ summary: { contains: "100\\%", mode: "insensitive" } }, { requester: { is: { name: { contains: "100\\%", mode: "insensitive" } } } }] }, { ownerUserId: null }, { itPriority: { equals: "HIGH" } }] });
  });
  it("pages operational buckets without ordering assigned owners by their IDs", async () => {
    const { prisma, mock } = staffPrismaMock();
    mock.ticket.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    mock.ticket.findMany.mockResolvedValueOnce([staffTicketRow()]).mockResolvedValueOnce([staffTicketRow()]);
    await listStaffTickets(prisma, parseStaffQueueQuery({ pageSize: "2" }));
    expect(mock.ticket.findMany.mock.calls.map(([query]) => query.where.AND[1])).toEqual([{ ownerUserId: null, itPriority: "HIGH" }, { ownerUserId: null, itPriority: "MEDIUM" }]);
    expect(mock.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead" });
  });
});
