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

test("E2E-04 Request Information fails safely until Issue 6 writer is connected @issue-5", async ({ page }) => {
  const fixture = await createStaffFixture();
  const ticket = fixture.tickets[0];
  try {
    await fixture.prisma.ticket.update({ where: { id: ticket.id }, data: { ownerUserId: fixture.staff.id, currentStatus: "OPEN" } });
    await loginStaffFixture(page, fixture);
    await page.goto(`/staff/tickets/${ticket.publicId}`);
    await page.getByRole("button", { name: "Request Information", exact: true }).click();
    await page.getByLabel("Message *").fill("Please provide a screenshot.");
    const failureResponse = page.waitForResponse((response) => response.url().endsWith("/request-information") && response.request().method() === "POST");
    await page.getByRole("dialog").getByRole("button", { name: "Request Information", exact: true }).click();
    expect((await failureResponse).status()).toBe(500);
    await expect(page.getByRole("alert")).toContainText("could not be updated");
    expect((await fixture.prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).currentStatus).toBe("OPEN");
    expect(await fixture.prisma.publicComment.count({ where: { ticketId: ticket.id } })).toBe(0);
    await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
    // Explicit WAITING fixture exercises Resume without simulating comment success.
    await fixture.prisma.ticket.update({ where: { id: ticket.id }, data: { currentStatus: "WAITING_FOR_REQUESTER" } });
    await page.reload();
    await page.getByRole("button", { name: "Resume Work" }).click();
    await expect(page.getByText("IN PROGRESS", { exact: true })).toBeVisible();
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
