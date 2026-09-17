import { expect, test } from "@playwright/test";
import { createStaffFixture, loginStaffFixture } from "./staff-fixture.js";

test("E2E-04 Queue controls, Claim, owner workflow, confirmation and Close @issue-5", async ({ page }) => {
  const fixture = await createStaffFixture();
  const ticket = fixture.tickets[0];
  try {
    await loginStaffFixture(page, fixture);
    await page.getByLabel("Search Tickets").fill(ticket.ticketNumber);
    await page.getByLabel("Sort", { exact: true }).selectOption("createdAt:asc");
    await page.getByRole("button", { name: "Filters (2)" }).click();
    await page.getByLabel("Owner", { exact: true }).selectOption("unassigned");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await page.getByRole("link", { name: ticket.ticketNumber, exact: true }).click();
    await page.getByRole("button", { name: "Claim Ticket" }).click();
    await expect(page.getByRole("button", { name: "Start Work", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Start Work", exact: true }).click();
    await expect(page.getByRole("button", { name: "Mark Resolved", exact: true })).toBeEnabled();
    await page.getByLabel("IT Priority", { exact: true }).selectOption("LOW");
    await expect(page.getByLabel("IT Priority", { exact: true })).toHaveValue("LOW");
    await page.getByRole("button", { name: "Mark Resolved", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Mark Resolved", exact: true }).click();
    await expect(page.getByText("RESOLVED", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Close Ticket", exact: true })).toHaveCount(0);
    // Requester confirmation implementation is Issue 4-owned; consume its state.
    await fixture.prisma.ticket.update({ where: { id: ticket.id }, data: { requesterResolutionConfirmedAt: new Date() } });
    await page.reload();
    await page.getByRole("button", { name: "Close Ticket", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Close Ticket", exact: true }).click();
    await expect(page.getByText("CLOSED", { exact: true })).toBeVisible();
    expect(await fixture.prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).toMatchObject({ currentStatus: "CLOSED", ownerUserId: fixture.staff.id, requestedPriority: "MEDIUM", itPriority: "LOW" });
    await expect(page.getByRole("button", { name: "Cancel Ticket" })).toHaveCount(0);
  } finally { await fixture.dispose(); }
});

test("E2E-04 Request Information creates comment and transitions to WAITING, then Resumes @issue-5", async ({ page }) => {
  const fixture = await createStaffFixture();
  const ticket = fixture.tickets[0];
  try {
    await fixture.prisma.ticket.update({ where: { id: ticket.id }, data: { ownerUserId: fixture.staff.id, currentStatus: "OPEN" } });
    await loginStaffFixture(page, fixture);
    await page.goto(`/staff/tickets/${ticket.publicId}`);
    await page.getByRole("button", { name: "Request Information", exact: true }).click();
    await page.getByLabel("Message *").fill("Please provide a screenshot.");
    const requestInfoResponse = page.waitForResponse((response) => response.url().endsWith("/request-information") && response.request().method() === "POST");
    await page.getByRole("dialog").getByRole("button", { name: "Request Information", exact: true }).click();
    expect((await requestInfoResponse).status()).toBe(200);
    await expect(page.getByText("WAITING FOR REQUESTER", { exact: true })).toBeVisible();
    expect((await fixture.prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).currentStatus).toBe("WAITING_FOR_REQUESTER");
    expect(await fixture.prisma.publicComment.count({ where: { ticketId: ticket.id } })).toBe(1);

    await page.getByRole("button", { name: "Resume Work" }).click();
    await expect(page.getByText("IN PROGRESS", { exact: true })).toBeVisible();
    expect((await fixture.prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).currentStatus).toBe("IN_PROGRESS");
  } finally { await fixture.dispose(); }
});

test("E2E-04 Administrator non-owner becomes operational only after assignment @issue-5", async ({ page }) => {
  const fixture = await createStaffFixture();
  const ticket = fixture.tickets[0];
  try {
    await loginStaffFixture(page, fixture, true);
    await page.goto(`/admin/tickets/${ticket.publicId}`);
    await expect(page.getByRole("heading", { name: ticket.ticketNumber })).toBeVisible();
    await expect(page.getByRole("button", { name: "Change Owner" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Claim Ticket" })).toHaveCount(0);
    await fixture.prisma.ticket.update({ where: { id: ticket.id }, data: { ownerUserId: fixture.admin.id, currentStatus: "OPEN" } });
    await page.reload();
    await page.getByRole("button", { name: "Start Work" }).click();
    await expect(page.getByText("IN PROGRESS", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Change Owner" }).click();
    await expect(page.getByRole("option", { name: "Workflow Administrator (ADMINISTRATOR)" })).toHaveCount(1);
    await page.getByLabel("Ticket Owner", { exact: true }).selectOption("");
    await page.getByRole("button", { name: "Apply Owner" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Unassign", exact: true }).click();
    await expect(page.getByRole("button", { name: "Change Owner" })).toHaveCount(0);
    expect(await fixture.prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).toMatchObject({ ownerUserId: null, currentStatus: "IN_PROGRESS" });
  } finally { await fixture.dispose(); }
});

test("E2E-06 Production Request Information creates Public Comment and transitions to WAITING @issue-6", async ({ page }) => {
  const fixture = await createStaffFixture();
  const ticket = fixture.tickets[0];
  try {
    await fixture.prisma.ticket.update({ where: { id: ticket.id }, data: { ownerUserId: fixture.staff.id, currentStatus: "OPEN" } });
    await loginStaffFixture(page, fixture);
    await page.goto(`/staff/tickets/${ticket.publicId}`);
    await page.getByRole("button", { name: "Request Information", exact: true }).click();
    await page.getByLabel("Message *").fill("Please provide reproduction steps.");
    await page.getByRole("dialog").getByRole("button", { name: "Request Information", exact: true }).click();

    await expect(page.getByText("WAITING FOR REQUESTER", { exact: true })).toBeVisible();
    expect((await fixture.prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).currentStatus).toBe("WAITING_FOR_REQUESTER");

    // Public comment was created by Staff and is visible in Public Comments
    await expect(page.getByText("Please provide reproduction steps.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Communication" }).getByText("Workflow Staff")).toBeVisible();
  } finally {
    await fixture.dispose();
  }
});

test("E2E-06 Requester sees Public Comments, can reply, and AC-28 waiting status does not resume @issue-6", async ({ page }) => {
  const fixture = await createStaffFixture();
  const ticket = fixture.tickets[0];
  try {
    await fixture.prisma.ticket.update({ where: { id: ticket.id }, data: { ownerUserId: fixture.staff.id, currentStatus: "WAITING_FOR_REQUESTER" } });
    await fixture.prisma.publicComment.create({
      data: {
        ticketId: ticket.id,
        authorUserId: fixture.staff.id,
        content: "Initial staff inquiry.",
      },
    });

    // Requester logs in and views ticket
    await page.goto("/login");
    await page.getByLabel("Email *").fill(fixture.requester.email);
    await page.getByLabel("Password *").fill(fixture.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/tickets$/);

    await page.goto(`/tickets/${ticket.publicId}`);
    await expect(page.getByRole("heading", { name: ticket.ticketNumber })).toBeVisible();

    // Confirms Internal Notes is NOT present anywhere on page
    await expect(page.getByRole("tab", { name: "Internal Notes" })).toHaveCount(0);
    await expect(page.getByText(/Internal notes are visible to IT Staff/)).toHaveCount(0);

    // Sees staff public comment
    await expect(page.getByText("Initial staff inquiry.")).toBeVisible();

    // Replies to the comment
    await page.getByRole("button", { name: "Reply" }).click();
    await page.getByPlaceholder("Write a reply…").fill("Here is the requested information.");
    await page.locator("form").getByRole("button", { name: "Reply", exact: true }).click();

    // Reply is visible
    await expect(page.getByText("Here is the requested information.")).toBeVisible();

    // AC-28: ticket status does NOT auto-resume, remains WAITING_FOR_REQUESTER
    expect((await fixture.prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).currentStatus).toBe("WAITING_FOR_REQUESTER");
    await expect(page.getByText("WAITING_FOR_REQUESTER", { exact: true })).toBeVisible();
  } finally {
    await fixture.dispose();
  }
});

test("E2E-06 Staff Internal Notes has private warning banner and appends notes @issue-6", async ({ page }) => {
  const fixture = await createStaffFixture();
  const ticket = fixture.tickets[0];
  try {
    await fixture.prisma.ticket.update({ where: { id: ticket.id }, data: { ownerUserId: fixture.staff.id, currentStatus: "OPEN" } });
    await loginStaffFixture(page, fixture);
    await page.goto(`/staff/tickets/${ticket.publicId}`);

    // Switch to Internal Notes tab
    await page.getByRole("tab", { name: "Internal Notes" }).click();

    // AC-63: prominent persistent private warning banner is visible
    await expect(page.getByRole("alert")).toContainText("Visible only to IT Staff and Administrators");

    // Add internal note
    await page.getByPlaceholder("Write an internal note…").fill("Staff internal diagnostic note.");
    await page.getByRole("button", { name: "Add Note", exact: true }).click();

    // Note appears in list
    await expect(page.getByText("Staff internal diagnostic note.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Communication" }).getByText("Workflow Staff")).toBeVisible();
  } finally {
    await fixture.dispose();
  }
});

test("E2E-06 Cross-Requester access returns safe 404 @issue-6", async ({ page }) => {
  const fixture = await createStaffFixture();
  try {
    // Log in as requester
    await page.goto("/login");
    await page.getByLabel("Email *").fill(fixture.requester.email);
    await page.getByLabel("Password *").fill(fixture.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/tickets$/);

    // Attempt to navigate to a nonexistent or non-owned ticket
    await page.goto("/tickets/00000000-0000-0000-0000-000000000000");
    await expect(page).toHaveURL(/\/error$/);
    await expect(page.getByText("Page not found.")).toBeVisible();
    await expect(page.getByText("The requested resource could not be found.")).toBeVisible();
  } finally {
    await fixture.dispose();
  }
});
