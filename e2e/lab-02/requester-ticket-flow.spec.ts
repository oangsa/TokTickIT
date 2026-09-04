import { randomUUID } from "node:crypto";

import { expect, type APIRequestContext, type Page, test } from "@playwright/test";

const API_BASE_URL = "http://127.0.0.1:3000";

interface NamedRecord {
  id: number;
  name: string;
}

interface DevelopmentRequester extends NamedRecord {
  email: string;
}

interface Attachment {
  attachmentId: string;
  originalName: string;
  deleted: boolean;
}

interface Ticket {
  publicId: string;
  ticketNumber: string;
  summary: string;
  currentStatus: string;
  attachments: Attachment[];
}

interface FilePayload {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

function pngFile(name: string): FilePayload {
  return {
    name,
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  };
}

async function getJson<T>(
  request: APIRequestContext,
  path: string,
  requesterId?: number,
): Promise<T> {
  const response = await request.get(`${API_BASE_URL}${path}`, {
    headers: requesterId === undefined ? undefined : { "X-Requester-Id": String(requesterId) },
  });

  expect(response.ok()).toBeTruthy();
  return (await response.json()) as T;
}

function named<T extends NamedRecord>(records: T[], name: string): T {
  const record = records.find((candidate) => candidate.name === name);

  if (record === undefined) {
    throw new Error(`Test fixture is missing ${name}.`);
  }

  return record;
}

async function createTicketViaApi(
  request: APIRequestContext,
  requesterName: string,
  summary: string,
  attachmentName?: string,
): Promise<Ticket> {
  const requesters = await getJson<DevelopmentRequester[]>(request, "/api/requesters");
  const requester = named(requesters, requesterName);
  const categories = await getJson<NamedRecord[]>(request, "/api/categories", requester.id);
  const systems = await getJson<NamedRecord[]>(request, "/api/related-systems", requester.id);
  const attachmentIds: string[] = [];

  if (attachmentName !== undefined) {
    const upload = await request.post(`${API_BASE_URL}/api/attachments`, {
      headers: { "X-Requester-Id": String(requester.id) },
      multipart: { file: pngFile(attachmentName) },
    });

    expect(upload.status()).toBe(201);
    const attachment = (await upload.json()) as Attachment;
    attachmentIds.push(attachment.attachmentId);
  }

  const response = await request.post(`${API_BASE_URL}/api/tickets`, {
    headers: {
      "X-Requester-Id": String(requester.id),
      "Idempotency-Key": randomUUID(),
    },
    data: {
      categoryId: named(categories, "Network").id,
      relatedSystemId: named(systems, "VPN").id,
      summary,
      requestedPriority: "HIGH",
      description: `${summary} description for the Lab 2 browser path.`,
      attachmentIds,
    },
  });

  expect(response.status()).toBe(201);
  return (await response.json()) as Ticket;
}

async function selectRequester(page: Page, name: string): Promise<void> {
  await page.goto("/requesters");
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();

  const requester = page.getByRole("combobox", { name: "Development Requester" });
  await expect(requester).toBeVisible();
  await requester.selectOption({ label: name });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/tickets$/);
}

async function fillTicketForm(
  page: Page,
  summary: string,
  attachment?: FilePayload,
): Promise<void> {
  await page.goto("/tickets/new");
  await expect(page.getByRole("heading", { name: "Create Ticket", exact: true })).toBeVisible();
  await page.getByLabel("Category").selectOption({ label: "Network" });
  await page.getByLabel("Related System").selectOption({ label: "VPN" });
  await page.getByLabel("Requested Priority").selectOption("HIGH");
  await page.getByLabel("Summary").fill(summary);
  await page
    .getByLabel("Description")
    .fill(`${summary} description for the full Requester golden path.`);

  if (attachment !== undefined) {
    await page.getByLabel("Add Attachment").setInputFiles(attachment);
    await expect(page.getByText(attachment.name, { exact: true })).toBeVisible();
    await expect(page.getByText("Pending", { exact: true })).toBeVisible();
  }
}

async function submitTicket(page: Page): Promise<{ publicId: string; ticketNumber: string }> {
  await expect(page.getByRole("button", { name: "Submit Ticket", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Submit Ticket", exact: true }).click();
  await expect(page).toHaveURL(/\/tickets\/[0-9a-f-]+$/);

  const ticketNumberField = page.getByLabel("Ticket Number");
  await expect(ticketNumberField).toHaveValue(/^TKT-[0-9]{8}-[A-F0-9]{12}$/);
  const publicId = new URL(page.url()).pathname.split("/").pop();

  if (publicId === undefined || publicId === "") {
    throw new Error("Ticket detail URL did not contain a public ID.");
  }

  return { publicId, ticketNumber: await ticketNumberField.inputValue() };
}

test.describe("Lab 2 Requester browser flows", () => {
  test("E2E-01 completes the Requester golden path and Attachment lifecycle", async ({
    page,
  }) => {
    const marker = `E2E Golden ${Date.now()}`;
    const preparedFile = pngFile("golden-path.png");
    const detailFile = pngFile("detail-path.png");

    await selectRequester(page, "Alice Johnson");
    await fillTicketForm(page, marker, preparedFile);
    const created = await submitTicket(page);

    await expect(page.getByText(`Ticket ${created.ticketNumber} was created.`)).toBeVisible();
    await expect(page.getByText("Active", { exact: true })).toBeVisible();
    await expect(page.getByText(preparedFile.name, { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "My Tickets", exact: true }).click();
    await expect(page.getByRole("heading", { name: "My Tickets", exact: true })).toBeVisible();

    const search = page.getByRole("searchbox", { name: "Search" });
    await search.fill(marker);
    const ticketLink = page.getByRole("link", { name: `Open ticket ${created.ticketNumber}` });
    await expect(ticketLink).toBeVisible();

    await page.getByRole("button", { name: "Filters", exact: true }).click();
    const filterDialog = page.getByRole("dialog", { name: "Filters" });
    /* Category is a dropdown of checkboxes: open it, tick the value, close it. */
    const categoryFilter = filterDialog.getByRole("button", { name: /^Category/ });
    await categoryFilter.click();
    await filterDialog.getByRole("checkbox", { name: "Network", exact: true }).check();
    await categoryFilter.click();
    await filterDialog.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(page.getByRole("button", { name: "Filters (1)", exact: true })).toBeVisible();

    await page.getByLabel("Sort by").selectOption("ticketNumber:asc");
    await expect(page.getByLabel("Sort by")).toHaveValue("ticketNumber:asc");
    await page.locator("label").filter({ hasText: "Rows per page" }).locator("select").selectOption("20");
    await expect(page).toHaveURL(/pageSize=20/);

    await ticketLink.click();
    await expect(page.getByLabel("Ticket Number")).toHaveValue(created.ticketNumber);

    await page.getByLabel("Add Attachment").setInputFiles(detailFile);
    const detailRow = page.locator("tr").filter({ hasText: detailFile.name });
    await expect(detailRow.getByText("Active", { exact: true })).toBeVisible();

    const preview = page.getByRole("button", { name: `Preview ${detailFile.name}`, exact: true });
    await preview.hover();
    await expect(page.getByRole("tooltip", { name: `Preview ${detailFile.name}` })).toBeVisible();
    await preview.click();

    const previewDialog = page.getByRole("dialog", { name: detailFile.name });
    await expect(previewDialog).toBeVisible();
    await expect(
      previewDialog.getByRole("img", { name: `Preview of ${detailFile.name}` }),
    ).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      previewDialog.getByRole("button", { name: "Download", exact: true }).click(),
    ]);
    expect(download.suggestedFilename()).toBe(detailFile.name);
    await previewDialog.getByRole("button", { name: "Close dialog", exact: true }).click();
    await expect(previewDialog).toHaveCount(0);

    await page.getByRole("checkbox", { name: `Select ${detailFile.name}` }).check();
    await detailRow.getByRole("button", { name: `Remove ${detailFile.name}`, exact: true }).click();
    const removalDialog = page.getByRole("dialog", { name: "Remove 1 Attachment" });
    await removalDialog.locator("input").fill("No longer needed");
    await removalDialog.getByRole("button", { name: "Remove", exact: true }).click();

    await expect(detailRow.getByText("Removed", { exact: true })).toBeVisible();
    await expect(detailRow.getByText("Removal reason: No longer needed", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: `Preview ${detailFile.name}`, exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: `Remove ${detailFile.name}`, exact: true })).toHaveCount(0);
  });

  test("E2E-02 isolates an Alice Ticket after switching to Bob", async ({ page }) => {
    const marker = `E2E Ownership ${Date.now()}`;

    await selectRequester(page, "Alice Johnson");
    await fillTicketForm(page, marker);
    const created = await submitTicket(page);

    await page.getByRole("button", { name: "Change Requester", exact: true }).click();
    await expect(page).toHaveURL(/\/requesters$/);
    await page.getByRole("combobox", { name: "Development Requester" }).selectOption({ label: "Bob Smith" });
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page).toHaveURL(/\/tickets$/);

    await page.goto(`/tickets/${created.publicId}`);
    await expect(page.getByRole("heading", { name: "Page not found.", exact: true })).toBeVisible();
    await expect(page.getByText(marker, { exact: true })).toHaveCount(0);
    await expect(page.getByText("Alice Johnson", { exact: true })).toHaveCount(0);
    await expect(page.locator(".tt-sidebar")).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);

    await page.getByRole("link", { name: "Back", exact: true }).click();
    await expect(page).toHaveURL(/\/tickets$/);
    await expect(page.getByRole("heading", { name: "My Tickets", exact: true })).toBeVisible();
  });
});
