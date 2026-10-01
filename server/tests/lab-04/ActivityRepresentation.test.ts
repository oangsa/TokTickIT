import { expect, it } from "vitest";
import { toActivityDTO, type ActivityRow } from "../../src/services/activityRepresentation.js";
import { STAFF, REQUESTER, TICKET_ID } from "../lab-03/support/staffFixture.js";
import { ACTION_ID } from "./support/actionFixture.js";
function row(extra: Partial<ActivityRow> = {}): ActivityRow {
  return { publicId: ACTION_ID, ticket: { publicId: TICKET_ID }, action: "REQUESTER_RESOLUTION_CONFIRMED", performedBy: REQUESTER, createdAt: new Date("2026-10-01T00:00:00Z"), assignment: null, status: null, priority: null, actionTaken: null, ...extra };
}
it("UNIT-09 confirmation has Requester actor and no invented transition/detail", () => {
  expect(toActivityDTO(row())).toEqual({ publicId: ACTION_ID, ticketPublicId: TICKET_ID, action: "REQUESTER_RESOLUTION_CONFIRMED", performedBy: { publicId: REQUESTER.publicId, name: REQUESTER.name, role: "REQUESTER", isSystem: false }, createdAt: "2026-10-01T00:00:00.000Z" });
});
it("UNIT-09 migration snapshot emits SYSTEM and typed prior state; no raw metadata", () => {
  const dto = toActivityDTO(row({ action: "MIGRATED_TICKET_SNAPSHOT", performedBy: { ...STAFF, isSystem: true }, status: { previousStatus: null, status: "OPEN" }, priority: { previousPriority: null, priority: "HIGH" }, assignment: { previousOwner: null, assignedOwner: STAFF } }));
  expect(dto).toMatchObject({ performedBy: { isSystem: true }, statusChange: { previousStatus: null, status: "OPEN" }, priorityChange: { previousPriority: null, priority: "HIGH" }, assignment: { assignedTo: { email: STAFF.email } } });
  expect(JSON.stringify(dto)).not.toContain('"id":'); expect(dto).not.toHaveProperty("metadata");
});
it("UNIT-09 Action assignment uses public identities and typed assignee details", () => {
  expect(toActivityDTO(row({ action: "ACTION_ASSIGNED", performedBy: STAFF, actionTaken: { actionTaken: { publicId: ACTION_ID }, previousAssignee: null, assignedAssignee: STAFF } }))).toMatchObject({ actionTaken: { publicId: ACTION_ID, previousAssignedTo: null, assignedTo: { publicId: STAFF.publicId, email: STAFF.email } } });
});
