import { describe, expect, it } from "vitest";
import { monthStart } from "./dates";
import { buildDemo } from "./demo";
import { PERSONAS, randomPurchase, randomPurchases, seededRandom } from "./randomizer";
import { CATEGORIES, MERCHANT_HINTS } from "./rewards";

const NOW = "2026-10-29";

describe("randomizer", () => {
  it("repeats exactly for the same seed", () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const xs = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(xs);
    for (const x of xs) expect(x >= 0 && x < 1).toBe(true);
    expect(randomPurchases(buildDemo(NOW), NOW, 7)).toEqual(
      randomPurchases(buildDemo(NOW), NOW, 7),
    );
  });

  it("makes six months of believable purchases on the wallet's cards", () => {
    const s = buildDemo(NOW);
    const cardIds = new Set(s.cards.map((c) => c.id));
    for (const seed of [1, 2, 3]) {
      const { purchases } = randomPurchases(s, NOW, seed);
      expect(purchases.length).toBeGreaterThan(40);
      expect(new Set(purchases.map((p) => p.id)).size).toBe(purchases.length);
      for (const p of purchases) {
        expect(p.date >= monthStart(NOW, 5) && p.date <= NOW).toBe(true);
        expect(cardIds.has(p.cardId)).toBe(true);
        expect(p.amount).toBeGreaterThan(0);
        expect(Math.round(p.amount * 100) / 100).toBe(p.amount);
        // Never contradicts what the app knows about a merchant.
        const hint = MERCHANT_HINTS[p.merchant!.toLowerCase()];
        if (hint) expect(hint).toBe(p.category);
      }
    }
  });

  it("follows the persona's habits", () => {
    const count = (personaId: string, category: string) =>
      [1, 2, 3, 4, 5]
        .flatMap((seed) => randomPurchases(buildDemo(NOW), NOW, seed, personaId).purchases)
        .filter((p) => p.category === category).length;
    expect(count("foodie", "dining")).toBeGreaterThan(count("foodie", "gas"));
    expect(count("commuter", "gas")).toBeGreaterThan(count("commuter", "dining"));
    expect(count("online", "online shopping")).toBeGreaterThan(count("online", "groceries"));
    expect(randomPurchases(buildDemo(NOW), NOW, 1, "traveler").persona.label).toBe("Traveler");
  });

  it("returns nothing for a wallet with no cards", () => {
    expect(randomPurchases({ ...buildDemo(NOW), cards: [] }, NOW, 1).purchases).toEqual([]);
  });

  it("makes a single purchase with a real category and a sensible amount", () => {
    const rand = seededRandom(9);
    for (let i = 0; i < 50; i++) {
      const p = randomPurchase(rand, PERSONAS[1]);
      expect(CATEGORIES).toContain(p.category);
      expect(p.amount).toBeGreaterThan(0);
      expect(p.amount).toBeLessThanOrEqual(900);
    }
  });
});
