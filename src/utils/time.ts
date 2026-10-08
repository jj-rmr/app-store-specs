const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export type UploadStamp = {
  /** Visible label: relative (<24h) or calendar date (>=24h). */
  text: string;
  /** Full local date/time for tooltip + accessibility. */
  title: string;
  /** ISO value for <time dateTime>. */
  dateTime: string;
};

/**
 * Format a project upload timestamp.
 *
 * - age < 1m  -> "Just now"
 * - age < 1h  -> "Xm ago"
 * - age < 24h -> "Xh ago"
 * - age >= 24h -> "Sep 20, 2026"
 *
 * Future timestamps (clock skew) clamp to "Just now".
 * Invalid input returns null so callers render nothing.
 */
export function formatUploadStamp(iso: string, nowMs: number = Date.now()): UploadStamp | null {
  if (typeof iso !== "string" || !iso.trim()) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const date = new Date(t);
  const title = date.toLocaleString();
  let dateTime = iso;
  try {
    dateTime = date.toISOString();
  } catch {
    dateTime = iso;
  }

  const diffMs = Math.max(0, nowMs - t);
  if (diffMs < MINUTE_MS) return { text: "Just now", title, dateTime };
  if (diffMs < HOUR_MS) {
    const m = Math.floor(diffMs / MINUTE_MS);
    return { text: `${m}m ago`, title, dateTime };
  }
  if (diffMs < DAY_MS) {
    const h = Math.floor(diffMs / HOUR_MS);
    return { text: `${h}h ago`, title, dateTime };
  }
  const text = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return { text, title, dateTime };
}
