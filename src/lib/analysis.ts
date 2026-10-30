import { daysBetween, monthStart } from "./dates";
import {
  replayPurchases,
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
  return new Map([...replayPurchases(state).earned].map(([id, result]) => [id, result.reward]));
}

/** Independent alternatives using actual historical balances; never a global optimum. */
export function purchaseAlternatives(
  state: WalletState,
  purchases: Purchase[],
): Map<string, CardResult> {
  const ids = new Set(purchases.map((p) => p.id));
  return new Map([...replayPurchases(state).alternatives].filter(([id]) => ids.has(id)));
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
  independentAlternativeTotal: number;
  byCategory: {
    category: Category;
    spent: number;
    earned: number;
    bestEarned: number; // independent alternatives; not an achievable combined total
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
  const replay = replayPurchases(state);
  const earnedOf = (p: Purchase) => replay.earned.get(p.id)?.reward ?? 0;
  const ids = new Set(purchases.map((p) => p.id));
  const best = new Map([...replay.alternatives].filter(([id]) => ids.has(id)));
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
    independentAlternativeTotal: sum([...best.values()].map((r) => r.reward)),
    byCategory,
    byCard,
    byMonth,
    missed,
  };
}

export type FeeVerdict = "keep" | "borderline" | "costly" | "early";

export interface FeeCheck {
  card: Card;
  fee: number;
  since: string; // Jan 1, or the first purchase recorded this year if that's later
  days: number;
  spent: number; // on this card, this year
  earned: number;
  baseline: number; // what the same purchases would have earned without this card
  baselineLabel: string;
  perYear: { earned: number; baseline: number; extra: number }; // at this year's pace
  perks: number;
  net: number; // extra per year + perks − fee
  verdict: FeeVerdict;
}

/** Under a month of purchases is too little to judge; within ±10% of the fee (at least $15) is a toss-up. */
export function feeVerdict(net: number, fee: number, days: number): FeeVerdict {
  const margin = Math.max(15, fee * 0.1);
  if (days < 30) return "early";
  return net >= margin ? "keep" : net <= -margin ? "costly" : "borderline";
}

/**
 * For each card with an annual fee: the cash back it earned this year against what the same purchases
 * would have earned on your other cards (or a no-fee 2% card, if it's your only card), scaled to a year.
 */
export function feeChecks(state: WalletState, now: string): FeeCheck[] {
  const yearStart = `${now.slice(0, 4)}-01-01`;
  const thisYear = state.purchases.filter((p) => p.date >= yearStart && p.date <= now);
  const firstRecorded = thisYear.reduce((min, p) => (p.date < min ? p.date : min), now);
  const since = firstRecorded > yearStart ? firstRecorded : yearStart;
  const days = daysBetween(since, now) + 1;
  const scale = 365 / Math.max(days, 30);
  const earnedMap = earnedByPurchase(state);

  return state.cards
    .filter((card) => !card.archived && (card.annualFee ?? 0) > 0)
    .map((card) => {
      const fee = card.annualFee ?? 0;
      const mine = thisYear.filter((p) => p.cardId === card.id);
      const earned = sum(mine.map((p) => earnedMap.get(p.id) ?? 0));
      const others = state.cards.filter((c) => c.id !== card.id);
      const alternatives = replayPurchases(state, card.id).alternatives;
      const baseline = others.length
        ? sum(mine.map((p) => alternatives.get(p.id)?.reward ?? 0))
        : sum(mine.map((p) => round2(p.amount * 0.02)));

      const perYear = {
        earned: round2(earned * scale),
        baseline: round2(baseline * scale),
        extra: round2((earned - baseline) * scale),
      };
      const perks = card.feeReview?.perksValue ?? 0;
      const net = round2(perYear.extra + perks - fee);
      return {
        card,
        fee,
        since,
        days,
        spent: sum(mine.map((p) => p.amount)),
        earned,
        baseline,
        baselineLabel: others.length ? "your other cards" : "a no-fee 2% card",
        perYear,
        perks,
        net,
        verdict: feeVerdict(net, fee, days),
      };
    });
}
