import { format, parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const CENTRAL_TZ = "America/Chicago";

/**
 * Format a date string to "Mon, Jun 1, 2026" in Central Time.
 * Accepts ISO strings or date-only strings (YYYY-MM-DD).
 */
export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    const date = d.includes("T") ? parseISO(d) : parseISO(d + "T12:00:00");
    const zoned = toZonedTime(date, CENTRAL_TZ);
    return format(zoned, "EEE, MMM d, yyyy");
  } catch {
    return d;
  }
}

/**
 * Format a date string to short "Jun 1, 2026" in Central Time (no weekday).
 */
export function formatDateShort(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    const date = d.includes("T") ? parseISO(d) : parseISO(d + "T12:00:00");
    const zoned = toZonedTime(date, CENTRAL_TZ);
    return format(zoned, "MMM d, yyyy");
  } catch {
    return d;
  }
}

/**
 * Format a datetime string to "Mon, Jun 1, 2026 10:00 AM" in Central Time.
 */
export function formatDatetime(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    const date = new Date(d);
    const zoned = toZonedTime(date, CENTRAL_TZ);
    return format(zoned, "EEE, MMM d, yyyy h:mm a");
  } catch {
    return d;
  }
}

/**
 * Format a datetime string to "Jun 1, 2026 10:00 AM" in Central Time (no weekday).
 */
export function formatDatetimeShort(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    const date = new Date(d);
    const zoned = toZonedTime(date, CENTRAL_TZ);
    return format(zoned, "MMM d, yyyy h:mm a");
  } catch {
    return d;
  }
}

/**
 * Format a time string ("HH:mm:ss" or "HH:mm") to "10:00 AM".
 */
export function formatTime(t: string | null | undefined): string {
  if (!t) return "—";
  try {
    const [h, m] = t.split(":");
    const hour = parseInt(h, 10);
    const minute = m ?? "00";
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${h12}:${minute} ${ampm}`;
  } catch {
    return t;
  }
}

/**
 * Format a time string with "(CT)" timezone label for public-facing pages.
 */
export function formatTimePublic(t: string | null | undefined): string {
  const formatted = formatTime(t);
  return formatted === "—" ? formatted : `${formatted} (CT)`;
}

/**
 * Format a datetime with "(CT)" timezone label for public-facing pages.
 */
export function formatDatetimePublic(d: string | null | undefined): string {
  const formatted = formatDatetime(d);
  return formatted === "—" ? formatted : `${formatted} (CT)`;
}

/**
 * Get today's date as YYYY-MM-DD in Central Time.
 */
export function todayCentral(): string {
  const now = toZonedTime(new Date(), CENTRAL_TZ);
  return format(now, "yyyy-MM-dd");
}

/**
 * Convert DB datetime to input datetime-local format.
 */
export function toDatetimeLocal(d: string | null | undefined): string {
  if (!d) return "";
  try {
    const date = new Date(d);
    return date.toISOString().slice(0, 16);
  } catch {
    return "";
  }
}
