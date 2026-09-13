import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import { generateInitialPassword } from "./initialPasswordGenerator.js";
import {
  hashPassword,
  MIGRATED_PASSWORD_UNPROVISIONED_PREFIX,
  NORMAL_ARGON2_PROFILE,
  validatePassword,
  type Argon2Profile,
} from "./passwordService.js";

export type PasswordHandoff = Readonly<Record<string, string>>;

export interface MigratedPasswordProvisioningOptions {
  existingCredentials?: PasswordHandoff;
  persistHandoff?: (credentials: PasswordHandoff) => void;
  profile?: Argon2Profile;
}

interface UnprovisionedUser {
  id: number;
  email: string;
}

interface PasswordUpdate {
  id: number;
  passwordHash: string;
}

export async function provisionMigratedPasswords(
  prisma: PrismaClient,
  options: MigratedPasswordProvisioningOptions = {},
): Promise<number> {
  return prisma.$transaction((tx) => provisionMigratedPasswordsInTransaction(tx, options));
}

export async function provisionMigratedPasswordsInTransaction(
  tx: Prisma.TransactionClient,
  options: MigratedPasswordProvisioningOptions = {},
): Promise<number> {
  const users = await tx.$queryRaw<UnprovisionedUser[]>`
    SELECT id, email::text AS email
    FROM "user"
    WHERE password_hash LIKE ${`${MIGRATED_PASSWORD_UNPROVISIONED_PREFIX}%`}
    ORDER BY id
    FOR UPDATE
  `;

  if (users.length === 0) {
    return 0;
  }

  const credentials: Record<string, string> = {
    ...options.existingCredentials,
  };
  const usedPasswords = new Set<string>();
  for (const password of Object.values(credentials)) {
    if (validatePassword(password).length > 0 || usedPasswords.has(password)) {
      throw new Error("Migrated password handoff contains an invalid or duplicate credential");
    }
    usedPasswords.add(password);
  }

  const updates: PasswordUpdate[] = [];
  const profile = options.profile ?? NORMAL_ARGON2_PROFILE;

  for (const user of users) {
    let initialPassword = credentials[user.email];
    if (initialPassword === undefined) {
      do {
        initialPassword = generateInitialPassword();
      } while (usedPasswords.has(initialPassword));
      credentials[user.email] = initialPassword;
      usedPasswords.add(initialPassword);
    }
    if (validatePassword(initialPassword).length > 0) {
      throw new Error("Migrated password handoff contains an invalid credential");
    }

    updates.push({
      id: user.id,
      passwordHash: await hashPassword(initialPassword, profile),
    });
  }

  options.persistHandoff?.(credentials);

  for (const update of updates) {
    const updated = await tx.$executeRaw`
      UPDATE "user"
      SET password_hash = ${update.passwordHash},
          must_change_password = TRUE,
          updated_by = 'migration-password-provisioning'
      WHERE id = ${update.id}
    `;
    if (updated !== 1) {
      throw new Error("Migrated password provisioning updated an unexpected number of users");
    }
  }

  return updates.length;
}
