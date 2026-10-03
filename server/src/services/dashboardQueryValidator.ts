import { invalidField, record } from "./staffQueueQueryValidator.js";

export function parseDashboardQuery(input: unknown, operational = false) {
  if (!record(input)) invalidField("query");
  const query = input;
  const keys = operational ? ["recentTicketsSize", "myActionsSize", "urgentTicketsSize"] : ["recentTicketsSize"];
  for (const key of Object.keys(input)) if (!keys.includes(key)) invalidField(key);
  function size(field: string): number {
    const value = query[field];
    if (value === undefined) return 5;
    if (typeof value !== "string" || !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 20) invalidField(field);
    return Number(value);
  }
  return { recentTicketsSize: size("recentTicketsSize"), myActionsSize: operational ? size("myActionsSize") : 5, urgentTicketsSize: operational ? size("urgentTicketsSize") : 5 };
}

export type DashboardSizes = ReturnType<typeof parseDashboardQuery>;
interface ActionActivity {
  id: number;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
}
export function actionActivityAt(action: ActionActivity): Date {
  // Database lifecycle constraints guarantee the relevant timestamp exists.
  switch (action.status) {
    case "COMPLETED": return action.completedAt!;
    case "CANCELLED": return action.cancelledAt!;
    case "IN_PROGRESS": return action.startedAt!;
    case "PLANNED": return action.createdAt;
  }
}
export function compareActionActivity(left: ActionActivity, right: ActionActivity): number {
  return actionActivityAt(right).getTime() - actionActivityAt(left).getTime() || right.id - left.id;
}
