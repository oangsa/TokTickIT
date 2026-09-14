import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

const ALICE_EMAIL = "alice.johnson@example.com";
const BOB_EMAIL = "bob.smith@example.com";
const SEED_CREDENTIALS_PATH = resolve(
  process.cwd(),
  "server/.local/lab3-seed-credentials.json",
);
const TEMPORARY_PASSWORD = "E2e-Requester-Reset-2026!";

interface SeededSession {
  initialPassword: string;
  passwordWasChanged: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readSeedPassword(email: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(SEED_CREDENTIALS_PATH, "utf8"));
  } catch {
    throw new Error("Lab 3 seed credentials are unavailable; run the guarded E2E setup first.");
  }

  if (!isRecord(parsed) || typeof parsed[email] !== "string") {
    throw new Error("Lab 3 seed credentials do not contain the required Requester.");
  }

  return parsed[email];
}

async function fillLogin(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel("Email *", { exact: true }).fill(email);
  await page.getByLabel("Password *", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function signInSeededRequester(page: Page, email: string): Promise<SeededSession> {
  const initialPassword = readSeedPassword(email);

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  await fillLogin(page, email, initialPassword);

  await expect(page).toHaveURL(/\/(change-password|tickets)$/);
  const passwordChangeRequired = new URL(page.url()).pathname === "/change-password";

  if (!passwordChangeRequired) {
    await expect(page).toHaveURL(/\/tickets$/);
    return { initialPassword, passwordWasChanged: false };
  }

  await page.getByLabel("New Password *", { exact: true }).fill(TEMPORARY_PASSWORD);
  await page.getByLabel("Confirm New Password *", { exact: true }).fill(TEMPORARY_PASSWORD);
  await page.getByRole("button", { name: "Change Password", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);

  await fillLogin(page, email, TEMPORARY_PASSWORD);
  await expect(page).toHaveURL(/\/tickets$/);

  return { initialPassword, passwordWasChanged: true };
}

async function restoreSeededPassword(page: Page, session: SeededSession): Promise<void> {
  if (!session.passwordWasChanged) {
    return;
  }

  await page.goto("/change-password");
  await expect(page.getByRole("heading", { name: "Change Password", exact: true })).toBeVisible();
  await page.getByLabel("Current Password *", { exact: true }).fill(TEMPORARY_PASSWORD);
  await page.getByLabel("New Password *", { exact: true }).fill(session.initialPassword);
  await page.getByLabel("Confirm New Password *", { exact: true }).fill(session.initialPassword);
  await page.getByRole("button", { name: "Change Password", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  session.passwordWasChanged = false;
}

async function signOutIfAuthenticated(page: Page): Promise<void> {
  await page.goto("/tickets");
  const logout = page.getByRole("button", { name: "Logout", exact: true });
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
