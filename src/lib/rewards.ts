// Deterministic USD estimates. Reward arithmetic and balances use integer cents.
export const CATEGORIES = [
  "groceries",
  "dining",
  "gas",
  "travel",
  "transit",
  "online shopping",
  "entertainment",
  "streaming",
  "drugstores",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];
export type Channel = "online" | "in-store";
export type DataSource = "demo" | "manual" | "catalog" | "verified";
export type Period = "month" | "quarter" | "year";
export interface FeeReview {
  decision: "keep" | "downgrade" | "cancel" | "undecided";
  perksValue: number;
  note?: string | undefined;
  reviewedOn: string;
}
export interface Card {
  id: string;
  name: string;
  issuer: string;
  nickname?: string | undefined;
  color: string;
  baseRate: number;
  source: DataSource;
  annualFee?: number | undefined;
  feeReview?: FeeReview | undefined;
  archived?: boolean | undefined;
  catalogId?: string | undefined;
  catalogVersion?: string | undefined;
  sourceUrls?: string[] | undefined;
  notes?: string[] | undefined;
  checkedOn?: string | undefined;
  confirmedOn?: string | undefined;
  reviewAfter?: string | undefined;
  setupConfirmed?: boolean | undefined;
}
export interface CapGroup {
  id: string;
  cardId: string;
  label: string;
  amount: number;
  period: Period;
  // Usage BEFORE purchases entered on this date. Null excludes the capped bonus.
  opening?: { date: string; used: number | null; throughOrder?: number | undefined } | undefined;
}
export interface BonusRule {
  id: string;
  cardId: string;
  categories: Category[];
  rate: number;
  channel?: Channel | undefined;
  merchants?: string[] | undefined;
  excludedMerchants?: string[] | undefined;
  capGroupId?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  requiresActivation: boolean;
  activated: boolean;
  source: DataSource;
  verified: boolean;
  lastChecked: string;
}
export interface Offer {
  id: string;
  cardId: string;
  title: string;
  categories: Category[];
  merchants?: string[] | undefined;
  rate: number;
  maxReward?: number | undefined;
  limitScope?: "offer" | "purchase" | "once" | undefined;
  opening?: { date: string; used: number; throughOrder?: number | undefined } | undefined;
  startDate: string;
  endDate: string;
  requiresActivation: boolean;
  activated: boolean;
  stackable: boolean;
  activationUrl?: string | undefined;
  source: DataSource;
}
export interface Purchase {
  id: string;
  cardId: string;
  amount: number;
  category: Category;
  merchant?: string | undefined;
  date: string;
  channel: Channel;
  termsVersionId?: string | undefined;
  order?: number | undefined;
}
export interface Terms {
  cards: Card[];
  rules: BonusRule[];
  capGroups: CapGroup[];
  offers: Offer[];
}
export interface TermsVersion extends Terms {
  id: string;
  effectiveFrom: string;
}
export interface WalletState extends Terms {
  purchases: Purchase[];
  versions?: TermsVersion[] | undefined;
}
export interface PurchaseInput {
  amount: number;
  category: Category;
  merchant?: string | undefined;
  date: string;
  channel: Channel;
  id?: string | undefined;
}
export interface CardResult {
  card: Card;
  reward: number;
  effectiveRate: number;
  explanation: string;
  steps: string[];
  appliedRule?: BonusRule | undefined;
  capRemaining?: number | undefined;
  appliedOffer?: Offer | undefined;
  appliedOffers?: Offer[] | undefined;
  assumptions?: string[] | undefined;
  potential?: { reward: number; reason: string } | undefined;
}
export const cents = (n: number) => Math.round((n + Number.EPSILON) * 100);
const dollars = (n: number) => n / 100;
const round2 = (n: number) => dollars(cents(n));
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export const money = (n: number) => usd.format(n);
export const normalizeMerchant = (s?: string) => {
  const value = (s ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ");
  return (
    (
      {
        "amazon.com": "amazon",
        "whole foods market": "whole foods",
        "trader joes": "trader joe's",
        "wal-mart": "walmart",
        "walmart.com": "walmart",
        "target.com": "target",
        "costco.com": "costco",
        "chase travel portal": "chase travel",
      } as Record<string, string>
    )[value] ?? value
  );
};
export function inDateRange(date: string, start?: string, end?: string) {
  return (!start || date >= start) && (!end || date <= end);
}
export function periodBounds(date: string, period: Period): { start: string; end: string } {
  const [y = 1970, m = 1] = date.split("-").map(Number);
  const sm = period === "year" ? 1 : period === "quarter" ? Math.floor((m - 1) / 3) * 3 + 1 : m;
  const em = period === "year" ? 12 : period === "quarter" ? sm + 2 : m;
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${y}-${p(sm)}-01`,
    end: `${y}-${p(em)}-${new Date(Date.UTC(y, em, 0)).getUTCDate()}`,
  };
}
export function nextReset(date: string, period: Period) {
  const d = new Date(periodBounds(date, period).end + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
const merchantMatches = (list: string[], merchant?: string) =>
  list.some((m) => normalizeMerchant(m) === normalizeMerchant(merchant));
function ruleMatches(rule: BonusRule, p: PurchaseInput) {
  return (
    rule.categories.includes(p.category) &&
    (!rule.channel || rule.channel === p.channel) &&
    inDateRange(p.date, rule.startDate, rule.endDate) &&
    (!rule.merchants?.length || merchantMatches(rule.merchants, p.merchant)) &&
    (!rule.excludedMerchants?.length || !merchantMatches(rule.excludedMerchants, p.merchant))
  );
}
const ruleActive = (r: BonusRule) => !r.requiresActivation || r.activated;
const offerMatches = (o: Offer, p: PurchaseInput) =>
  inDateRange(p.date, o.startDate, o.endDate) &&
  (!o.categories.length || o.categories.includes(p.category)) &&
  (!o.merchants?.length || merchantMatches(o.merchants, p.merchant));
export const termsForPurchase = (state: WalletState, purchase: Purchase): Terms =>
  state.versions?.find((v) => v.id === purchase.termsVersionId) ?? state;
export const orderedPurchases = (purchases: Purchase[]) =>
  purchases
    .map((p, i) => ({ p, i }))
    .sort(
      (a, b) =>
        a.p.date.localeCompare(b.p.date) || (a.p.order ?? a.i) - (b.p.order ?? b.i) || a.i - b.i,
    )
    .map((x) => ({ ...x.p, order: x.p.order ?? x.i }));
export function cardReady(card: Card, date: string) {
  return (
    !card.archived &&
    card.setupConfirmed !== false &&
    (!card.reviewAfter || date <= card.reviewAfter)
  );
}
type Timeline = { date: string; order: number; total: number }[];
interface Ledger {
  caps: Map<string, Timeline>;
  offers: Map<string, Timeline>;
}
const newLedger = (): Ledger => ({ caps: new Map(), offers: new Map() });
function append(map: Map<string, Timeline>, key: string, date: string, value: number, order = 0) {
  const rows = map.get(key) ?? [];
  rows.push({ date, order, total: (rows.at(-1)?.total ?? 0) + value });
  map.set(key, rows);
}
function totalSince(
  map: Map<string, Timeline>,
  key: string,
  from: string,
  throughOrder = -Infinity,
) {
  const rows = map.get(key) ?? [];
  let lo = 0,
    hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (rows[mid]!.date < from || (rows[mid]!.date === from && rows[mid]!.order < throughOrder))
      lo = mid + 1;
    else hi = mid;
  }
  return (rows.at(-1)?.total ?? 0) - (rows[lo - 1]?.total ?? 0);
}
const capKey = (g: CapGroup, date: string) => `${g.id}:${periodBounds(date, g.period).start}`;
const offerKey = (o: Offer) => o.id;
function usedCap(ledger: Ledger, g: CapGroup, date: string) {
  const { start, end } = periodBounds(date, g.period);
  const opening =
    g.opening && inDateRange(g.opening.date, start, end) && g.opening.date <= date
      ? g.opening
      : undefined;
  if (opening?.used === null) return cents(g.amount);
  return Math.min(
    cents(g.amount),
    cents(opening?.used ?? 0) +
      totalSince(ledger.caps, capKey(g, date), opening?.date ?? start, opening?.throughOrder),
  );
}
function offerValue(ledger: Ledger, o: Offer, amount: number, date: string) {
  const opening = o.opening && o.opening.date <= date ? o.opening : undefined;
  const used =
    cents(opening?.used ?? 0) +
    totalSince(ledger.offers, offerKey(o), opening?.date ?? "0001-01-01", opening?.throughOrder);
  if (o.limitScope === "once" && used > 0) return 0;
  const remaining =
    o.maxReward == null
      ? Infinity
      : Math.max(0, cents(o.maxReward) - (o.limitScope === "purchase" ? 0 : used));
  return Math.min(Math.round((cents(amount) * o.rate) / 100), remaining);
}
function evaluate(
  terms: Terms,
  card: Card,
  p: PurchaseInput,
  ledger: Ledger,
  showPotential = true,
): CardResult {
  const amount = Number.isFinite(p.amount) ? Math.max(0, cents(p.amount)) : 0;
  const rules = terms.rules.filter((r) => r.cardId === card.id && ruleMatches(r, p));
  const active = rules.filter(ruleActive);
  const remaining = new Map(
    terms.capGroups
      .filter((g) => g.cardId === card.id)
      .map((g) => [g.id, Math.max(0, cents(g.amount) - usedCap(ledger, g, p.date))]),
  );
  const boundaries = [
    ...new Set([
      0,
      amount,
      ...active.flatMap((r) =>
        r.capGroupId ? [Math.min(amount, remaining.get(r.capGroupId) ?? 0)] : [],
      ),
    ]),
  ].sort((a, b) => a - b);
  let rawReward = 0;
  const steps: string[] = [];
  let appliedRule: BonusRule | undefined;
  for (let i = 1; i < boundaries.length; i++) {
    const start = boundaries[i - 1]!,
      spend = boundaries[i]! - start;
    const rule = active
      .filter((r) => !r.capGroupId || (remaining.get(r.capGroupId) ?? 0) > start)
      .sort((a, b) => b.rate - a.rate)[0];
    const rate = Math.max(card.baseRate, rule?.rate ?? 0);
    if (rule && rate > card.baseRate && !appliedRule) appliedRule = rule;
    rawReward += (spend * rate) / 100;
    if (spend > 0) steps.push(`${money(dollars(spend))} at ${rate}%`);
  }
  const bonusReward = Math.round(rawReward),
    baseReward = Math.round((amount * card.baseRate) / 100);
  steps.push(`${money(dollars(bonusReward))} in card rewards (rounded once)`);
  const offers = terms.offers.filter((o) => o.cardId === card.id && offerMatches(o, p));
  const activeOffers = offers.filter((o) => !o.requiresActivation || o.activated);
  let appliedOffers = activeOffers.filter(
    (o) => o.stackable && offerValue(ledger, o, dollars(amount), p.date) > 0,
  );
  let total =
    bonusReward +
    appliedOffers.reduce((sum, o) => sum + offerValue(ledger, o, dollars(amount), p.date), 0);
  let finalSteps = [
    ...steps,
    ...appliedOffers.map(
      (o) =>
        `+ ${money(dollars(offerValue(ledger, o, dollars(amount), p.date)))} from “${o.title}”`,
    ),
  ];
  for (const o of activeOffers.filter((o) => !o.stackable)) {
    const value = offerValue(ledger, o, dollars(amount), p.date);
    if (baseReward + value > total) {
      total = baseReward + value;
      appliedRule = undefined;
      appliedOffers = [o];
      finalSteps = [
        `${money(dollars(amount))} × ${card.baseRate}% base = ${money(dollars(baseReward))}`,
        `+ ${money(dollars(value))} from “${o.title}” (exclusive)`,
      ];
    }
  }
  const assumptions = terms.capGroups
    .filter(
      (g) =>
        g.cardId === card.id &&
        g.opening?.used === null &&
        periodBounds(g.opening.date, g.period).start === periodBounds(p.date, g.period).start &&
        g.opening.date <= p.date,
    )
    .map((g) => `“${g.label}” usage is unknown; its capped bonus is excluded.`);
  let potential: CardResult["potential"];
  if (showPotential) {
    for (const rule of rules.filter((r) => !ruleActive(r))) {
      const trial = evaluate(
        {
          ...terms,
          rules: terms.rules.map((r) => (r.id === rule.id ? { ...r, activated: true } : r)),
        },
        card,
        p,
        ledger,
        false,
      );
      if (trial.reward > dollars(total) && (!potential || trial.reward > potential.reward))
        potential = {
          reward: trial.reward,
          reason: `Activate the ${rule.rate}% ${rule.categories.join("/")} bonus`,
        };
    }
    for (const offer of offers.filter((o) => o.requiresActivation && !o.activated)) {
      const trial = evaluate(
        {
          ...terms,
          offers: terms.offers.map((o) => (o.id === offer.id ? { ...o, activated: true } : o)),
        },
        card,
        p,
        ledger,
        false,
      );
      if (trial.reward > dollars(total) && (!potential || trial.reward > potential.reward))
        potential = { reward: trial.reward, reason: `Activate offer “${offer.title}”` };
    }
  }
  const capRemaining = appliedRule?.capGroupId
    ? dollars(Math.max(0, (remaining.get(appliedRule.capGroupId) ?? 0) - amount))
    : undefined;
  const explanation = appliedRule
    ? `Uses eligible ${p.category} rates, including ${appliedRule.rate}%${capRemaining != null ? "; capped spending falls back to the next eligible rate" : ""}.`
    : `${card.baseRate}% base cash back.`;
  return {
    card,
    reward: dollars(total),
    effectiveRate: amount ? round2((total / amount) * 100) : 0,
    explanation:
      explanation +
      (appliedOffers.length
        ? ` Includes ${appliedOffers.map((o) => `“${o.title}”`).join(", ")}.`
        : ""),
    steps: finalSteps,
    appliedRule,
    capRemaining,
    appliedOffer: appliedOffers[0],
    appliedOffers,
    assumptions,
    potential,
  };
}
function consume(ledger: Ledger, terms: Terms, p: Purchase, result: CardResult) {
  for (const g of terms.capGroups.filter((g) => g.cardId === p.cardId))
    if (terms.rules.some((r) => r.capGroupId === g.id && ruleActive(r) && ruleMatches(r, p)))
      append(ledger.caps, capKey(g, p.date), p.date, cents(p.amount), p.order);
  for (const o of result.appliedOffers ?? [])
    append(ledger.offers, offerKey(o), p.date, offerValue(ledger, o, p.amount, p.date), p.order);
}
function priorPurchases(state: WalletState, p: PurchaseInput) {
  const ordered = orderedPurchases(state.purchases);
  const index = p.id ? ordered.findIndex((x) => x.id === p.id) : -1;
  return ordered.filter(
    (x, i) => x.id !== p.id && (x.date < p.date || (x.date === p.date && (index < 0 || i < index))),
  );
}
function ledgerBefore(state: WalletState, p: PurchaseInput) {
  const ledger = newLedger();
  for (const purchase of priorPurchases(state, p)) {
    const terms = termsForPurchase(state, purchase),
      card = terms.cards.find((c) => c.id === purchase.cardId);
    if (card) consume(ledger, terms, purchase, evaluate(terms, card, purchase, ledger, false));
  }
  return ledger;
}
export function capUsed(
  state: WalletState,
  group: CapGroup,
  date: string,
  excludePurchaseId?: string,
) {
  return dollars(
    usedCap(
      ledgerBefore(state, {
        amount: 0,
        category: "other",
        channel: "in-store",
        date,
        id: excludePurchaseId,
      }),
      group,
      date,
    ),
  );
}
export function calculateCard(state: WalletState, card: Card, p: PurchaseInput) {
  return evaluate(state, card, p, ledgerBefore(state, p));
}
export function rankCards(state: WalletState, p: PurchaseInput) {
  const ledger = ledgerBefore(state, p);
  return state.cards
    .filter((c) => cardReady(c, p.date))
    .map((c) => evaluate(state, c, p, ledger))
    .sort((a, b) => b.reward - a.reward || a.card.name.localeCompare(b.card.name));
}
// Alternatives are independent: switching one purchase can affect later rewards.
export function replayPurchases(state: WalletState, excludeCardId?: string) {
  const ledger = newLedger(),
    earned = new Map<string, CardResult>(),
    alternatives = new Map<string, CardResult>();
  for (const p of orderedPurchases(state.purchases)) {
    const terms = termsForPurchase(state, p),
      card = terms.cards.find((c) => c.id === p.cardId);
    if (!card) continue;
    const actual = evaluate(terms, card, p, ledger, false);
    earned.set(p.id, actual);
    const best = terms.cards
      .filter((c) => c.id !== excludeCardId && !c.archived && c.setupConfirmed !== false)
      .map((c) => evaluate(terms, c, p, ledger, false))
      .sort((a, b) => b.reward - a.reward || a.card.name.localeCompare(b.card.name))[0];
    if (best) alternatives.set(p.id, best);
    consume(ledger, terms, p, actual);
  }
  return { earned, alternatives };
}
export const MERCHANT_HINTS: Record<string, Category> = {
  "whole foods": "groceries",
  "trader joe's": "groceries",
  safeway: "groceries",
  kroger: "groceries",
  shell: "gas",
  chevron: "gas",
  exxon: "gas",
  starbucks: "dining",
  chipotle: "dining",
  amazon: "online shopping",
  uber: "transit",
  lyft: "transit",
  delta: "travel",
  netflix: "streaming",
  spotify: "streaming",
  hulu: "streaming",
  cvs: "drugstores",
  walgreens: "drugstores",
  costco: "other",
  target: "other",
  walmart: "other",
};
export function merchantCertainty(merchant: string | undefined, category: Category) {
  const m = normalizeMerchant(merchant),
    hint = MERCHANT_HINTS[m];
  if (!m)
    return {
      certain: false as const,
      reason: `Assumes ${category}. Merchant coding and card exclusions may change the reward.`,
    };
  if (!hint)
    return {
      certain: false as const,
      reason: `Issuer coding for “${merchant}” is unknown. Assumes ${category}.`,
    };
  if (hint !== category)
    return {
      certain: false as const,
      reason: `“${merchant}” is often coded as ${hint}, rather than ${category}.`,
      hint,
    };
  return {
    certain: false as const,
    reason: `“${merchant}” is usually ${hint}. Your issuer decides the final category.`,
    hint,
  };
}
