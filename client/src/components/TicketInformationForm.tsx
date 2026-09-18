import { CommonForm } from "./CommonForm.js";
import { useManagedForm } from "../forms/useManagedForm.js";
import type { FormField, FormSection } from "../forms/formTypes.js";

export interface TicketInformationValues {
  ticketNumber?: string;
  ticketDate: string;
  requesterName?: string;
  requesterEmail?: string;
  categoryName: string;
  relatedSystemName: string;
  requestedPriority: string;
  summary: string;
  description: string;
  createdBy?: string;
  updatedBy?: string;
  lastUpdated?: string;
}

export interface TicketInformationFormProps {
  values: TicketInformationValues;
  title?: string;
  includeTicketNumber?: boolean;
  includeRequester?: boolean;
  includeAuditFields?: boolean;
  className?: string;
}

export function TicketInformationForm({
  values,
  title,
  includeTicketNumber = false,
  includeRequester = true,
  includeAuditFields = false,
  className,
}: TicketInformationFormProps) {
  const form = useManagedForm<TicketInformationValues>({
    defaultValues: values,
    values,
  });

  const fields: FormField<TicketInformationValues>[] = [];

  if (includeTicketNumber) {
    fields.push({
      key: "ticketNumber",
      name: "ticketNumber",
      label: "Ticket Number",
      type: "text",
      span: "half",
    });
  }

  fields.push({
    key: "ticketDate",
    name: "ticketDate",
    label: "Ticket Date",
    type: "text",
    span: includeTicketNumber ? "half" : "full",
  });

  if (includeRequester) {
    fields.push(
      {
        key: "requesterName",
        name: "requesterName",
        label: "Requester Name",
        type: "text",
        span: "half",
      },
      {
        key: "requesterEmail",
        name: "requesterEmail",
        label: "Requester Email",
        type: "email",
        span: "half",
      },
    );
  }

  fields.push(
    {
      key: "categoryName",
      name: "categoryName",
      label: "Category",
      type: "text",
      span: "half",
    },
    {
      key: "relatedSystemName",
      name: "relatedSystemName",
      label: "Related System",
      type: "text",
      span: "half",
    },
    {
      key: "requestedPriority",
      name: "requestedPriority",
      label: "Requested Priority",
      type: "text",
      span: "half",
    },
    {
      key: "summary",
      name: "summary",
      label: "Summary",
      type: "text",
      span: "full",
    },
    {
      key: "description",
      name: "description",
      label: "Description",
      type: "textarea",
      rows: 4,
      span: "full",
    },
  );

  if (includeAuditFields) {
    fields.push(
      {
        key: "createdBy",
        name: "createdBy",
        label: "Created By",
        type: "text",
        span: "third",
      },
      {
        key: "updatedBy",
        name: "updatedBy",
        label: "Updated By",
        type: "text",
        span: "third",
      },
      {
        key: "lastUpdated",
        name: "lastUpdated",
        label: "Last Updated",
        type: "text",
        span: "third",
      },
    );
  }

  const sections: FormSection<TicketInformationValues>[] = [
    {
      key: "ticket-information",
      title,
      card: false,
      fields,
    },
  ];

  return (
    <CommonForm
      mode="view"
      form={form}
      sections={sections}
      className={className}
    />
  );
}

export default TicketInformationForm;
