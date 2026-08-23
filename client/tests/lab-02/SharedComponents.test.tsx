import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { AttachmentState, AttachmentStateName } from "../../src/components/AttachmentState.js";
import { Button } from "../../src/components/Button.js";
import { FilterChip } from "../../src/components/FilterChip.js";
import { Form } from "../../src/components/Form.js";
import { Modal } from "../../src/components/Modal.js";
import { Pagination } from "../../src/components/Pagination.js";
import { ReadOnlyField } from "../../src/components/ReadOnlyField.js";
import { SuccessMessage } from "../../src/components/SuccessMessage.js";
import { TextInput } from "../../src/components/TextInput.js";

function ModalHarness({ withAction = false }: { withAction?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}>Remove attachment</button>
      <Modal
        open={open}
        title="Remove attachment"
        onClose={() => setOpen(false)}
        footer={withAction ? <button>Confirm</button> : undefined}
      >
        <p data-testid="prose">This cannot be undone.</p>
      </Modal>
    </>
  );
}

describe("UI-32 modal focus management (ui-spec 29.5, 29.6)", () => {
  it("moves focus into the dialog on open and back to the invoker on close", async () => {
    render(<ModalHarness />);
    const invoker = screen.getByRole("button", { name: "Remove attachment" });

    await userEvent.click(invoker);
    expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(invoker).toHaveFocus();
  });

  it("still closes on Escape after clicking non-focusable dialog content", async () => {
    render(<ModalHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Remove attachment" }));

    // Clicking prose would drop focus to document.body without tabIndex={-1} on
    // the dialog, and the keydown handler would never fire.
    await userEvent.click(screen.getByTestId("prose"));
    expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("traps Tab inside the dialog", async () => {
    render(<ModalHarness withAction />);
    await userEvent.click(screen.getByRole("button", { name: "Remove attachment" }));

    const dialog = screen.getByRole("dialog");
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();

    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it("traps Shift+Tab when focus rests on the dialog container", async () => {
    render(<ModalHarness withAction />);
    const invoker = screen.getByRole("button", { name: "Remove attachment" });
    await userEvent.click(invoker);

    // Clicking non-focusable content parks focus on the dialog container, and
    // native Shift+Tab from there walks backwards out of the portal into the
    // page behind the backdrop.
    await userEvent.click(screen.getByTestId("prose"));
    await userEvent.tab({ shift: true });

    expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
    expect(invoker).not.toHaveFocus();
  });

  it("closes on a click outside the dialog but not on a drag out of it", async () => {
    render(<ModalHarness />);
    const invoker = screen.getByRole("button", { name: "Remove attachment" });
    await userEvent.click(invoker);

    // A drag that starts inside the dialog and releases outside must not dismiss.
    const surface = screen.getByRole("dialog").parentElement as HTMLElement;
    fireEvent.mouseDown(screen.getByTestId("prose"));
    fireEvent.mouseUp(surface);
    fireEvent.click(surface);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.mouseDown(surface);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(invoker).toHaveFocus();
  });

  it("locks page scrolling while open and restores it on close", async () => {
    render(<ModalHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Remove attachment" }));
    expect(document.body.style.overflow).toBe("hidden");

    await userEvent.keyboard("{Escape}");
    expect(document.body.style.overflow).toBe("");
  });

  it("labels the dialog by its title and gives the close control a tooltip", async () => {
    render(<ModalHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Remove attachment" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("Remove attachment");
    expect(dialog).toHaveFocus();

    // Opening must not pop a tooltip. Focus lands on the dialog, not on the
    // close control, so the dialog copy is what greets the reader.
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    const close = within(dialog).getByRole("button", { name: "Close dialog" });
    expect(close).toHaveAccessibleName("Close dialog");

    await userEvent.hover(close);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Close dialog");
    expect(tooltip.parentElement).toBe(document.body);
    expect(tooltip).toHaveClass("tt-tip");
    expect(tooltip).toHaveStyle({ visibility: "visible" });
  });
});

describe("UI-32 pagination (ui-spec 18)", () => {
  it("windows the page numbers instead of rendering one button per page", () => {
    render(
      <Pagination
        pageNumber={1}
        pageSize={10}
        totalItems={4000}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    const numbered = screen.getAllByRole("button").filter((b) => /^\d+$/.test(b.textContent ?? ""));
    expect(numbered.length).toBeLessThanOrEqual(7);
    expect(screen.getByRole("button", { name: "1" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "400" })).toBeInTheDocument();
  });

  it("keeps every page listed when the set is small enough", () => {
    render(
      <Pagination
        pageNumber={2}
        pageSize={10}
        totalItems={47}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Showing 11–20 of 47")).toBeInTheDocument();
    for (const page of ["1", "2", "3", "4", "5"]) {
      expect(screen.getByRole("button", { name: page })).toBeInTheDocument();
    }
  });

  it("clamps a stale page number past the end of a narrowed result set", async () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        pageNumber={40}
        pageSize={10}
        totalItems={25}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Showing 21\u201325 of 25")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    // Previous steps back from the clamped page, not from the stale 40.
    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("reports the clamp so the caller's stale page state converges", () => {
    // Clamping the display alone would leave the caller fetching page 40 and
    // rendering its empty result under a "Showing 21-25 of 25" range.
    const onPageChange = vi.fn();
    render(
      <Pagination
        pageNumber={40}
        pageSize={10}
        totalItems={25}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("does not report a page change when the caller is already in range", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        pageNumber={2}
        pageSize={10}
        totalItems={47}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("does not re-report the clamp when the caller passes a fresh callback each render", () => {
    const onPageChange = vi.fn();
    const props = { pageNumber: 40, pageSize: 10, totalItems: 25, onPageSizeChange: vi.fn() };
    const { rerender } = render(
      <Pagination {...props} onPageChange={(page) => onPageChange(page)} />,
    );
    rerender(<Pagination {...props} onPageChange={(page) => onPageChange(page)} />);
    rerender(<Pagination {...props} onPageChange={(page) => onPageChange(page)} />);

    expect(onPageChange).toHaveBeenCalledTimes(1);
  });

  it("disables Previous on the first page and Next on the last", () => {
    const { unmount } = render(
      <Pagination
        pageNumber={1}
        pageSize={10}
        totalItems={47}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    unmount();

    render(
      <Pagination
        pageNumber={5}
        pageSize={10}
        totalItems={47}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});

describe("UI-32 form field contract (ui-spec 7, 8, 9, 29)", () => {
  it("disables native submit blocking for the shared custom-validation form", () => {
    const { container } = render(
      <Form>
        <input aria-label="Summary" required />
      </Form>,
    );

    expect(container.querySelector("form")).toHaveAttribute("novalidate");
    expect(screen.getByRole("textbox", { name: "Summary" })).toBeRequired();
  });

  it("puts the validation message immediately below its control, before the counter", () => {
    const { container } = render(
      <TextInput
        label="Summary"
        required
        error="Summary must contain 3-150 characters."
        counter={{ value: 2, max: 150 }}
      />,
    );

    const order = Array.from(container.querySelectorAll("input, .tt-counter, .tt-validation")).map(
      (node) => (node.matches("input") ? "control" : node.matches(".tt-counter") ? "counter" : "error"),
    );
    expect(order).toEqual(["control", "error", "counter"]);
  });

  it("associates the label, required state, error, and counter with the control", () => {
    render(
      <TextInput
        label="Summary"
        required
        error="Summary must contain 3-150 characters."
        counter={{ value: 2, max: 150 }}
      />,
    );

    const input = screen.getByRole("textbox", { name: /Summary/ });
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(/Summary must contain 3-150 characters\./);
    expect(input).toHaveAccessibleDescription(/2 \/ 150/);
    expect(screen.getByText("2 / 150")).toBeInTheDocument();
  });

  it("shows no validation message on an untouched field", () => {
    const { container } = render(
      <TextInput label="Summary" required counter={{ value: 0, max: 150 }} />,
    );

    expect(container.querySelector(".tt-validation")).toBeNull();
    const input = screen.getByRole("textbox", { name: /Summary/ });
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAccessibleDescription(/must contain/);
  });

  it("keeps a read-only value reachable but not editable", () => {
    render(<ReadOnlyField label="Ticket Number" value="Assigned on submission" />);

    const field = screen.getByRole("textbox", { name: "Ticket Number" });
    expect(field).toHaveAttribute("readonly");
    expect(field).not.toBeDisabled();
    expect(field).toHaveClass("tt-readonly");
    expect(field).toHaveValue("Assigned on submission");
  });

  it("renders a multi-line read-only value as a textarea, not a one-line input", () => {
    // Ticket Detail Description is read-only and runs to 2000 characters
    // (ui-spec Sections 20.2, 20.3); a single-line input would clip it.
    const description = "First line.\nSecond line.\n" + "x".repeat(500);
    render(<ReadOnlyField label="Description" value={description} multiline />);

    const field = screen.getByRole("textbox", { name: "Description" });
    expect(field.tagName).toBe("TEXTAREA");
    expect(field).toHaveAttribute("readonly");
    expect(field).not.toBeDisabled();
    expect(field).toHaveClass("tt-readonly");
    expect(field).toHaveValue(description);
  });
});

describe("UI-32 button hierarchy (ui-spec 10)", () => {
  it("keeps the action text and disables the button while busy", () => {
    render(
      <Button variant="primary" busy>
        Submit Ticket
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Submit Ticket" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveTextContent("Submit Ticket");
    expect(button).not.toHaveTextContent(/Submitting/);
  });

  it("reserves the spinner slot while idle so a busy button does not shift", () => {
    const { container } = render(
      <Button variant="primary" busy={false}>
        Submit Ticket
      </Button>,
    );

    expect(container.querySelector(".tt-btn__spinner")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit Ticket" })).not.toHaveAttribute("aria-busy");
  });

  it("adds no spinner slot to a button that never becomes busy", () => {
    // The reserved slot is 1rem plus its margin. On a button with no busy state
    // it is dead space that indents the label, which is visible on the `px-0`
    // tertiary action sitting under the sidebar navigation links.
    const { container } = render(
      <Button variant="tertiary" className="px-0">
        Change Requester
      </Button>,
    );

    expect(container.querySelector(".tt-btn__spinner")).toBeNull();
  });
});

describe("UI-37 icon-only controls and non-colour state (ui-spec 23, 29.8, 29.9)", () => {
  it("gives a filter chip's remove control both a name and a tooltip", async () => {
    render(<FilterChip label="Priority: HIGH" onRemove={vi.fn()} />);

    const remove = screen.getByRole("button", { name: "Remove filter Priority: HIGH" });
    await userEvent.hover(remove);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Remove filter Priority: HIGH");
    expect(tooltip.parentElement).toBe(document.body);
  });

  const states: AttachmentStateName[] = [
    "Uploading",
    "Failed",
    "Invalid",
    "Pending",
    "Active",
    "Removed",
  ];

  it.each(states)("renders the %s attachment state as visible text", (state) => {
    const { container } = render(<AttachmentState state={state} />);

    expect(screen.getByText(state)).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("tt-badge");
  });

  it("gives every attachment state a treatment of its own, not just a label", () => {
    // Section 34 asks for all six to be visually distinct. Two states that
    // differ only by their text collapse into one look at a glance.
    const classNames = states.map((state) => {
      const { container } = render(<AttachmentState state={state} />);
      return container.firstElementChild?.className ?? "";
    });

    expect(new Set(classNames).size).toBe(states.length);
  });

  it("separates Failed from Invalid by border style, not only by colour", () => {
    // Both are red error surfaces; Failed was attempted and can be retried,
    // Invalid never became a usable Attachment (Sections 23.2, 23.3).
    const { container: failed } = render(<AttachmentState state="Failed" />);
    const { container: invalid } = render(<AttachmentState state="Invalid" />);

    expect(failed.firstElementChild).not.toHaveClass("tt-attachment-state--invalid");
    expect(invalid.firstElementChild).toHaveClass("tt-attachment-state--invalid");
  });

  it("announces a success confirmation politely without interrupting", () => {
    render(<SuccessMessage>Ticket TKT-20260820-A81F3C9D7B21 created.</SuccessMessage>);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Ticket TKT-20260820-A81F3C9D7B21 created.");
    expect(status).toHaveClass("tt-success");
  });
});
