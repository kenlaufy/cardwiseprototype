import { describe, expect, it } from "vitest";
import { analyze, earnedByPurchase, feeChecks, feeVerdict } from "./analysis";
import { monthLabel, monthStart } from "./dates";
import { buildDemo } from "./demo";

const NOW = "2026-10-29";
const demo = () => buildDemo(NOW);

describe("month helpers", () => {
  it("steps back across years", () => {
    expect(monthStart("2026-10-29")).toBe("2026-10-01");
    expect(monthStart("2026-10-29", 2)).toBe("2026-08-01");
    expect(monthStart("2026-02-10", 3)).toBe("2025-11-01");
    expect(monthLabel("2026-08", NOW)).toBe("Aug");
    expect(monthLabel("2025-11", NOW)).toBe("Nov 2025");
  });
});

describe("spending analysis", () => {
  it("totals spending by month, oldest first, over whole calendar months", () => {
    const a = analyze(demo(), "3m", NOW);
    expect(a.start).toBe("2026-08-01");
    expect(a.byMonth).toEqual([
      expect.objectContaining({ month: "2026-08", spent: 894.73 }),
      expect.objectContaining({ month: "2026-09", spent: 418.09 }),
      expect.objectContaining({ month: "2026-10", spent: 1842.4 }),
    ]);
    expect(a.spent).toBe(3155.22);
    expect(analyze(demo(), "month", NOW).spent).toBe(1842.4);
    expect(analyze(demo(), "all", NOW).byMonth.map((m) => m.month)).toEqual([
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
  });

  it("sorts categories by spending", () => {
    const a = analyze(demo(), "3m", NOW);
    expect(a.byCategory[0]).toMatchObject({ category: "groceries", count: 4 });
    const spent = a.byCategory.map((c) => c.spent);
    expect(spent).toEqual([...spent].sort((x, y) => y - x));
  });

  it("counts caps from earlier purchases when estimating what each purchase earned", () => {
    // $300 of groceries earlier this month leaves $200 of the $500 cap: $180 × 5% = $9.
    expect(earnedByPurchase(demo()).get("p2")).toBe(9);
  });
});

describe("reward analysis", () => {
  it("flags purchases that another card would have paid more for", () => {
    const a = analyze(demo(), "3m", NOW);
    const ids = a.missed.map((m) => m.purchase.id);
    // Dining on a 1% card, online shopping and Uber on the grocery card: the flat 2% card pays more.
    expect(ids).toEqual(expect.arrayContaining(["h3", "h6", "h8"]));
    // Groceries on the 5% grocery card were already the best choice.
    expect(ids).not.toContain("h2");
    const h3 = a.missed.find((m) => m.purchase.id === "h3")!;
    expect(h3).toMatchObject({ earned: 0.36, best: expect.objectContaining({ reward: 0.72 }) });
    expect(h3.best.card.id).toBe("flat");
    expect(a.independentAlternativeTotal).toBeGreaterThan(a.earned);
  });

  it("compares the card used most per category with the one that would have earned most", () => {
    const cat = (c: string) => analyze(demo(), "3m", NOW).byCategory.find((x) => x.category === c)!;
    expect(cat("groceries")).toMatchObject({ usedCardId: "grocer", bestCardId: "grocer" });
    expect(cat("online shopping")).toMatchObject({ usedCardId: "rotate", bestCardId: "rotate" });
    // Uber went on the 1% grocery card; the flat 2% card pays more.
    expect(cat("transit")).toMatchObject({
      usedCardId: "grocer",
      bestCardId: "flat",
      earned: 0.23,
      bestEarned: 0.45,
    });
  });
});

describe("annual fee check", () => {
  const withFee = (fee: number, perksValue = 0) => {
    const s = demo();
    s.cards = s.cards.map((c) =>
      c.id === "grocer"
        ? {
            ...c,
            annualFee: fee,
            feeReview: { decision: "undecided", perksValue, reviewedOn: NOW },
          }
        : c,
    );
    return feeChecks(s, NOW);
  };

  it("compares this year's cash back with what your other cards would have paid", () => {
    const [check, ...rest] = feeChecks(demo(), NOW);
    expect(rest).toHaveLength(0); // only the demo grocery card has a fee
    expect(check).toMatchObject({
      fee: 95,
      since: "2026-07-02", // the first purchase recorded this year
      days: 120,
      earned: 67.05,
      baseline: 29.25,
      baselineLabel: "your other cards",
      perYear: { earned: 203.94, baseline: 88.97, extra: 114.97 },
      net: 19.97,
      verdict: "keep",
    });
  });

  it("counts perks the cardholder values, and flags cards that cost more than they earn", () => {
    expect(withFee(95, 30)[0]).toMatchObject({ perks: 30, net: 49.97, verdict: "keep" });
    expect(withFee(110)[0]).toMatchObject({ net: 4.97, verdict: "borderline" });
    expect(withFee(250)[0]).toMatchObject({ net: -135.03, verdict: "costly" });
  });

  it("compares against a no-fee 2% card when it's your only card", () => {
    const s = demo();
    s.cards = s.cards.filter((c) => c.id === "grocer");
    expect(feeChecks(s, NOW)[0]).toMatchObject({
      baselineLabel: "a no-fee 2% card",
      baseline: 29.25,
    });
  });

  it("waits for a month of purchases before judging", () => {
    expect(feeChecks(buildDemo("2026-01-15"), "2026-01-15")[0]?.verdict).toBe("early");
    expect(feeVerdict(-50, 95, 29)).toBe("early");
    expect(feeVerdict(15, 95, 30)).toBe("keep");
    expect(feeVerdict(14.99, 95, 30)).toBe("borderline");
    expect(feeVerdict(-15, 95, 30)).toBe("costly");
  });
});
