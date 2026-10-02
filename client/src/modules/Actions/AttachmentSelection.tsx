import { useMemo, useState } from "react";
import type { Attachment, Ticket } from "../../api.js";
import type { CustomFieldRenderProps } from "../../forms/formTypes.js";
import type { ActionFormValues } from "../../constants/forms/action.js";
import type { LookupDefinition } from "../../components/Common/Lookup/types.js";
import { LookupModal } from "../../components/Common/Lookup/LookupModal.js";
import { Button } from "../../components/Common/Button.js";

export function AttachmentSelection({ ticket, field, selected, inputRef }: { ticket: Ticket; field: CustomFieldRenderProps<ActionFormValues>; selected: string[]; inputRef: (element: HTMLButtonElement | null) => void }) {
  const [open, setOpen] = useState(false);
  const definition = useMemo<LookupDefinition<Attachment>>(() => ({
    title: "Select existing Attachments", columns: [{ key: "originalName", label: "Name" }, { key: "sizeBytes", label: "Size (bytes)", sortable: false }],
    getValue: (file) => file.attachmentId, getDisplayValue: (file) => file.originalName,
    searchPlaceholder: "Search attachments", emptyMessage: "No eligible attachments", noMatchMessage: "No matching attachments", defaultSortKey: "originalName",
    fetchData: async ({ searchTerm, page, limit, sortDir }) => {
      const rows = ticket.attachments.filter((file) => file.ticketPublicId === ticket.publicId && !file.deleted && !file.removalReason && !selected.includes(file.attachmentId) && file.originalName.toLowerCase().includes(searchTerm.trim().toLowerCase())).sort((left, right) => left.originalName.localeCompare(right.originalName) * (sortDir === "desc" ? -1 : 1));
      return { data: rows.slice((page - 1) * limit, page * limit), total: rows.length };
    },
  }), [ticket, selected]);
  return <>
    <span ref={(element) => inputRef(element?.querySelector("button") ?? null)}><Button aria-label="Select existing" id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={field.disabled} onClick={() => !field.disabled && setOpen(true)}>Select existing</Button></span>
    <ul className="list-unstyled mt-2">{selected.map((id) => {
      const file = ticket.attachments.find((attachment) => attachment.attachmentId === id);
      return <li key={id} className="d-flex flex-wrap align-items-center gap-2 py-2"><span className="text-break">{file?.originalName ?? "Previously associated file (unavailable)"}{file?.deleted ? " (removed)" : ""}</span><Button variant="tertiary" disabled={field.disabled} aria-label={`Remove ${file?.originalName ?? "unavailable file"} association`} onClick={() => !field.disabled && field.setValue(selected.filter((value) => value !== id))}>Remove</Button></li>;
    })}</ul>
    <LookupModal open={open && !field.disabled} disabled={field.disabled} definition={definition} onClose={() => setOpen(false)} onSelect={(file) => { if (!field.disabled) { field.setValue([...selected, file.attachmentId]); setOpen(false); } }} />
  </>;
}
