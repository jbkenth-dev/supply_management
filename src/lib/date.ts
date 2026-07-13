/**
 * Centralized date / time utility.
 *
 * ALL date operations in the frontend must go through this module so that
 * every timestamp is consistently interpreted and displayed in
 * Asia/Manila (UTC+08:00), regardless of the browser or host timezone.
 */

import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import timezone from "dayjs/plugin/timezone"

dayjs.extend(utc)
dayjs.extend(timezone)

/** The single source of truth for the application timezone. */
export const APP_TIMEZONE = "Asia/Manila"

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

/**
 * Parse any date-like value (ISO string, "YYYY-MM-DD HH:mm:ss", etc.)
 * and return a dayjs instance pinned to Asia/Manila.
 */
function toManila(value: string | dayjs.ConfigType): dayjs.Dayjs {
  if (!value) return dayjs().tz(APP_TIMEZONE)
  return dayjs(value).tz(APP_TIMEZONE)
}

// ---------------------------------------------------------------------------
// Formatting helpers — used across the application
// ---------------------------------------------------------------------------

/**
 * Full date-time format: "MMMM D, YYYY h:mm A"  (e.g. "July 13, 2026 3:45 PM")
 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return ""
  const d = toManila(value)
  return d.isValid() ? d.format("MMMM D, YYYY h:mm A") : String(value)
}

/**
 * Short date-time format: "MMM D, YYYY h:mm A"  (e.g. "Jul 13, 2026 3:45 PM")
 */
export function formatDateTimeShort(value: string | null | undefined): string {
  if (!value) return ""
  const d = toManila(value)
  return d.isValid() ? d.format("MMM D, YYYY h:mm A") : String(value)
}

/**
 * Date-only format: "MMM D, YYYY"  (e.g. "Jul 13, 2026")
 */
export function formatDateShort(value: string | null | undefined): string {
  if (!value) return ""
  const d = toManila(value)
  return d.isValid() ? d.format("MMM D, YYYY") : String(value)
}

/**
 * Date-only format: "MMMM D, YYYY"  (e.g. "July 13, 2026")
 */
export function formatDateLong(value: string | null | undefined): string {
  if (!value) return ""
  const d = toManila(value)
  return d.isValid() ? d.format("MMMM D, YYYY") : String(value)
}

/**
 * Format for contact/message list timestamps.
 * Shows time ("h:mm A") for today, otherwise ("MMM D") for older messages.
 */
export function formatContactTime(value: string | null | undefined): string {
  if (!value) return ""
  const d = toManila(value)
  if (!d.isValid()) return String(value)

  const now = dayjs().tz(APP_TIMEZONE)
  const isSameDay = now.format("YYYY-MM-DD") === d.format("YYYY-MM-DD")

  return isSameDay ? d.format("h:mm A") : d.format("MMM D")
}

/**
 * Format for individual message timestamps.
 * "MMM D, h:mm A"  (e.g. "Jul 13, 3:45 PM")
 */
export function formatMessageDate(value: string | null | undefined): string {
  if (!value) return ""
  const d = toManila(value)
  return d.isValid() ? d.format("MMM D, h:mm A") : String(value)
}

/**
 * Format for notification timestamps.
 * Full locale string in Manila timezone.
 */
export function formatNotificationTime(value: string | null | undefined): string {
  if (!value) return ""
  const d = toManila(value)
  return d.isValid() ? d.format("MMMM D, YYYY h:mm A") : String(value)
}

/**
 * Relative time format: "Just now", "X mins ago", "X hours ago",
 * or "MMM D, YYYY h:mm A" for older dates.
 */
export function formatRelativeDate(value: string | null | undefined): string {
  if (!value) return "No timestamp"

  const parsed = toManila(value)
  if (!parsed.isValid()) return String(value)

  const now = dayjs().tz(APP_TIMEZONE)
  const diffMinutes = Math.abs(now.diff(parsed, "minute"))

  if (diffMinutes < 1) return "Just now"
  if (diffMinutes < 60) return `${diffMinutes} min${diffMinutes === 1 ? "" : "s"} ago`

  const diffHours = Math.abs(now.diff(parsed, "hour"))
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`

  return parsed.format("MMM D, YYYY h:mm A")
}

/**
 * Convert a date string to a numeric timestamp (milliseconds)
 * for sorting. Returns 0 for invalid values.
 */
export function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0
  const d = toManila(value)
  return d.isValid() ? d.valueOf() : 0
}

/**
 * Return the current year in Asia/Manila timezone.
 * Use this instead of `new Date().getFullYear()`.
 */
export function currentManilaYear(): number {
  return dayjs().tz(APP_TIMEZONE).year()
}
