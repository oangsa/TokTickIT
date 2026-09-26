import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { z } from "zod";

import { CommonForm } from "../../src/components/Common/Form/CommonForm.js";
import { useManagedForm } from "../../src/forms/useManagedForm.js";
import type { FormSection } from "../../src/forms/formTypes.js";
import { ApiResponseError } from "../../src/api.js";

interface Values { name: string; kind: string; enabled: boolean }

interface NumericSelectValues { priority?: number }

interface AllFieldValues {
  text: string;
  email: string;
  password: string;
  amount: number;
  date: string;
  notes: string;
  choice: string;
  selected: string;
  enabled: boolean;
  file: unknown;
  owner: string;
  custom: string;
  readonly: string;
}

function Harness({ onSubmit = () => undefined }: { onSubmit?: (values: Values) => void }) {
  const form = useManagedForm<Values>({ schema: z.object({ name: z.string().min(2, "Name is required."), kind: z.string().min(1), enabled: z.boolean() }), defaultValues: { name: "", kind: "", enabled: false } });
  const sections: FormSection<Values>[] = [{ key: "main", title: "Main", fields: [
    { key: "name", name: "name", label: "Name", type: "text", required: true, span: "half" },
    { key: "kind", name: "kind", label: "Kind", type: "select", options: [{ value: "one", label: "One" }], span: "third" },
    { key: "enabled", name: "enabled", label: "Enabled", type: "switch", span: "quarter" },
  ] }];
  return <CommonForm form={form} sections={sections} onSubmit={onSubmit} />;
}

function AllFieldsHarness() {
  const form = useManagedForm<AllFieldValues>({
    schema: z.object({
      text: z.string(), email: z.string(), password: z.string(), amount: z.number(), date: z.string(),
      notes: z.string(), choice: z.string(), selected: z.string(), enabled: z.boolean(), file: z.unknown(),
      owner: z.string(), custom: z.string(), readonly: z.string(),
    }),
    defaultValues: { text: "", email: "", password: "", amount: 0, date: "", notes: "", choice: "", selected: "", enabled: false, file: undefined, owner: "", custom: "", readonly: "" },
  });
  const sections: FormSection<AllFieldValues>[] = [{ key: "all", fields: [
    { key: "text", name: "text", label: "Text", type: "text" },
    { key: "email", name: "email", label: "Email", type: "email" },
    { key: "password", name: "password", label: "Password", type: "password", passwordToggle: true },
    { key: "amount", name: "amount", label: "Amount", type: "number" },
    { key: "date", name: "date", label: "Date", type: "date" },
    { key: "notes", name: "notes", label: "Notes", type: "textarea" },
    { key: "choice", name: "choice", label: "Choice", type: "radio", options: [{ value: "one", label: "One" }] },
    { key: "selected", name: "selected", label: "Selected", type: "select", options: [{ value: "one", label: "One" }] },
    { key: "enabled", name: "enabled", label: "Enabled", type: "switch" },
    { key: "file", name: "file", label: "Attachment", type: "attachment" },
    { key: "owner", name: "owner", label: "Owner", type: "lookup", lookupLabel: "Lookup Owner" },
    { key: "custom", name: "custom", label: "Custom", type: "custom", render: ({ id }) => <output id={id} data-testid="custom-control">Custom control</output> },
    { key: "readonly", name: "readonly", label: "Readonly", type: "readonly", value: "Static value" },
  ] }];
  return <CommonForm form={form} sections={sections} onSubmit={() => undefined} showCancelButton={false} />;
}

function NumericSelectHarness({ onSubmit }: { onSubmit: (values: NumericSelectValues) => void }) {
  const form = useManagedForm<NumericSelectValues>({
    schema: z.object({ priority: z.number().optional() }),
    defaultValues: { priority: undefined },
  });
  const sections: FormSection<NumericSelectValues>[] = [{ key: "numeric", fields: [
    { key: "priority", name: "priority", label: "Priority", type: "select", options: [{ value: 10, label: "High" }] },
  ] }];
  return <CommonForm form={form} sections={sections} onSubmit={onSubmit} showCancelButton={false} />;
}

describe("Issue 3 CommonForm", () => {
  it("UI-32 renders discriminated fields and Bootstrap semantic spans @issue-3", () => {
    render(<Harness />);
    expect(screen.getByLabelText("Name *")).toHaveClass("form-control");
    expect(screen.getByLabelText("Kind")).toHaveClass("form-select");
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(document.querySelector(".col-12.col-md-6")).toBeInTheDocument();
    expect(document.querySelector(".col-12.col-md-6.col-lg-4")).toBeInTheDocument();
    expect(document.querySelector(".col-12.col-md-6.col-lg-3")).toBeInTheDocument();
  });

  it("UI-32 renders every built-in field type plus lookup and custom escape hatch @issue-3", () => {
    render(<AllFieldsHarness />);
    expect(screen.getByLabelText("Text")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Amount")).toHaveAttribute("type", "number");
    expect(screen.getByLabelText("Date")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("Notes")).toBeInstanceOf(HTMLTextAreaElement);
    expect(screen.getByLabelText("One")).toHaveAttribute("type", "radio");
    expect(screen.getByLabelText("Selected")).toBeInstanceOf(HTMLSelectElement);
    expect(screen.getByLabelText("Enabled")).toHaveAttribute("type", "checkbox");
    expect(screen.getByLabelText("Attachment")).toHaveAttribute("type", "file");
    expect(screen.getByRole("button", { name: "Lookup Owner" })).toBeInTheDocument();
    expect(screen.getByTestId("custom-control")).toHaveTextContent("Custom control");
    expect(screen.getByText("Static value")).toBeInTheDocument();
  });

  it("UI-33 validates with Zod, focuses first invalid field, then submits normalized values @issue-3", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Name is required.")).toBeInTheDocument();
    expect(screen.getByLabelText("Name *")).toHaveFocus();
    await user.type(screen.getByLabelText("Name *"), "Ada");
    await user.selectOptions(screen.getByLabelText("Kind"), "one");
    await user.click(screen.getByLabelText("Enabled"));
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledWith({ name: "Ada", kind: "one", enabled: true });
  });

  it("UI-34 maps known server details to fields and keeps unknown failures at form level @issue-3", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new ApiResponseError(400, "VALIDATION_ERROR", [
      { field: "name", message: "Name is already in use." },
      { field: "serverOnly", message: "Do not expose this detail." },
    ]));
    render(<Harness onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText("Name *"), "Ada");
    await user.selectOptions(screen.getByLabelText("Kind"), "one");
    await user.click(screen.getByLabelText("Enabled"));
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Name is already in use.")).toBeInTheDocument();
    expect(screen.getByLabelText("Name *")).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent("Please review the form and try again.");
    expect(screen.queryByText("Do not expose this detail.")).not.toBeInTheDocument();
  });

  it("preserves numeric select option values @issue-3", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<NumericSelectHarness onSubmit={onSubmit} />);
    await user.selectOptions(screen.getByLabelText("Priority"), "10");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledWith({ priority: 10 });
  });

  it("renders disabled controls and hides submit button in mode='view' @issue-3", () => {
    function ViewHarness() {
      const form = useManagedForm<Values>({
        defaultValues: { name: "Read-only Name", kind: "one", enabled: true },
      });
      const sections: FormSection<Values>[] = [{
        key: "main",
        fields: [
          { key: "name", name: "name", label: "Name", type: "text", required: true },
          { key: "kind", name: "kind", label: "Kind", type: "select", options: [{ value: "one", label: "One" }] },
          { key: "enabled", name: "enabled", label: "Enabled", type: "switch" },
        ],
      }];
      return <CommonForm mode="view" form={form} sections={sections} />;
    }

    render(<ViewHarness />);
    expect(screen.getByLabelText("Name")).toHaveValue("Read-only Name");
    expect(screen.getByLabelText("Name")).toBeDisabled();
    expect(screen.getByLabelText("Kind")).toBeDisabled();
    expect(screen.getByLabelText("Enabled")).toBeDisabled();
    // Required asterisk omitted in view mode
    expect(screen.queryByText("*")).not.toBeInTheDocument();
    // Submit button hidden in view mode
    expect(screen.queryByRole("button", { name: /submit|save/i })).not.toBeInTheDocument();
  });

  it("defaults submit label to 'Save Changes' in mode='edit' @issue-3", () => {
    function EditHarness() {
      const form = useManagedForm<Values>({
        defaultValues: { name: "Editable Name", kind: "one", enabled: false },
      });
      const sections: FormSection<Values>[] = [{
        key: "main",
        fields: [
          { key: "name", name: "name", label: "Name", type: "text" },
        ],
      }];
      return <CommonForm mode="edit" form={form} sections={sections} />;
    }

    render(<EditHarness />);
    expect(screen.getByLabelText("Name")).toHaveValue("Editable Name");
    expect(screen.getByLabelText("Name")).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument();
  });
});
