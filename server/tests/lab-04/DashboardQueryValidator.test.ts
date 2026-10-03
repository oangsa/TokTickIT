import { expect, it } from "vitest";
import { actionActivityAt, compareActionActivity, parseDashboardQuery } from "../../src/services/dashboardQueryValidator.js";
it("UNIT-06 defaults and every integer 1..20; rejects non-scalar, fractional, out-of-range and unknown query", () => {
  expect(parseDashboardQuery({})).toEqual({ recentTicketsSize: 5, myActionsSize: 5, urgentTicketsSize: 5 });
  for (let value = 1; value <= 20; value++) expect(parseDashboardQuery({ recentTicketsSize: String(value) }).recentTicketsSize).toBe(value);
  for (const value of ["0", "21", "1.1", "NaN", "", " 5", "5e0", "-1", ["5"], { value: "5" }, 5, null]) expect(() => parseDashboardQuery({ recentTicketsSize: value })).toThrow();
  expect(() => parseDashboardQuery({ requesterId: "1" })).toThrow();
});
it("UNIT-05 lifecycle timestamp rather than updatedAt or unrelated lifecycle dates; descending ID tie", () => {
  const base = { id: 1, status: "PLANNED" as const, createdAt: new Date("2026-10-01"), startedAt: new Date("2026-10-02"), completedAt: new Date("2026-10-03"), cancelledAt: new Date("2026-10-04") };
  const planned = base;
  const started = { ...base, id: 2, status: "IN_PROGRESS" as const };
  const completed = { ...base, id: 3, status: "COMPLETED" as const };
  const cancelled = { ...base, id: 4, status: "CANCELLED" as const };
  expect([planned, started, completed, cancelled].map((row) => actionActivityAt(row).toISOString())).toEqual(["2026-10-01T00:00:00.000Z", "2026-10-02T00:00:00.000Z", "2026-10-03T00:00:00.000Z", "2026-10-04T00:00:00.000Z"]);
  expect([planned, completed, { ...completed, id: 5 }, started, cancelled].sort(compareActionActivity).map((row) => row.id)).toEqual([4, 5, 3, 2, 1]);
});
