import { differenceInCalendarDays, format, parseISO } from "date-fns";

// Dates in the app are YYYY-MM-DD strings.

export const daysBetween = (from: string, to: string) =>
  differenceInCalendarDays(parseISO(to), parseISO(from));

/** "Nov 3", or "Jan 1, 2027" when it's not in the same year as `now`. */
export function shortDate(date: string, now: string) {
  return format(parseISO(date), date.slice(0, 4) === now.slice(0, 4) ? "MMM d" : "MMM d, yyyy");
}

/** First day of the month `back` months before the one `date` is in: ("2026-10-29", 2) → "2026-08-01". */
export function monthStart(date: string, back = 0) {
  const [y = 1970, m = 1] = date.split("-").map(Number);
  const t = y * 12 + (m - 1) - back;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}-01`;
}

/** "Oct", or "Oct 2025" when it's not in the same year as `now`. Takes "YYYY-MM" or a full date. */
export function monthLabel(month: string, now: string) {
  return format(
    parseISO(month.slice(0, 7) + "-01"),
    month.slice(0, 4) === now.slice(0, 4) ? "MMM" : "MMM yyyy",
  );
}

/** "today", "tomorrow", "in 5 days", "yesterday", "5 days ago". */
export function relativeDays(date: string, now: string) {
  const d = daysBetween(now, date);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d === -1) return "yesterday";
  return d > 0 ? `in ${d} days` : `${-d} days ago`;
}
