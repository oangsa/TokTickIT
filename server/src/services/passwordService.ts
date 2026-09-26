import argon2, { argon2id } from "argon2";

export interface Argon2Profile {
  memoryCost: number;
  timeCost: number;
  parallelism: number;
}

export const NORMAL_ARGON2_PROFILE: Argon2Profile = {
  memoryCost: 32 * 1024,
  timeCost: 2,
  parallelism: 1,
};

export const TEST_ARGON2_PROFILE: Argon2Profile = {
  memoryCost: 8 * 1024,
  timeCost: 1,
  parallelism: 1,
};

const CODE_POINT_MIN = 8;
const CODE_POINT_MAX = 128;

export const MIGRATED_PASSWORD_UNPROVISIONED_PREFIX = "!migrated-password-unprovisioned:";

export interface PasswordValidationError {
  field: string;
  message: string;
}

export function validatePassword(password: unknown, field = "password"): PasswordValidationError[] {
  if (typeof password !== "string") {
    return [{ field, message: "Password is required." }];
  }

  const errors: PasswordValidationError[] = [];
  const length = [...password].length;

  if (length < CODE_POINT_MIN || length > CODE_POINT_MAX) {
    errors.push({ field, message: "Password must contain 8-128 characters." });
  }
  if (!/[A-Z]/.test(password)) {
    errors.push({ field, message: "Password must contain an uppercase letter." });
  }
  if (!/[a-z]/.test(password)) {
    errors.push({ field, message: "Password must contain a lowercase letter." });
  }
  if (!/\p{Nd}/u.test(password)) {
    errors.push({ field, message: "Password must contain a decimal digit." });
  }
  if (!/[\p{P}\p{S}]/u.test(password)) {
    errors.push({ field, message: "Password must contain a non-whitespace symbol." });
  }

  return errors;
}

export async function hashPassword(
  password: string,
  profile: Argon2Profile = NORMAL_ARGON2_PROFILE,
): Promise<string> {
  return argon2.hash(password, { type: argon2id, ...profile });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  if (hash.startsWith(MIGRATED_PASSWORD_UNPROVISIONED_PREFIX)) {
    return false;
  }

  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

const DUMMY_NORMAL_PASSWORD_HASH =
  "$argon2id$v=19$m=32768,p=1,t=2$/fXNnVdPRL1m3iN+ts9LVg$L4L7lHlTNa8KDJzvPJAiHub5Rwk3m9ue527s9HLGVbU";
export const DUMMY_TEST_PASSWORD_HASH =
  "$argon2id$v=19$m=8192,p=1,t=1$NjU0MzIxMDk4NzY1NDMyMQ$T9z5nuy6HLXsGrro5e/7L8AnABae9LCL8Iaktep/GQA";

export const DUMMY_PASSWORD_HASH = DUMMY_NORMAL_PASSWORD_HASH;

export function dummyPasswordHash(profile: Argon2Profile = NORMAL_ARGON2_PROFILE): string {
  return profile.memoryCost === TEST_ARGON2_PROFILE.memoryCost &&
    profile.timeCost === TEST_ARGON2_PROFILE.timeCost &&
    profile.parallelism === TEST_ARGON2_PROFILE.parallelism
    ? DUMMY_TEST_PASSWORD_HASH
    : DUMMY_NORMAL_PASSWORD_HASH;
}
