// Deterministic cash-back engine. No AI, no randomness. All money in USD.

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

export interface Card {
  id: string;
  name: string;
  issuer: string;
  nickname?: string | undefined;
  color: string; // one of CARD_COLORS keys
  baseRate: number; // percent, e.g. 1 = 1%
  source: DataSource;
}

export interface CapGroup {
  id: string;
  cardId: string;
  label: string;
  amount: number; // max bonus-eligible spend per period
  period: Period;
}

export interface BonusRule {
  id: string;
  cardId: string;
  categories: Category[];
  rate: number; // percent
  channel?: Channel | undefined; // undefined = any
  merchants?: string[] | undefined; // if set, purchase merchant must match
  capGroupId?: string | undefined;
  startDate?: string | undefined; // YYYY-MM-DD inclusive
  endDate?: string | undefined; // inclusive
  requiresActivation: boolean;
  activated: boolean; // only true after user confirmation
  source: DataSource;
  verified: boolean;
  lastChecked: string; // ISO
}

export interface Offer {
  id: string;
  cardId: string;
  title: string;
  categories: Category[];
  merchants?: string[] | undefined;
  rate: number; // extra percent
  maxReward?: number | undefined; // dollars
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
}

export interface WalletState {
  cards: Card[];
  rules: BonusRule[];
  capGroups: CapGroup[];
  offers: Offer[];
  purchases: Purchase[];
}

export interface PurchaseInput {
  amount: number;
  category: Category;
  merchant?: string | undefined;
  date: string;
  channel: Channel;
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
  potential?: { reward: number; reason: string } | undefined; // value if inactive bonus/offer were activated
}

const round2 = (n: number) => Math.round(n * 100) / 100;
export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const norm = (s?: string) => (s ?? "").trim().toLowerCase();

export function inDateRange(date: string, start?: string, end?: string) {
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

export function periodBounds(date: string, period: Period): { start: string; end: string } {
  const [y = 1970, m = 1] = date.split("-").map(Number);
  let sm = m,
    em = m;
  if (period === "quarter") {
    sm = Math.floor((m - 1) / 3) * 3 + 1;
    em = sm + 2;
  } else if (period === "year") {
    sm = 1;
    em = 12;
  }
  const lastDay = new Date(Date.UTC(y, em, 0)).getUTCDate();
  const p = (n: number) => String(n).padStart(2, "0");
  return { start: `${y}-${p(sm)}-01`, end: `${y}-${p(em)}-${p(lastDay)}` };
}

export function nextReset(date: string, period: Period): string {
  const { end } = periodBounds(date, period);
  const d = new Date(end + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function ruleMatches(rule: BonusRule, p: PurchaseInput) {
  if (!rule.categories.includes(p.category)) return false;
  if (rule.channel && rule.channel !== p.channel) return false;
  if (!inDateRange(p.date, rule.startDate, rule.endDate)) return false;
  if (rule.merchants?.length && !rule.merchants.some((m) => norm(m) === norm(p.merchant)))
    return false;
  return true;
}

const ruleActive = (r: BonusRule) => !r.requiresActivation || r.activated;

/** Bonus-eligible spend already used in the cap group's period containing `date`. */
export function capUsed(
  state: WalletState,
  group: CapGroup,
  date: string,
  excludePurchaseId?: string,
): number {
  const { start, end } = periodBounds(date, group.period);
  const groupRules = state.rules.filter((r) => r.capGroupId === group.id);
  let used = 0;
  const purchases = state.purchases
    .filter((p) => p.cardId === group.cardId && p.id !== excludePurchaseId)
    .filter((p) => p.date >= start && p.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const p of purchases) {
    if (groupRules.some((r) => ruleActive(r) && ruleMatches(r, p))) {
      used = Math.min(group.amount, used + p.amount);
    }
  }
  return used;
}

function bonusReward(
  state: WalletState,
  card: Card,
  rule: BonusRule,
  p: PurchaseInput,
): { reward: number; capRemaining?: number; steps: string[] } {
  const group = rule.capGroupId
    ? state.capGroups.find((g) => g.id === rule.capGroupId)
    : undefined;
  if (!group) {
    const reward = (p.amount * rule.rate) / 100;
    return { reward, steps: [`${money(p.amount)} × ${rule.rate}% = ${money(reward)}`] };
  }
  const remaining = Math.max(0, group.amount - capUsed(state, group, p.date));
  const bonusAmt = Math.min(p.amount, remaining);
  const rest = p.amount - bonusAmt;
  const reward = (bonusAmt * rule.rate) / 100 + (rest * card.baseRate) / 100;
  const steps = [
    `${money(remaining)} left in "${group.label}" cap (${money(group.amount)} per ${group.period})`,
    `${money(bonusAmt)} × ${rule.rate}% = ${money((bonusAmt * rule.rate) / 100)}`,
  ];
  if (rest > 0)
    steps.push(`${money(rest)} beyond cap × ${card.baseRate}% base = ${money((rest * card.baseRate) / 100)}`);
  return { reward, capRemaining: remaining - bonusAmt, steps };
}

function offerMatches(o: Offer, p: PurchaseInput) {
  if (!inDateRange(p.date, o.startDate, o.endDate)) return false;
  const catOk = o.categories.length === 0 || o.categories.includes(p.category);
  const merchOk =
    !o.merchants?.length || o.merchants.some((m) => norm(m) === norm(p.merchant));
  return catOk && merchOk;
}

function offerValue(o: Offer, amount: number) {
  const v = (amount * o.rate) / 100;
  return o.maxReward != null ? Math.min(v, o.maxReward) : v;
}

export function calculateCard(state: WalletState, card: Card, p: PurchaseInput): CardResult {
  const amount = Math.max(0, p.amount || 0);
  const input = { ...p, amount };
  const rules = state.rules.filter((r) => r.cardId === card.id && ruleMatches(r, input));
  const active = rules.filter(ruleActive);
  const inactive = rules.filter((r) => !ruleActive(r));

  const baseReward = (amount * card.baseRate) / 100;
  let best = {
    reward: baseReward,
    rule: undefined as BonusRule | undefined,
    capRemaining: undefined as number | undefined,
    steps: [`${money(amount)} × ${card.baseRate}% base = ${money(baseReward)}`],
  };
  for (const r of active) {
    const b = bonusReward(state, card, r, input);
    if (b.reward > best.reward) best = { reward: b.reward, rule: r, capRemaining: b.capRemaining, steps: b.steps };
  }

  // Offers: stackable ones add on top; non-stackable ones replace the bonus (take best).
  const offers = state.offers.filter((o) => o.cardId === card.id && offerMatches(o, input));
  const activeOffers = offers.filter((o) => !o.requiresActivation || o.activated);
  const inactiveOffers = offers.filter((o) => o.requiresActivation && !o.activated);

  let total = best.reward;
  let steps = [...best.steps];
  let appliedOffer: Offer | undefined;
  const stackable = activeOffers.filter((o) => o.stackable);
  const exclusive = activeOffers.filter((o) => !o.stackable);
  const bestStack = stackable.sort((a, b) => offerValue(b, amount) - offerValue(a, amount))[0];
  if (bestStack) {
    const v = offerValue(bestStack, amount);
    total += v;
    appliedOffer = bestStack;
    steps.push(`+ offer "${bestStack.title}": ${money(v)} (stacks)`);
  }
  for (const o of exclusive) {
    const alt = baseReward + offerValue(o, amount);
    if (alt > total) {
      total = alt;
      appliedOffer = o;
      best = { ...best, rule: undefined, capRemaining: undefined };
      steps = [
        `${money(amount)} × ${card.baseRate}% base = ${money(baseReward)}`,
        `+ offer "${o.title}": ${money(offerValue(o, amount))} (does not stack with bonuses)`,
      ];
    }
  }

  // Potential value if user activated something
  let potential: CardResult["potential"];
  for (const r of inactive) {
    const v = bonusReward(state, card, r, input).reward;
    if (v > total && (!potential || v > potential.reward))
      potential = { reward: round2(v), reason: `Activate the ${r.rate}% ${r.categories.join("/")} bonus` };
  }
  for (const o of inactiveOffers) {
    const v = o.stackable ? total + offerValue(o, amount) : baseReward + offerValue(o, amount);
    if (v > total && (!potential || v > potential.reward))
      potential = { reward: round2(v), reason: `Activate offer "${o.title}"` };
  }

  const reward = round2(total);
  let explanation: string;
  if (appliedOffer && !best.rule) {
    explanation = `${card.baseRate}% base plus the "${appliedOffer.title}" offer.`;
  } else if (best.rule) {
    explanation = `${best.rule.rate}% on ${p.category}`;
    if (best.capRemaining != null)
      explanation +=
        best.capRemaining > 0
          ? `, with ${money(best.capRemaining)} remaining before your bonus cap.`
          : `, but this purchase reaches your bonus cap — the rest earns ${card.baseRate}%.`;
    else explanation += ".";
    if (appliedOffer) explanation += ` Plus "${appliedOffer.title}".`;
  } else {
    explanation = `${card.baseRate}% base cash back — no active bonus for ${p.category}.`;
  }

  return {
    card,
    reward,
    effectiveRate: amount > 0 ? round2((reward / amount) * 100) : 0,
    explanation,
    steps,
    appliedRule: best.rule,
    capRemaining: best.capRemaining,
    appliedOffer,
    potential,
  };
}

export function rankCards(state: WalletState, p: PurchaseInput): CardResult[] {
  return state.cards
    .map((c) => calculateCard(state, c, p))
    .sort((a, b) => b.reward - a.reward || a.card.name.localeCompare(b.card.name));
}

/** Known merchant → category hints. Never treated as a guarantee. */
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
  const m = norm(merchant);
  if (!m) return { certain: true as const };
  const hint = MERCHANT_HINTS[m];
  if (!hint) return { certain: false as const, reason: `We don't know how "${merchant}" is coded by issuers.` };
  if (hint !== category)
    return { certain: false as const, reason: `"${merchant}" is often coded as ${hint}, not ${category}.`, hint };
  return { certain: true as const };
}
