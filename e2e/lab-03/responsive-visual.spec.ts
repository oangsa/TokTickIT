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
  "Access-Control-Expose-Headers": "X-Pagination",
};

async function fulfillAuth(
  route: import("@playwright/test").Route,
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<void> {
  if (route.request().method() === "OPTIONS") {
    await route.fulfill({ status: 204, headers: { ...CORS_HEADERS, ...extraHeaders } });
    return;
  }
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: { ...CORS_HEADERS, ...extraHeaders },
    body: JSON.stringify(body),
  });
}

async function stubAuth(page: Page, user = STAFF_USER): Promise<void> {
  for (const resource of ["tickets", "users/assignable", "categories", "related-systems"]) {
    await page.route(`**/api/${resource}{,?*}`, async (route) => { await fulfillAuth(route, 200, []); });
  }
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

const STAFF_CATEGORY = { id: 4, name: "Network" };

const STAFF_TICKETS = Array.from({ length: 12 }, (_, index) => ({
  publicId: `synthetic-ticket-${index + 1}`,
  ticketNumber: `TKT-20260916-${String(index + 1).padStart(12, "0")}`,
  requesterName: "Workflow Requester",
  categoryId: STAFF_CATEGORY.id,
  categoryName: STAFF_CATEGORY.name,
  relatedSystemId: 5,
  relatedSystemName: "VPN",
  summary: index === 0 ? "VPN disconnects after login" : `Support request ${index + 1}`,
  requestedPriority: "MEDIUM" as const,
  itPriority: index % 2 ? ("MEDIUM" as const) : ("HIGH" as const),
  currentStatus: "NEW" as const,
  owner: null,
  createdAt: "2026-09-16T00:00:00.000Z",
  updatedAt: "2026-09-16T00:00:00.000Z",
}));

const STAFF_TICKET_DETAIL = {
  ...STAFF_TICKETS[0],
  description: "Synthetic workflow fixture for Staff Queue verification.",
  requesterEmail: "requester@example.test",
  requesterResolutionConfirmedAt: null,
  createdBy: "issue5-e2e",
  updatedBy: "issue5-e2e",
  deleted: false,
  attachments: [],
};

async function stubStaffQueuePages(page: Page): Promise<void> {
  await stubAuth(page, STAFF_USER);
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
      await fulfillAuth(route, 200, STAFF_USER);
      return;
    }
    if (url.pathname === "/api/categories") {
      await fulfillAuth(route, 200, [STAFF_CATEGORY]);
      return;
    }
    if (url.pathname === "/api/related-systems") {
      await fulfillAuth(route, 200, [{ id: 5, name: "VPN" }]);
      return;
    }
    if (url.pathname === "/api/users/assignable") {
      await fulfillAuth(route, 200, [{ publicId: STAFF_USER.publicId, name: STAFF_USER.name, role: STAFF_USER.role }]);
      return;
    }
    if (url.pathname === "/api/tickets" && request.method() === "GET") {
      const search = url.searchParams.get("search");
      if (search && search.includes("No matching")) {
        await fulfillAuth(route, 200, [], {
          "X-Pagination": JSON.stringify({
            totalItems: 0,
            pageNumber: 1,
            pageSize: 10,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          }),
        });
        return;
      }
      await fulfillAuth(route, 200, STAFF_TICKETS, {
        "X-Pagination": JSON.stringify({
          totalItems: STAFF_TICKETS.length,
          pageNumber: 1,
          pageSize: 10,
          totalPages: Math.ceil(STAFF_TICKETS.length / 10),
          hasNextPage: STAFF_TICKETS.length > 10,
          hasPreviousPage: false,
        }),
      });
      return;
    }
    if (url.pathname === `/api/tickets/${STAFF_TICKETS[0].publicId}`) {
      await fulfillAuth(route, 200, STAFF_TICKET_DETAIL);
      return;
    }

    await fulfillAuth(route, 404, { code: "NOT_FOUND" });
  });
}

const ADMIN_USER = {
  ...STAFF_USER,
  role: "ADMINISTRATOR" as const,
  name: "Admin User",
  email: "admin@example.test",
};

const SYNTHETIC_USERS = [
  {
    publicId: "synthetic-user-1",
    name: "Alice Requester",
    email: "alice@example.test",
    role: "REQUESTER",
    isActive: true,
    mustChangePassword: false,
    createdAt: "2026-09-17T00:00:00.000Z",
    updatedAt: "2026-09-17T00:00:00.000Z",
  },
  {
    publicId: "synthetic-user-2",
    name: "Bob Staff",
    email: "bob@example.test",
    role: "IT_STAFF",
    isActive: true,
    mustChangePassword: false,
    createdAt: "2026-09-17T00:00:00.000Z",
    updatedAt: "2026-09-17T00:00:00.000Z",
  },
  {
    publicId: ADMIN_USER.publicId,
    name: ADMIN_USER.name,
    email: ADMIN_USER.email,
    role: "ADMINISTRATOR",
    isActive: true,
    mustChangePassword: false,
    createdAt: "2026-09-17T00:00:00.000Z",
    updatedAt: "2026-09-17T00:00:00.000Z",
  },
];

const SYNTHETIC_COMMENTS = [
  {
    id: 1,
    publicId: "comment-root-1",
    ticketPublicId: STAFF_TICKETS[0].publicId,
    author: {
      publicId: STAFF_USER.publicId,
      name: STAFF_USER.name,
      role: STAFF_USER.role,
    },
    parentCommentId: null,
    parentCommentPublicId: null,
    replyToCommentId: null,
    replyToCommentPublicId: null,
    replyToAuthorName: null,
    content: "Please send more details regarding the network connection error.",
    createdAt: "2026-09-17T01:00:00.000Z",
    replyCount: 1,
    replies: [
      {
        id: 2,
        publicId: "comment-reply-1",
        ticketPublicId: STAFF_TICKETS[0].publicId,
        author: {
          publicId: REQUESTER_USER.publicId,
          name: REQUESTER_USER.name,
          role: REQUESTER_USER.role,
        },
        parentCommentId: 1,
        parentCommentPublicId: "comment-root-1",
        replyToCommentId: 1,
        replyToCommentPublicId: "comment-root-1",
        replyToAuthorName: STAFF_USER.name,
        content: "Here is the error log from the VPN client.",
        createdAt: "2026-09-17T01:10:00.000Z",
        replyCount: 0,
        previews: [],
        replies: [],
      },
    ],
    previews: [
      {
        id: 2,
        publicId: "comment-reply-1",
        ticketPublicId: STAFF_TICKETS[0].publicId,
        author: {
          publicId: REQUESTER_USER.publicId,
          name: REQUESTER_USER.name,
          role: REQUESTER_USER.role,
        },
        parentCommentId: 1,
        parentCommentPublicId: "comment-root-1",
        replyToCommentId: 1,
        replyToCommentPublicId: "comment-root-1",
        replyToAuthorName: STAFF_USER.name,
        content: "Here is the error log from the VPN client.",
        createdAt: "2026-09-17T01:10:00.000Z",
        replyCount: 0,
        previews: [],
        replies: [],
      },
    ],
  },
];

const SYNTHETIC_NOTES = [
  {
    id: 1,
    publicId: "note-1",
    ticketPublicId: STAFF_TICKETS[0].publicId,
    author: {
      publicId: STAFF_USER.publicId,
      name: STAFF_USER.name,
      role: STAFF_USER.role,
    },
    content: "Checked RADIUS server logs, user authentication succeeded. Routing failure suspected.",
    createdAt: "2026-09-17T01:15:00.000Z",
  },
];

async function stubStaffDetailWithCommunication(page: Page): Promise<void> {
  await stubAuth(page, STAFF_USER);
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
      await fulfillAuth(route, 200, STAFF_USER);
      return;
    }
    if (url.pathname === "/api/categories") {
      await fulfillAuth(route, 200, [STAFF_CATEGORY]);
      return;
    }
    if (url.pathname === "/api/related-systems") {
      await fulfillAuth(route, 200, [{ id: 5, name: "VPN" }]);
      return;
    }
    if (url.pathname === "/api/users/assignable") {
      await fulfillAuth(route, 200, [{ publicId: STAFF_USER.publicId, name: STAFF_USER.name, role: STAFF_USER.role }]);
      return;
    }
    if (url.pathname === `/api/tickets/${STAFF_TICKETS[0].publicId}`) {
      await fulfillAuth(route, 200, {
        ...STAFF_TICKET_DETAIL,
        owner: { publicId: STAFF_USER.publicId, name: STAFF_USER.name, role: STAFF_USER.role },
      });
      return;
    }
    if (url.pathname === `/api/tickets/${STAFF_TICKETS[0].publicId}/comments`) {
      await fulfillAuth(route, 200, SYNTHETIC_COMMENTS, {
        "X-Pagination": JSON.stringify({
          totalItems: 1,
          pageNumber: 1,
          pageSize: 10,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        }),
      });
      return;
    }
    if (url.pathname === `/api/tickets/${STAFF_TICKETS[0].publicId}/internal-notes`) {
      await fulfillAuth(route, 200, SYNTHETIC_NOTES, {
        "X-Pagination": JSON.stringify({
          totalItems: 1,
          pageNumber: 1,
          pageSize: 10,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        }),
      });
      return;
    }

    await fulfillAuth(route, 404, { code: "NOT_FOUND" });
  });
}

async function stubUserManagementPages(page: Page): Promise<void> {
  await stubAuth(page, ADMIN_USER);
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
      await fulfillAuth(route, 200, ADMIN_USER);
      return;
    }
    if (url.pathname === "/api/admin/users" && request.method() === "GET") {
      await fulfillAuth(route, 200, SYNTHETIC_USERS, {
        "X-Pagination": JSON.stringify({
          totalItems: SYNTHETIC_USERS.length,
          pageNumber: 1,
          pageSize: 10,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        }),
      });
      return;
    }
    if (url.pathname === `/api/admin/users/${SYNTHETIC_USERS[0].publicId}`) {
      await fulfillAuth(route, 200, SYNTHETIC_USERS[0]);
      return;
    }
    if (url.pathname === `/api/admin/users/${ADMIN_USER.publicId}`) {
      await fulfillAuth(route, 200, SYNTHETIC_USERS[2]);
      return;
    }

    await fulfillAuth(route, 404, { code: "NOT_FOUND" });
  });
}

for (const viewport of VIEWPORTS) {
  test(`RESP-03 Queue table/cards and filter controls ${viewport.width} @issue-5`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await stubStaffQueuePages(page);
    await page.goto("/staff/tickets");
    await expect(page.getByRole("heading", { name: "Ticket Queue", exact: true })).toBeVisible();
    await expect(page.getByText("Loading Tickets", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Filters (2)" }).click();
    await page.getByLabel("Category", { exact: true }).selectOption(String(STAFF_CATEGORY.id));
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    if (viewport.width === 1440) {
      await expect(page.getByRole("table", { name: "Ticket Queue" })).toBeVisible();
    } else {
      await expect(page.getByRole("table", { name: "Ticket Queue" })).toBeHidden();
      await expect(page.getByRole("link", { name: /^Open Ticket/ }).first()).toBeVisible();
    }
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: `docs/lab-03/evidence/screenshots/staff-queue/queue-${viewport.width}.png`, fullPage: true });
    await page.getByLabel("Search Tickets").fill("No matching synthetic Ticket");
    await expect(page.getByText(/No Tickets match your search/)).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: `docs/lab-03/evidence/screenshots/staff-queue/no-results-${viewport.width}.png`, fullPage: true });
    await page.goto(`/staff/tickets/${STAFF_TICKETS[0].publicId}`);
    await expect(page.getByRole("button", { name: "Claim Ticket" })).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: `docs/lab-03/evidence/screenshots/staff-ticket-detail/unassigned-${viewport.width}.png`, fullPage: true });
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
      if (shellRole.user.role === "REQUESTER") {
        await stubRequesterPages(page);
      } else {
        await stubAuth(page, shellRole.user);
      }
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

for (const viewport of VIEWPORTS) {
  test(`RESP-04 Staff Ticket Detail with comments and notes ${viewport.width} @issue-6`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await stubStaffDetailWithCommunication(page);
    await page.goto(`/staff/tickets/${STAFF_TICKETS[0].publicId}`);
    await expect(page.getByRole("heading", { name: STAFF_TICKETS[0].ticketNumber })).toBeVisible();

    // Public Comments tab
    await expect(page.getByRole("tab", { name: "Public Comments" })).toBeVisible();
    await expect(page.getByText("Please send more details")).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.screenshot({
      path: `docs/lab-03/evidence/screenshots/staff-ticket-detail/detail-comments-${viewport.width}.png`,
      fullPage: true,
    });

    // Switch to Internal Notes tab
    await page.getByRole("tab", { name: "Internal Notes" }).click();
    await expect(page.getByRole("alert")).toContainText("Visible only to IT Staff and Administrators");
    await expect(page.getByText("Checked RADIUS server logs")).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.screenshot({
      path: `docs/lab-03/evidence/screenshots/staff-ticket-detail/detail-notes-${viewport.width}.png`,
      fullPage: true,
    });
  });

  test(`RESP-05 User Management list, create, and edit ${viewport.width} @issue-6`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await stubUserManagementPages(page);

    // User List
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "User Management", exact: true })).toBeVisible();
    await expect(page.getByText("Alice Requester")).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.screenshot({
      path: `docs/lab-03/evidence/screenshots/user-management/users-list-${viewport.width}.png`,
      fullPage: true,
    });

    // Create User
    await page.goto("/admin/users/new");
    await expect(page.getByRole("heading", { name: "Create User", exact: true })).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.screenshot({
      path: `docs/lab-03/evidence/screenshots/user-management/user-create-${viewport.width}.png`,
      fullPage: true,
    });

    // Edit User
    await page.goto(`/admin/users/${SYNTHETIC_USERS[0].publicId}/edit`);
    await expect(page.getByRole("heading", { name: /Edit / })).toBeVisible();
    await expect(page.getByLabel("Name *")).toHaveValue("Alice Requester");
    await assertNoHorizontalOverflow(page);
    await page.screenshot({
      path: `docs/lab-03/evidence/screenshots/user-management/user-edit-${viewport.width}.png`,
      fullPage: true,
    });
  });
}
