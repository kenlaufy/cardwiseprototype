import { CATALOG, catalogDraft, type CatalogCard } from "./catalog";
import { daysBetween, monthStart } from "./dates";
import {
  calculateCard,
  rankCards,
  type Card,
  type CardResult,
  type Category,
  type Purchase,
  type WalletState,
} from "./rewards";

// Spending and reward analysis over recorded purchases. Estimates only, like the rest of the engine.

export const RANGES = [
  { id: "month", label: "This month", months: 1 },
  { id: "3m", label: "3 months", months: 3 },
  { id: "12m", label: "12 months", months: 12 },
  { id: "all", label: "All time", months: 0 },
] as const;
export type RangeId = (typeof RANGES)[number]["id"];

const round2 = (n: number) => Math.round(n * 100) / 100;
const sum = (xs: number[]) => round2(xs.reduce((s, x) => s + x, 0));

/** Cash back each purchase earned on the card it went on, counting caps used by earlier purchases only. */
export function earnedByPurchase(state: WalletState): Map<string, number> {
  const order = new Map(state.purchases.map((p, i) => [p.id, i]));
  const out = new Map<string, number>();
  for (const p of state.purchases) {
    const card = state.cards.find((c) => c.id === p.cardId);
    if (!card) {
      out.set(p.id, 0);
      continue;
    }
    const prior = state.purchases.filter(
      (x) =>
        x.id !== p.id &&
        (x.date < p.date || (x.date === p.date && order.get(x.id)! < order.get(p.id)!)),
    );
    out.set(p.id, calculateCard({ ...state, purchases: prior }, card, p).reward);
  }
  return out;
}

/** Replays purchases in date order, putting each on whichever card earns most, so caps fill up as they would have. */
export function bestCase(state: WalletState, purchases: Purchase[]): Map<string, CardResult> {
  const placed: Purchase[] = [];
  const sim: WalletState = { ...state, purchases: placed };
  const out = new Map<string, CardResult>();
  for (const p of [...purchases].sort((a, b) => a.date.localeCompare(b.date))) {
    const best = rankCards(sim, p)[0];
    if (!best) continue;
    out.set(p.id, best);
    placed.push({ ...p, cardId: best.card.id });
  }
  return out;
}

export interface Missed {
  purchase: Purchase;
  earned: number;
  best: CardResult;
}

export interface Analysis {
  start: string;
  days: number;
  purchases: Purchase[];
  spent: number;
  earned: number;
  bestTotal: number;
  byCategory: {
    category: Category;
    spent: number;
    earned: number;
    bestEarned: number; // using the best card every time
    count: number;
    usedCardId: string; // the card most of this category's spending went on
    bestCardId: string; // the card that would have earned most on most of it
  }[];
  byCard: { card: Card; spent: number; earned: number; count: number }[];
  byMonth: { month: string; spent: number; earned: number }[];
  missed: Missed[];
}

export function analyze(state: WalletState, range: RangeId, now: string): Analysis {
  const months = RANGES.find((r) => r.id === range)?.months ?? 0;
  const past = state.purchases.filter((p) => p.date <= now);
  const earliest = past.reduce((min, p) => (p.date < min ? p.date : min), now);
  const start = months ? monthStart(now, months - 1) : monthStart(earliest);
  const purchases = past.filter((p) => p.date >= start);
  const earnedMap = earnedByPurchase(state);
  const earnedOf = (p: Purchase) => earnedMap.get(p.id) ?? 0;
  const best = bestCase(state, purchases);
  const bestOf = (p: Purchase) => best.get(p.id);
  // The card carrying the most spending among these purchases.
  const topCard = (ps: Purchase[], cardOf: (p: Purchase) => string | undefined) => {
    const spend = new Map<string, number>();
    for (const p of ps) {
      const id = cardOf(p);
      if (id) spend.set(id, (spend.get(id) ?? 0) + p.amount);
    }
    return [...spend].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  };

  const categories = [...new Set(purchases.map((p) => p.category))];
  const byCategory = categories
    .map((category) => {
      const ps = purchases.filter((p) => p.category === category);
      return {
        category,
        spent: sum(ps.map((p) => p.amount)),
        earned: sum(ps.map(earnedOf)),
        bestEarned: sum(ps.map((p) => bestOf(p)?.reward ?? 0)),
        count: ps.length,
        usedCardId: topCard(ps, (p) => p.cardId),
        bestCardId: topCard(ps, (p) => bestOf(p)?.card.id),
      };
    })
    .sort((a, b) => b.spent - a.spent);

  const byCard = state.cards
    .map((card) => {
      const ps = purchases.filter((p) => p.cardId === card.id);
      return {
        card,
        spent: sum(ps.map((p) => p.amount)),
        earned: sum(ps.map(earnedOf)),
        count: ps.length,
      };
    })
    .sort((a, b) => b.spent - a.spent);

  const [sy = 1970, sm = 1] = start.split("-").map(Number);
  const [ny = 1970, nm = 1] = now.split("-").map(Number);
  const monthCount = ny * 12 + nm - (sy * 12 + sm) + 1;
  const byMonth = Array.from({ length: monthCount }, (_, i) => {
    const month = monthStart(now, monthCount - 1 - i).slice(0, 7);
    const ps = purchases.filter((p) => p.date.startsWith(month));
    return { month, spent: sum(ps.map((p) => p.amount)), earned: sum(ps.map(earnedOf)) };
  });

  const missed = purchases
    .flatMap((p) => {
      const b = best.get(p.id);
      return b && b.card.id !== p.cardId && b.reward - earnedOf(p) >= 0.01
        ? [{ purchase: p, earned: earnedOf(p), best: b }]
        : [];
    })
    .sort((a, b) => b.best.reward - b.earned - (a.best.reward - a.earned));

  return {
    start,
    days: daysBetween(start, now) + 1,
    purchases,
    spent: sum(purchases.map((p) => p.amount)),
    earned: sum(purchases.map(earnedOf)),
    bestTotal: sum([...best.values()].map((r) => r.reward)),
    byCategory,
    byCard,
    byMonth,
    missed,
  };
}

export interface Upside {
  entry: CatalogCard;
  extra: number; // more cash back on these purchases, using the best card each time
  perYear: number;
  net: number; // per year, after the annual fee
}

/**
 * How much more each catalog card would have earned on these purchases if it were in the wallet,
 * assuming you'd activate its bonuses and always use your best card. Scaled to a year.
 */
export function catalogUpside(state: WalletState, purchases: Purchase[], days: number): Upside[] {
  if (!purchases.length) return [];
  const base = sum([...bestCase(state, purchases).values()].map((r) => r.reward));
  const owned = new Set(state.cards.map((c) => `${c.issuer}|${c.name}`.toLowerCase()));
  let n = 0;
  const makeId = () => `sim-${++n}`;
  return CATALOG.filter((t) => !t.generic && !owned.has(`${t.issuer}|${t.name}`.toLowerCase()))
    .map((entry) => {
      const d = catalogDraft(entry, makeId);
      const sim: WalletState = {
        ...state,
        cards: [...state.cards, d.card],
        rules: [...state.rules, ...d.rules.map((r) => ({ ...r, activated: true }))],
        capGroups: [...state.capGroups, ...d.caps],
      };
      const extra = round2(sum([...bestCase(sim, purchases).values()].map((r) => r.reward)) - base);
      const perYear = round2((extra * 365) / Math.max(days, 30));
      return { entry, extra, perYear, net: round2(perYear - entry.annualFee) };
    })
    .filter((u) => u.extra > 0 && u.net > 0)
    .sort((a, b) => b.net - a.net);
}
