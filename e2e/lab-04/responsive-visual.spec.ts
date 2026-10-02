import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { ticket, action, staff, other } from "../../client/tests/lab-04/fixtures.js";

const CORS = { "Access-Control-Allow-Origin": "http://127.0.0.1:5173", "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "Authorization,Content-Type,Idempotency-Key,X-Request-ID", "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS", "Access-Control-Expose-Headers": "X-Pagination" };
const widths = [{ width: 1440, height: 900 }, { width: 820, height: 1180 }, { width: 390, height: 844 }];
async function stub(page: Page, role: "IT_STAFF" | "ADMINISTRATOR" | "REQUESTER") {
  const writes: string[] = [];
  const activityReads: string[] = [];
  await page.route("http://127.0.0.1:3000/api/**", async (route) => {
    const request = route.request(); const url = new URL(request.url());
    if (request.method() === "OPTIONS") { await route.fulfill({ status: 204, headers: CORS }); return; }
    let data: unknown; let collection = false;
    if (url.pathname === "/api/auth/refresh") data = { accessToken: "synthetic-ui-token", expiresIn: 600 };
    else if (url.pathname === "/api/auth/me") data = { ...staff, role, isActive: true, mustChangePassword: false, sessionStage: "FULL" };
    else if (url.pathname === "/api/users/assignable") { data = [staff, other]; collection = true; }
    else if (url.pathname.endsWith("/activity")) {
      activityReads.push(url.pathname); collection = true;
      data = [{ publicId: "event-1", ticketPublicId: ticket.publicId, action: "ACTION_CREATED", performedBy: { ...staff, isSystem: false }, actionTaken: { publicId: action.publicId, previousAssignedTo: null, assignedTo: staff }, createdAt: action.createdAt }];
    } else if (url.pathname.endsWith("/comments") || url.pathname.endsWith("/internal-notes")) data = { items: [], pagination: { pageNumber: 1, pageSize: 10, totalItems: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false } };
    else if (url.pathname.endsWith("/actions")) { data = [action]; collection = true; }
    else if (url.pathname.includes("/actions/")) data = action;
    else if (url.pathname.endsWith(ticket.publicId)) data = ticket;
    else if (url.pathname.includes("/api/categories") || url.pathname.includes("related-systems")) data = [{ id: 1, name: "Network" }];
    else { await route.fulfill({ status: 404, headers: CORS, json: { code: "NOT_FOUND" } }); return; }
    if (["POST", "PATCH", "DELETE"].includes(request.method()) && !url.pathname.startsWith("/api/auth")) writes.push(url.pathname);
    const headers = { ...CORS, ...(collection ? { "X-Pagination": JSON.stringify({ pageNumber: 1, pageSize: 10, totalItems: Array.isArray(data) ? data.length : 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false }) } : {}) };
    await route.fulfill({ status: 200, headers, json: data });
  });
  return { writes, activityReads };
}
async function screenshot(page: Page, section: string, name: string) {
  const directory = `artifacts/lab-04/screenshots/${section}`;
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: `${directory}/${name}.png`, fullPage: false });
}
async function noPageOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}
for (const viewport of widths) for (const role of ["IT_STAFF", "ADMINISTRATOR", "REQUESTER"] as const) {
  test(`RESP-03 ${role} ${viewport.width}x${viewport.height}: Actions, forms, Lookup, Detail, Activity`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const observed = await stub(page, role);
    const prefix = role === "REQUESTER" ? "/tickets" : role === "ADMINISTRATOR" ? "/admin/tickets" : "/staff/tickets";
    const name = `${role.toLowerCase()}-${viewport.width}x${viewport.height}`;
    await page.goto(`${prefix}/${ticket.publicId}`);
    await expect(page.getByRole("heading", { name: "Actions Taken", exact: true })).toBeVisible();
    await expect(page.getByText("Inspect port", { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await page.getByRole("heading", { name: "Actions Taken", exact: true }).scrollIntoViewIfNeeded();
    await noPageOverflow(page); await screenshot(page, "actions-taken", name);
    if (role !== "REQUESTER") {
      await page.getByRole("heading", { name: "Activity", exact: true }).scrollIntoViewIfNeeded();
      await screenshot(page, "ticket-activity", `${name}-ticket-history`);
    }
    if (role !== "REQUESTER") {
      await page.getByRole("button", { name: "Create Action", exact: true }).click();
      const form = page.getByRole("dialog", { name: "Create Action", exact: true });
      await expect(form).toBeVisible();
      await form.getByLabel("Description", { exact: false }).fill("Inspect the network port and review existing rack evidence.");
      await form.getByRole("switch", { name: "Follow-Up Required" }).check();
      await form.getByLabel("Follow-Up Note", { exact: false }).fill("Recheck network error counters tomorrow.");
      await noPageOverflow(page);
      const bounds = await form.boundingBox(); expect(bounds!.height).toBeLessThanOrEqual(viewport.height);
      await screenshot(page, "action-create-edit", `${name}-create`);
      const trigger = form.getByRole("button", { name: "Lookup Assigned To", exact: true });
      await trigger.focus(); await page.keyboard.press("Enter");
      const lookup = page.getByRole("dialog", { name: "Select User", exact: true });
      await expect(lookup.getByRole("button", { name: "Select Other Staff", exact: true }).filter({ visible: true })).toBeVisible();
      const choice = await lookup.getByRole("button", { name: "Select Other Staff", exact: true }).filter({ visible: true }).boundingBox();
      const lookupBounds = await lookup.boundingBox();
      expect(choice!.x + choice!.width).toBeLessThanOrEqual(lookupBounds!.x + lookupBounds!.width);
      await noPageOverflow(page); await screenshot(page, "assignee-selection", name);
      await page.keyboard.press("Shift+Tab");
      await expect(lookup.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
      await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
      await form.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.getByRole("button", { name: "Discard Changes", exact: true }).click();
      await page.getByRole("link", { name: "View Inspect port", exact: true }).filter({ visible: true }).first().click();
    } else {
      await expect(page.getByRole("button", { name: "Create Action", exact: true })).toHaveCount(0);
      await page.getByRole("link", { name: "View Inspect port", exact: true }).filter({ visible: true }).first().click();
    }
    await expect(page.getByRole("heading", { name: "Action Taken", exact: true })).toBeVisible();
    await noPageOverflow(page); await screenshot(page, "action-detail", name);
    if (role !== "REQUESTER") {
      await expect(page.getByRole("heading", { name: "Activity", exact: true })).toBeVisible();
      await page.getByRole("heading", { name: "Activity", exact: true }).scrollIntoViewIfNeeded();
      await screenshot(page, "ticket-activity", `${name}-action-history`);
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Edit Action", exact: true })).toBeVisible();
      await noPageOverflow(page); await screenshot(page, "action-create-edit", `${name}-edit`);
    } else {
      await expect(page.getByRole("heading", { name: "Activity", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^(Edit|Reassign|Unassign|Start|Complete|Cancel Action)$/ })).toHaveCount(0);
      expect(observed.writes).toEqual([]); expect(observed.activityReads).toEqual([]);
    }
  });
}
