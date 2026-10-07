import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { z } from "zod";
import { CommonForm } from "../../src/components/Common/Form/CommonForm.js";
import { Modal } from "../../src/components/Common/Modal.js";
import { useManagedForm } from "../../src/forms/useManagedForm.js";
import { ApiResponseError } from "../../src/api.js";
import { LookupField } from "../../src/components/Common/Lookup/LookupField.js";
import { LookupModal } from "../../src/components/Common/Lookup/LookupModal.js";
import { MetricCards } from "../../src/modules/Dashboard/DashboardShared.js";
import { StatusChip } from "../../src/modules/Tickets/components/StatusChip.js";
const definition = { title: "Choose User", columns: [{ key: "name", label: "Name" }], fetchData: async () => ({ data: [{ id: "one", name: "Alex" }], total: 1 }), getValue: (row: { id: string; name: string }) => row.id, getDisplayValue: (row: { id: string; name: string }) => row.name, searchPlaceholder: "Search users", emptyMessage: "None", noMatchMessage: "No matches" };
function Harness({ disabled = false, serverError = false }: { disabled?: boolean; serverError?: boolean }) {
  const form = useManagedForm<{ owner: string }>({ schema: z.object({ owner: z.string().min(1, "Owner required.") }), defaultValues: { owner: "" } });
  return <Modal open title="Parent form" onClose={() => undefined}><CommonForm form={form} disabled={disabled} sections={[{ key: "fields", card: false, fields: [{ key: "owner", name: "owner", label: "Owner", type: "lookup", definition, clearable: true, helpText: "Select owner" }] }]} onSubmit={() => { if (serverError) form.mapServerErrors(new ApiResponseError(400, "VALIDATION_ERROR", [{ field: "owner", message: "User no longer eligible." }]), new Set(["owner"])); }} /></Modal>;
}
it("Lookup required/server errors associate with owning control and focus it; disabled field cannot open", async () => {
  const user = userEvent.setup(); const rendered = render(<MemoryRouter><Harness /></MemoryRouter>);
  await user.click(screen.getByRole("button", { name: "Submit" }));
  const field = screen.getByLabelText("Owner");
  expect(field).toHaveAttribute("aria-invalid", "true");
  expect(field).toHaveAttribute("aria-describedby", `${field.id}-description ${field.id}-error`);
  expect(field).toHaveFocus();
  rendered.unmount(); render(<MemoryRouter><Harness disabled /></MemoryRouter>);
  const trigger = screen.getByRole("button", { name: "Lookup Owner" });
  expect(trigger).toBeDisabled(); await user.click(trigger);
  expect(screen.queryByRole("dialog", { name: "Choose User" })).not.toBeInTheDocument();
});
it("Nested Lookup isolates parent dialog, traps keyboard and restores invoking focus", async () => {
  const user = userEvent.setup(); render(<MemoryRouter><Harness /></MemoryRouter>);
  const parent = screen.getByRole("dialog", { name: "Parent form" });
  const trigger = screen.getByRole("button", { name: "Lookup Owner" });
  await user.click(trigger);
  const lookup = screen.getByRole("dialog", { name: "Choose User" });
  expect(parent).toHaveAttribute("inert");
  (await within(lookup).findAllByRole("button", { name: "Select Alex" }))[0];
  const cancel = within(lookup).getByRole("button", { name: "Cancel" });
  cancel.focus(); await user.tab();
  expect(within(lookup).getByRole("button", { name: "Close dialog" })).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(trigger).toHaveFocus(); expect(parent).not.toHaveAttribute("inert");
});
it("Two mounted CommonForms keep labels/feedback uniquely associated with their own controls", () => {
  render(<MemoryRouter><Harness /><Harness /></MemoryRouter>);
  const fields = document.querySelectorAll<HTMLInputElement>('input[name="owner"]');
  expect(fields).toHaveLength(2);
  expect(fields[0].id).not.toBe(fields[1].id);
});
it("Unmounting nested dialogs restores original body scrolling", async () => {
  const user = userEvent.setup(); const initial = document.body.style.overflow;
  const rendered = render(<MemoryRouter><Harness /></MemoryRouter>);
  await user.click(screen.getByRole("button", { name: "Lookup Owner" }));
  await screen.findByRole("dialog", { name: "Choose User" });
  rendered.unmount();
  expect(document.body.style.overflow).toBe(initial);
});

it("Lookup selected value survives field-level server validation with associated error text", async () => {
  const user = userEvent.setup(); render(<MemoryRouter><Harness serverError /></MemoryRouter>);
  await user.click(screen.getByRole("button", { name: "Lookup Owner" }));
  await user.click((await screen.findAllByRole("button", { name: "Select Alex" }))[0]);
  await user.click(screen.getByRole("button", { name: "Submit" }));
  const field = screen.getByLabelText("Owner");
  expect(field).toHaveValue("Alex"); expect(field).toHaveAttribute("aria-invalid", "true");
  expect(document.getElementById(`${field.id}-error`)).toHaveTextContent("User no longer eligible.");
});

it("Disabled global field cannot clear; disabled modal Select cannot change selection", async () => {
  const user = userEvent.setup(); const changed = vi.fn(); const selected = vi.fn();
  const rendered = render(<MemoryRouter><LookupField id="disabled-lookup" label="Owner" value="one" displayValue="Alex" definition={definition} disabled clearable onChange={changed} /></MemoryRouter>);
  await user.click(screen.getByRole("button", { name: "Clear Owner" }));
  expect(changed).not.toHaveBeenCalled(); rendered.unmount();
  render(<MemoryRouter><LookupModal open disabled definition={definition} onClose={vi.fn()} onSelect={selected} /></MemoryRouter>);
  const choose = (await screen.findAllByRole("button", { name: "Select Alex" }))[0];
  expect(choose).toBeDisabled(); await user.click(choose); expect(selected).not.toHaveBeenCalled();
});

it("UI-13 Dashboard card links expose metric/count/destination and support keyboard navigation", async () => {
  const user = userEvent.setup();
  render(<MemoryRouter><MetricCards requester cards={[
    { label: "Active Tickets", count: 3, to: "/tickets?status=OPEN" },
    { label: "Waiting for Me", count: 1, to: "/tickets?status=WAITING_FOR_REQUESTER" },
  ]} /></MemoryRouter>);
  const active = screen.getByRole("link", { name: "Active Tickets: 3. View tickets" });
  const waiting = screen.getByRole("link", { name: "Waiting for Me: 1. View tickets" });
  expect(active).toHaveAttribute("href", "/tickets?status=OPEN");
  expect(waiting).toHaveAttribute("href", "/tickets?status=WAITING_FOR_REQUESTER");
  await user.tab(); expect(active).toHaveFocus();
  await user.tab(); expect(waiting).toHaveFocus();
});

it.each(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const)("UI-13 %s status has readable non-color meaning", (status) => {
  render(<StatusChip value={status} />);
  expect(screen.getByText(status.replaceAll("_", " "), { exact: true })).toBeVisible();
});
