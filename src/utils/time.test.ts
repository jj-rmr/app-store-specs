import { describe, expect, it } from "vitest";
import { formatUploadStamp } from "./time";

const NOW = Date.parse("2026-10-07T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("formatUploadStamp", () => {
  it("says Just now under a minute (and clamps future skew)", () => {
    expect(formatUploadStamp(ago(30_000), NOW)?.text).toBe("Just now");
    expect(formatUploadStamp(ago(-60_000), NOW)?.text).toBe("Just now");
  });

  it("shows minutes then hours under 24h", () => {
    expect(formatUploadStamp(ago(5 * 60_000), NOW)?.text).toBe("5m ago");
    expect(formatUploadStamp(ago(3 * 3_600_000), NOW)?.text).toBe("3h ago");
    expect(formatUploadStamp(ago(23 * 3_600_000), NOW)?.text).toBe("23h ago");
  });

  it("shows the calendar date at and past 24h", () => {
    expect(formatUploadStamp(ago(25 * 3_600_000), NOW)?.text).toBe("Oct 6, 2026");
  });

  it("returns null for missing or invalid input", () => {
    expect(formatUploadStamp("", NOW)).toBeNull();
    expect(formatUploadStamp("not-a-date", NOW)).toBeNull();
  });

  it("always carries tooltip + machine-readable time", () => {
    const stamp = formatUploadStamp(ago(5 * 60_000), NOW);
    expect(stamp?.title).toBeTruthy();
    expect(stamp?.dateTime).toBeTruthy();
  });
});
