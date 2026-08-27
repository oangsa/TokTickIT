import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { expect, type APIRequestContext, type Page, test } from "@playwright/test";

const API_BASE_URL = "http://127.0.0.1:3000";

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 820, height: 1180 },
  { width: 390, height: 844 },
] as const;

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
  description: string;
  currentStatus: string;
  attachments: Attachment[];
}

interface FilePayload {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

interface Fixture {
  requester: DevelopmentRequester;
  category: NamedRecord;
  relatedSystem: NamedRecord;
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

async function loadFixture(request: APIRequestContext): Promise<Fixture> {
  const requesters = await getJson<DevelopmentRequester[]>(request, "/api/requesters");
  const requester = named(requesters, "Alice Johnson");
  const categories = await getJson<NamedRecord[]>(request, "/api/categories", requester.id);
  const relatedSystems = await getJson<NamedRecord[]>(request, "/api/related-systems", requester.id);

  return {
    requester,
    category: named(categories, "Network"),
    relatedSystem: named(relatedSystems, "VPN"),
  };
}

async function createTicketViaApi(
  request: APIRequestContext,
  fixture: Fixture,
  summary: string,
  attachmentName?: string,
): Promise<Ticket> {
  const attachmentIds: string[] = [];

  if (attachmentName !== undefined) {
    const upload = await request.post(`${API_BASE_URL}/api/attachments`, {
      headers: { "X-Requester-Id": String(fixture.requester.id) },
      multipart: { file: pngFile(attachmentName) },
    });

    expect(upload.status()).toBe(201);
    const attachment = (await upload.json()) as Attachment;
    attachmentIds.push(attachment.attachmentId);
  }

  const response = await request.post(`${API_BASE_URL}/api/tickets`, {
    headers: {
      "X-Requester-Id": String(fixture.requester.id),
      "Idempotency-Key": randomUUID(),
    },
    data: {
      categoryId: fixture.category.id,
      relatedSystemId: fixture.relatedSystem.id,
      summary,
      requestedPriority: "HIGH",
      description: `${summary} description for responsive verification.`,
      attachmentIds,
    },
  });

  expect(response.status()).toBe(201);
  return (await response.json()) as Ticket;
}

async function selectRequester(page: Page): Promise<void> {
  await page.goto("/requesters");
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await page.getByRole("combobox", { name: "Development Requester" }).selectOption({
    label: "Alice Johnson",
  });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/tickets$/);
}

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const fits = await page.evaluate(
    () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= document.documentElement.clientWidth,
  );
  expect(fits).toBe(true);
}

async function assertZenGreenTokens(page: Page): Promise<void> {
  const tokens = await page.locator("body").evaluate((body) => {
    const style = getComputedStyle(body);
    return {
      pageBackground: style.backgroundColor,
      primaryGreen: style.getPropertyValue("--tt-green-primary").trim(),
    };
  });

  expect(tokens.pageBackground).not.toBe("");
  expect(tokens.primaryGreen).toBe("#006b3c");
}

async function resetViewportToTop(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.scrollingElement?.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
}

function screenshotPath(
  screen: "create-ticket" | "my-tickets" | "ticket-detail",
  viewport: { width: number; height: number },
  suffix = "",
): string {
  return resolve(
    "artifacts",
    "lab-02",
    "screenshots",
    screen,
    `${viewport.width}x${viewport.height}${suffix}.png`,
  );
}

for (const viewport of VIEWPORTS) {
  const label = `${viewport.width}x${viewport.height}`;

  test(`RESP-01/VIS-01 Create Ticket at ${label}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await selectRequester(page);
    await page.goto("/tickets/new");

    const summary = `Responsive Create ${viewport.width}`;
    const attachment = pngFile(`create-${viewport.width}.png`);
    await expect(page.getByRole("heading", { name: "Create Ticket", exact: true })).toBeVisible();
    await page.getByLabel("Category").selectOption({ label: "Network" });
    await page.getByLabel("Related System").selectOption({ label: "VPN" });
    await page.getByLabel("Requested Priority").selectOption("HIGH");
    await page.getByLabel("Summary").fill(summary);
    await page.getByLabel("Description").fill(`${summary} description for responsive verification.`);
    await page.getByLabel("Add Attachment").setInputFiles(attachment);
    await expect(page.getByText("Pending", { exact: true })).toBeVisible();

    await expect(page.getByLabel("Ticket Number")).toHaveValue("Assigned on submission");
    await expect(page.getByLabel("Ticket Date")).toHaveValue("Assigned on submission");
    await expect(page.getByLabel("Requester")).toHaveValue("Alice Johnson");
    await expect(page.getByRole("button", { name: "Submit Ticket", exact: true })).toBeEnabled();

    const categoryBox = await page.getByLabel("Category").boundingBox();
    const systemBox = await page.getByLabel("Related System").boundingBox();
    expect(categoryBox).not.toBeNull();
    expect(systemBox).not.toBeNull();

    if (viewport.width < 768) {
      expect((systemBox?.y ?? 0) > (categoryBox?.y ?? 0) + (categoryBox?.height ?? 0)).toBe(true);
    } else {
      expect(Math.abs((systemBox?.y ?? 0) - (categoryBox?.y ?? 0))).toBeLessThan(8);
    }

    await assertNoHorizontalOverflow(page);
    await assertZenGreenTokens(page);
    await resetViewportToTop(page);
    await expect(page.getByRole("heading", { name: "Create Ticket", exact: true })).toBeInViewport();
    await page.screenshot({ path: screenshotPath("create-ticket", viewport) });
    await page.getByText(/^Attachments \d+\/5$/).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: screenshotPath("create-ticket", viewport, "-attachments"),
    });

    const preview = page.getByRole("button", { name: `Preview ${attachment.name}`, exact: true });
    await preview.focus();
    await expect(page.getByRole("tooltip", { name: `Preview ${attachment.name}` })).toBeVisible();
  });

  test(`RESP-02/VIS-02 My Tickets at ${label}`, async ({ page, request }) => {
    await page.setViewportSize(viewport);
    const fixture = await loadFixture(request);
    const marker = `Responsive List ${viewport.width} ${Date.now()}`;
    const ticket = await createTicketViaApi(request, fixture, marker);

    if (viewport.width >= 992) {
      for (let index = 0; index < 12; index += 1) {
        await createTicketViaApi(request, fixture, `Scrollable List ${viewport.width} ${index} ${Date.now()}`);
      }
    }

    await selectRequester(page);
    await page.goto("/tickets");
    await expect(page.getByRole("heading", { name: "My Tickets", exact: true })).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Search" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Filters", exact: true })).toBeVisible();
    await expect(page.getByLabel("Sort by")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Ticket pagination" })).toBeVisible();

    for (const heading of ["Ticket Number", "Summary", "Priority", "Status"]) {
      await expect(page.getByRole("columnheader", { name: heading })).toBeVisible();
    }

    for (const heading of ["Category", "Related System", "Created At"]) {
      const column = page.getByRole("columnheader", { name: heading });

      if (viewport.width < 768) {
        await expect(column).toBeHidden();
      } else {
        await expect(column).toBeVisible();
      }
    }

    const rows = page.locator("tbody tr");
    if (viewport.width >= 992) {
      await expect(rows).toHaveCount(10);
      const pageIsLong = await page.evaluate(() => document.body.scrollHeight > window.innerHeight);
      expect(pageIsLong).toBe(true);
    } else {
      await expect(rows).not.toHaveCount(0);
    }

    const sidebar = page.locator(".tt-sidebar");
    if (viewport.width < 992) {
      await expect(sidebar).toBeHidden();
      const hiddenSidebarFocus = await sidebar.locator("a, button").evaluateAll((elements) =>
        elements.map((element) => {
          (element as HTMLElement).focus();
          return document.activeElement === element;
        }),
      );
      expect(hiddenSidebarFocus.every((focused) => !focused)).toBe(true);

      const menu = page.getByRole("button", { name: "Open navigation menu", exact: true });
      await menu.hover();
      await expect(page.getByRole("tooltip", { name: "Open navigation menu" })).toBeVisible();
      await menu.click();
      await expect(page.getByRole("button", { name: "Close navigation menu", exact: true })).toBeVisible();
      await expect(sidebar).toBeVisible();
      await expect(sidebar.getByRole("button", { name: "Change Requester", exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: "Open navigation menu", exact: true })).toBeVisible();
    } else {
      await expect(sidebar).toBeVisible();
      await expect(sidebar.getByRole("button", { name: "Change Requester", exact: true })).toBeVisible();
      await expect
        .poll(() => sidebar.evaluate((element) => getComputedStyle(element).position))
        .toBe("sticky");
    }

    await assertNoHorizontalOverflow(page);
    await assertZenGreenTokens(page);
    await resetViewportToTop(page);
    await expect(page.getByRole("heading", { name: "My Tickets", exact: true })).toBeInViewport();
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.screenshot({ path: screenshotPath("my-tickets", viewport) });

    await page.getByRole("searchbox", { name: "Search" }).fill(marker);
    await expect(page.getByRole("link", { name: `Open ticket ${ticket.ticketNumber}` })).toBeVisible();
  });

  test(`RESP-03/VIS-03 Ticket Detail and Attachments at ${label}`, async ({ page, request }) => {
    await page.setViewportSize(viewport);
    const fixture = await loadFixture(request);
    const attachmentName = `detail-${viewport.width}.png`;
    const ticket = await createTicketViaApi(
      request,
      fixture,
      `Responsive Detail ${viewport.width} ${Date.now()}`,
      attachmentName,
    );

    await selectRequester(page);
    await page.goto(`/tickets/${ticket.publicId}`);
    await expect(page.getByLabel("Ticket Number")).toHaveValue(ticket.ticketNumber);
    await expect(page.getByLabel("Summary")).toHaveValue(ticket.summary);
    await expect(page.getByLabel("Description")).toHaveValue(ticket.description);
    await expect(page.getByLabel("Current Status")).toHaveValue("NEW");
    await expect(page.getByText(attachmentName, { exact: true })).toBeVisible();
    await expect(page.getByText("Active", { exact: true })).toBeVisible();

    for (const heading of ["Type", "Uploaded At"]) {
      const column = page.getByRole("columnheader", { name: heading });

      if (viewport.width < 768) {
        await expect(column).toBeHidden();
      } else {
        await expect(column).toBeVisible();
      }
    }

    const preview = page.getByRole("button", { name: `Preview ${attachmentName}`, exact: true });
    await assertNoHorizontalOverflow(page);
    await assertZenGreenTokens(page);
    await resetViewportToTop(page);
    await expect(page.getByRole("heading", { name: new RegExp(`^${ticket.ticketNumber}$`) })).toBeInViewport();
    await page.screenshot({ path: screenshotPath("ticket-detail", viewport) });
    await page.getByText(/^Attachments \d+\/5$/).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: screenshotPath("ticket-detail", viewport, "-attachments"),
    });
    await preview.focus();
    await expect(page.getByRole("tooltip", { name: `Preview ${attachmentName}` })).toBeVisible();
  });
}
