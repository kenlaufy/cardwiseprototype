import { describe, expect, it } from "vitest";
import { capUsed, rankCards, type WalletState } from "./rewards";
import { buildDemo } from "./demo";

const NOW = "2026-10-29";
const demo = () => buildDemo(NOW);

describe("reward engine", () => {
  it("grocery card with $20 cap left earns $1.80 on $100; flat 2% wins with $2", () => {
    const s = demo(); // grocer has $480 of $500 used this month
    const r = rankCards(s, { amount: 100, category: "groceries", date: NOW, channel: "in-store" });
    const groc = r.find((x) => x.card.id === "grocer")!;
    expect(groc.reward).toBe(1.8);
    expect(r[0].card.id).toBe("flat");
    expect(r[0].reward).toBe(2);
  });

  it("expired offer cannot win", () => {
    const r = rankCards(demo(), { amount: 100, category: "travel", date: NOW, channel: "online" });
    expect(r.find((x) => x.card.id === "grocer")!.reward).toBe(1);
    expect(r[0].card.id).toBe("flat");
  });

  it("unactivated offer is excluded but shown as potential", () => {
    const r = rankCards(demo(), { amount: 100, category: "dining", date: NOW, channel: "in-store" });
    const flat = r.find((x) => x.card.id === "flat")!;
    expect(flat.reward).toBe(2);
    expect(flat.potential?.reward).toBe(12);
  });

  it("unactivated rotating bonus does not apply", () => {
    const s: WalletState = { ...demo(), purchases: [] };
    const r = rankCards(s, { amount: 100, category: "dining", date: "2027-01-10", channel: "in-store" });
    expect(r.find((x) => x.card.id === "rotate")!.reward).toBe(1);
  });

  it("shared quarterly cap is consumed across categories", () => {
    const s = demo(); // $900 online + $400 gas = $1300 of $1500
    expect(capUsed(s, s.capGroups[1], NOW)).toBe(1300);
    const r = rankCards(s, { amount: 300, category: "gas", date: NOW, channel: "in-store" });
    // $200 × 5% + $100 × 1% = $11
    expect(r.find((x) => x.card.id === "rotate")!.reward).toBe(11);
  });

  it("deleting a purchase frees cap", () => {
    const s = demo();
    s.purchases = s.purchases.filter((p) => p.id !== "p2");
    const r = rankCards(s, { amount: 100, category: "groceries", date: NOW, channel: "in-store" });
    expect(r[0].card.id).toBe("grocer");
    expect(r[0].reward).toBe(5);
  });
});
