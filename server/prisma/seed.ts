import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { assertLab3TargetEnvironment } from "../src/databaseTargetGuard.js";
import { getPrisma } from "../src/prisma.js";
import { generateInitialPassword } from "../src/services/initialPasswordGenerator.js";
import {
  hashPassword,
  NORMAL_ARGON2_PROFILE,
  validatePassword,
} from "../src/services/passwordService.js";

const CATEGORIES = ["Account and Access", "Hardware", "Software", "Network"];
const RELATED_SYSTEMS = [
  "Corporate Laptop",
  "Desktop Workstation",
  "Printer",
  "Campus Wi-Fi",
  "VPN",
  "Email",
  "Learning Management System",
];

const SEED_CREDENTIALS_PATH = resolve(process.cwd(), ".local/lab3-seed-credentials.json");
type SeedCredentials = Record<string, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function loadSeedCredentials(): SeedCredentials {
  if (!existsSync(SEED_CREDENTIALS_PATH)) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(SEED_CREDENTIALS_PATH, "utf8"));
  } catch {
    throw new Error("Seed credential handoff file is invalid");
  }
  if (!isRecord(parsed)) {
    throw new Error("Seed credential handoff file is invalid");
  }

  const credentials: SeedCredentials = {};
  for (const [email, password] of Object.entries(parsed)) {
    if (
      typeof password !== "string" ||
      [...password].length !== 16 ||
      validatePassword(password).length > 0
    ) {
      throw new Error(`Seed credential for ${email} does not meet the password policy`);
    }
    credentials[email] = password;
  }
  chmodSync(SEED_CREDENTIALS_PATH, 0o600);
  return credentials;
}

function writeSeedCredentials(credentials: SeedCredentials): void {
  if (Object.keys(credentials).length === 0) {
    return;
  }

  mkdirSync(dirname(SEED_CREDENTIALS_PATH), { recursive: true, mode: 0o700 });
  writeFileSync(
    SEED_CREDENTIALS_PATH,
    `${JSON.stringify(credentials, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  chmodSync(SEED_CREDENTIALS_PATH, 0o600);
}

const USERS = [
  { name: "Alice Johnson", email: "alice.johnson@example.com", role: "REQUESTER" as const, isActive: true },
  { name: "Bob Smith", email: "bob.smith@example.com", role: "REQUESTER" as const, isActive: true },
  { name: "Carol Lee", email: "carol.lee@example.com", role: "REQUESTER" as const, isActive: true },
  { name: "David Brown", email: "david.brown@example.com", role: "REQUESTER" as const, isActive: true },
  { name: "Eve Wilson", email: "eve.wilson@example.com", role: "REQUESTER" as const, isActive: false },
  { name: "Iris Patel", email: "iris.patel@example.com", role: "IT_STAFF" as const, isActive: true },
  { name: "Jon Bell", email: "jon.bell@example.com", role: "IT_STAFF" as const, isActive: true },
  { name: "Kim Nguyen", email: "kim.nguyen@example.com", role: "IT_STAFF" as const, isActive: true },
  { name: "Lee Carter", email: "lee.carter@example.com", role: "IT_STAFF" as const, isActive: false },
  { name: "Morgan Admin", email: "morgan.admin@example.com", role: "ADMINISTRATOR" as const, isActive: true },
];

const TICKETS = [
  { publicId: "10000000-0000-4000-8000-000000000001", ticketNumber: "TKT-20260913-000000000001", email: "alice.johnson@example.com", category: "Account and Access", system: "VPN", status: "NEW" as const, priority: "HIGH" as const, summary: "VPN access fails", description: "VPN access fails after the latest client update." },
  { publicId: "10000000-0000-4000-8000-000000000002", ticketNumber: "TKT-20260913-000000000002", email: "bob.smith@example.com", category: "Hardware", system: "Corporate Laptop", status: "OPEN" as const, priority: "MEDIUM" as const, summary: "Laptop fan is loud", description: "Corporate laptop fan runs loudly during normal work." },
  { publicId: "10000000-0000-4000-8000-000000000003", ticketNumber: "TKT-20260913-000000000003", email: "carol.lee@example.com", category: "Software", system: "Email", status: "IN_PROGRESS" as const, priority: "LOW" as const, summary: "Email search is slow", description: "Email search takes several minutes to return results." },
  { publicId: "10000000-0000-4000-8000-000000000004", ticketNumber: "TKT-20260913-000000000004", email: "david.brown@example.com", category: "Network", system: "Campus Wi-Fi", status: "WAITING_FOR_REQUESTER" as const, priority: "HIGH" as const, summary: "Wi-Fi drops in office", description: "Campus Wi-Fi disconnects repeatedly in the office." },
  { publicId: "10000000-0000-4000-8000-000000000005", ticketNumber: "TKT-20260913-000000000005", email: "alice.johnson@example.com", category: "Software", system: "Learning Management System", status: "RESOLVED" as const, priority: "MEDIUM" as const, summary: "Course page will not load", description: "The course page remains blank after signing in." },
  { publicId: "10000000-0000-4000-8000-000000000006", ticketNumber: "TKT-20260913-000000000006", email: "bob.smith@example.com", category: "Hardware", system: "Printer", status: "CLOSED" as const, priority: "LOW" as const, summary: "Printer queue stuck", description: "The shared printer queue stopped processing jobs." },
];

async function upsertUser(
  prisma: ReturnType<typeof getPrisma>,
  input: (typeof USERS)[number],
  credentials: SeedCredentials,
) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    if (existing.mustChangePassword && credentials[input.email] === undefined) {
      const initialPassword = generateInitialPassword();
      credentials[input.email] = initialPassword;
      const passwordHash = await hashPassword(initialPassword, NORMAL_ARGON2_PROFILE);
      return prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, mustChangePassword: true, updatedBy: "seed" },
      });
    }
    return existing;
  }

  const initialPassword = generateInitialPassword();
  credentials[input.email] = initialPassword;
  const passwordHash = await hashPassword(initialPassword, NORMAL_ARGON2_PROFILE);
  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      role: input.role,
      passwordHash,
      mustChangePassword: true,
      isActive: input.isActive,
      deleted: false,
      createdBy: "seed",
      updatedBy: "seed",
    },
  });
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "test") {
    assertLab3TargetEnvironment();
  }
  const credentials = loadSeedCredentials();
  const prisma = getPrisma();
  try {
    for (const name of CATEGORIES) {
      await prisma.category.upsert({
        where: { name },
        update: {},
        create: { name, deleted: false, createdBy: "seed", updatedBy: "seed" },
      });
    }

    for (const name of RELATED_SYSTEMS) {
      await prisma.relatedSystem.upsert({
        where: { name },
        update: {},
        create: { name, deleted: false, createdBy: "seed", updatedBy: "seed" },
      });
    }

    const users = new Map<string, Awaited<ReturnType<typeof upsertUser>>>();
    for (const input of USERS) {
      users.set(input.email, await upsertUser(prisma, input, credentials));
    }

    const categories = new Map(
      (await prisma.category.findMany({ where: { name: { in: CATEGORIES } } })).map((row) => [row.name, row.id]),
    );
    const systems = new Map(
      (await prisma.relatedSystem.findMany({ where: { name: { in: RELATED_SYSTEMS } } })).map((row) => [row.name, row.id]),
    );
    const staff = [...users.values()].filter((user) => user.role === "IT_STAFF" && user.isActive);

    const tickets = new Map<string, Awaited<ReturnType<typeof prisma.ticket.upsert>>>();
    for (const [index, input] of TICKETS.entries()) {
      const requester = users.get(input.email);
      const categoryId = categories.get(input.category);
      const relatedSystemId = systems.get(input.system);
      if (!requester || !categoryId || !relatedSystemId) {
        throw new Error("Seed reference data is incomplete");
      }
      const ownerUserId = input.status === "NEW" || input.status === "CLOSED"
        ? null
        : staff[index % staff.length]?.id ?? null;
      tickets.set(input.publicId, await prisma.ticket.upsert({
        where: { publicId: input.publicId },
        update: {},
        create: {
          publicId: input.publicId,
          ticketNumber: input.ticketNumber,
          requesterId: requester.id,
          ownerUserId,
          categoryId,
          relatedSystemId,
          summary: input.summary,
          requestedPriority: input.priority,
          itPriority: input.priority,
          description: input.description,
          currentStatus: input.status,
          deleted: false,
          createdBy: requester.email,
          updatedBy: requester.email,
        },
      }));
    }

    const firstTicket = tickets.get(TICKETS[0]?.publicId as string);
    const firstAuthor = users.get("alice.johnson@example.com");
    if (firstTicket && firstAuthor) {
      const root = await prisma.publicComment.upsert({
        where: { publicId: "20000000-0000-4000-8000-000000000001" },
        update: {},
        create: {
          publicId: "20000000-0000-4000-8000-000000000001",
          ticketId: firstTicket.id,
          authorUserId: firstAuthor.id,
          content: "I still cannot connect from my office.",
        },
      });
      await prisma.publicComment.upsert({
        where: { publicId: "20000000-0000-4000-8000-000000000002" },
        update: {},
        create: {
          publicId: "20000000-0000-4000-8000-000000000002",
          ticketId: firstTicket.id,
          authorUserId: firstAuthor.id,
          parentCommentId: root.id,
          replyToCommentId: root.id,
          content: "Thanks for checking this.",
        },
      });
      const staffAuthor = staff[0];
      if (staffAuthor) {
        await prisma.internalNote.upsert({
          where: { publicId: "30000000-0000-4000-8000-000000000001" },
          update: {},
          create: {
            publicId: "30000000-0000-4000-8000-000000000001",
            ticketId: firstTicket.id,
            authorUserId: staffAuthor.id,
            content: "Checked VPN gateway logs; follow-up required.",
          },
        });
      }
    }

    writeSeedCredentials(credentials);
    console.log(JSON.stringify({ job: "prisma:seed", categories: CATEGORIES.length, relatedSystems: RELATED_SYSTEMS.length, users: USERS.length, tickets: TICKETS.length }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ job: "prisma:seed", failed: true, errorClass: error instanceof Error ? error.constructor.name : typeof error }));
  process.exitCode = 1;
});
