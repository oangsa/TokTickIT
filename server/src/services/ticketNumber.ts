import { randomBytes } from "node:crypto";

/*
 * BR-01-03 / AC-07. `TKT-YYYYMMDD-RRRRRRRRRRRR`: the business date in
 * `Asia/Bangkok` and a 12-character uppercase hexadecimal suffix, 25 characters
 * in total. The database `CHECK (ticket_number ~ '^TKT-[0-9]{8}-[0-9A-F]{12}$')`
 * is the authority on the shape; this pattern mirrors it so a malformed
 * candidate fails in a test rather than at insert time.
 */
export const TICKET_NUMBER_PATTERN = /^TKT-\d{8}-[0-9A-F]{12}$/;

/*
 * `en-CA` because it formats as `YYYY-MM-DD`, which only needs its separators
 * stripped. Building the date from `getUTC*` would be wrong: the business date
 * is Bangkok's, and Bangkok is UTC+7, so between 17:00 and 24:00 UTC the two
 * calendars disagree.
 */
const BANGKOK_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function bangkokBusinessDate(now: Date): string {
  return BANGKOK_DATE.format(now).replaceAll("-", "");
}

/* 6 bytes is exactly 12 hexadecimal characters. */
function defaultSuffix(): string {
  return randomBytes(6).toString("hex").toUpperCase();
}

/*
 * Deliberately has no database awareness (BR-03): uniqueness is owned by the
 * `ticket_number` unique constraint and the bounded retry in the create
 * transaction, which calls this again for each attempt.
 */
export function generateTicketNumber(now: Date, suffix: () => string = defaultSuffix): string {
  return `TKT-${bangkokBusinessDate(now)}-${suffix()}`;
}
