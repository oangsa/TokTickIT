import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createStaffFixture } from "../lab-03/staff-fixture.js";
import { ActionTakenService } from "../../server/src/services/actionTakenService.js";

const createBody = { followUpRequired: false, followUpNote: null, attachmentNotes: null, attachmentIds: [] };

const viewports = [{ width: 1440, height: 900 }, { width: 820, height: 1180 }, { width: 390, height: 844 }];
async function capture(page: Page, name: string, section: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  for (const dialog of await page.getByRole("dialog").all()) {
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  }
  const directory = `artifacts/lab-04/screenshots/final/${section}`;
  await mkdir(directory, { recursive: true });
  const path = `${directory}/${name}.png`;
  await page.screenshot({ path });
  await test.info().attach(`${section}/${name}`, { path, contentType: "image/png" });
}

for (const viewport of viewports) for (const role of ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const) {
  test(`VIS-01 real ${role} ${viewport.width}x${viewport.height} screens, focus and reduced motion`, async ({ page }) => {
    test.setTimeout(120000);
    const fixture = await createStaffFixture();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const user = role === "REQUESTER" ? fixture.requester : role === "IT_STAFF" ? fixture.staff : fixture.admin;
    const worker = role === "ADMINISTRATOR" ? fixture.admin : fixture.staff;
    const actor = { userId: worker.id, userPublicId: worker.publicId, email: worker.email, role: worker.role };
    const ticket = await fixture.prisma.ticket.update({ where: { id: fixture.tickets[0].id }, data: { currentStatus: "IN_PROGRESS", ownerUserId: worker.id } });
    const service = new ActionTakenService(fixture.prisma);
    const started = (await service.create(actor, ticket.publicId, { ...createBody, description: "Responsive started work", assignedToUserPublicId: worker.publicId }, randomUUID())).action;
    await service.lifecycle(actor, ticket.publicId, started.publicId, "start", { expectedVersion: 1 }, randomUUID());
    const planned = (await service.create(actor, ticket.publicId, { ...createBody, description: "Responsive planned work", assignedToUserPublicId: worker.publicId }, randomUUID())).action;
    const prefix = role === "REQUESTER" ? "/tickets" : role === "IT_STAFF" ? "/staff/tickets" : "/admin/tickets";
    const name = `${role.toLowerCase()}-${viewport.width}x${viewport.height}`;
    try {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/login");
      await page.getByLabel("Email *", { exact: true }).fill(user.email);
      await page.getByLabel("Password *", { exact: true }).fill(fixture.password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
      // The anonymous login bootstrap intentionally receives SESSION_INVALID
      // from refresh. Observe console errors on the authenticated major screens.
      page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
      const card = page.getByRole("link", { name: role === "REQUESTER" ? /^Active Tickets:/ : /^My Assigned:/ });
      await card.focus();
      // Establish keyboard modality; programmatic focus after a mouse click
      // intentionally does not necessarily match the browser's :focus-visible.
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(card).toBeFocused();
      expect(await card.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
      await capture(page, name, "dashboard");
      await page.goto(`${prefix}/${ticket.publicId}`);
      await page.getByRole("heading", { name: "Actions Taken", exact: true }).scrollIntoViewIfNeeded();
      await expect(page.getByText("Responsive started work", { exact: true }).filter({ visible: true })).toBeVisible();
      await capture(page, name, "ticket-actions");
      if (role !== "REQUESTER") {
        await page.getByRole("button", { name: "Create Action", exact: true }).first().click();
        const create = page.getByRole("dialog", { name: "Create Action", exact: true });
        await create.getByLabel("Description", { exact: false }).fill("Responsive release Action");
        await capture(page, name, "create-action");
        const trigger = create.getByRole("button", { name: "Lookup Assigned To", exact: true });
        await trigger.focus(); await page.keyboard.press("Enter");
        const lookup = page.getByRole("dialog", { name: "Select User", exact: true });
        await lookup.getByRole("searchbox", { name: "Search users" }).fill(worker.email);
        const select = lookup.getByRole("button", { name: `Select ${worker.name}`, exact: true }).filter({ visible: true });
        await expect(select).toHaveCount(1);
        await expect(select).toBeVisible();
        await capture(page, name, "lookup");
        await select.focus(); await page.keyboard.press("Enter");
        await expect(trigger).toBeFocused();
        await create.getByRole("button", { name: "Create Action", exact: true }).click();
        await expect(create).not.toBeVisible();
        await page.getByRole("heading", { name: "Activity", exact: true }).scrollIntoViewIfNeeded();
        await capture(page, name, "ticket-activity");
      }
      await page.goto(`${prefix}/${ticket.publicId}/actions/${started.publicId}`);
      await expect(page.getByRole("heading", { name: "Action Taken", exact: true })).toBeVisible();
      await expect(page.getByText("IN PROGRESS", { exact: true }).first()).toBeVisible();
      await capture(page, name, "action-detail");
      if (role !== "REQUESTER") {
        await page.getByRole("heading", { name: "Activity", exact: true }).scrollIntoViewIfNeeded();
        await expect(page.getByText("started an Action.", { exact: false })).toBeVisible();
        await capture(page, name, "action-activity");
        const editTrigger = page.getByRole("button", { name: "Edit", exact: true });
        await editTrigger.click();
        const edit = page.getByRole("dialog", { name: "Edit Action", exact: true });
        await expect(edit.getByLabel("Description", { exact: false })).toHaveValue("Responsive started work");
        await capture(page, name, "edit-action");
        await page.keyboard.press("Escape");
        await expect(editTrigger).toBeFocused();
        await page.getByRole("button", { name: "Complete", exact: true }).click();
        const complete = page.getByRole("dialog", { name: "Complete Action", exact: true });
        await complete.getByLabel("Result", { exact: false }).fill("Synthetic release evidence");
        await capture(page, name, "complete-action");
        await complete.getByRole("button", { name: "Cancel", exact: true }).click();
        await page.goto(`${prefix}/${ticket.publicId}/actions/${planned.publicId}`);
        await page.getByRole("button", { name: "Cancel Action", exact: true }).click();
        const cancel = page.getByRole("dialog", { name: "Cancel Action", exact: true });
        await cancel.getByLabel("Cancellation Reason", { exact: false }).fill("Synthetic cancel evidence");
        await capture(page, name, "cancel-action");
        await cancel.getByRole("button", { name: "Keep Action", exact: true }).click();
      } else {
        await expect(page.getByRole("heading", { name: "Activity", exact: true })).toHaveCount(0);
        await expect(page.getByRole("button", { name: /^(Edit|Reassign|Unassign|Start|Complete|Cancel Action)$/ })).toHaveCount(0);
      }
      expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
      expect(await page.locator(".tt-main__inner").evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
      expect(await page.locator(".tt-sidebar").evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0s");
      expect(errors).toEqual([]);
    } finally { await fixture.dispose(); }
  });
}
