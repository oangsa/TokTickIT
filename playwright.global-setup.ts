import { execFile } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { resolve } from "node:path";

const execFileAsync = promisify(execFile);
const repositoryRoot = fileURLToPath(new URL(".", import.meta.url));
const serverRoot = resolve(repositoryRoot, "server");
const clientBaseUrl = "http://127.0.0.1:5173";

function redactDatabaseUrls(value: string): string {
  return value.replace(/postgres(?:ql)?:\/\/[^\s'"`]+/gi, "<DATABASE_URL>");
}

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

async function runCommand(command: string, arguments_: string[], testUrl: string): Promise<void> {
  try {
    await execFileAsync(command, arguments_, {
      cwd: serverRoot,
      env: testEnvironment(testUrl),
      maxBuffer: 2 * 1024 * 1024,
    });
  } catch (error) {
    const details =
      typeof error === "object" && error !== null
        ? (error as { stderr?: unknown; stdout?: unknown; message?: unknown })
        : {};
    const output =
      (typeof details.stderr === "string" && details.stderr) ||
      (typeof details.stdout === "string" && details.stdout) ||
      (typeof details.message === "string" && details.message) ||
      "unknown command failure";

    throw new Error(redactDatabaseUrls(output));
  }
}

export default async function globalSetup(): Promise<void> {
  const testUrl = requireTestDatabaseUrl();

  for (const directory of [
    "docs/lab-02/evidence/screenshots/create-ticket",
    "docs/lab-02/evidence/screenshots/my-tickets",
    "docs/lab-02/evidence/screenshots/ticket-detail",
  ]) {
    mkdirSync(resolve(repositoryRoot, directory), { recursive: true });
  }

  await runCommand("npx", ["--no-install", "prisma", "migrate", "deploy"], testUrl);
  await runCommand("npm", ["run", "prisma:seed"], testUrl);
}
