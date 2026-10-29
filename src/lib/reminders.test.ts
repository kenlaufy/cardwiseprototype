import { describe, expect, it } from "vitest";
import { buildDemo } from "./demo";
import { relativeDays, shortDate } from "./dates";
import { buildReminders } from "./reminders";
import type { Prefs } from "./store";

const ALL: Prefs = { activation: true, expiring: true, caps: true, categoryChanges: true };

describe("dates", () => {
  it("formats short and relative dates", () => {
    expect(shortDate("2026-11-03", "2026-10-29")).toBe("Nov 3");
    expect(shortDate("2027-01-01", "2026-10-29")).toBe("Jan 1, 2027");
    expect(relativeDays("2026-10-29", "2026-10-29")).toBe("today");
    expect(relativeDays("2026-10-30", "2026-10-29")).toBe("tomorrow");
    expect(relativeDays("2026-11-03", "2026-10-29")).toBe("in 5 days");
    expect(relativeDays("2026-10-26", "2026-10-29")).toBe("3 days ago");
  });
});

describe("reminders", () => {
  it("points activation reminders at the offer they're about", () => {
    const now = "2026-10-29";
    const r = buildReminders(buildDemo(now), ALL, [], now);
    expect(r.map((x) => x.id)).toEqual([
      "act-o-dine",
      "cap-grocer-cap-2026-11-01",
      "cap-rotate-cap-2027-01-01",
    ]);
    expect(r[0]).toMatchObject({ kind: "activation", offerId: "o-dine" });
    expect(r[0]!.detail).toBe("Steady 2% · offer ends Nov 3 (in 5 days)");
  });

  it("shows one reminder for a bonus that needs activating before it starts", () => {
    const now = "2026-12-10"; // next quarter's rotating bonus starts Jan 1
    const s = buildDemo(now);
    const ids = (prefs: Prefs) => buildReminders(s, prefs, [], now).map((x) => x.id);
    expect(ids(ALL)).toContain("ract-r-rot-next");
    expect(ids(ALL)).not.toContain("chg-r-rot-next");
    // With activation reminders off, the category change still shows.
    expect(ids({ ...ALL, activation: false })).toContain("chg-r-rot-next");
  });

  it("leaves out dismissed reminders", () => {
    const now = "2026-10-29";
    expect(buildReminders(buildDemo(now), ALL, ["act-o-dine"], now).map((x) => x.id)).not.toContain(
      "act-o-dine",
    );
  });
});
