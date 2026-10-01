import { describe, expect, it } from "vitest";
import { actionTransition, parseActionCreate, parseActionEdit, parseActionLifecycle, expectedVersion, requireActionKey } from "../../src/services/actionTakenService.js";
import { canonicalResourcePath, hashIdempotencyRequest } from "../../src/services/idempotencyRequest.js";
import { ActionTakenService } from "../../src/services/actionTakenService.js";
import { createBody, actionPrismaMock, ACTION_ID } from "./support/actionFixture.js";
import { actor, STAFF, TICKET_ID } from "../lab-03/support/staffFixture.js";

describe("UNIT-01 transition table", () => {
  const cases = [
    ["PLANNED", "start", "IN_PROGRESS"], ["PLANNED", "complete", null], ["PLANNED", "cancel", "CANCELLED"],
    ["IN_PROGRESS", "start", null], ["IN_PROGRESS", "complete", "COMPLETED"], ["IN_PROGRESS", "cancel", "CANCELLED"],
    ["COMPLETED", "start", null], ["COMPLETED", "complete", null], ["COMPLETED", "cancel", null],
    ["CANCELLED", "start", null], ["CANCELLED", "complete", null], ["CANCELLED", "cancel", null],
  ] as const;
  it.each(cases)("%s %s yields %s", (status, operation, next) => {
    if (next) expect(actionTransition(status, operation)).toBe(next);
    else expect(() => actionTransition(status, operation)).toThrow(expect.objectContaining({ code: "INVALID_ACTION_TRANSITION" }));
  });
});
describe("UNIT-02 normalization", () => {
  it.each([1, 2000])("Description accepts %i Unicode code points", (length) => {
    expect(parseActionCreate({ ...createBody, description: ` ${"😀".repeat(length)} ` }).description).toBe("😀".repeat(length));
  });
  it.each(["", " \n ", "😀".repeat(2001), null, 123])("invalid Description rejects", (description) => {
    expect(() => parseActionCreate({ ...createBody, description })).toThrow(expect.objectContaining({ details: [{ field: "description", message: expect.any(String) }] }));
  });
  it("Follow-Up normalizes false note, requires true note, and Attachment Notes blank to null", () => {
    expect(parseActionCreate({ ...createBody, followUpNote: "ignored", attachmentNotes: " \n " })).toMatchObject({ followUpNote: null, attachmentNotes: null });
    expect(parseActionCreate({ ...createBody, followUpRequired: true, followUpNote: ` ${"😀".repeat(2000)} ` })).toMatchObject({ followUpNote: "😀".repeat(2000) });
    for (const followUpNote of [null, "", " ", "x".repeat(2001)]) expect(() => parseActionCreate({ ...createBody, followUpRequired: true, followUpNote })).toThrow();
    expect(() => parseActionCreate({ ...createBody, attachmentNotes: "😀".repeat(2001) })).toThrow();
  });
  it("Result edit omission preserved, null allowed, nonblank required when text supplied", () => {
    const { assignedToUserPublicId: _id, attachmentNotes: _notes, ...editable } = createBody;
    const body = { ...editable, expectedVersion: 1 };
    expect(parseActionEdit(body)).not.toHaveProperty("result");
    expect(parseActionEdit({ ...body, result: null })).toHaveProperty("result", null);
    expect(parseActionEdit({ ...body, result: " 😀 " })).toHaveProperty("result", "😀");
    for (const result of [" ", "😀".repeat(2001)]) expect(() => parseActionEdit({ ...body, result })).toThrow();
  });
  it("Complete Result required and cancellation has exact 1..500 boundary", () => {
    expect(parseActionLifecycle("complete", { expectedVersion: 1, result: "😀".repeat(2000), followUpRequired: false })).toHaveProperty("result", "😀".repeat(2000));
    for (const result of [undefined, null, " ", "😀".repeat(2001)]) expect(() => parseActionLifecycle("complete", { expectedVersion: 1, result, followUpRequired: false })).toThrow();
    expect(parseActionLifecycle("cancel", { expectedVersion: 1, cancellationReason: ` ${"😀".repeat(500)} ` })).toHaveProperty("cancellationReason", "😀".repeat(500));
    for (const cancellationReason of [undefined, " ", "😀".repeat(501)]) expect(() => parseActionLifecycle("cancel", { expectedVersion: 1, cancellationReason })).toThrow();
  });
  it.each([0, -1, 1.5, "1", null, Number.MAX_SAFE_INTEGER + 1])("invalid expectedVersion %s", (value) => { expect(() => expectedVersion(value)).toThrow(); });
  it.each([undefined, "bad", [], "00000000-0000-0000-0000-000000000000"])("invalid key rejects", (value) => { expect(() => requireActionKey(value)).toThrow(); });
  it.each(["creatorUserId", "performedByUserId", "createdAt", "status", "result", "version"])("Create forbids client field %s", (field) => {
    expect(() => parseActionCreate({ ...createBody, [field]: "injected" })).toThrow();
  });
});
it("UNIT-03 mutation rechecks eligible assignee and rejects unavailable target", async () => {
  const { mock, prisma } = actionPrismaMock();
  mock.user.findFirst.mockResolvedValue(null);
  await expect(new ActionTakenService(prisma).assign(actor(), TICKET_ID, ACTION_ID, { assignedToUserPublicId: STAFF.publicId, expectedVersion: 1 })).rejects.toMatchObject({ code: "VALIDATION_ERROR", details: [{ field: "assignedToUserPublicId", message: expect.any(String) }] });
  expect(mock.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { publicId: STAFF.publicId, isActive: true, deleted: false, isSystem: false, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } } }));
  expect(mock.actionTaken.updateMany).not.toHaveBeenCalled();
});
it("UNIT-10 identity canonicalizes paths/body and isolates concrete resources/versions", () => {
  const path = `/api/tickets/${TICKET_ID}/actions/${ACTION_ID}/complete`;
  const body = parseActionLifecycle("complete", { result: " Done ", followUpRequired: false, followUpNote: "ignored", expectedVersion: 2 });
  const equivalent = parseActionLifecycle("complete", { expectedVersion: 2, followUpNote: null, result: "Done", followUpRequired: false });
  expect(canonicalResourcePath(`${path.toUpperCase()}/?extra=ignored`)).toBe(path);
  const hash = hashIdempotencyRequest("post", `${path}/?extra=ignored`, body);
  expect(hash).toBe(hashIdempotencyRequest("POST", path, equivalent));
  for (const [method, otherPath, otherBody] of [["PATCH", path, body], ["POST", path.replace(ACTION_ID, STAFF.publicId), body], ["POST", path.replace(TICKET_ID, STAFF.publicId), body], ["POST", path, { ...body, expectedVersion: 3 }]] as const) expect(hash).not.toBe(hashIdempotencyRequest(method, otherPath, otherBody));
  const left = parseActionCreate({ ...createBody, attachmentIds: [ACTION_ID, TICKET_ID] });
  const right = parseActionCreate({ ...createBody, attachmentIds: [TICKET_ID.toUpperCase(), ACTION_ID] });
  expect(hashIdempotencyRequest("POST", path, left)).toBe(hashIdempotencyRequest("POST", path, right));
});
