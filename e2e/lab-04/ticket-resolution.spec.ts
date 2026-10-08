import { expect, test } from "@playwright/test";
import { createStaffFixture, loginStaffFixture } from "../lab-03/staff-fixture.js";

for (const administrator of [false, true]) test(`E2E-02 ${administrator ? "Administrator" : "Staff"} owner resolution gate, Requester advice, Close and Activity`, async ({ page, browser }) => {
  test.setTimeout(120_000);
  const fixture = await createStaffFixture(2); const ticket = fixture.tickets[0];
  const requesterContext = await browser.newContext({ baseURL: "http://127.0.0.1:5173" });
  try {
    const loginResponse = page.waitForResponse((response) => response.url().endsWith("/auth/login") && response.request().method() === "POST");
    await loginStaffFixture(page, fixture, administrator);
    const token = (await (await loginResponse).json()).accessToken as string;
    const headers = { Authorization: `Bearer ${token}` };
    await page.goto(`/${administrator ? "admin" : "staff"}/tickets/${ticket.publicId}`);
    const denied = await page.request.post(`http://127.0.0.1:3000/api/tickets/${ticket.publicId}/start-work`, { headers });
    expect(denied.status()).toBe(403); expect((await denied.json()).code).toBe("FORBIDDEN");
    if (administrator) {
      await expect(page.getByLabel("IT Priority", { exact: true })).toBeEnabled();
      await expect(page.getByRole("button", { name: "Cancel Ticket", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Change Owner", exact: true })).toHaveCount(0);
    }
    await page.getByRole("button", { name: "Claim Ticket", exact: true }).click();
    await page.getByRole("button", { name: "Start Work", exact: true }).click();
    await expect(page.getByText("IN PROGRESS", { exact: true })).toBeVisible();
    const path = new URL(page.url()).pathname;
    async function createAction(description: string) {
      await page.getByRole("button", { name: "Create Action", exact: true }).first().click();
      const modal = page.getByRole("dialog", { name: "Create Action", exact: true });
      await modal.getByLabel("Description", { exact: false }).fill(description);
      await modal.getByRole("button", { name: "Create Action", exact: true }).click();
      await expect(modal).not.toBeVisible();
    }
    await createAction("E2E resolution real work"); await createAction("E2E redundant work");
    await expect(page.getByRole("button", { name: "Mark Resolved", exact: true })).toBeDisabled();
    const rejected = await page.request.post(`http://127.0.0.1:3000/api/tickets/${ticket.publicId}/mark-resolved`, { headers });
    expect(rejected.status()).toBe(409); expect((await rejected.json()).code).toBe("INVALID_STATUS_TRANSITION");
    await page.getByRole("link", { name: "View E2E resolution real work", exact: true }).filter({ visible: true }).click();
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await page.getByRole("dialog", { name: "Start this Action?" }).getByRole("button", { name: "Start Action", exact: true }).click();
    await page.getByRole("button", { name: "Complete", exact: true }).click();
    const complete = page.getByRole("dialog", { name: "Complete Action", exact: true });
    await complete.getByLabel("Result", { exact: false }).fill("Real work verified");
    await complete.getByRole("button", { name: "Complete Action", exact: true }).click(); await expect(complete).not.toBeVisible();
    await page.goto(path);
    await expect(page.getByRole("button", { name: "Mark Resolved", exact: true })).toBeDisabled();
    await page.getByRole("link", { name: "View E2E redundant work", exact: true }).filter({ visible: true }).click();
    await page.getByRole("button", { name: "Cancel Action", exact: true }).click();
    const cancel = page.getByRole("dialog", { name: "Cancel Action", exact: true });
    await cancel.getByLabel("Cancellation Reason", { exact: false }).fill("No longer required");
    await cancel.getByRole("button", { name: "Cancel Action", exact: true }).click(); await expect(cancel).not.toBeVisible();
    await page.goto(path);
    await expect(page.getByRole("button", { name: "Mark Resolved", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Mark Resolved", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Mark Resolved", exact: true }).click();
    await expect(page.getByText("RESOLVED", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Close Ticket", exact: true })).toHaveCount(0);
    const requester = await requesterContext.newPage();
    await requester.goto("/login"); await requester.getByLabel("Email *", { exact: true }).fill(fixture.requester.email);
    await requester.getByLabel("Password *", { exact: true }).fill(fixture.password);
    await requester.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(requester).toHaveURL(/\/dashboard$/);
    await requester.goto("/tickets");
    await requester.goto(`/tickets/${ticket.publicId}`);
    await requester.getByRole("button", { name: "Problem appears resolved", exact: true }).click();
    await expect(requester.getByRole("button", { name: "Resolution confirmed", exact: true })).toBeDisabled();
    await expect(requester.getByText("RESOLVED", { exact: true })).toBeVisible();
    await expect(requester.getByRole("heading", { name: "Activity", exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByText(/confirmed the problem appears resolved\./)).toBeVisible();
    await page.getByRole("button", { name: "Close Ticket", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Close Ticket", exact: true }).click();
    await expect(page.getByText("CLOSED", { exact: true })).toBeVisible();
    const saved = await fixture.prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(saved.ownerUserId).toBe(administrator ? fixture.admin.id : fixture.staff.id);
    expect(saved.requesterResolutionConfirmedAt).not.toBeNull();
    expect(await fixture.prisma.ticketActivity.count({ where: { ticketId: ticket.id, action: "REQUESTER_RESOLUTION_CONFIRMED", performedByUserId: fixture.requester.id } })).toBe(1);
    await test.info().attach(`E2E-02-${administrator ? "admin" : "staff"}-closed`, { body: await page.screenshot(), contentType: "image/png" });
    if (administrator) {
      const unowned = fixture.tickets[1]; await page.goto(`/admin/tickets/${unowned.publicId}`);
      await page.getByLabel("IT Priority", { exact: true }).selectOption("LOW");
      await expect(page.getByLabel("IT Priority", { exact: true })).toHaveValue("LOW");
      await page.getByRole("button", { name: "Cancel Ticket", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Cancel Ticket", exact: true }).click();
      await expect(page.getByText("CANCELLED", { exact: true })).toBeVisible();
      expect((await fixture.prisma.ticket.findUniqueOrThrow({ where: { id: unowned.id } })).ownerUserId).toBeNull();
    }
  } finally { await requesterContext.close(); await fixture.dispose(); }
});
