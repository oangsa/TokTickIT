import { defineConfig } from "@playwright/test";
import { assertLab3TargetEnvironment } from "./server/src/databaseTargetGuard.js";

const apiBaseUrl = "http://127.0.0.1:3000";
const clientBaseUrl = "http://127.0.0.1:5173";
// Issue 3 browser specs mock every auth request, so they can run without a database.
// Keep this opt-in: other suites need the guarded API web server by default.
const issue3UiRun = process.env.ISSUE_3_UI_ONLY === "1";

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
    throw new Error("Lab Playwright tests require NODE_ENV=test");
  }

  const testUrl = process.env.TEST_DATABASE_URL?.trim();

  if (!testUrl) {
    throw new Error("Lab Playwright tests require TEST_DATABASE_URL");
  }

  const testIdentity = databaseIdentity(testUrl);
  const databaseName = testIdentity.slice(testIdentity.lastIndexOf("/") + 1);

  const isLabDatabase = /(^|[_-])lab(?:2|3)([_-]|$)/i.test(databaseName);
  if (!isLabDatabase || !/(^|[_-])test([_-]|$)/i.test(databaseName)) {
    throw new Error(
      "TEST_DATABASE_URL database name must identify a dedicated Lab 2 or Lab 3 test database",
    );
  }

  // Explicit Lab 3 overrides are safe only with captured, distinct baselines.
  if (process.env.DATABASE_URL === testUrl && process.env.DIRECT_URL === testUrl) {
    return assertLab3TargetEnvironment();
  }

  for (const variableName of ["DATABASE_URL", "DIRECT_URL"] as const) {
    const comparisonUrl = process.env[variableName]?.trim();

    if (comparisonUrl && databaseIdentity(comparisonUrl) === testIdentity) {
      throw new Error(`TEST_DATABASE_URL must identify a database different from ${variableName}`);
    }
  }

  return testUrl;
}

function evidenceLab(testUrl: string): "lab-02" | "lab-03" {
  const databaseName = databaseIdentity(testUrl).slice(databaseIdentity(testUrl).lastIndexOf("/") + 1);
  return /(^|[_-])lab3([_-]|$)/i.test(databaseName) ? "lab-03" : "lab-02";
}

function testEnvironment(testUrl: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: "test",
    TEST_DATABASE_URL: testUrl,
    DATABASE_URL: testUrl,
    DIRECT_URL: testUrl,
    CORS_ALLOWED_ORIGINS: clientBaseUrl,
    JWT_SECRET: process.env.JWT_SECRET || "synthetic-test-jwt-secret-at-least-32-chars-long",
  };
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  globalSetup: issue3UiRun ? undefined : "./playwright.global-setup.ts",
  outputDir: `artifacts/${evidenceLab(process.env.TEST_DATABASE_URL ?? "postgresql://localhost/lab3_test")}/playwright`,
  reporter: [["list"], ["html", { outputFolder: `artifacts/${evidenceLab(process.env.TEST_DATABASE_URL ?? "postgresql://localhost/lab3_test")}/playwright-report` }]],
  use: {
    baseURL: clientBaseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: issue3UiRun
    ? {
        command: "npm run dev -- --host 127.0.0.1 --port 5173",
        cwd: "client",
        url: clientBaseUrl,
        timeout: 120_000,
        reuseExistingServer: false,
        env: {
          ...process.env,
          VITE_API_URL: apiBaseUrl,
        },
      }
    : [
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
