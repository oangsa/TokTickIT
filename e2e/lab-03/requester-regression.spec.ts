import { expect, test, type Page } from "@playwright/test";
import {
  ALICE_EMAIL,
  BOB_EMAIL,
  restoreSeededPassword,
  signInSeededRequester,
  type SeededSession,
} from "../helpers/requester-auth.js";
import { createStaffFixture } from "./staff-fixture.js";

async function signOutIfAuthenticated(page: Page): Promise<void> {
  await page.goto("/tickets");
  const logout = page.getByRole("button", { name: "Logout", exact: true });
  const signInHeading = page.getByRole("heading", { name: "Sign in", exact: true });
  await expect(logout.or(signInHeading)).toBeVisible();
  if (await logout.isVisible().catch(() => false)) {
    await logout.click();
    await expect(page).toHaveURL(/\/login$/);
  }
}

test("E2E-03 authenticated Requester create/detail/action and owner isolation @issue-4", async ({ page }) => {
  let aliceSession: SeededSession | null = null;
  let bobSession: SeededSession | null = null;
  let ticketPublicId: string | null = null;
  let ticketNumber: string | null = null;
  let createBody: unknown;
  const requesterRequests: Array<{ method: string; headers: Record<string, string> }> = [];

  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() !== "OPTIONS" && path.startsWith("/api/users/me/")) {
      requesterRequests.push({ method: request.method(), headers: request.headers() });
    }
    if (request.method() === "POST" && path === "/api/users/me/tickets") {
      createBody = request.postDataJSON();
    }
  });

  try {
    aliceSession = await signInSeededRequester(page, ALICE_EMAIL);
    await page.goto("/tickets/new");
    await expect(page.getByRole("heading", { name: "Create Ticket", exact: true })).toBeVisible();

    await page.getByLabel("Category *", { exact: true }).selectOption({ label: "Network" });
    await page.getByLabel("Related System *", { exact: true }).selectOption({ label: "VPN" });
    await page.getByLabel("Requested Priority *", { exact: true }).selectOption("HIGH");

    const summary = `Authenticated requester E2E ${Date.now()}`;
    const description = "The VPN client fails after entering my credentials.";
    await page.getByLabel("Summary *", { exact: true }).fill(summary);
    await page.getByLabel("Description *", { exact: true }).fill(description);
    await page.getByLabel("Add Attachment", { exact: true }).setInputFiles({
      name: "vpn-error.png",
      mimeType: "image/png",
      buffer: Buffer.from("synthetic attachment"),
    });
    await expect(page.getByText("Pending", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Submit Ticket", exact: true }).click();

    await expect(page).toHaveURL(/\/tickets\/[0-9a-f-]+$/i);
    const detailPath = new URL(page.url()).pathname;
    ticketPublicId = detailPath.split("/").pop() ?? null;
    expect(ticketPublicId).toMatch(/^[0-9a-f-]+$/i);
    ticketNumber = await page.locator("h1").innerText();

    expect(createBody).toEqual({
      categoryId: expect.any(Number),
      relatedSystemId: expect.any(Number),
      requestedPriority: "HIGH",
      summary,
      description,
      attachmentIds: [expect.any(String)],
    });
    expect(Object.keys(createBody as Record<string, unknown>).sort()).toEqual([
      "attachmentIds",
      "categoryId",
      "description",
      "relatedSystemId",
      "requestedPriority",
      "summary",
    ]);
    expect(createBody).not.toHaveProperty("requesterId");
    expect(createBody).not.toHaveProperty("ticketNumber");
    expect(createBody).not.toHaveProperty("createdAt");

    await expect(page.getByText("Development Requester", { exact: true })).not.toBeVisible();
    await expect(page.getByText("Change Requester", { exact: true })).not.toBeVisible();
    await expect(page.getByLabel("Requester Name", { exact: true })).toHaveValue("Alice Johnson");
    await expect(page.getByText("Active", { exact: true })).toBeVisible();
    await expect(page.getByText("vpn-error.png", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Cancel Ticket", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Cancel this Ticket?", exact: true })).toBeVisible();
    await expect(dialog.getByText("This action will stop further work on it.", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel Ticket", exact: true }).click();
    await expect(page.getByText("CANCELLED", { exact: true })).toBeVisible();

    await page.goto("/tickets");
    await expect(page.getByRole("heading", { name: "My Tickets", exact: true })).toBeVisible();
    await expect(page.getByText(summary, { exact: true })).toBeVisible();

    await restoreSeededPassword(page, aliceSession);
    aliceSession = null;
    await signOutIfAuthenticated(page);

    bobSession = await signInSeededRequester(page, BOB_EMAIL);
    await page.goto(`/tickets/${ticketPublicId}`);
    await expect(page.getByText("404", { exact: true })).toBeVisible();
    if (ticketNumber !== null) {
      await expect(page.getByText(ticketNumber, { exact: true })).not.toBeVisible();
    }

    expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({
      local: 0,
      session: 0,
    });
  } finally {
    if (bobSession !== null) {
      await restoreSeededPassword(page, bobSession);
    }
    if (aliceSession !== null) {
      await restoreSeededPassword(page, aliceSession);
    }
  }

  for (const request of requesterRequests) {
    expect(request.headers["x-requester-id"]).toBeUndefined();
    expect(request.headers.authorization).toMatch(/^Bearer\s+\S+$/);
  }
});

test("E2E-03 ambiguous Create Ticket response replays one Ticket after reload @issue-4", async ({ page, request }) => {
  let session: SeededSession | null = null;
  const summary = `Lab 3 recovery ${Date.now()}`;
  const keys: string[] = [];
  try {
    session = await signInSeededRequester(page, ALICE_EMAIL);
    await page.route("**/api/users/me/tickets", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      keys.push(route.request().headers()["idempotency-key"]);
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred." }) });
    });
    await page.goto("/tickets/new");
    await page.getByLabel("Category *").selectOption({ label: "Network" });
    await page.getByLabel("Related System *").selectOption({ label: "VPN" });
    await page.getByLabel("Requested Priority *").selectOption("HIGH");
    await page.getByLabel("Summary *").fill(summary);
    await page.getByLabel("Description *").fill("A synthetic ambiguous submission for Lab 3.");
    await page.getByRole("button", { name: "Submit Ticket" }).click();
    const retry = page.getByRole("button", { name: "Retry Again" });
    await expect(retry).toBeVisible();
    await page.reload();
    await expect(retry).toBeVisible();
    await page.unrouteAll();
    page.on("request", (outgoing) => {
      if (outgoing.method() === "POST" && new URL(outgoing.url()).pathname === "/api/users/me/tickets") {
        keys.push(outgoing.headers()["idempotency-key"]);
      }
    });
    await retry.click();
    await expect(page).toHaveURL(/\/tickets\/[0-9a-f-]+$/i);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
    const response = await request.get(`http://127.0.0.1:3000/api/users/me/tickets?search=${encodeURIComponent(summary)}&searchFields=summary`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    expect(response.ok()).toBeTruthy();
    expect(await response.json()).toHaveLength(1);
  } finally {
    if (session !== null) await restoreSeededPassword(page, session);
  }
});

test("E2E-03 Requester confirms resolution then reopens unassigned @issue-4", async ({ page }) => {
  const fixture = await createStaffFixture();
  const ticket = fixture.tickets[0];
  try {
    await fixture.prisma.ticket.update({ where: { id: ticket.id }, data: { currentStatus: "RESOLVED", ownerUserId: fixture.staff.id, itPriority: "HIGH" } });
    await page.goto("/login");
    await page.getByLabel("Email *").fill(fixture.requester.email);
    await page.getByLabel("Password *").fill(fixture.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/tickets$/);
    await page.goto(`/tickets/${ticket.publicId}`);
    await page.getByRole("button", { name: "Problem appears resolved" }).click();
    await expect(page.getByRole("button", { name: "Resolution confirmed" })).toBeDisabled();
    expect((await fixture.prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).requesterResolutionConfirmedAt).not.toBeNull();
    await page.getByRole("button", { name: "Problem Still Exists" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Reopen Ticket" }).click();
    await expect(page.getByText("REOPENED", { exact: true })).toBeVisible();
    expect(await fixture.prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).toMatchObject({
      currentStatus: "REOPENED", ownerUserId: null, requesterResolutionConfirmedAt: null, itPriority: "HIGH",
    });
  } finally {
    await fixture.dispose();
  }
});

test("E2E-03 My Tickets search, filter, sort and page use authenticated ownership @issue-4", async ({ page }) => {
  const fixture = await createStaffFixture(12);
  try {
    await page.goto("/login");
    await page.getByLabel("Email *").fill(fixture.requester.email);
    await page.getByLabel("Password *").fill(fixture.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/tickets$/);
    await page.getByPlaceholder("Search by ticket number, summary, or description…").fill("Support request");
    await page.getByLabel("Sort by", { exact: true }).selectOption("summary:desc");
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    const filters = page.getByRole("dialog", { name: "Filters" });
    await filters.getByRole("button", { name: /Status.*Any Status/ }).click();
    await filters.getByRole("checkbox", { name: "NEW" }).check();
    await filters.getByRole("checkbox", { name: "NEW" }).press("Escape");
    await filters.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(page.locator("[data-testid='ticket-table'] tbody tr")).toHaveCount(10);
    expect(new URL(page.url()).searchParams.get("sort")).toBe("summary:desc");
    expect(new URL(page.url()).searchParams.get("currentStatus")).toBe("NEW");
    await expect(page.locator("[data-testid='ticket-table'] tbody tr").first()).toContainText("Support request 9");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator("[data-testid='ticket-table'] tbody tr")).toHaveCount(1);
    await expect(page.locator("[data-testid='ticket-table'] tbody tr")).toContainText("Support request 10");
  } finally { await fixture.dispose(); }
});
