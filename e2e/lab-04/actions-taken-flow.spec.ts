import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createStaffFixture, loginStaffFixture } from "../lab-03/staff-fixture.js";

test("E2E-01 integrated claim, assignee Lookup, start, edit, Attachment, complete, Activity and Requester read-only", async ({ page }) => {
  const fixture = await createStaffFixture();
  const ticket = fixture.tickets[0];
  await fixture.prisma.attachment.create({ data: { storageKey: randomUUID(), ticketId: ticket.id, uploadedByRequesterId: fixture.requester.id, originalName: "synthetic-evidence.txt", extension: "txt", mimeType: "text/plain", sizeBytes: 4, data: Buffer.from("test"), createdBy: "issue80-smoke", updatedBy: "issue80-smoke" } });
  try {
    await loginStaffFixture(page, fixture);
    await page.goto(`/staff/tickets/${ticket.publicId}`);
    await page.getByRole("button", { name: "Claim Ticket", exact: true }).click();
    await page.getByRole("button", { name: "Start Work", exact: true }).click();
    await expect(page.getByText("IN PROGRESS", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Create Action", exact: true }).first().click();
    const create = page.getByRole("dialog", { name: "Create Action", exact: true });
    await create.getByLabel("Description", { exact: false }).fill("Synthetic Action API integration smoke");
    const lookupTrigger = create.getByRole("button", { name: "Lookup Assigned To", exact: true });
    await lookupTrigger.click();
    const lookup = page.getByRole("dialog", { name: "Select User", exact: true });
    await lookup.getByRole("searchbox", { name: "Search users" }).fill(fixture.staff.email);
    await lookup.getByRole("button", { name: "Select Workflow Staff", exact: true }).filter({ visible: true }).click();
    await expect(lookupTrigger).toBeFocused();
    await create.getByRole("button", { name: "Create Action", exact: true }).click();
    await expect(create).not.toBeVisible();
    await page.getByRole("link", { name: "View Synthetic Action API integration smoke" }).filter({ visible: true }).click();
    await expect(page.getByRole("heading", { name: "Action Taken", exact: true })).toBeVisible();
    const actionPath = new URL(page.url()).pathname;
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await page.getByRole("dialog", { name: "Start this Action?" }).getByRole("button", { name: "Start Action", exact: true }).click();
    await expect(page.getByRole("button", { name: "Complete", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const edit = page.getByRole("dialog", { name: "Edit Action", exact: true });
    await edit.getByLabel("Description", { exact: false }).fill("Synthetic integrated Action edited after start");
    await edit.getByLabel("Attachment Notes").fill("Synthetic evidence associated without a Staff upload.");
    await edit.getByRole("button", { name: "Select existing", exact: true }).click();
    await page.getByRole("button", { name: "Select synthetic-evidence.txt", exact: true }).filter({ visible: true }).click();
    await edit.getByRole("button", { name: "Save Changes", exact: true }).click();
    await expect(edit).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Preview synthetic-evidence.txt" })).toBeVisible();
    await page.getByRole("button", { name: "Complete", exact: true }).click();
    const complete = page.getByRole("dialog", { name: "Complete Action", exact: true });
    await complete.getByLabel("Result", { exact: false }).fill("Synthetic completed result");
    await complete.getByRole("button", { name: "Complete Action", exact: true }).click();
    await expect(complete).not.toBeVisible();
    await expect(page.getByText("Synthetic completed result", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
    await expect(page.getByText("completed an Action.", { exact: false })).toBeVisible();
    await expect(page.getByText("updated an Action.", { exact: false })).toBeVisible();
    await test.info().attach("real-server-completed-action-staff", { body: await page.screenshot(), contentType: "image/png" });
    await page.goto(`/staff/tickets/${ticket.publicId}`);
    await expect(page.getByText("assigned the Ticket.", { exact: false })).toBeVisible();
    await expect(page.getByText("started work on the Ticket.", { exact: false })).toBeVisible();
    await expect(page.getByText("completed an Action.", { exact: false })).toBeVisible();
    const context = await page.context().browser()!.newContext({ baseURL: "http://127.0.0.1:5173" });
    const requester = await context.newPage();
    try {
      await requester.goto("/login");
      await requester.getByLabel("Email *", { exact: true }).fill(fixture.requester.email);
      await requester.getByLabel("Password *", { exact: true }).fill(fixture.password);
      await requester.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(requester).toHaveURL(/\/dashboard$/);
      await requester.goto("/tickets");
      await requester.goto(actionPath.replace("/staff/tickets/", "/tickets/"));
      await expect(requester.getByText("Synthetic completed result", { exact: true })).toBeVisible();
      await expect(requester.getByRole("button", { name: "Preview synthetic-evidence.txt" })).toBeVisible();
      await expect(requester.getByRole("heading", { name: "Activity", exact: true })).toHaveCount(0);
      await expect(requester.getByRole("button", { name: /^(Edit|Assign|Reassign|Unassign|Start|Complete|Cancel)$/ })).toHaveCount(0);
      await test.info().attach("real-server-completed-action-requester-read-only", { body: await requester.screenshot(), contentType: "image/png" });
    } finally { await context.close(); }
    const saved = await fixture.prisma.actionTaken.findFirstOrThrow({ where: { ticketId: ticket.id } });
    expect(saved).toMatchObject({ status: "COMPLETED", assignedToUserId: fixture.staff.id, performedByUserId: fixture.staff.id, isMigrated: false, version: 4, attachmentNotes: "Synthetic evidence associated without a Staff upload." });
    expect(await fixture.prisma.actionTakenAttachment.count({ where: { actionTakenId: saved.id } })).toBe(1);
    expect(await fixture.prisma.ticketActivity.count({ where: { ticketId: ticket.id } })).toBe(6);
  } finally {
    // Append-only audit records intentionally remain on the guarded disposable target.
    // Do not delete audit history or reset a database to clean a browser fixture.
    await fixture.prisma.$disconnect();
  }
});
