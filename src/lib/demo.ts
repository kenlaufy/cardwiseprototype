import { monthStart } from "./dates";
import { periodBounds, type WalletState } from "./rewards";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const pad = (n: number) => String(n).padStart(2, "0");
/** The user's local date. Not toISOString(), which gives the UTC date: a day ahead on US evenings. */
export const today = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (date: string, n: number) => {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

/** Fictional demo wallet, built relative to today so caps/offers always demonstrate. */
export function buildDemo(now = today()): WalletState {
  const q = periodBounds(now, "quarter");
  const m = periodBounds(now, "month");
  const nextQStart = addDays(q.end, 1);
  const nextQ = periodBounds(nextQStart, "quarter");
  // Earlier months, for spending history. None of these touch this month's or quarter's caps.
  const [m1, m2, m3] = [1, 2, 3].map((back) => monthStart(now, back)) as [string, string, string];
  const base ={ source: "demo" as const, verified: false, lastChecked: now };

  return {
    cards: [
      { id: "flat", name: "Steady 2%", issuer: "Demo Bank", color: "slate", baseRate: 2, source: "demo" },
      { id: "grocer", name: "Everyday Rewards", issuer: "Demo Credit Union", color: "emerald", baseRate: 1, annualFee: 95, source: "demo" },
      { id: "rotate", name: "Quarterly Five", issuer: "Demo Financial", color: "amber", baseRate: 1, source: "demo" },
    ],
    capGroups: [
      { id: "grocer-cap", cardId: "grocer", label: "Groceries bonus", amount: 500, period: "month" },
      { id: "rotate-cap", cardId: "rotate", label: "Rotating categories (shared)", amount: 1500, period: "quarter" },
    ],
    rules: [
      { id: "r-groc", cardId: "grocer", categories: ["groceries"], rate: 5, capGroupId: "grocer-cap", requiresActivation: false, activated: true, ...base },
      { id: "r-rot-now", cardId: "rotate", categories: ["gas", "online shopping"], rate: 5, capGroupId: "rotate-cap", startDate: q.start, endDate: q.end, requiresActivation: true, activated: true, ...base },
      { id: "r-rot-next", cardId: "rotate", categories: ["dining", "entertainment"], rate: 5, capGroupId: "rotate-cap", startDate: nextQ.start, endDate: nextQ.end, requiresActivation: true, activated: false, ...base },
    ],
    offers: [
      { id: "o-dine", cardId: "flat", title: "10% back on dining", categories: ["dining"], rate: 10, maxReward: 15, startDate: addDays(now, -10), endDate: addDays(now, 5), requiresActivation: true, activated: false, stackable: false, activationUrl: "https://example.com/activate", source: "demo" },
      { id: "o-travel", cardId: "grocer", title: "8% back on travel", categories: ["travel"], rate: 8, startDate: addDays(now, -60), endDate: addDays(now, -3), requiresActivation: false, activated: true, stackable: false, source: "demo" },
      { id: "o-stream", cardId: "rotate", title: "$5 back on streaming", categories: ["streaming"], rate: 20, maxReward: 5, startDate: addDays(now, 3), endDate: addDays(now, 40), requiresActivation: false, activated: false, stackable: true, source: "demo" },
    ],
    purchases: [
      { id: "p1", cardId: "grocer", amount: 300, category: "groceries", merchant: "Safeway", date: m.start, channel: "in-store" },
      { id: "p2", cardId: "grocer", amount: 180, category: "groceries", merchant: "Trader Joe's", date: now, channel: "in-store" },
      { id: "p3", cardId: "rotate", amount: 900, category: "online shopping", merchant: "Amazon", date: q.start, channel: "online" },
      { id: "p4", cardId: "rotate", amount: 400, category: "gas", merchant: "Shell", date: now, channel: "in-store" },
      { id: "p5", cardId: "flat", amount: 62.4, category: "dining", merchant: "Chipotle", date: now, channel: "in-store" },
      { id: "h1", cardId: "flat", amount: 15.49, category: "streaming", merchant: "Netflix", date: addDays(m1, 1), channel: "online" },
      { id: "h2", cardId: "grocer", amount: 312.4, category: "groceries", merchant: "Safeway", date: addDays(m1, 3), channel: "in-store" },
      { id: "h3", cardId: "rotate", amount: 36, category: "dining", merchant: "Chipotle", date: addDays(m1, 11), channel: "in-store" },
      { id: "h4", cardId: "flat", amount: 54.2, category: "gas", merchant: "Shell", date: addDays(m1, 17), channel: "in-store" },
      { id: "h5", cardId: "flat", amount: 15.49, category: "streaming", merchant: "Netflix", date: addDays(m2, 1), channel: "online" },
      { id: "h6", cardId: "grocer", amount: 128.99, category: "online shopping", merchant: "Amazon", date: addDays(m2, 6), channel: "online" },
      { id: "h7", cardId: "grocer", amount: 241.75, category: "groceries", merchant: "Trader Joe's", date: addDays(m2, 9), channel: "in-store" },
      { id: "h8", cardId: "grocer", amount: 22.5, category: "transit", merchant: "Uber", date: addDays(m2, 14), channel: "online" },
      { id: "h9", cardId: "flat", amount: 486, category: "travel", merchant: "Delta", date: addDays(m2, 20), channel: "online" },
      { id: "h10", cardId: "flat", amount: 15.49, category: "streaming", merchant: "Netflix", date: addDays(m3, 1), channel: "online" },
      { id: "h11", cardId: "grocer", amount: 276.3, category: "groceries", merchant: "Kroger", date: addDays(m3, 4), channel: "in-store" },
      { id: "h12", cardId: "flat", amount: 88.6, category: "dining", merchant: "Olive Garden", date: addDays(m3, 16), channel: "in-store" },
      { id: "h13", cardId: "rotate", amount: 64, category: "entertainment", merchant: "AMC", date: addDays(m3, 22), channel: "in-store" },
    ],
  };
}

export { addDays };
