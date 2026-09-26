import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { assertLab3TargetEnvironment } from "../databaseTargetGuard.js";
import { getPrisma } from "../prisma.js";
import {
  provisionMigratedPasswords,
  type PasswordHandoff,
} from "../services/migratedPasswordProvisioning.js";
import { validatePassword } from "../services/passwordService.js";

const DEFAULT_HANDOFF_PATH = ".local/lab3-migrated-user-credentials.json";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getHandoffPath(): string {
  return resolve(process.cwd(), process.env.LAB3_MIGRATED_PASSWORD_HANDOFF_PATH ?? DEFAULT_HANDOFF_PATH);
}

function loadHandoff(path: string): Record<string, string> {
  if (!existsSync(path)) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error("Migrated password handoff file is invalid");
  }
  if (!isRecord(parsed)) {
    throw new Error("Migrated password handoff file is invalid");
  }

  const credentials: Record<string, string> = {};
  for (const [email, password] of Object.entries(parsed)) {
    if (
      typeof password !== "string" ||
      [...password].length !== 16 ||
      validatePassword(password).length > 0
    ) {
      throw new Error(`Migrated password handoff for ${email} is invalid`);
    }
    credentials[email] = password;
  }
  chmodSync(path, 0o600);
  return credentials;
}

function writeHandoff(path: string, credentials: PasswordHandoff): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, `${JSON.stringify(credentials, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  chmodSync(path, 0o600);
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "test") {
    assertLab3TargetEnvironment();
  }
  const path = getHandoffPath();
  const existingCredentials = loadHandoff(path);
  const prisma = getPrisma();

  try {
    const provisioned = await provisionMigratedPasswords(prisma, {
      existingCredentials,
      persistHandoff: (credentials) => writeHandoff(path, credentials),
    });
    console.log(JSON.stringify({ job: "prisma:provision-migrated-passwords", provisioned }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({
    job: "prisma:provision-migrated-passwords",
    failed: true,
    errorClass: error instanceof Error ? error.constructor.name : typeof error,
  }));
  process.exitCode = 1;
});
