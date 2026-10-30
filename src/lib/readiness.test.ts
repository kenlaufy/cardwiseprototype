import { describe, it, expect } from "vitest";
import {
  calculateCard,
  capUsed,
  rankCards,
  replayPurchases,
  type WalletState,
  type Purchase,
  type Offer,
} from "./rewards";
import { CATALOG, catalogDraft } from "./catalog";
import { analyze, earnedByPurchase } from "./analysis";
import { emptyWallet, migrateWallet, versionWallet } from "./persistence";
const date = "2026-10-29";
const input = { amount: 100, category: "dining" as const, date, channel: "in-store" as const };
const card = {
  id: "flat",
  name: "Flat",
  issuer: "Test",
  color: "teal",
  baseRate: 2,
  source: "manual" as const,
};
const purchase = (id: string, amount = 100, day = date): Purchase => ({
  ...input,
  id,
  cardId: card.id,
  amount,
  date: day,
});
const offer: Offer = {
  id: "offer",
  cardId: card.id,
  title: "10% up to $15",
  categories: ["dining"],
  rate: 10,
  maxReward: 15,
  startDate: "2026-10-01",
  endDate: "2026-12-31",
  requiresActivation: false,
  activated: false,
  stackable: true,
  source: "manual",
};
const wallet = (): WalletState => ({
  cards: [card],
  rules: [],
  capGroups: [],
  offers: [offer],
  purchases: [],
});
function flex(): WalletState {
  let n = 0;
  const d = catalogDraft(
    CATALOG.find((c) => c.id === "chase-freedom-flex")!,
    () => `id${++n}`,
  );
  return {
    cards: [{ ...d.card, setupConfirmed: true }],
    rules: d.rules.map((r) => ({ ...r, activated: true })),
    capGroups: d.caps.map((g) => ({ ...g, opening: undefined })),
    offers: [],
    purchases: [],
  } satisfies WalletState;
}
describe("release calculation regressions", () => {
  it("exhausts an offer across purchases and frees usage when one is removed", () => {
    const s = wallet();
    s.purchases = [purchase("first", 200, "2026-10-01")];
    expect(calculateCard(s, card, input).reward).toBe(2);
    s.purchases = [];
    expect(calculateCard(s, card, input).reward).toBe(12);
  });
  it("pays only the remaining cumulative offer reward", () => {
    const s = wallet();
    s.purchases = [purchase("first", 100, "2026-10-01")];
    expect(calculateCard(s, card, input).reward).toBe(7);
  });
  it("supports per-purchase and one-use limits explicitly", () => {
    const s = wallet();
    s.purchases = [purchase("first", 200, "2026-10-01")];
    s.offers = [{ ...offer, limitScope: "purchase" }];
    expect(calculateCard(s, card, input).reward).toBe(12);
    s.offers = [{ ...offer, limitScope: "once" }];
    expect(calculateCard(s, card, input).reward).toBe(2);
  });
  it("combines compatible stackable offers but keeps exclusive offers separate", () => {
    const s = wallet();
    s.offers = [
      offer,
      { ...offer, id: "second", rate: 5 },
      { ...offer, id: "exclusive", rate: 12, stackable: false },
    ];
    expect(calculateCard(s, card, input).reward).toBe(17);
  });
  it("uses the next eligible category rate when a cap is crossed", () => {
    const s = flex(),
      c = s.cards[0]!;
    s.purchases = [{ ...purchase("prior", 1450, "2026-10-01"), cardId: c.id }];
    expect(calculateCard(s, c, input).reward).toBe(5);
  });
  it("ignores future purchases even within the same cap period", () => {
    const s = flex(),
      c = s.cards[0]!;
    s.purchases = [{ ...purchase("future", 1500, "2026-11-15"), cardId: c.id }];
    expect(calculateCard(s, c, input).reward).toBe(7);
    expect(capUsed(s, s.capGroups[0]!, date)).toBe(0);
  });
  it("uses stable same-day order and excludes the purchase under edit", () => {
    const s = wallet();
    s.purchases = [
      { ...purchase("later"), order: 2 },
      { ...purchase("earlier"), order: 1 },
    ];
    expect(calculateCard(s, card, { ...input, id: "earlier" }).reward).toBe(12);
    expect(calculateCard(s, card, { ...input, id: "later" }).reward).toBe(7);
    const r = replayPurchases(s);
    expect(r.earned.get("earlier")?.reward).toBe(12);
    expect(r.earned.get("later")?.reward).toBe(7);
  });
  it("does not double-count recorded purchases included in a corrected opening balance", () => {
    const s = flex(),
      c = s.cards[0]!;
    s.purchases = [{ ...purchase("already-recorded", 100), cardId: c.id, order: 0 }];
    s.capGroups = s.capGroups.map((g) => ({
      ...g,
      opening: { date, used: 1450, throughOrder: 1 },
    }));
    expect(capUsed(s, s.capGroups[0]!, date)).toBe(1450);
    expect(calculateCard(s, c, input).reward).toBe(5);
    s.purchases.push({ ...purchase("after-balance", 50), cardId: c.id, order: 1 });
    expect(calculateCard(s, c, input).reward).toBe(3);
  });
  it("conservatively excludes bonuses with unknown opening usage", () => {
    const s = flex(),
      c = s.cards[0]!;
    s.capGroups = s.capGroups.map((g) => ({ ...g, opening: { date, used: null } }));
    const r = calculateCard(s, c, input);
    expect(r.reward).toBe(3);
    expect(r.assumptions).toHaveLength(1);
  });
  it("resets an opening balance at the correct period boundary", () => {
    const s = flex(),
      c = s.cards[0]!;
    s.capGroups = s.capGroups.map((g) => ({ ...g, opening: { date, used: 1500 } }));
    expect(capUsed(s, s.capGroups[0]!, "2027-01-01")).toBe(0);
    expect(calculateCard(s, c, { ...input, date: "2027-01-01" }).reward).toBe(3);
  });
  it("keeps historical earnings stable after a rate or activation edit", () => {
    let s = migrateWallet({
      ...emptyWallet(),
      ...wallet(),
      offers: [],
      purchases: [purchase("past")],
    });
    s = versionWallet({ ...s, cards: [{ ...card, baseRate: 3 }] });
    expect(earnedByPurchase(s).get("past")).toBe(2);
    expect(rankCards(s, input)[0]?.reward).toBe(3);
  });
  it("retains exhausted annual caps when the analyzer range changes", () => {
    let n = 0;
    const d = catalogDraft(
      CATALOG.find((c) => c.id === "amex-blue-cash-preferred")!,
      () => `b${++n}`,
    );
    const s: WalletState = {
      cards: [{ ...d.card, setupConfirmed: true }],
      rules: d.rules,
      capGroups: d.caps.map((g) => ({ ...g, opening: undefined })),
      offers: [],
      purchases: [
        { ...purchase("jan", 6000, "2026-01-15"), category: "groceries", cardId: d.card.id },
        { ...purchase("oct"), category: "groceries", cardId: d.card.id },
      ],
    };
    const a = analyze(s, "month", date);
    expect(a.earned).toBe(1);
    expect(a.independentAlternativeTotal).toBe(1);
    expect(a.missed).toHaveLength(0);
  });
  it("compares each alternative against actual balances rather than a greedy replay", () => {
    const a = { ...card, id: "a", baseRate: 1 },
      b = { ...card, id: "b", baseRate: 1 };
    const s: WalletState = {
      cards: [a, b],
      rules: [
        {
          id: "ar",
          cardId: "a",
          categories: ["groceries", "dining"],
          rate: 5,
          capGroupId: "cap",
          requiresActivation: false,
          activated: false,
          source: "manual",
          verified: false,
          lastChecked: date,
        },
        {
          id: "br",
          cardId: "b",
          categories: ["groceries"],
          rate: 4,
          requiresActivation: false,
          activated: false,
          source: "manual",
          verified: false,
          lastChecked: date,
        },
      ],
      capGroups: [{ id: "cap", cardId: "a", label: "Shared", amount: 100, period: "month" }],
      offers: [],
      purchases: [
        { ...purchase("g", 100, "2026-10-01"), cardId: "b", category: "groceries" },
        { ...purchase("d", 100, "2026-10-02"), cardId: "a" },
      ],
    };
    const r = replayPurchases(s);
    expect([...r.earned.values()].reduce((sum, x) => sum + x.reward, 0)).toBe(9);
    expect(r.alternatives.get("d")?.reward).toBe(5);
  });
  it("enforces merchant exclusions and normalizes known aliases", () => {
    const s = flex(),
      c = s.cards[0]!;
    s.rules = s.rules.map((r) => ({ ...r, excludedMerchants: ["Walmart"] }));
    expect(
      calculateCard(s, c, { ...input, category: "groceries", merchant: "Walmart.com" }).reward,
    ).toBe(1);
  });
  it("excludes archived, incomplete and stale cards from current recommendations", () => {
    const s = wallet();
    s.cards = [
      { ...card, archived: true },
      { ...card, id: "incomplete", setupConfirmed: false },
      { ...card, id: "stale", reviewAfter: "2026-10-01" },
    ];
    expect(rankCards(s, input)).toEqual([]);
  });
});
