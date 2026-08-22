import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../../src/generated/prisma/client.js";

config({ path: [".env.local", ".env"] });

const execFileAsync = promisify(execFile);
const serverRoot = fileURLToPath(new URL("../../../", import.meta.url));
const lab1MigrationPath = `${serverRoot}prisma/migrations/20260808064543_add_category/migration.sql`;

export interface TestDatabaseTarget {
  url: string;
  databaseName: string;
}

function redactDatabaseUrls(value: string): string {
  return value.replace(/postgres(?:ql)?:\/\/[^\s'"`]+/gi, "<DATABASE_URL>");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function commandFailureDetails(error: unknown, fallback: string): string {
  if (!isRecord(error)) {
    return fallback;
  }

  const stderr = typeof error.stderr === "string" ? error.stderr : undefined;
  const stdout = typeof error.stdout === "string" ? error.stdout : undefined;
  const message = typeof error.message === "string" ? error.message : undefined;
  return stderr || stdout || message || fallback;
}

function parseDatabaseTarget(value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL URL");
  }

  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error("TEST_DATABASE_URL must use the PostgreSQL protocol");
  }

  if (!parsed.pathname || parsed.pathname === "/") {
    throw new Error("TEST_DATABASE_URL must identify a database name");
  }

  return parsed;
}

function databaseIdentity(parsed: URL): string {
  const databaseName = decodeURIComponent(parsed.pathname.slice(1));
  return `postgresql://${parsed.hostname.toLowerCase()}:${parsed.port || "5432"}/${databaseName}`;
}

export function assertLab2TestDatabase(): TestDatabaseTarget {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Lab 2 PostgreSQL tests require NODE_ENV=test");
  }

  const rawTestUrl = process.env.TEST_DATABASE_URL?.trim();
  if (!rawTestUrl) {
    throw new Error("Lab 2 PostgreSQL tests require TEST_DATABASE_URL");
  }

  const parsedTestUrl = parseDatabaseTarget(rawTestUrl);
  const databaseName = decodeURIComponent(parsedTestUrl.pathname.slice(1));
  if (!/(^|[_-])test([_-]|$)/i.test(databaseName)) {
    throw new Error("TEST_DATABASE_URL database name must contain an explicit test marker");
  }

  const developmentUrls = [
    ["DATABASE_URL", process.env.DATABASE_URL],
    ["DIRECT_URL", process.env.DIRECT_URL],
  ] as const;
  for (const [variableName, rawDevelopmentUrl] of developmentUrls) {
    const developmentUrl = rawDevelopmentUrl?.trim();
    if (!developmentUrl) {
      continue;
    }

    const parsedDevelopmentUrl = parseDatabaseTarget(developmentUrl);
    const developmentDatabaseName = decodeURIComponent(
      parsedDevelopmentUrl.pathname.slice(1),
    );
    if (
      databaseName === developmentDatabaseName ||
      databaseIdentity(parsedTestUrl) === databaseIdentity(parsedDevelopmentUrl)
    ) {
      throw new Error(
        `TEST_DATABASE_URL must identify a database different from ${variableName}`,
      );
    }
  }

  return { url: rawTestUrl, databaseName };
}

function assertGuardedTarget(target: TestDatabaseTarget): TestDatabaseTarget {
  const guardedTarget = assertLab2TestDatabase();
  if (
    target.url !== guardedTarget.url ||
    target.databaseName !== guardedTarget.databaseName
  ) {
    throw new Error("Test database target must match the guarded TEST_DATABASE_URL");
  }

  return guardedTarget;
}

export function createTestPrisma(target: TestDatabaseTarget): PrismaClient {
  const guardedTarget = assertGuardedTarget(target);
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: guardedTarget.url }),
  });
}

function testProcessEnvironment(target: TestDatabaseTarget): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: "test",
    TEST_DATABASE_URL: target.url,
    DATABASE_URL: target.url,
    DIRECT_URL: target.url,
  };
}

async function runPrismaCommand(
  target: TestDatabaseTarget,
  arguments_: string[],
): Promise<void> {
  const guardedTarget = assertGuardedTarget(target);
  try {
    await execFileAsync("npx", ["prisma", ...arguments_], {
      cwd: serverRoot,
      env: testProcessEnvironment(guardedTarget),
      maxBuffer: 2 * 1024 * 1024,
    });
  } catch (error) {
    const details = commandFailureDetails(error, "unknown Prisma command failure");
    throw new Error(redactDatabaseUrls(details));
  }
}

export async function resetTestSchema(
  target: TestDatabaseTarget,
): Promise<void> {
  const prisma = createTestPrisma(target);
  try {
    await prisma.$executeRawUnsafe("DROP SCHEMA public CASCADE");
    await prisma.$executeRawUnsafe("CREATE SCHEMA public");
  } finally {
    await prisma.$disconnect();
  }
}

export async function deployMigrations(
  target: TestDatabaseTarget,
): Promise<void> {
  await runPrismaCommand(target, ["migrate", "deploy"]);
}

export async function markLab1MigrationApplied(
  target: TestDatabaseTarget,
): Promise<void> {
  await runPrismaCommand(target, [
    "migrate",
    "resolve",
    "--applied",
    "20260808064543_add_category",
  ]);
}

export async function runSeed(
  target: TestDatabaseTarget,
): Promise<void> {
  const guardedTarget = assertGuardedTarget(target);
  try {
    await execFileAsync("npm", ["run", "prisma:seed"], {
      cwd: serverRoot,
      env: testProcessEnvironment(guardedTarget),
      maxBuffer: 2 * 1024 * 1024,
    });
  } catch (error) {
    const details = commandFailureDetails(error, "unknown seed command failure");
    throw new Error(redactDatabaseUrls(details));
  }
}

export async function applyLab1Migration(
  target: TestDatabaseTarget,
): Promise<void> {
  const prisma = createTestPrisma(target);
  const migrationSql = readFileSync(lab1MigrationPath, "utf8")
    .replace(/--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  try {
    for (const statement of migrationSql) {
      await prisma.$executeRawUnsafe(statement);
    }
  } finally {
    await prisma.$disconnect();
  }
}
