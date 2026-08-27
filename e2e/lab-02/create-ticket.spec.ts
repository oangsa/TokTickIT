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
  deleted: boolean;
}

interface Ticket {
  publicId: string;
  ticketNumber: string;
  summary: string;
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

async function fillTicketForm(page: Page, summary: string, attachment: FilePayload): Promise<void> {
  await page.goto("/tickets/new");
  await expect(page.getByRole("heading", { name: "Create Ticket", exact: true })).toBeVisible();
  await page.getByLabel("Category").selectOption({ label: "Network" });
  await page.getByLabel("Related System").selectOption({ label: "VPN" });
  await page.getByLabel("Requested Priority").selectOption("HIGH");
  await page.getByLabel("Summary").fill(summary);
  await page.getByLabel("Description").fill(`${summary} recovery description for Lab 2.`);
  await page.getByLabel("Add Attachment").setInputFiles(attachment);
  await expect(page.getByText(attachment.name, { exact: true })).toBeVisible();
  await expect(page.getByText("Pending", { exact: true })).toBeVisible();
}

function pathPublicId(url: string): string {
  const publicId = new URL(url).pathname.split("/").pop();

  if (publicId === undefined || publicId === "") {
    throw new Error("Ticket detail URL did not contain a public ID.");
  }

  return publicId;
}

test("E2E-03 recovers an ambiguous Create Ticket submission across reload", async ({
  page,
  request,
}) => {
  const marker = `E2E Recovery ${Date.now()}`;
  const attachment = pngFile("recovery-path.png");
  const requesters = await getJson<DevelopmentRequester[]>(request, "/api/requesters");
  const alice = named(requesters, "Alice Johnson");
  let createRequests = 0;
  let uploadRequests = 0;

  page.on("request", (outgoing) => {
    const pathname = new URL(outgoing.url()).pathname;

    if (outgoing.method() === "POST" && pathname === "/api/tickets") {
      createRequests += 1;
    }

    if (outgoing.method() === "POST" && pathname === "/api/attachments") {
      uploadRequests += 1;
    }
  });

  await selectRequester(page, "Alice Johnson");
  await page.route("**/api/tickets**", async (route) => {
    const url = new URL(route.request().url());

    if (route.request().method() !== "POST" || url.pathname !== "/api/tickets") {
      await route.continue();
      return;
    }

    /* Let the real API commit, then make the browser observe an ambiguous 500. */
    const response = await route.fetch();
    await response.body();
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        statusCode: 500,
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
        error: "Internal Server Error",
      }),
    });
  });

  await fillTicketForm(page, marker, attachment);
  await page.getByRole("button", { name: "Submit Ticket", exact: true }).click();

  const recovery = page.getByRole("button", { name: "Resume Submission Recovery", exact: true });
  await expect(recovery).toBeVisible();
  await expect(recovery).toBeEnabled();
  expect(createRequests).toBe(1);
  expect(uploadRequests).toBe(1);

  await page.reload();
  await expect(recovery).toBeVisible();
  await expect(recovery).toBeEnabled();
  await expect.poll(() => createRequests).toBe(1);
  expect(uploadRequests).toBe(1);
  expect(page.url()).toMatch(/\/tickets\/new$/);

  await page.unroute("**/api/tickets**");
  await recovery.click();
  await expect(page).toHaveURL(/\/tickets\/[0-9a-f-]+$/);

  const recoveredPublicId = pathPublicId(page.url());
  const ticketNumber = await page.getByLabel("Ticket Number").inputValue();
  await expect(page.getByText("Active", { exact: true })).toBeVisible();
  expect(createRequests).toBe(2);
  expect(uploadRequests).toBe(1);

  const list = await getJson<Array<{ publicId: string; summary: string }>>(
    request,
    `/api/tickets?search=${encodeURIComponent(marker)}&searchFields=summary&pageNumber=1&pageSize=100`,
    alice.id,
  );
  expect(list).toHaveLength(1);
  expect(list[0]).toMatchObject({ publicId: recoveredPublicId, summary: marker });

  const recovered = await getJson<Ticket>(request, `/api/tickets/${recoveredPublicId}`, alice.id);
  expect(recovered).toMatchObject({ publicId: recoveredPublicId, ticketNumber, summary: marker });
  expect(recovered.attachments).toHaveLength(1);
  expect(recovered.attachments[0].deleted).toBe(false);
});
