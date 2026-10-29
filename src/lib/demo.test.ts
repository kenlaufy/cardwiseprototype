import { afterEach, describe, expect, it } from "vitest";
import { today } from "./demo";

describe("today", () => {
  const tz = process.env["TZ"];
  afterEach(() => {
    if (tz === undefined) delete process.env["TZ"];
    else process.env["TZ"] = tz;
  });

  it("is the local date, not the UTC date", () => {
    process.env["TZ"] = "America/New_York";
    // 9:30 pm on Oct 29 in New York is already Oct 30 in UTC.
    expect(today(new Date("2026-10-30T01:30:00Z"))).toBe("2026-10-29");

    process.env["TZ"] = "Asia/Tokyo";
    // 8 am on Oct 30 in Tokyo is still Oct 29 in UTC.
    expect(today(new Date("2026-10-29T23:00:00Z"))).toBe("2026-10-30");
  });
});
