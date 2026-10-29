import { differenceInCalendarDays, format, parseISO } from "date-fns";

// Dates in the app are YYYY-MM-DD strings.

export const daysBetween = (from: string, to: string) =>
  differenceInCalendarDays(parseISO(to), parseISO(from));

/** "Nov 3", or "Jan 1, 2027" when it's not in the same year as `now`. */
export function shortDate(date: string, now: string) {
  return format(parseISO(date), date.slice(0, 4) === now.slice(0, 4) ? "MMM d" : "MMM d, yyyy");
}

/** "today", "tomorrow", "in 5 days", "yesterday", "5 days ago". */
export function relativeDays(date: string, now: string) {
  const d = daysBetween(now, date);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d === -1) return "yesterday";
  return d > 0 ? `in ${d} days` : `${-d} days ago`;
}
