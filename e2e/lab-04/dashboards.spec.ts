import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { createStaffFixture } from "../lab-03/staff-fixture.js";

async function capture(page: Page, name: string) {
  const directory = "artifacts/lab-04/screenshots/dashboard-drill-downs";
  await mkdir(directory, { recursive: true });
  const path = `${directory}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  await test.info().attach(name, { path, contentType: "image/png" });
}
async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email *", { exact: true }).fill(email);
  await page.getByLabel("Password *", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
}
test("E2E-03 real role snapshots, filtered drills, Action links, URL sizes, refresh, remount, visibility and recoverable failure", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const fixture = await createStaffFixture(8);
  const { prisma, tickets, requester, staff, admin } = fixture;
  for (const [index, currentStatus] of (["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const).entries()) {
    await prisma.ticket.update({ where: { id: tickets[index].id }, data: { currentStatus, ownerUserId: index % 2 ? staff.id : null, itPriority: index % 2 ? "HIGH" : "LOW" } });
  }
  const action = await prisma.actionTaken.create({ data: { ticketId: tickets[2].id, creatorUserId: staff.id, assignedToUserId: staff.id, performedByUserId: staff.id, status: "COMPLETED", description: "Verified Dashboard action", result: "Synthetic verified result", followUpRequired: false,
    startedAt: new Date("2026-10-01T09:00:00Z"), completedAt: new Date("2026-10-01T10:00:00Z"), createdBy: "dashboard-e2e", updatedBy: "dashboard-e2e" } });
  let reads = 0; let failNext = false;
  await page.route("**/api/users/me/dashboard?**", async (route) => {
    reads++;
    if (failNext) {
      failNext = false;
      await route.fulfill({ status: 503, headers: { "Access-Control-Allow-Origin": "http://127.0.0.1:5173", "Access-Control-Allow-Credentials": "true", "Cache-Control": "no-store" }, json: { code: "INTERNAL_ERROR" } });
    } else await route.continue();
  });
  const contexts = [];
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.clock.install();
    const requesterResponse = page.waitForResponse((response) => response.url().includes("/api/users/me/dashboard?") && response.status() === 200);
    await signIn(page, requester.email, fixture.password);
    expect((await requesterResponse).headers()["cache-control"]).toBe("no-store");
    for (const [label, count] of [["Active Tickets", 5], ["Waiting for Me", 1], ["Resolved", 1], ["Closed", 1]] as const) await expect(page.getByRole("link", { name: `${label}: ${count}. View tickets` })).toBeVisible();
    await capture(page, "requester-nonzero");
    for (const [label, count, statuses] of [["Active Tickets", 5, ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"]], ["Waiting for Me", 1, ["WAITING_FOR_REQUESTER"]], ["Resolved", 1, ["RESOLVED"]], ["Closed", 1, ["CLOSED"]]] as const) {
      const api = page.waitForResponse((response) => response.url().includes("/api/users/me/tickets?") && response.status() === 200);
      await page.getByRole("link", { name: `${label}: ${count}. View tickets` }).click();
      const rows = await (await api).json() as { publicId: string; currentStatus: string }[];
      expect(rows.length).toBe(count); expect(rows.every((row) => (statuses as readonly string[]).includes(row.currentStatus) && tickets.some((ticket) => ticket.publicId === row.publicId))).toBe(true);
      await expect(page.getByRole("heading", { name: "My Tickets", exact: true })).toBeVisible();
      await capture(page, `requester-${label.replaceAll(" ", "-").toLowerCase()}`);
      await page.getByRole("link", { name: "Dashboard", exact: true }).click();
      await expect(page.getByRole("link", { name: "Active Tickets: 5. View tickets" })).toBeVisible();
    }
    for (const size of [10, 20, 5]) {
      await page.getByLabel("Recently Updated list size").selectOption(String(size));
      await expect(page).toHaveURL(new RegExp(`recentTicketsSize=${size}`));
      await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
    }
    const before = reads;
    await page.clock.fastForward(30_000); await expect.poll(() => reads).toBe(before + 1);
    await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Refresh", exact: true }).click(); await expect.poll(() => reads).toBe(before + 2);
    await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
    const fresh = reads;
    await page.getByRole("link", { name: "My Tickets", exact: true }).click();
    await page.goBack();
    await expect(page.getByRole("link", { name: "Active Tickets: 5. View tickets" })).toBeVisible();
    expect(reads).toBe(fresh);
    await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
    await page.clock.fastForward(60_000); expect(reads).toBe(fresh);
    await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); document.dispatchEvent(new Event("visibilitychange")); });
    await expect.poll(() => reads).toBe(fresh + 1); await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
    const updated = await page.getByText(/^Last updated /).textContent();
    failNext = true; await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Showing last successful data");
    await expect(page.getByRole("link", { name: "Active Tickets: 5. View tickets" })).toBeVisible();
    expect(await page.getByText(/^Last updated /).textContent()).toBe(updated);
    await capture(page, "requester-background-failure");
    await page.getByRole("button", { name: "Retry", exact: true }).click(); await expect(page.getByRole("alert")).toHaveCount(0);
    expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
    for (const user of [staff, admin]) {
      const context = await browser.newContext({ baseURL: "http://127.0.0.1:5173", viewport: { width: 1440, height: 900 } }); contexts.push(context);
      const operational = await context.newPage();
      const snapshotResponse = operational.waitForResponse((response) => response.url().includes("/api/dashboard?") && response.status() === 200);
      await signIn(operational, user.email, fixture.password);
      const snapshot = await snapshotResponse;
      expect(snapshot.headers()["cache-control"]).toBe("no-store");
      const compact = await snapshot.json() as { recentTickets: { publicId: string; ticketNumber: string }[]; urgentTickets: { publicId: string; ticketNumber: string }[] };
      const recentIds = (await prisma.ticket.findMany({ where: { deleted: false, currentStatus: { notIn: ["CLOSED", "CANCELLED"] } }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 5, select: { publicId: true } })).map((ticket) => ticket.publicId);
      expect(compact.recentTickets.map((ticket) => ticket.publicId)).toEqual(recentIds);
      expect(compact.recentTickets.length).toBeLessThanOrEqual(5); expect(compact.urgentTickets.length).toBeLessThanOrEqual(5);
      const nonTerminal = { deleted: false, currentStatus: { notIn: ["CLOSED", "CANCELLED"] as ("CLOSED" | "CANCELLED")[] } };
      const expected = [
        ["Unassigned", await prisma.ticket.count({ where: { ...nonTerminal, ownerUserId: null } })],
        ["My Assigned", await prisma.ticket.count({ where: { ...nonTerminal, ownerUserId: user.id } })],
        ["In Progress", await prisma.ticket.count({ where: { deleted: false, currentStatus: "IN_PROGRESS" } })],
        ["Waiting for Requester", await prisma.ticket.count({ where: { deleted: false, currentStatus: "WAITING_FOR_REQUESTER" } })],
        ["High Priority", await prisma.ticket.count({ where: { ...nonTerminal, itPriority: "HIGH" } })],
      ] as const;
      for (const [label, count] of expected) await expect(operational.getByRole("link", { name: `${label}: ${count}. View tickets` })).toBeVisible();
      await capture(operational, `${user.role.toLowerCase()}-nonzero`);
      const prefix = user.role === "ADMINISTRATOR" ? "/admin/tickets" : "/staff/tickets";
      if (user.role === "IT_STAFF") {
        await expect(operational.getByRole("link", { name: action.description, exact: true }).filter({ visible: true })).toHaveCount(1);
        await operational.getByRole("link", { name: action.description, exact: true }).filter({ visible: true }).click();
        await expect(operational).toHaveURL(`${prefix}/${tickets[2].publicId}/actions/${action.publicId}`);
        await expect(operational.getByText("Synthetic verified result", { exact: true })).toBeVisible();
        await capture(operational, "staff-action-detail"); await operational.getByRole("link", { name: "Dashboard", exact: true }).click();
      }
      for (const [label, count] of expected) {
        const response = operational.waitForResponse((response) => response.url().includes("/api/tickets?") && response.status() === 200);
        await operational.getByRole("link", { name: `${label}: ${count}. View tickets` }).click();
        const filtered = await response;
        expect(JSON.parse(filtered.headers()["x-pagination"]).totalItems).toBe(count);
        const rows = await filtered.json() as { itPriority: string; currentStatus: string; owner: { publicId: string } | null }[];
        expect(rows.every((row) => label === "In Progress" ? row.currentStatus === "IN_PROGRESS" : label === "Waiting for Requester" ? row.currentStatus === "WAITING_FOR_REQUESTER" : !["CLOSED", "CANCELLED"].includes(row.currentStatus) && (label === "Unassigned" ? row.owner === null : label === "My Assigned" ? row.owner?.publicId === user.publicId : row.itPriority === "HIGH"))).toBe(true);
        await capture(operational, `${user.role.toLowerCase()}-${label.replaceAll(" ", "-").toLowerCase()}-drill`);
        await operational.getByRole("link", { name: "Dashboard", exact: true }).click();
      }
      for (const [title, rows] of [["Recently Updated Tickets", compact.recentTickets], ["Urgent Tickets", compact.urgentTickets]] as const) {
        expect(rows.length).toBeGreaterThan(0);
        await operational.getByRole("region", { name: title, exact: true }).getByRole("link", { name: rows[0].ticketNumber, exact: true }).filter({ visible: true }).click();
        await expect(operational).toHaveURL(`${prefix}/${rows[0].publicId}`);
        await expect(operational.getByRole("heading", { name: rows[0].ticketNumber, exact: true })).toBeVisible();
        await capture(operational, `${user.role.toLowerCase()}-${title.replaceAll(" ", "-").toLowerCase()}-detail`);
        await operational.getByRole("link", { name: "Dashboard", exact: true }).click();
      }
      for (const label of ["My Actions Taken", "Recently Updated Tickets", "Urgent Tickets"]) for (const size of [10, 20, 5]) {
        await operational.getByLabel(`${label} list size`).selectOption(String(size));
        await expect(operational.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
      }
    }
  } finally {
    for (const context of contexts) await context.close();
    // Synthetic audit-compatible fixture remains on the dedicated disposable database.
    await prisma.$disconnect();
  }
});
