import type { BonusRule, CapGroup, Card, Category, Channel, Period } from "./rewards";
import { today } from "./demo";

// Published U.S. card terms, checked against issuer pages and card reviews. Issuers change
// terms (and rotating categories every quarter), so users must confirm against their own card.
export const CATALOG_CHECKED = "2026-10-29";

const Q4_2026 = { startDate: "2026-10-01", endDate: "2026-12-31" };

export interface CatalogRule {
  categories: Category[];
  rate: number;
  cap?: string; // id of a cap in the same entry; rules pointing at one cap share it
  merchants?: string[];
  excludedMerchants?: string[];
  channel?: Channel;
  startDate?: string;
  endDate?: string;
  requiresActivation?: boolean;
}

export interface CatalogCard {
  id: string;
  name: string;
  issuer: string;
  color: string;
  baseRate: number;
  annualFee: number;
  summary: string;
  notes?: string[]; // terms the engine can't model, or choices the cardholder has to make
  caps?: { id: string; label: string; amount: number; period: Period }[];
  rules: CatalogRule[];
  sourceUrls?: string[];
  supported?: boolean;
  generic?: boolean; // a starting template, not a real product
}

export const CATALOG: CatalogCard[] = [
  {
    id: "wf-active-cash",
    name: "Active Cash",
    issuer: "Wells Fargo",
    color: "rose",
    baseRate: 2,
    annualFee: 0,
    summary: "2% on everything",
    rules: [],
  },
  {
    id: "citi-double-cash",
    name: "Double Cash",
    issuer: "Citi",
    color: "slate",
    baseRate: 2,
    annualFee: 0,
    summary: "2% on everything (1% when you buy, 1% when you pay)",
    notes: [
      "The 5% Citi Travel bonus isn't included: sources disagree on whether it's still offered.",
    ],
    rules: [],
  },
  {
    id: "c1-quicksilver",
    name: "Quicksilver",
    issuer: "Capital One",
    color: "ink",
    baseRate: 1.5,
    annualFee: 0,
    summary: "1.5% on everything · 5% hotels & rental cars via Capital One Travel",
    notes: ["The 5% travel rate counts when the merchant is Capital One Travel."],
    rules: [{ categories: ["travel"], rate: 5, merchants: ["Capital One Travel"] }],
  },
  {
    id: "c1-savor",
    name: "Savor",
    issuer: "Capital One",
    color: "amber",
    baseRate: 1,
    annualFee: 0,
    summary: "3% dining, groceries, entertainment & streaming · 1% else",
    notes: [
      "The grocery rate excludes superstores like Walmart and Target.",
      "8% on Capital One Entertainment and 5% on Capital One Travel hotels & rental cars count when that's the merchant.",
    ],
    rules: [
      { categories: ["dining", "groceries", "entertainment", "streaming"], rate: 3 },
      { categories: ["entertainment"], rate: 8, merchants: ["Capital One Entertainment"] },
      { categories: ["travel"], rate: 5, merchants: ["Capital One Travel"] },
    ],
  },
  {
    id: "chase-freedom-unlimited",
    name: "Freedom Unlimited",
    issuer: "Chase",
    color: "teal",
    baseRate: 1.5,
    annualFee: 0,
    summary: "3% dining & drugstores · 5% Chase Travel · 1.5% else",
    notes: [
      "Earns Ultimate Rewards points, worth 1¢ each as cash back.",
      "The 5% travel rate counts when the merchant is Chase Travel.",
    ],
    rules: [
      { categories: ["dining", "drugstores"], rate: 3 },
      { categories: ["travel"], rate: 5, merchants: ["Chase Travel"] },
    ],
  },
  {
    id: "chase-freedom-flex",
    name: "Freedom Flex",
    issuer: "Chase",
    color: "teal",
    baseRate: 1,
    annualFee: 0,
    summary: "5% rotating (Q4 2026: groceries & dining) · 3% dining & drugstores · 1% else",
    notes: [
      "Q4 2026 (Oct 1 – Dec 31): 5% at grocery stores and the American Red Cross, and 7% on dining (its usual 3% plus the bonus), on up to $1,500 combined. Activate with Chase by Dec 14, then mark it activated here.",
      "The grocery bonus excludes Walmart and Target. Red Cross donations aren't modeled.",
      "Categories change every quarter, so update this card when they do.",
    ],
    caps: [{ id: "q", label: "Q4 2026 bonus (shared)", amount: 1500, period: "quarter" }],
    rules: [
      { categories: ["groceries"], rate: 5, cap: "q", requiresActivation: true, ...Q4_2026 },
      { categories: ["dining"], rate: 7, cap: "q", requiresActivation: true, ...Q4_2026 },
      { categories: ["dining", "drugstores"], rate: 3 },
      { categories: ["travel"], rate: 5, merchants: ["Chase Travel"] },
    ],
  },
  {
    id: "chase-prime-visa",
    name: "Prime Visa",
    issuer: "Chase",
    color: "slate",
    baseRate: 1,
    annualFee: 0,
    summary: "5% Amazon, Whole Foods & Chase Travel · 2% gas, dining & transit · 1% else",
    notes: [
      "5% needs an eligible Prime membership (3% without).",
      "The 5% rate counts when the merchant is Amazon, Amazon Fresh, Whole Foods or Chase Travel.",
    ],
    rules: [
      {
        categories: ["online shopping", "groceries"],
        rate: 5,
        merchants: ["Amazon", "Amazon.com", "Amazon Fresh", "Whole Foods"],
      },
      { categories: ["travel"], rate: 5, merchants: ["Chase Travel"] },
      { categories: ["gas", "dining", "transit"], rate: 2 },
    ],
  },
  {
    id: "discover-it-cash-back",
    name: "Discover it Cash Back",
    issuer: "Discover",
    color: "amber",
    baseRate: 1,
    annualFee: 0,
    summary: "5% rotating (Q4 2026: restaurants & entertainment) · 1% else",
    notes: [
      "Q4 2026 (Oct 1 – Dec 31): 5% on restaurants, entertainment and utilities, on up to $1,500 combined. Activate with Discover, then mark it activated here.",
      "Entertainment excludes streaming. Utilities aren't modeled.",
      "Categories change every quarter, so update this card when they do.",
    ],
    caps: [{ id: "q", label: "Q4 2026 5% (shared)", amount: 1500, period: "quarter" }],
    rules: [
      {
        categories: ["dining", "entertainment"],
        rate: 5,
        cap: "q",
        requiresActivation: true,
        ...Q4_2026,
      },
    ],
  },
  {
    id: "amex-blue-cash-preferred",
    name: "Blue Cash Preferred",
    issuer: "American Express",
    color: "emerald",
    baseRate: 1,
    annualFee: 95,
    summary: "6% U.S. supermarkets & streaming · 3% gas & transit · 1% else",
    notes: [
      "6% at supermarkets on up to $6,000 a year, then 1%.",
      "$0 intro annual fee the first year, then $95.",
      "U.S. purchases only. Superstores and warehouse clubs usually don't count as supermarkets.",
    ],
    caps: [{ id: "s", label: "Supermarkets 6%", amount: 6000, period: "year" }],
    rules: [
      { categories: ["groceries"], rate: 6, cap: "s" },
      { categories: ["streaming"], rate: 6 },
      { categories: ["gas", "transit"], rate: 3 },
    ],
  },
  {
    id: "amex-blue-cash-everyday",
    name: "Blue Cash Everyday",
    issuer: "American Express",
    color: "teal",
    baseRate: 1,
    annualFee: 0,
    summary: "3% U.S. supermarkets, gas & online retail · 1% else",
    notes: [
      "Each 3% category is capped at $6,000 a year, then 1%.",
      "U.S. purchases only. Warehouse clubs don't count as supermarkets.",
    ],
    caps: [
      { id: "s", label: "Supermarkets 3%", amount: 6000, period: "year" },
      { id: "g", label: "Gas 3%", amount: 6000, period: "year" },
      { id: "o", label: "Online retail 3%", amount: 6000, period: "year" },
    ],
    rules: [
      { categories: ["groceries"], rate: 3, cap: "s" },
      { categories: ["gas"], rate: 3, cap: "g" },
      { categories: ["online shopping"], rate: 3, cap: "o" },
    ],
  },
  {
    id: "boa-customized-cash",
    name: "Customized Cash Rewards",
    issuer: "Bank of America",
    color: "rose",
    baseRate: 1,
    annualFee: 0,
    summary: "3% in a category you choose · 2% groceries & wholesale clubs · 1% else",
    notes: [
      "Set the 3% rule to your chosen category: gas & EV charging (the default), online shopping, dining, travel, drugstores or home improvement. You can change it once a month.",
      "The 3% and 2% rates share $2,500 in purchases per quarter, then 1%.",
      "The first-year 6% intro rate isn't included.",
    ],
    caps: [{ id: "c", label: "3% & 2% combined", amount: 2500, period: "quarter" }],
    rules: [
      { categories: ["gas"], rate: 3, cap: "c" },
      { categories: ["groceries"], rate: 2, cap: "c" },
      {
        categories: ["groceries", "other"],
        rate: 2,
        cap: "c",
        merchants: ["Costco", "Sam's Club", "BJ's"],
      },
    ],
  },
  {
    id: "usbank-cash-plus",
    name: "Cash+",
    issuer: "U.S. Bank",
    color: "ink",
    baseRate: 1,
    annualFee: 0,
    summary: "5% in two categories you choose · 2% in one everyday category · 1% else",
    notes: [
      "Choose two 5% categories each quarter (for example TV, internet & streaming; ground transportation; movie theaters; fast food) and set the 5% rule to match. They share $2,000 per quarter.",
      "Choose one 2% category: gas & EV charging, grocery stores or restaurants.",
      "You have to enroll in categories with U.S. Bank each quarter.",
    ],
    caps: [{ id: "c", label: "5% categories (shared)", amount: 2000, period: "quarter" }],
    rules: [
      { categories: ["streaming", "transit"], rate: 5, cap: "c", requiresActivation: true },
      { categories: ["groceries"], rate: 2 },
    ],
  },
  {
    id: "citi-custom-cash",
    name: "Custom Cash",
    issuer: "Citi",
    color: "emerald",
    baseRate: 1,
    annualFee: 0,
    summary: "5% on your top eligible category each billing cycle (up to $500) · 1% else",
    notes: [
      "5% goes to whichever eligible category you spend most in each billing cycle: restaurants, gas, groceries, select travel and transit, streaming, drugstores, home improvement, fitness clubs or live entertainment. Set the 5% rule to your usual top category.",
      "The $500 cap follows your billing cycle, which may not line up with calendar months.",
      "Reportedly closed to new applicants since May 2026. Existing cards still earn.",
    ],
    caps: [{ id: "c", label: "Top category 5%", amount: 500, period: "month" }],
    rules: [{ categories: ["dining"], rate: 5, cap: "c" }],
  },
  {
    id: "citi-costco-anywhere",
    name: "Costco Anywhere Visa",
    issuer: "Citi",
    color: "slate",
    baseRate: 1,
    annualFee: 0,
    summary: "5% Costco gas · 4% other gas & EV · 3% dining & travel · 2% Costco · 1% else",
    notes: [
      "Needs a Costco membership.",
      "Gas and EV charging rates apply to the first $7,000 a year, then 1%.",
      "Rewards arrive once a year as a certificate.",
    ],
    caps: [{ id: "g", label: "Gas & EV (shared)", amount: 7000, period: "year" }],
    rules: [
      { categories: ["gas"], rate: 5, cap: "g", merchants: ["Costco", "Costco Gas"] },
      { categories: ["gas"], rate: 4, cap: "g" },
      { categories: ["dining", "travel"], rate: 3 },
      {
        categories: ["groceries", "online shopping", "other"],
        rate: 2,
        merchants: ["Costco", "Costco.com"],
      },
    ],
  },

  {
    id: "generic-flat-2",
    name: "Flat 2% Cash Back",
    issuer: "Any issuer",
    color: "slate",
    baseRate: 2,
    annualFee: 0,
    summary: "2% on everything",
    rules: [],
    generic: true,
  },
  {
    id: "generic-flat-1-5",
    name: "Flat 1.5% Cash Back",
    issuer: "Any issuer",
    color: "ink",
    baseRate: 1.5,
    annualFee: 0,
    summary: "1.5% on everything",
    rules: [],
    generic: true,
  },
  {
    id: "generic-grocery-6",
    name: "Grocery 6% (capped yearly)",
    issuer: "Any issuer",
    color: "emerald",
    baseRate: 1,
    annualFee: 0,
    summary: "6% groceries up to $6,000 a year · 1% else",
    caps: [{ id: "c", label: "groceries bonus", amount: 6000, period: "year" }],
    rules: [{ categories: ["groceries"], rate: 6, cap: "c" }],
    generic: true,
  },
  {
    id: "generic-dining-3",
    name: "Dining & Entertainment 3%",
    issuer: "Any issuer",
    color: "rose",
    baseRate: 1,
    annualFee: 0,
    summary: "3% dining & entertainment · 1% else",
    rules: [{ categories: ["dining", "entertainment"], rate: 3 }],
    generic: true,
  },
  {
    id: "generic-gas-4",
    name: "Gas & Transit 4%",
    issuer: "Any issuer",
    color: "amber",
    baseRate: 1,
    annualFee: 0,
    summary: "4% gas & transit · 1% else",
    rules: [{ categories: ["gas", "transit"], rate: 4 }],
    generic: true,
  },
  {
    id: "generic-online-5",
    name: "Online Shopping 5% (quarterly)",
    issuer: "Any issuer",
    color: "teal",
    baseRate: 1,
    annualFee: 0,
    summary: "5% online shopping up to $1,500 a quarter · 1% else",
    caps: [{ id: "c", label: "online shopping bonus", amount: 1500, period: "quarter" }],
    rules: [{ categories: ["online shopping"], rate: 5, cap: "c" }],
    generic: true,
  },
];

// Only templates checked against primary issuer sources are offered in beta.
// Complex legacy templates remain available to existing wallets for review.
const CHECKED_SOURCES: Record<string, string[]> = {
  "wf-active-cash": ["https://creditcards.wellsfargo.com/active-cash-credit-card/"],
  "chase-freedom-unlimited": [
    "https://www.chase.com/personal/credit-cards/freedom/unlimited",
    "https://asset.chase.com/content/dam/card/rulesregulations/en/RPA0509_Web.pdf",
  ],
};
for (const entry of CATALOG) {
  entry.supported = !!CHECKED_SOURCES[entry.id];
  entry.sourceUrls = CHECKED_SOURCES[entry.id] ?? [];
  if (entry.supported)
    entry.notes = [
      ...(entry.notes ?? []),
      "Eligible retail purchases only. Cash advances, fees, interest, welcome bonuses, refunds and foreign transaction costs are not modeled. Check your own account terms.",
    ];
}
export const BETA_CATALOG = CATALOG.filter((c) => c.supported || c.generic);

export interface CatalogDraft {
  card: Card;
  rules: BonusRule[];
  caps: CapGroup[];
  notes: string[];
}

/** A new, unsaved card built from a catalog entry. Activation-only bonuses start inactive. */
export function catalogDraft(t: CatalogCard, makeId: () => string): CatalogDraft {
  const id = makeId();
  const source = t.generic ? "manual" : "catalog";
  const lastChecked = t.generic ? today() : CATALOG_CHECKED;
  const capIds = new Map((t.caps ?? []).map((c) => [c.id, makeId()]));
  const caps: CapGroup[] = (t.caps ?? []).map((c) => ({
    id: capIds.get(c.id)!,
    cardId: id,
    label: c.label,
    amount: c.amount,
    period: c.period,
    opening: { date: today(), used: null },
  }));
  const rules: BonusRule[] = t.rules.map((r) => ({
    id: makeId(),
    cardId: id,
    categories: [...r.categories],
    rate: r.rate,
    channel: r.channel,
    merchants: r.merchants && [...r.merchants],
    excludedMerchants: r.excludedMerchants && [...r.excludedMerchants],
    capGroupId: r.cap && capIds.get(r.cap),
    startDate: r.startDate,
    endDate: r.endDate,
    requiresActivation: r.requiresActivation ?? false,
    activated: false,
    source,
    verified: false,
    lastChecked,
  }));
  return {
    card: {
      id,
      name: t.name,
      issuer: t.issuer,
      color: t.color,
      baseRate: t.baseRate,
      annualFee: t.annualFee || undefined,
      source,
      catalogId: t.generic ? undefined : t.id,
      catalogVersion: CATALOG_CHECKED,
      sourceUrls: t.sourceUrls ?? [],
      notes: t.notes ?? [],
      checkedOn: t.supported ? CATALOG_CHECKED : undefined,
      setupConfirmed: t.generic ? true : false,
    },
    rules,
    caps,
    notes: t.notes ?? [],
  };
}
