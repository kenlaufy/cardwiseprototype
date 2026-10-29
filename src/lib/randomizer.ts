import { addDays } from "./demo";
import { daysBetween, monthStart } from "./dates";
import { rankCards, type Category, type Channel, type Purchase, type WalletState } from "./rewards";

// Random but realistic purchases, so people can play with the app without typing in their own.

/** Small seeded PRNG (mulberry32): the same seed always gives the same sequence. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Merchants agree with MERCHANT_HINTS where it knows them, so random purchases never look miscategorized.
const SPEND: Record<
  Category,
  { merchants: string[]; min: number; max: number; channel: Channel | "either" }
> = {
  groceries: {
    merchants: ["Safeway", "Trader Joe's", "Kroger", "Whole Foods"],
    min: 25,
    max: 180,
    channel: "in-store",
  },
  dining: {
    merchants: ["Chipotle", "Starbucks", "Olive Garden", "Sweetgreen", "Shake Shack"],
    min: 8,
    max: 95,
    channel: "in-store",
  },
  gas: {
    merchants: ["Shell", "Chevron", "Exxon", "Costco Gas"],
    min: 30,
    max: 75,
    channel: "in-store",
  },
  travel: {
    merchants: ["Delta", "United", "Marriott", "Airbnb"],
    min: 150,
    max: 900,
    channel: "online",
  },
  transit: { merchants: ["Uber", "Lyft", "Metro"], min: 8, max: 45, channel: "either" },
  "online shopping": {
    merchants: ["Amazon", "Etsy", "Best Buy"],
    min: 15,
    max: 220,
    channel: "online",
  },
  entertainment: {
    merchants: ["AMC", "Ticketmaster", "Bowlero"],
    min: 15,
    max: 120,
    channel: "either",
  },
  streaming: { merchants: ["Netflix", "Spotify", "Hulu"], min: 8, max: 23, channel: "online" },
  drugstores: { merchants: ["CVS", "Walgreens"], min: 8, max: 60, channel: "in-store" },
  other: {
    merchants: ["Target", "Walmart", "Home Depot", "Costco"],
    min: 12,
    max: 160,
    channel: "in-store",
  },
};

export interface Persona {
  id: string;
  label: string;
  blurb: string;
  weights: Partial<Record<Category, number>>;
  perMonth: [number, number]; // purchases a month, min and max
}

export const PERSONAS: Persona[] = [
  {
    id: "balanced",
    label: "All-rounder",
    blurb: "A bit of everything",
    weights: {
      groceries: 4,
      dining: 3,
      gas: 2,
      "online shopping": 2,
      transit: 1,
      entertainment: 1,
      drugstores: 1,
      other: 2,
      travel: 0.3,
    },
    perMonth: [9, 14],
  },
  {
    id: "foodie",
    label: "Foodie",
    blurb: "Eats out a lot",
    weights: {
      dining: 7,
      groceries: 3,
      entertainment: 1.5,
      transit: 1.5,
      "online shopping": 1,
      other: 1,
    },
    perMonth: [12, 18],
  },
  {
    id: "commuter",
    label: "Commuter",
    blurb: "Lots of gas and rides",
    weights: { gas: 5, transit: 3, dining: 2, groceries: 3, other: 1 },
    perMonth: [10, 15],
  },
  {
    id: "family",
    label: "Family shopper",
    blurb: "Big grocery and household runs",
    weights: { groceries: 6, other: 3, drugstores: 2, gas: 2, "online shopping": 2, dining: 1 },
    perMonth: [10, 16],
  },
  {
    id: "online",
    label: "Online shopper",
    blurb: "Most things arrive in a box",
    weights: { "online shopping": 6, groceries: 2, dining: 1.5, entertainment: 1, other: 1 },
    perMonth: [9, 14],
  },
  {
    id: "traveler",
    label: "Traveler",
    blurb: "Flights, hotels and meals out",
    weights: { travel: 2.5, dining: 3.5, transit: 2, groceries: 2, gas: 1, "online shopping": 1 },
    perMonth: [8, 12],
  },
];

const pick = <T>(rand: () => number, xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;

function weighted(rand: () => number, weights: Partial<Record<Category, number>>): Category {
  const entries = Object.entries(weights) as [Category, number][];
  let r = rand() * entries.reduce((s, [, w]) => s + w, 0);
  for (const [c, w] of entries) if ((r -= w) < 0) return c;
  return entries[entries.length - 1]![0];
}

/** One random purchase in a category (or a category picked by the persona's habits). */
export function randomPurchase(
  rand: () => number,
  persona: Persona = PERSONAS[0]!,
  category?: Category,
) {
  const cat = category ?? weighted(rand, persona.weights);
  const s = SPEND[cat];
  // Skewed toward smaller amounts, like real spending.
  const amount = Math.round((s.min + (s.max - s.min) * rand() ** 1.6) * 100) / 100;
  const channel: Channel =
    s.channel === "either" ? (rand() < 0.5 ? "online" : "in-store") : s.channel;
  return { amount, category: cat, merchant: pick(rand, s.merchants), channel };
}

/**
 * Six months of purchases (up to today) for a persona, put on the wallet's cards. Most go on the best
 * card at the time, the rest on a random one, so there's some cash back left behind to find.
 */
export function randomPurchases(
  state: WalletState,
  now: string,
  seed: number,
  personaId?: string,
): { persona: Persona; purchases: Purchase[] } {
  const rand = seededRandom(seed);
  const persona = PERSONAS.find((p) => p.id === personaId) ?? pick(rand, PERSONAS);
  if (!state.cards.length) return { persona, purchases: [] };

  const drafts: Omit<Purchase, "id" | "cardId">[] = [];
  const subscriptions = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => ({
    ...randomPurchase(rand, persona, "streaming"),
    day: Math.floor(rand() * 28),
  }));
  for (let back = 5; back >= 0; back--) {
    const start = monthStart(now, back);
    const end = back === 0 ? now : addDays(monthStart(now, back - 1), -1);
    const days = daysBetween(start, end) + 1;
    const [lo, hi] = persona.perMonth;
    const full = lo + Math.floor(rand() * (hi - lo + 1));
    const count = back === 0 ? Math.round((full * days) / 30) : full;
    for (let i = 0; i < count; i++)
      drafts.push({
        ...randomPurchase(rand, persona),
        date: addDays(start, Math.floor(rand() * days)),
      });
    for (const sub of subscriptions)
      if (sub.day < days) {
        const { day, ...p } = sub;
        drafts.push({ ...p, date: addDays(start, day) });
      }
  }

  const placed: Purchase[] = [];
  const sim: WalletState = { ...state, purchases: placed };
  drafts
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((p, i) => {
      const best = rankCards(sim, p)[0]!;
      const card = rand() < 0.7 ? best.card : pick(rand, state.cards);
      placed.push({ ...p, id: `r${seed.toString(36)}-${i}`, cardId: card.id });
    });
  return { persona, purchases: placed };
}
