import { expect, test, type Page } from "@playwright/test";
import { createStaffFixture } from "./staff-fixture.js";

const FULL_USER = {
  publicId: "e2e-user",
  name: "E2E User",
  email: "e2e@example.test",
  role: "REQUESTER",
  isActive: true,
  mustChangePassword: false,
  sessionStage: "FULL",
};

const RESTRICTED_USER = {
  ...FULL_USER,
  mustChangePassword: true,
  sessionStage: "PASSWORD_CHANGE_REQUIRED",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "http://127.0.0.1:5173",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

async function fulfillJson(route: import("@playwright/test").Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({ status, contentType: "application/json", headers: CORS_HEADERS, body: JSON.stringify(body) });
}

async function fulfillAuth(route: import("@playwright/test").Route, status: number, body: unknown): Promise<void> {
  if (route.request().method() === "OPTIONS") {
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
    return;
  }
  await fulfillJson(route, status, body);
}

async function fulfillNoContent(route: import("@playwright/test").Route): Promise<void> {
  if (route.request().method() === "OPTIONS") {
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
    return;
  }
  await route.fulfill({ status: 204, headers: CORS_HEADERS });
}

async function stubRefreshAndIdentity(
  page: Page,
  user: typeof FULL_USER,
): Promise<void> {
  await page.route("**/api/auth/refresh", async (route) => {
    await fulfillAuth(route, 200, { accessToken: "e2e-memory-token", expiresIn: 600 });
  });
  await page.route("**/api/auth/me", async (route) => {
    await fulfillAuth(route, 200, user);
  });
}

async function stubRequesterList(page: Page): Promise<void> {
  await page.route("**/api/categories", async (route) => {
    await fulfillAuth(route, 200, []);
  });
  await page.route("**/api/related-systems", async (route) => {
    await fulfillAuth(route, 200, []);
  });
  await page.route("**/api/users/me/tickets**", async (route) => {
    await fulfillAuth(route, 200, []);
  });
}

test("E2E-01 initial-password login requires a fresh login and protects routes @issue-3", async ({ page }) => {
  type AuthPhase = "restricted" | "full" | "anonymous";
  let phase: AuthPhase = "anonymous";
  let passwordChanged = false;
  const loginBodies: unknown[] = [];

  await page.route("**/api/auth/refresh", async (route) => {
    if (phase === "anonymous") {
      await fulfillAuth(route, 401, { code: "SESSION_INVALID" });
      return;
    }
    await fulfillAuth(route, 200, { accessToken: `${phase}-token`, expiresIn: 600 });
  });
  await page.route("**/api/auth/me", async (route) => {
    await fulfillAuth(route, 200, phase === "restricted" ? RESTRICTED_USER : FULL_USER);
  });
  await page.route("**/api/auth/login", async (route) => {
    if (route.request().method() !== "OPTIONS") {
      loginBodies.push(route.request().postDataJSON());
      phase = passwordChanged ? "full" : "restricted";
    }
    await fulfillAuth(route, 200, { accessToken: `${phase}-token`, expiresIn: 600 });
  });
  await page.route("**/api/auth/change-password", async (route) => {
    passwordChanged = true;
    await fulfillNoContent(route);
  });
  await page.route("**/api/auth/logout", async (route) => {
    phase = "anonymous";
    await fulfillNoContent(route);
  });
  await stubRequesterList(page);

  await page.goto("/login");
  await page.getByLabel("Email *", { exact: true }).fill(FULL_USER.email);
  await page.getByLabel("Password *", { exact: true }).fill("InitialPass1!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/change-password$/);
  await expect(page.getByRole("navigation")).not.toBeAttached();

  await page.getByLabel("New Password *", { exact: true }).fill("NewPassword1!");
  await page.getByLabel("Confirm New Password *", { exact: true }).fill("Different1!");
  await page.getByRole("button", { name: "Change Password", exact: true }).click();
  await expect(page.getByText("Passwords do not match.", { exact: true })).toBeVisible();

  await page.getByLabel("New Password *", { exact: true }).fill("NewPassword1!");
  await page.getByLabel("Confirm New Password *", { exact: true }).fill("NewPassword1!");
  await page.getByRole("button", { name: "Change Password", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Password changed successfully. Please sign in again.")).toBeVisible();

  await page.getByLabel("Email *").fill(FULL_USER.email);
  await page.getByLabel("Password *").fill("NewPassword1!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/tickets$/);
  await expect(page.getByRole("heading", { name: "My Tickets", exact: true })).toBeVisible();
  expect(loginBodies).toEqual([
    { email: FULL_USER.email, password: "InitialPass1!", rememberMe: false },
    { email: FULL_USER.email, password: "NewPassword1!", rememberMe: false },
  ]);

  await page.goto("/staff/tickets");
  await expect(page.getByText("403", { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation")).not.toBeAttached();

  await page.goto("/tickets");
  await expect(page.getByRole("button", { name: "Logout", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();

  await page.goto("/tickets");
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
});

test("E2E-02 Login sends only documented fields and shows safe auth failure @issue-3", async ({ page }) => {
  let requestBody: unknown;
  await page.route("**/api/auth/refresh", async (route) => {
    await fulfillAuth(route, 401, { code: "SESSION_INVALID" });
  });
  await page.route("**/api/auth/login", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.continue();
      return;
    }
    requestBody = route.request().postDataJSON();
    await fulfillJson(route, 401, { code: "AUTHENTICATION_FAILED" });
  });

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  await page.getByLabel("Email *").fill("wrong@example.test");
  await page.getByLabel("Password *").fill("WrongPassword1!");
  await page.getByLabel("Remember me").check();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page.getByText("Invalid email or password.", { exact: true })).toBeVisible();
  expect(requestBody).toEqual({ email: "wrong@example.test", password: "WrongPassword1!", rememberMe: true });
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
});

test("E2E-02 rate limiting keeps login feedback safe @issue-3", async ({ page }) => {
  await page.route("**/api/auth/refresh", async (route) => {
    await fulfillAuth(route, 401, { code: "SESSION_INVALID" });
  });
  await page.route("**/api/auth/login", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await fulfillAuth(route, 204, undefined);
      return;
    }
    await route.fulfill({
      status: 429,
      contentType: "application/json",
      headers: { ...CORS_HEADERS, "Retry-After": "60" },
      body: JSON.stringify({ code: "RATE_LIMITED" }),
    });
  });

  await page.goto("/login");
  await page.getByLabel("Email *", { exact: true }).fill("someone@example.test");
  await page.getByLabel("Password *", { exact: true }).fill("WrongPassword1!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Too many login attempts. Try again later.", { exact: true })).toBeVisible();
});

for (const failureCase of ["unknown account", "inactive account", "incorrect password"] as const) {
  test(`E2E-02 ${failureCase} uses indistinguishable safe feedback @issue-3`, async ({ page }) => {
    await page.route("**/api/auth/refresh", async (route) => {
      await fulfillAuth(route, 401, { code: "SESSION_INVALID" });
    });
    await page.route("**/api/auth/login", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await fulfillAuth(route, 204, undefined);
        return;
      }
      await fulfillJson(route, 401, { code: "AUTHENTICATION_FAILED" });
    });

    await page.goto("/login");
    await page.getByLabel("Email *", { exact: true }).fill(`${failureCase.replace(/ /g, ".")}@example.test`);
    await page.getByLabel("Password *", { exact: true }).fill("WrongPassword1!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText("Invalid email or password.", { exact: true })).toBeVisible();
  });
}

test("E2E-02 restricted identity reaches Change Password without shell flash @issue-3", async ({ page }) => {
  await stubRefreshAndIdentity(page, RESTRICTED_USER);
  await page.goto("/tickets");
  await expect(page).toHaveURL(/\/change-password$/);
  await expect(page.getByRole("heading", { name: "Change Password", exact: true })).toBeVisible();
  await expect(page.getByLabel("New Password *", { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation")).not.toBeVisible();
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
});

test("E2E-01 live Remember Me, refresh bootstrap, and logout-all revoke sessions @issue-3", async ({ page, browser }) => {
  test.skip(process.env.ISSUE_3_UI_ONLY === "1", "Live session proof needs guarded PostgreSQL");
  const fixture = await createStaffFixture(0);
  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();

  try {
    await page.goto("/login");
    await page.getByLabel("Email *").fill(fixture.requester.email);
    await page.getByLabel("Password *").fill(fixture.password);
    await page.getByLabel("Remember me").check();
    const loginResponse = page.waitForResponse((response) => response.url().endsWith("/api/auth/login") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const { accessToken } = await (await loginResponse).json() as { accessToken: string };
    await expect(page).toHaveURL(/\/tickets$/);

    const cookie = (await page.context().cookies("http://127.0.0.1:3000/api/auth/refresh")).find((item) => item.name === "toktickit_refresh");
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Strict" });
    expect(cookie!.expires).toBeGreaterThan(Date.now() / 1000);
    expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });

    const refreshResponse = page.waitForResponse((response) => response.url().endsWith("/api/auth/refresh") && response.request().method() === "POST");
    await page.reload();
    expect((await refreshResponse).status()).toBe(200);
    await expect(page.getByRole("heading", { name: "My Tickets", exact: true })).toBeVisible();

    await secondPage.goto("/login");
    await secondPage.getByLabel("Email *").fill(fixture.requester.email);
    await secondPage.getByLabel("Password *").fill(fixture.password);
    await secondPage.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(secondPage).toHaveURL(/\/tickets$/);

    const logoutStatus = await page.evaluate(async (token) => {
      const response = await fetch("http://127.0.0.1:3000/api/auth/logout-all", {
        method: "POST",
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.status;
    }, accessToken);
    expect(logoutStatus).toBe(204);
    await page.reload();
    await secondPage.reload();
    await expect(page).toHaveURL(/\/login$/);
    await expect(secondPage).toHaveURL(/\/login$/);
    expect(await fixture.prisma.userSession.count({ where: { userId: fixture.requester.id, revokedAt: null } })).toBe(0);
  } finally {
    await secondContext.close();
    await fixture.dispose();
  }
});
