import { useMemo } from "react";
import { z } from "zod";
import { Modal } from "../../components/Common/Modal.js";
import { CommonForm } from "../../components/Common/Form/CommonForm.js";
import { useManagedForm } from "../../forms/useManagedForm.js";
import type { FormField, FormSection } from "../../forms/formTypes.js";
import { useAuthenticatedApi } from "../../auth/useAuthenticatedApi.js";
import { actionUserLookup } from "../../lookups/actionUserLookup.js";

export interface ActionFilterValues { status: string; assignedToUserPublicId: string; assignedName: string; performedByUserPublicId: string; performedName: string; unassigned: boolean; unknownPerformer: boolean; followUpRequired: string; createdDate: string }
export const EMPTY_ACTION_FILTERS: ActionFilterValues = { status: "", assignedToUserPublicId: "", assignedName: "", performedByUserPublicId: "", performedName: "", unassigned: false, unknownPerformer: false, followUpRequired: "", createdDate: "" };
const optionalUser = z.union([z.literal(""), z.string().uuid("Select a valid User.")]).optional().transform((value) => value ?? "");
const filterSchema = z.object({ status: z.enum(["", "PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional().transform((value) => value ?? ""), assignedToUserPublicId: optionalUser, assignedName: z.string(), performedByUserPublicId: optionalUser, performedName: z.string(), unassigned: z.boolean(), unknownPerformer: z.boolean(), followUpRequired: z.enum(["", "true", "false"]).optional().transform((value) => value ?? ""), createdDate: z.string().refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Choose a valid date.") });
export function actionFilterExpressions(values: ActionFilterValues) {
  const filters: { field: string; condition: string; value: string | boolean }[] = [];
  if (values.status) filters.push({ field: "status", condition: "EQUAL", value: values.status });
  for (const [field, missing] of [["assignedToUserPublicId", values.unassigned], ["performedByUserPublicId", values.unknownPerformer]] as const) {
    if (missing) filters.push({ field, condition: "ISNULL", value: "" });
    else if (values[field]) filters.push({ field, condition: "EQUAL", value: values[field] });
  }
  if (values.followUpRequired) filters.push({ field: "followUpRequired", condition: "EQUAL", value: values.followUpRequired === "true" });
  if (values.createdDate) {
    const from = new Date(`${values.createdDate}T00:00:00Z`); const until = new Date(from); until.setUTCDate(until.getUTCDate() + 1);
    filters.push({ field: "createdAt", condition: "GREATEROREQUAL", value: from.toISOString() }, { field: "createdAt", condition: "LESSER", value: until.toISOString() });
  }
  return filters;
}
export function ActionFilters({ values, ticketPublicId, requester, onApply, onClose }: { values: ActionFilterValues; ticketPublicId: string; requester: boolean; onApply: (values: ActionFilterValues) => void; onClose: () => void }) {
  const request = useAuthenticatedApi();
  const definitions = useMemo(() => ({ assignedToUserPublicId: actionUserLookup(request, ticketPublicId, requester, "assignedTo"), performedByUserPublicId: actionUserLookup(request, ticketPublicId, requester, "performedBy") }), [request, ticketPublicId, requester]);
  const form = useManagedForm<ActionFilterValues>({ schema: filterSchema, defaultValues: values });
  const userField = (name: "assignedToUserPublicId" | "performedByUserPublicId", label: string, displayName: "assignedName" | "performedName", disabled: boolean): FormField<ActionFilterValues> => ({ key: name, name, label, type: "lookup", definition: definitions[name], displayName, clearable: true, disabled });
  const sections: FormSection<ActionFilterValues>[] = [{ key: "action-filters", card: false, fields: [
    { key: "status", name: "status", label: "Status", type: "select", placeholder: "All", options: ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map((value) => ({ value, label: value.replaceAll("_", " ") })) },
    userField("assignedToUserPublicId", "Assigned To", "assignedName", form.watch("unassigned")),
    { key: "unassigned", name: "unassigned", label: "Only unassigned", type: "switch" },
    userField("performedByUserPublicId", "Performed By", "performedName", form.watch("unknownPerformer")),
    { key: "unknownPerformer", name: "unknownPerformer", label: "Only unknown performer", type: "switch" },
    { key: "followUpRequired", name: "followUpRequired", label: "Follow-Up Required", type: "select", placeholder: "All", options: [{ value: "true", label: "Yes" }, { value: "false", label: "No" }] },
    { key: "createdDate", name: "createdDate", label: "Created Date", type: "date", helpText: "UTC date" },
  ] }];
  return <Modal open title="Filter Actions" onClose={onClose}><CommonForm form={form} sections={sections} onCancel={onClose} onSubmit={onApply} submitLabel="Apply" /></Modal>;
}
