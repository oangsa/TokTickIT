import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import { CommonForm } from "../../src/components/Common/Form/CommonForm.js";
import { useManagedForm } from "../../src/forms/useManagedForm.js";

const definition = {
  title: "Choose User", columns: [{ key: "name", label: "Name" }],
  fetchData: async () => ({ data: [{ publicId: "user-2", name: "Alex" }], total: 1 }),
  getValue: (row: { publicId: string }) => row.publicId,
  getDisplayValue: (row: { name: string }) => row.name,
  searchPlaceholder: "Search users", emptyMessage: "No eligible users", noMatchMessage: "No matching users",
};
function Harness({ disabled = false }: { disabled?: boolean }) {
  const form = useManagedForm<{ owner: string }>({ defaultValues: { owner: "" } });
  return <CommonForm form={form} disabled={disabled} sections={[{ key: "main", card: false, fields: [{ key: "owner", name: "owner", label: "Owner", type: "lookup", definition, clearable: true }] }]} showSubmitButton={false}><output data-testid="value">{form.watch("owner")}</output></CommonForm>;
}
it("global definition selects managed ID/display by explicit keyboard action and restores focus", async () => {
  const user = userEvent.setup();
  render(<MemoryRouter><Harness /></MemoryRouter>);
  const trigger = screen.getByRole("button", { name: "Lookup Owner" });
  await user.click(trigger);
  const dialog = screen.getByRole("dialog", { name: "Choose User" });
  const select = (await within(dialog).findAllByRole("button", { name: "Select Alex" }))[0];
  select.focus(); await user.keyboard("{Enter}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Owner")).toHaveValue("Alex");
  expect(screen.getByTestId("value")).toHaveTextContent("user-2");
  expect(trigger).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Clear Owner" }));
  expect(screen.getByTestId("value")).toBeEmptyDOMElement();
});
