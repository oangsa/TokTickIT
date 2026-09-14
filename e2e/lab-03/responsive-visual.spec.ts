import { expect, test, type Page } from "@playwright/test";

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 820, height: 1180 },
  { width: 390, height: 844 },
] as const;

const STAFF_USER = {
  publicId: "e2e-staff",
  name: "Staff User",
  email: "staff@example.test",
  role: "IT_STAFF",
  isActive: true,
  mustChangePassword: false,
  sessionStage: "FULL",
};

const RESTRICTED_USER = {
  ...STAFF_USER,
  mustChangePassword: true,
  sessionStage: "PASSWORD_CHANGE_REQUIRED",
};

const SHELL_ROLES = [
  { user: { ...STAFF_USER, role: "REQUESTER", name: "Requester User", email: "requester@example.test" }, path: "/tickets", expected: ["Create Ticket", "My Tickets"], forbidden: ["Ticket Queue", "User Management"] },
  { user: STAFF_USER, path: "/staff/tickets", expected: ["Ticket Queue"], forbidden: ["Create Ticket", "User Management"] },
  { user: { ...STAFF_USER, role: "ADMINISTRATOR", name: "Admin User", email: "admin@example.test" }, path: "/admin/users", expected: ["User Management", "Tickets"], forbidden: ["Create Ticket", "Ticket Queue"] },
] as const;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "http://127.0.0.1:5173",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

async function fulfillAuth(route: import("@playwright/test").Route, status: number, body: unknown): Promise<void> {
  if (route.request().method() === "OPTIONS") {
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
    return;
  }
  await route.fulfill({ status, contentType: "application/json", headers: CORS_HEADERS, body: JSON.stringify(body) });
}

async function stubAuth(page: Page, user = STAFF_USER): Promise<void> {
  await page.route("**/api/auth/refresh", async (route) => {
    await fulfillAuth(route, 200, { accessToken: "e2e-memory-token", expiresIn: 600 });
  });
  await page.route("**/api/auth/me", async (route) => {
    await fulfillAuth(route, 200, user);
  });
}

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  expect(fits).toBe(true);
}

for (const viewport of VIEWPORTS) {
  test(`RESP-01 Login remains readable at ${viewport.width}x${viewport.height} @issue-3`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.route("**/api/auth/refresh", async (route) => {
      await fulfillAuth(route, 401, { code: "SESSION_INVALID" });
    });
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
    await expect(page.getByLabel("Email *")).toBeVisible();
    await expect(page.getByLabel("Password *")).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test(`RESP-01 Change Password remains readable at ${viewport.width}x${viewport.height} @issue-3`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await stubAuth(page, RESTRICTED_USER);
    await page.goto("/change-password");
    await expect(page.getByRole("heading", { name: "Change Password", exact: true })).toBeVisible();
    await expect(page.getByLabel("New Password *", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Confirm New Password *", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Current Password *", { exact: true })).not.toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  for (const shellRole of SHELL_ROLES) {
    test(`RESP-06 ${shellRole.user.role} shell stays usable at ${viewport.width}x${viewport.height} @issue-3`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await stubAuth(page, shellRole.user);
      await page.goto(shellRole.path);
      await assertNoHorizontalOverflow(page);

      if (viewport.width < 992) {
        const toggle = page.getByRole("button", { name: "Open navigation menu" });
        await expect(toggle).toBeVisible();
        await toggle.click();
        await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
        await expect(page.getByText(shellRole.user.name, { exact: true })).toBeVisible();
        for (const link of shellRole.expected) await expect(page.getByRole("link", { name: link, exact: true })).toBeVisible();
        for (const link of shellRole.forbidden) await expect(page.getByRole("link", { name: link, exact: true })).not.toBeVisible();
        await expect(page.getByRole("button", { name: "Change Password", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Logout", exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Close navigation menu" }).press("Escape");
        await expect(page.getByRole("button", { name: "Open navigation menu" })).toBeFocused();
      } else {
        await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
        await expect(page.getByText(shellRole.user.name, { exact: true })).toBeVisible();
        for (const link of shellRole.expected) await expect(page.getByRole("link", { name: link, exact: true })).toBeVisible();
        for (const link of shellRole.forbidden) await expect(page.getByRole("link", { name: link, exact: true })).not.toBeVisible();
        await expect(page.getByRole("button", { name: "Open navigation menu" })).not.toBeVisible();
      }
    });
  }
}
