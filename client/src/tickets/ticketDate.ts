/*
 * `createdAt` arrives as a UTC instant, and slicing the ISO string rendered the
 * UTC date -- which contradicted the Ticket Number beside it. The Ticket Number
 * embeds the `Asia/Bangkok` business date (BR-01-03), so between 17:00 and
 * 24:00 UTC the same row read `TKT-20260827-...` next to a Created At of
 * 2026-08-26. The business calendar is the one the row already commits to.
 *
 * Both the locale and the time zone are pinned, so this renders identically on
 * every machine and in CI -- the reason the slice was chosen originally, kept.
 * `en-CA` formats as `YYYY-MM-DD`, the same shape the slice produced.
 *
 * My Tickets and Ticket Detail both show the same Ticket's date, so the format
 * lives here rather than once per page: two copies would let them disagree.
 */
const TICKET_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function ticketDate(createdAt: string): string {
  return TICKET_DATE.format(new Date(createdAt));
}

/*
 * `updatedAt` and an Attachment's `createdAt` are audit instants, not the
 * business date the Ticket Number commits to, so they keep their time of day:
 * date alone renders two audits on one day identically. Same pinned locale and
 * time zone, and `h23` so midnight reads `00:00` rather than `24:00`.
 */
const TICKET_DATE_TIME = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function ticketDateTime(instant: string): string {
  return TICKET_DATE_TIME.format(new Date(instant));
}
