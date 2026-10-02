import { z } from "zod";
import type { FormField, FormSection } from "../../forms/formTypes.js";
import type { LookupDefinition } from "../../components/Common/Lookup/types.js";

export interface ActionFormValues {
  description: string; result: string; assignedToUserPublicId: string;
  followUpRequired: boolean; followUpNote: string; attachmentNotes: string; attachmentIds: string[];
}
const length = (value: string, max: number) => Array.from(value.trim()).length <= max;
const prose = z.string().refine((value) => length(value, 2000), "Use at most 2000 characters.");
export const actionFormSchema = z.object({
  description: prose.refine((value) => value.trim().length > 0, "Description is required."),
  result: prose, assignedToUserPublicId: z.string(), followUpRequired: z.boolean(),
  followUpNote: z.string(), attachmentNotes: prose, attachmentIds: z.array(z.string()),
}).superRefine((values, context) => {
  if (values.followUpRequired && !values.followUpNote.trim()) context.addIssue({ code: "custom", path: ["followUpNote"], message: "Follow-Up Note is required." });
  if (values.followUpRequired && !length(values.followUpNote, 2000)) context.addIssue({ code: "custom", path: ["followUpNote"], message: "Use at most 2000 characters." });
});
export function actionSections(definition: LookupDefinition, displayValue: string, followUp: boolean, editing = false): FormSection<ActionFormValues>[] {
  const textarea = (name: "description" | "result" | "followUpNote" | "attachmentNotes", label: string, required = false): FormField<ActionFormValues> => ({ key: name, name, label, type: "textarea", rows: 3, maxLength: 2000, enforceMaxLength: false, showCount: true, required });
  return [{ key: "action-information", card: false, fields: [
    textarea("description", "Description", true),
    ...(editing ? [textarea("result", "Result")] : [{ key: "assignedToUserPublicId", name: "assignedToUserPublicId", label: "Assigned To", type: "lookup", definition, displayValue, clearable: true } as FormField<ActionFormValues>]),
    { key: "followUpRequired", name: "followUpRequired", label: "Follow-Up Required", type: "switch" },
    ...(followUp ? [textarea("followUpNote", "Follow-Up Note", true)] : []),
    textarea("attachmentNotes", "Attachment Notes"),
  ] }];
}

export interface CompletionValues { result: string; followUpRequired: boolean; followUpNote: string }
export const completionSchema = z.object({ result: prose.refine((value) => value.trim().length > 0, "Result is required."), followUpRequired: z.boolean(), followUpNote: z.string() }).superRefine((values, context) => {
  if (values.followUpRequired && !values.followUpNote.trim()) context.addIssue({ code: "custom", path: ["followUpNote"], message: "Follow-Up Note is required." });
  if (values.followUpRequired && !length(values.followUpNote, 2000)) context.addIssue({ code: "custom", path: ["followUpNote"], message: "Use at most 2000 characters." });
});
export function completionSections(followUp: boolean): FormSection<LifecycleValues>[] {
  return [{ key: "completion", card: false, fields: [
    { key: "result", name: "result", label: "Result", type: "textarea", required: true, maxLength: 2000, enforceMaxLength: false, showCount: true },
    { key: "followUpRequired", name: "followUpRequired", label: "Follow-Up Required", type: "switch" },
    ...(followUp ? [{ key: "followUpNote", name: "followUpNote", label: "Follow-Up Note", type: "textarea", required: true, maxLength: 2000, enforceMaxLength: false, showCount: true } as FormField<LifecycleValues>] : []),
  ] }];
}

export interface LifecycleValues extends CompletionValues { cancellationReason: string }
export const lifecycleSchema = (operation: "start" | "complete" | "cancel") => operation === "cancel"
  ? z.object({ result: z.string(), followUpRequired: z.boolean(), followUpNote: z.string(), cancellationReason: z.string().refine((value) => value.trim().length > 0 && length(value, 500), "Enter a Cancellation Reason of 1–500 characters.") })
  : z.intersection(completionSchema, z.object({ cancellationReason: z.string() }));
export const CANCEL_SECTIONS: FormSection<LifecycleValues>[] = [{ key: "cancellation", card: false, fields: [{ key: "cancellationReason", name: "cancellationReason", label: "Cancellation Reason", type: "textarea", required: true, maxLength: 500, enforceMaxLength: false, showCount: true }] }];
