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
    else if (url.pathname === "/api/users/me/dashboard") data = { metrics: { activeTickets: 8, waitingForRequester: 2, resolvedTickets: 3, closedTickets: 12 }, recentTickets: [ticket] };
    else if (url.pathname === "/api/dashboard") data = { metrics: { unassignedTickets: 4, myAssignedTickets: 3, inProgressTickets: 2, waitingForRequester: 1, highPriorityTickets: 5 }, myActions: [{ ...action, ticketNumber: ticket.ticketNumber, activityAt: action.createdAt }], recentTickets: [{ ...ticket, itPriority: "HIGH" }], urgentTickets: [{ ...ticket, itPriority: "HIGH" }] };
    else if (url.pathname === "/api/users/assignable") { data = [staff, other]; collection = true; }
    else if (url.pathname.endsWith("/actions/filter-users")) { data = [{ publicId: other.publicId, name: "Former Staff", role: "REQUESTER" }]; collection = true; }
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
  const path = `${directory}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  await test.info().attach(`${section}/${name}`, { path, contentType: "image/png" });
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
    await page.getByRole("button", { name: /^Filters/ }).first().click();
    const filters = page.getByRole("dialog", { name: "Filter Actions", exact: true });
    for (const label of ["Assigned To", "Performed By"]) {
      const trigger = filters.getByRole("button", { name: `Lookup ${label}`, exact: true });
      await trigger.click();
      const lookup = page.getByRole("dialog", { name: `Select ${label}`, exact: true });
      await expect(lookup.getByText("Requester", { exact: true }).filter({ visible: true })).toBeVisible();
      await lookup.getByRole("button", { name: "Select Former Staff", exact: true }).filter({ visible: true }).click();
      await expect(filters.getByLabel(label, { exact: true })).toHaveValue("Former Staff");
      await expect(trigger).toBeFocused();
      await screenshot(page, "keyboard-focus", `${name}-${label === "Assigned To" ? "assigned-to" : "performed-by"}-restored`);
    }
    await noPageOverflow(page); await screenshot(page, "action-filters", name);
    await filters.getByRole("button", { name: "Cancel", exact: true }).click();
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
      await screenshot(page, "keyboard-focus", `${name}-lookup-shift-tab`);
      await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
      await screenshot(page, "keyboard-focus", `${name}-lookup-escape-restored`);
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

for (const viewport of widths) for (const role of ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const) {
  test(`${role === "REQUESTER" ? "RESP-01" : "RESP-02"} ${role} Dashboard loading ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await stub(page, role);
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const endpoint = role === "REQUESTER" ? "/api/users/me/dashboard" : "/api/dashboard";
    await page.route(`http://127.0.0.1:3000${endpoint}?**`, async (route) => {
      await pending;
      await route.fallback();
    });
    try {
      await page.goto("/dashboard");
      const loading = page.getByRole("status", { name: "Loading Dashboard" });
      await expect(loading).toBeVisible();
      const metrics = loading.getByRole("group", { name: "Dashboard metrics" });
      await expect(metrics.locator(".card")).toHaveCount(role === "REQUESTER" ? 4 : 5);
      for (const title of role === "REQUESTER" ? ["Recently Updated"] : ["My Actions Taken", "Recently Updated Tickets", "Urgent Tickets"]) {
        const table = loading.getByRole("region", { name: title, exact: true });
        await expect(table).toBeVisible();
        if (viewport.width === 1440) {
          await expect(table.getByRole("table", { name: title })).toBeVisible();
          await expect(table.locator("tbody tr")).toHaveCount(5);
        } else await expect(table.locator(".d-xl-none > div")).toHaveCount(5);
      }
      await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeDisabled();
      await noPageOverflow(page);
      await screenshot(page, "dashboard-loading", `${role.toLowerCase()}-${viewport.width}x${viewport.height}`);
    } finally { release(); }
    await expect(page.getByRole("link", { name: role === "REQUESTER" ? "Active Tickets: 8. View tickets" : "Unassigned: 4. View tickets" })).toBeVisible();
    await expect(page.getByRole("status", { name: "Loading Dashboard" })).toHaveCount(0);
  });

  test(`${role === "REQUESTER" ? "RESP-01" : "RESP-02"} ${role} Dashboard ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await stub(page, role);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    const label = role === "REQUESTER" ? "Active Tickets: 8. View tickets" : "Unassigned: 4. View tickets";
    await expect(page.getByRole("link", { name: label })).toBeVisible();
    await expect(page.getByRole("searchbox")).toHaveCount(0);
    await expect(page.getByLabel("Recently Updated" + (role === "REQUESTER" ? "" : " Tickets") + " list size")).toBeVisible();
    await noPageOverflow(page);
    if (role === "REQUESTER") {
      const quick = page.getByRole("region", { name: "Quick Actions" });
      if (viewport.width === 390) await expect(quick).toBeVisible(); else await expect(quick).not.toBeVisible();
      // Measure all layout offsets in one browser turn; page-enter transforms do not alter layout.
      const positions = await page.getByRole("link", { name: /\. View tickets$/ }).evaluateAll((links) => links.map((link) => ({ top: link.parentElement!.offsetTop, height: link.parentElement!.offsetHeight })));
      if (viewport.width === 390) expect(positions[1].top).toBeGreaterThan(positions[0].top + positions[0].height);
      if (viewport.width === 1440) expect(new Set(positions.map((position) => position.top)).size).toBe(1);
    }
    await screenshot(page, role === "REQUESTER" ? "requester-dashboard" : role === "IT_STAFF" ? "staff-dashboard" : "admin-dashboard", `${role.toLowerCase()}-${viewport.width}x${viewport.height}`);
    for (const title of role === "REQUESTER" ? ["Recently Updated"] : ["My Actions Taken", "Recently Updated Tickets", "Urgent Tickets"]) {
      await page.getByRole("heading", { name: title, exact: true }).scrollIntoViewIfNeeded();
      await noPageOverflow(page);
      await screenshot(page, "dashboard-tables", `${role.toLowerCase()}-${viewport.width}x${viewport.height}-${title.replaceAll(" ", "-").toLowerCase()}`);
    }
    const endpoint = role === "REQUESTER" ? "/api/users/me/dashboard" : "/api/dashboard";
    const zero = role === "REQUESTER" ? { metrics: { activeTickets: 0, waitingForRequester: 0, resolvedTickets: 0, closedTickets: 0 }, recentTickets: [] } : { metrics: { unassignedTickets: 0, myAssignedTickets: 0, inProgressTickets: 0, waitingForRequester: 0, highPriorityTickets: 0 }, myActions: [], recentTickets: [], urgentTickets: [] };
    await page.route(`http://127.0.0.1:3000${endpoint}?**`, (route) => route.fulfill({ status: 200, headers: { ...CORS, "Cache-Control": "no-store" }, json: zero }));
    await page.reload();
    await expect(page.getByRole("link", { name: role === "REQUESTER" ? "Active Tickets: 0. View tickets" : "Unassigned: 0. View tickets" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "No recent tickets", exact: true }).first()).toBeAttached();
    await noPageOverflow(page);
    await screenshot(page, "dashboard-zero", `${role.toLowerCase()}-${viewport.width}x${viewport.height}`);
  });
}
