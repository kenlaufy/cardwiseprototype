import { describe, expect, it } from "vitest";
import { CATALOG, catalogDraft } from "./catalog";
import { CATEGORIES, calculateCard, type PurchaseInput, type WalletState } from "./rewards";

let n = 0;
const makeId = () => `id${++n}`;
const NOW = "2026-11-15";

function walletWith(catalogId: string) {
  const entry = CATALOG.find((t) => t.id === catalogId);
  if (!entry) throw new Error(`No catalog entry ${catalogId}`);
  const d = catalogDraft(entry, makeId);
  const state: WalletState = {
    cards: [d.card],
    rules: d.rules,
    capGroups: d.caps,
    offers: [],
    purchases: [],
  };
  const earn = (p: Pick<PurchaseInput, "amount" | "category"> & Partial<PurchaseInput>) =>
    calculateCard(state, d.card, { date: NOW, channel: "in-store", ...p });
  const spend = (p: Pick<PurchaseInput, "amount" | "category" | "date"> & Partial<PurchaseInput>) =>
    state.purchases.push({ id: makeId(), cardId: d.card.id, channel: "in-store", ...p });
  const activateAll = () => {
    state.rules = state.rules.map((r) => (r.requiresActivation ? { ...r, activated: true } : r));
  };
  return { d, earn, spend, activateAll };
}

describe("card catalog", () => {
  it("every entry passes the card editor's checks", () => {
    expect(new Set(CATALOG.map((t) => t.id)).size).toBe(CATALOG.length);
    for (const t of CATALOG) {
      const capIds = (t.caps ?? []).map((c) => c.id);
      expect(t.baseRate, t.id).toBeGreaterThanOrEqual(0);
      expect(t.baseRate, t.id).toBeLessThanOrEqual(20);
      for (const c of t.caps ?? []) expect(c.amount, t.id).toBeGreaterThan(0);
      for (const r of t.rules) {
        expect(r.categories.length, t.id).toBeGreaterThan(0);
        for (const c of r.categories) expect(CATEGORIES, t.id).toContain(c);
        expect(r.rate, t.id).toBeGreaterThan(0);
        expect(r.rate, t.id).toBeLessThanOrEqual(30);
        if (r.cap) expect(capIds, t.id).toContain(r.cap);
        if (r.startDate && r.endDate) expect(r.endDate >= r.startDate, t.id).toBe(true);
      }
    }
  });

  it("drafts link rules to their caps and never start activated", () => {
    for (const t of CATALOG) {
      const d = catalogDraft(t, makeId);
      const capIds = d.caps.map((c) => c.id);
      expect(d.card.source).toBe(t.generic ? "manual" : "catalog");
      for (const r of d.rules) {
        expect(r.cardId).toBe(d.card.id);
        expect(r.activated).toBe(false);
        if (r.capGroupId) expect(capIds).toContain(r.capGroupId);
      }
      expect(d.rules.filter((r) => r.capGroupId).length).toBe(t.rules.filter((r) => r.cap).length);
    }
  });

  it("Blue Cash Preferred: 6% groceries until the $6,000 yearly cap", () => {
    const w = walletWith("amex-blue-cash-preferred");
    expect(w.earn({ amount: 100, category: "groceries" }).reward).toBe(6);
    expect(w.earn({ amount: 20, category: "streaming" }).reward).toBe(1.2);
    w.spend({ amount: 6000, category: "groceries", date: "2026-03-01" });
    expect(w.earn({ amount: 100, category: "groceries" }).reward).toBe(1);
  });

  it("Freedom Flex: Q4 2026 bonus only counts once activated, and only in Q4", () => {
    const w = walletWith("chase-freedom-flex");
    const before = w.earn({ amount: 100, category: "dining" });
    expect(before.reward).toBe(3);
    expect(before.potential?.reward).toBe(7);
    w.activateAll();
    expect(w.earn({ amount: 100, category: "dining" }).reward).toBe(7);
    expect(w.earn({ amount: 100, category: "groceries" }).reward).toBe(5);
    expect(w.earn({ amount: 100, category: "groceries", date: "2027-01-10" }).reward).toBe(1);
  });

  it("Prime Visa: 5% needs an Amazon or Whole Foods merchant", () => {
    const w = walletWith("chase-prime-visa");
    expect(w.earn({ amount: 100, category: "online shopping", merchant: "Amazon" }).reward).toBe(5);
    expect(w.earn({ amount: 100, category: "groceries", merchant: "whole foods" }).reward).toBe(5);
    expect(w.earn({ amount: 100, category: "online shopping" }).reward).toBe(1);
    expect(w.earn({ amount: 50, category: "dining" }).reward).toBe(1);
  });

  it("Costco Anywhere: 5% gas at Costco, 4% elsewhere", () => {
    const w = walletWith("citi-costco-anywhere");
    expect(w.earn({ amount: 100, category: "gas", merchant: "Costco" }).reward).toBe(5);
    expect(w.earn({ amount: 100, category: "gas", merchant: "Shell" }).reward).toBe(4);
  });

  it("Customized Cash: 3% and 2% share one $2,500 quarterly cap", () => {
    const w = walletWith("boa-customized-cash");
    w.spend({ amount: 2000, category: "groceries", date: "2026-10-05" });
    // $500 left in the cap: $500 × 3% + $500 × 1% = $20
    expect(w.earn({ amount: 1000, category: "gas" }).reward).toBe(20);
  });
});

describe("catalog fees", () => {
  it("carries the annual fee onto the card", () => {
    const fee = (id: string) =>
      catalogDraft(
        CATALOG.find((t) => t.id === id)!,
        makeId,
      ).card.annualFee;
    expect(fee("amex-blue-cash-preferred")).toBe(95);
    expect(fee("wf-active-cash")).toBeUndefined();
  });
});
