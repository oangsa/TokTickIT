import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

export const ALICE_EMAIL = "alice.johnson@example.com";
export const BOB_EMAIL = "bob.smith@example.com";

const SEED_CREDENTIALS_PATH = resolve(
  process.cwd(),
  "server/.local/lab3-seed-credentials.json",
);

export interface SeededSession {
  initialPassword: string;
  currentPassword: string;
  passwordWasChanged: boolean;
  accessToken: string;
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

async function fillLogin(page: Page, email: string, password: string): Promise<string> {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/auth/login",
  );

  await page.getByLabel("Email *", { exact: true }).fill(email);
  await page.getByLabel("Password *", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  const response = await responsePromise;
  const body: unknown = await response.json();
  if (!response.ok() || !isRecord(body) || typeof body.accessToken !== "string") {
    throw new Error(`Seeded Requester login failed (${response.status()}).`);
  }

  return body.accessToken;
}

export async function signInSeededRequester(
  page: Page,
  email: string,
): Promise<SeededSession> {
  const initialPassword = readSeedPassword(email);

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  let accessToken = await fillLogin(page, email, initialPassword);

  await expect(page).toHaveURL(/\/(change-password|tickets)$/);
  const passwordChangeRequired = new URL(page.url()).pathname === "/change-password";

  if (!passwordChangeRequired) {
    await expect(page).toHaveURL(/\/tickets$/);
    return {
      initialPassword,
      currentPassword: initialPassword,
      passwordWasChanged: false,
      accessToken,
    };
  }

  const currentPassword = `E2e-${randomUUID()}!`;
  await page.getByLabel("New Password *", { exact: true }).fill(currentPassword);
  await page.getByLabel("Confirm New Password *", { exact: true }).fill(currentPassword);
  await page.getByRole("button", { name: "Change Password", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);

  accessToken = await fillLogin(page, email, currentPassword);
  await expect(page).toHaveURL(/\/tickets$/);

  return { initialPassword, currentPassword, passwordWasChanged: true, accessToken };
}

export async function restoreSeededPassword(
  page: Page,
  session: SeededSession,
): Promise<void> {
  if (!session.passwordWasChanged) {
    return;
  }

  await page.goto("/change-password");
  await expect(page.getByRole("heading", { name: "Change Password", exact: true })).toBeVisible();
  await page.getByLabel("Current Password *", { exact: true }).fill(session.currentPassword);
  await page.getByLabel("New Password *", { exact: true }).fill(session.initialPassword);
  await page.getByLabel("Confirm New Password *", { exact: true }).fill(session.initialPassword);
  await page.getByRole("button", { name: "Change Password", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  session.currentPassword = session.initialPassword;
  session.passwordWasChanged = false;
}

export const aliceRequesterTest = test.extend<{ aliceSession: SeededSession }>({
  aliceSession: [
    async ({ page }, use) => {
      const session = await signInSeededRequester(page, ALICE_EMAIL);
      try {
        await use(session);
      } finally {
        await restoreSeededPassword(page, session);
      }
    },
    { auto: true },
  ],
});
