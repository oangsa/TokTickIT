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

const REQUESTER_USER = {
  ...STAFF_USER,
  role: "REQUESTER" as const,
  name: "Requester User",
  email: "requester@example.test",
};

const REQUESTER_TICKET_ID = "05a214b4-b957-4ed7-a58e-73f4392b35ec";

const REQUESTER_TICKET = {
  publicId: REQUESTER_TICKET_ID,
  ticketNumber: "TKT-20260820-A81F3C9D7B21",
  categoryId: 4,
  categoryName: "Network",
  relatedSystemId: 5,
  relatedSystemName: "VPN",
  summary: "Cannot connect to campus VPN",
  requestedPriority: "HIGH",
  currentStatus: "RESOLVED",
  requesterId: 3,
  requesterPublicId: REQUESTER_USER.publicId,
  requesterName: REQUESTER_USER.name,
  requesterEmail: REQUESTER_USER.email,
  description: "The VPN client fails after entering my credentials.",
  itPriority: "HIGH",
  owner: null,
  requesterResolutionConfirmedAt: null,
  attachments: [],
  createdBy: REQUESTER_USER.email,
  createdAt: "2026-08-20T08:14:32.000Z",
  updatedBy: REQUESTER_USER.email,
  updatedAt: "2026-08-20T08:14:32.000Z",
  deleted: false,
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

async function stubRequesterPages(page: Page): Promise<void> {
  await stubAuth(page, REQUESTER_USER);
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    const url = new URL(request.url());
    if (url.pathname === "/api/auth/refresh") {
      await fulfillAuth(route, 200, { accessToken: "e2e-memory-token", expiresIn: 600 });
      return;
    }
    if (url.pathname === "/api/auth/me") {
      await fulfillAuth(route, 200, REQUESTER_USER);
      return;
    }
    if (url.pathname === "/api/categories") {
      await fulfillAuth(route, 200, [{ id: 4, name: "Network" }]);
      return;
    }
    if (url.pathname === "/api/related-systems") {
      await fulfillAuth(route, 200, [{ id: 5, name: "VPN" }]);
      return;
    }
    if (url.pathname === "/api/users/me/tickets" && request.method() === "GET") {
      await fulfillAuth(route, 200, [
        {
          publicId: REQUESTER_TICKET_ID,
          ticketNumber: REQUESTER_TICKET.ticketNumber,
          categoryId: REQUESTER_TICKET.categoryId,
          categoryName: REQUESTER_TICKET.categoryName,
          relatedSystemId: REQUESTER_TICKET.relatedSystemId,
          relatedSystemName: REQUESTER_TICKET.relatedSystemName,
          summary: REQUESTER_TICKET.summary,
          requestedPriority: REQUESTER_TICKET.requestedPriority,
          currentStatus: REQUESTER_TICKET.currentStatus,
          createdAt: REQUESTER_TICKET.createdAt,
        },
      ]);
      return;
    }
    if (url.pathname === `/api/users/me/tickets/${REQUESTER_TICKET_ID}`) {
      await fulfillAuth(route, 200, REQUESTER_TICKET);
      return;
    }

    await fulfillAuth(route, 404, { code: "NOT_FOUND" });
  });
}

for (const viewport of VIEWPORTS) {
  test(`RESP-02 Requester pages remain usable at ${viewport.width}x${viewport.height} @issue-4`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await stubRequesterPages(page);

    await page.goto("/tickets/new");
    await expect(page.getByRole("heading", { name: "Create Ticket", exact: true })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.goto("/tickets");
    await expect(page.getByRole("heading", { name: "My Tickets", exact: true })).toBeVisible();
    await expect(page.getByText(REQUESTER_TICKET.ticketNumber, { exact: true })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.goto(`/tickets/${REQUESTER_TICKET_ID}`);
    await expect(page.getByRole("heading", { name: REQUESTER_TICKET.ticketNumber, exact: true })).toBeVisible();
    await expect(page.getByLabel("Requester Name", { exact: true })).toHaveValue(REQUESTER_USER.name);
    await assertNoHorizontalOverflow(page);
  });

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
