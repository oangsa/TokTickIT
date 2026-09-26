import type { FormSection } from "../../forms/formTypes.js";

export const TICKET_FORM_RULES = {
  summary: { minLength: 3, maxLength: 150 },
  description: { minLength: 10, maxLength: 2000 },
  publicComment: { minLength: 1, maxLength: 2000 },
  internalNote: { minLength: 1, maxLength: 4000 },
} as const;

export interface TicketFormValues {
  categoryId?: number;
  relatedSystemId?: number;
  requestedPriority: string;
  summary: string;
  description: string;
}

export interface RequestInformationValues { content: string }
export const REQUEST_INFORMATION_SECTIONS: FormSection<RequestInformationValues>[] = [{
  key: "message", title: "Public message", fields: [{
    key: "content", name: "content", label: "Message", type: "textarea", rows: 5,
    required: true, maxLength: TICKET_FORM_RULES.publicComment.maxLength,
    enforceMaxLength: false, showCount: true, helpText: "Message will be public.", span: "full",
  }],
}];

export const TICKET_FORM_SECTIONS: FormSection<TicketFormValues>[] = [
  {
    key: "ticket",
    title: "Ticket details",
    fields: [
      { key: "categoryId", name: "categoryId", label: "Category", type: "select", options: [], required: true, span: "half" },
      { key: "relatedSystemId", name: "relatedSystemId", label: "Related System", type: "select", options: [], required: true, span: "half" },
      { key: "requestedPriority", name: "requestedPriority", label: "Requested Priority", type: "select", options: [
        { value: "LOW", label: "Low" },
        { value: "MEDIUM", label: "Medium" },
        { value: "HIGH", label: "High" },
      ], required: true, span: "half" },
      { key: "summary", name: "summary", label: "Summary", type: "text", required: true, maxLength: TICKET_FORM_RULES.summary.maxLength, showCount: true, span: "full" },
      { key: "description", name: "description", label: "Description", type: "textarea", required: true, maxLength: TICKET_FORM_RULES.description.maxLength, showCount: true, span: "full" },
    ],
  },
];
