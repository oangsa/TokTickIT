import { defineConfig } from "@playwright/test";

const apiBaseUrl = "http://127.0.0.1:3000";
const clientBaseUrl = "http://127.0.0.1:5173";

function databaseIdentity(value: string): string {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL URL");
  }

  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error("TEST_DATABASE_URL must use the PostgreSQL protocol");
  }

  const databaseName = decodeURIComponent(parsed.pathname.slice(1));

  if (databaseName === "") {
    throw new Error("TEST_DATABASE_URL must identify a database name");
  }

  return `${parsed.hostname.toLowerCase()}:${parsed.port || "5432"}/${databaseName}`;
}

function requireTestDatabaseUrl(): string {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Lab 2 Playwright tests require NODE_ENV=test");
  }

  const testUrl = process.env.TEST_DATABASE_URL?.trim();

  if (!testUrl) {
    throw new Error("Lab 2 Playwright tests require TEST_DATABASE_URL");
  }

  const testIdentity = databaseIdentity(testUrl);
  const databaseName = testIdentity.slice(testIdentity.lastIndexOf("/") + 1);

  if (
    !/(^|[_-])lab2([_-]|$)/i.test(databaseName) ||
    !/(^|[_-])test([_-]|$)/i.test(databaseName)
  ) {
    throw new Error(
      "TEST_DATABASE_URL database name must identify the dedicated Lab 2 test database",
    );
  }

  for (const variableName of ["DATABASE_URL", "DIRECT_URL"] as const) {
    const comparisonUrl = process.env[variableName]?.trim();

    if (comparisonUrl && databaseIdentity(comparisonUrl) === testIdentity) {
      throw new Error(`TEST_DATABASE_URL must identify a database different from ${variableName}`);
    }
  }

  return testUrl;
}

function testEnvironment(testUrl: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: "test",
    TEST_DATABASE_URL: testUrl,
    DATABASE_URL: testUrl,
    DIRECT_URL: testUrl,
    CORS_ALLOWED_ORIGINS: clientBaseUrl,
  };
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  globalSetup: "./playwright.global-setup.ts",
  outputDir: "artifacts/lab-02/playwright",
  reporter: [["list"], ["html", { outputFolder: "artifacts/lab-02/playwright-report" }]],
  use: {
    baseURL: clientBaseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: [
    {
      command: "npm run dev",
      cwd: "server",
      url: `${apiBaseUrl}/api/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: testEnvironment(requireTestDatabaseUrl()),
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5173",
      cwd: "client",
      url: clientBaseUrl,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        VITE_API_URL: apiBaseUrl,
      },
    },
  ],
});
