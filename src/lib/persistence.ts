import { z } from "zod";
import { CATEGORIES, type Terms, type WalletState, type TermsVersion } from "./rewards";
import { CATALOG, BETA_CATALOG, CATALOG_CHECKED } from "./catalog";
import { today } from "./demo";

export type Mode = "demo" | "local";
export interface Prefs {
  activation: boolean;
  expiring: boolean;
  caps: boolean;
  categoryChanges: boolean;
}
export interface Persisted extends WalletState {
  dismissed: string[];
  prefs: Prefs;
  demoPersona?: string | undefined;
}
export const emptyWallet = (): Persisted => ({
  cards: [],
  rules: [],
  capGroups: [],
  offers: [],
  purchases: [],
  versions: [],
  dismissed: [],
  prefs: { activation: true, expiring: true, caps: true, categoryChanges: true },
});
export const uid = () => crypto.randomUUID();
export const isDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  Number(s.slice(0, 4)) > 0 &&
  Number.isFinite(Date.parse(s + "T00:00:00Z")) &&
  new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
const date = z.string().refine(isDate, "Enter a valid date");
const id = z.string().min(1).max(120);
const text = z.string().max(1000);
const amount = z
  .number()
  .finite()
  .min(0)
  .max(1_000_000)
  .refine(
    (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001,
    "Use at most two decimal places",
  );
const rate = z.number().finite().min(0).max(100);
const source = z.enum(["demo", "manual", "catalog", "verified"]);
const strings = z.array(text).max(200);
const url = z
  .string()
  .url()
  .refine((s) => new URL(s).protocol === "https:", "Use an HTTPS link");
const categories = z.array(z.enum(CATEGORIES)).max(CATEGORIES.length);
const cardSchema = z.object({
  id,
  name: z.string().trim().min(1).max(50),
  issuer: z.string().max(50),
  nickname: z.string().max(30).optional(),
  color: z.enum(["emerald", "teal", "slate", "amber", "rose", "ink"]),
  baseRate: rate,
  source,
  annualFee: amount.optional(),
  archived: z.boolean().optional(),
  catalogId: id.optional(),
  catalogVersion: text.optional(),
  sourceUrls: z.array(url).max(20).optional(),
  notes: strings.optional(),
  checkedOn: date.optional(),
  confirmedOn: date.optional(),
  reviewAfter: date.optional(),
  setupConfirmed: z.boolean().optional(),
  feeReview: z
    .object({
      decision: z.enum(["keep", "downgrade", "cancel", "undecided"]),
      perksValue: amount,
      note: text.optional(),
      reviewedOn: date,
    })
    .optional(),
});
const capSchema = z
  .object({
    id,
    cardId: id,
    label: z.string().min(1).max(100),
    amount: amount.positive(),
    period: z.enum(["month", "quarter", "year"]),
    opening: z
      .object({
        date,
        used: amount.nullable(),
        throughOrder: z.number().int().nonnegative().optional(),
      })
      .optional(),
  })
  .refine(
    (g) => g.opening?.used == null || g.opening.used <= g.amount,
    "Opening usage exceeds the cap",
  );
const ruleSchema = z
  .object({
    id,
    cardId: id,
    categories: categories.min(1),
    rate,
    channel: z.enum(["online", "in-store"]).optional(),
    merchants: strings.optional(),
    excludedMerchants: strings.optional(),
    capGroupId: id.optional(),
    startDate: date.optional(),
    endDate: date.optional(),
    requiresActivation: z.boolean(),
    activated: z.boolean(),
    source,
    verified: z.boolean(),
    lastChecked: z.string().refine((s) => isDate(s.slice(0, 10))),
  })
  .refine(
    (r) => !r.startDate || !r.endDate || r.endDate >= r.startDate,
    "Rule ends before it starts",
  );
const offerSchema = z
  .object({
    id,
    cardId: id,
    title: z.string().trim().min(1).max(60),
    categories,
    merchants: strings.optional(),
    rate: rate.positive(),
    maxReward: amount.positive().optional(),
    limitScope: z.enum(["offer", "purchase", "once"]).optional(),
    opening: z
      .object({ date, used: amount, throughOrder: z.number().int().nonnegative().optional() })
      .optional(),
    startDate: date,
    endDate: date,
    requiresActivation: z.boolean(),
    activated: z.boolean(),
    stackable: z.boolean(),
    activationUrl: url.optional(),
    source,
  })
  .refine((o) => o.endDate >= o.startDate, "Offer ends before it starts");
const termsShape = {
  cards: z.array(cardSchema).max(100),
  rules: z.array(ruleSchema).max(1000),
  capGroups: z.array(capSchema).max(500),
  offers: z.array(offerSchema).max(1000),
};
const versionSchema = z.object({ ...termsShape, id, effectiveFrom: date });
const purchaseSchema = z.object({
  id,
  cardId: id,
  amount: amount
    .positive()
    .refine(
      (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001,
      "Use at most two decimal places",
    ),
  category: z.enum(CATEGORIES),
  merchant: z.string().max(60).optional(),
  date,
  channel: z.enum(["online", "in-store"]),
  termsVersionId: id.optional(),
  order: z.number().int().nonnegative().optional(),
});
const walletSchema = z.object({
  ...termsShape,
  purchases: z.array(purchaseSchema).max(20000),
  versions: z.array(versionSchema).max(2000).default([]),
  dismissed: z.array(id).max(20000).default([]),
  prefs: z
    .object({
      activation: z.boolean(),
      expiring: z.boolean(),
      caps: z.boolean(),
      categoryChanges: z.boolean(),
    })
    .default({ activation: true, expiring: true, caps: true, categoryChanges: true }),
  demoPersona: text.optional(),
});
function unique(values: { id: string }[]) {
  if (new Set(values.map((v) => v.id)).size !== values.length)
    throw new Error("Duplicate record identifiers in wallet");
}
function checkTerms(terms: Terms) {
  for (const rows of [terms.cards, terms.rules, terms.capGroups, terms.offers]) unique(rows);
  const cards = new Set(terms.cards.map((c) => c.id));
  for (const row of [...terms.rules, ...terms.capGroups, ...terms.offers])
    if (!cards.has(row.cardId)) throw new Error("A record refers to a missing card");
  for (const rule of terms.rules)
    if (
      rule.capGroupId &&
      !terms.capGroups.some((g) => g.id === rule.capGroupId && g.cardId === rule.cardId)
    )
      throw new Error("A bonus refers to a missing or different card’s cap");
}
export function parseWallet(input: unknown): Persisted {
  const data = walletSchema.parse(input) as Persisted;
  checkTerms(data);
  unique(data.purchases);
  unique(data.versions ?? []);
  for (const version of data.versions ?? []) checkTerms(version);
  for (const p of data.purchases) {
    const terms = p.termsVersionId ? data.versions?.find((v) => v.id === p.termsVersionId) : data;
    if (!terms?.cards.some((c) => c.id === p.cardId))
      throw new Error("A purchase refers to missing card terms");
  }
  return data;
}
export const currentTerms = (s: Terms): Terms => ({
  cards: s.cards,
  rules: s.rules,
  capGroups: s.capGroups,
  offers: s.offers,
});
export function versionWallet(s: Persisted): Persisted {
  const terms = currentTerms(s),
    versions = s.versions ?? [],
    last = versions.at(-1);
  if (last && JSON.stringify(currentTerms(last)) === JSON.stringify(terms)) return s;
  const version: TermsVersion = { ...structuredClone(terms), id: uid(), effectiveFrom: today() };
  return { ...s, versions: [...versions, version] };
}
export function migrateWallet(input: unknown): Persisted {
  let data = parseWallet(input);
  data = versionWallet(data);
  const versionId = data.versions!.at(-1)!.id;
  // Existing estimates are preserved against the terms available at migration.
  data = {
    ...data,
    purchases: data.purchases.map((p, i) => ({
      ...p,
      termsVersionId: p.termsVersionId ?? versionId,
      order: p.order ?? i,
    })),
    cards: data.cards.map((c) => {
      if (c.source !== "catalog") return c;
      const entry = CATALOG.find(
        (t) => t.id === c.catalogId || (!c.catalogId && t.name === c.name && t.issuer === c.issuer),
      );
      if (!c.catalogId)
        return {
          ...c,
          catalogId: entry?.id ?? "legacy-custom",
          catalogVersion: CATALOG_CHECKED,
          notes: c.notes ?? entry?.notes ?? [],
          sourceUrls: entry?.sourceUrls ?? [],
          checkedOn: entry?.supported ? CATALOG_CHECKED : undefined,
          setupConfirmed: false,
        };
      return BETA_CATALOG.some((t) => t.id === c.catalogId && !t.generic)
        ? c
        : { ...c, setupConfirmed: false };
    }),
  };
  return versionWallet(data);
}
export const storageKey = (mode: Mode) => `cardwise:${mode}:v2`;
export const legacyKey = (mode: Mode) => `cardwise:${mode}:v1`;
export const MODE_KEY = "cardwise:mode";
export class WalletStorage {
  revision: string | null = null;
  blocked = false;
  constructor(
    private storage: Storage,
    readonly mode: Mode,
  ) {}
  load(fallback: () => Persisted): { data: Persisted; error?: string } {
    try {
      const raw = this.storage.getItem(storageKey(this.mode));
      if (raw) {
        const envelope = z
          .object({ format: z.literal(2), revision: id, data: walletSchema })
          .parse(JSON.parse(raw));
        const data = migrateWallet(envelope.data);
        this.revision = envelope.revision;
        return { data };
      }
      const legacy = this.storage.getItem(legacyKey(this.mode));
      const data = migrateWallet(legacy ? JSON.parse(legacy) : fallback());
      try {
        this.save(data);
        return { data };
      } catch {
        return {
          data,
          error:
            "Your wallet is open, but browser storage could not save it. Export a backup or retry saving.",
        };
      }
    } catch {
      this.blocked = true;
      return {
        data: emptyWallet(),
        error:
          "Wallet data could not be opened safely. It has been kept untouched. Export the stored copy or restore a backup in Data & privacy.",
      };
    }
  }
  save(data: Persisted, replace = false) {
    if (this.blocked && !replace)
      throw new Error("Stored data is protected. Restore a backup to replace it.");
    const validated = parseWallet(data),
      key = storageKey(this.mode),
      raw = this.storage.getItem(key);
    let storedRevision: string | null = null;
    if (raw) {
      try {
        storedRevision = JSON.parse(raw).revision;
      } catch {
        if (!replace)
          throw new Error("Stored data is unreadable. Export it before restoring a backup.");
      }
    }
    if (!replace && storedRevision !== this.revision)
      throw new Error(
        "This wallet changed in another tab. Export your unsaved changes, then reload to use the latest copy.",
      );
    // Keep the previous successful copy. Never clear current data on save failure.
    if (raw) this.storage.setItem(`${key}:previous`, raw);
    const revision = uid();
    this.storage.setItem(key, JSON.stringify({ format: 2, revision, data: validated }));
    this.revision = revision;
    this.blocked = false;
  }
  raw() {
    return (
      this.storage.getItem(storageKey(this.mode)) ??
      this.storage.getItem(legacyKey(this.mode)) ??
      ""
    );
  }
  previous(): Persisted {
    const raw = this.storage.getItem(`${storageKey(this.mode)}:previous`);
    if (!raw) throw new Error("No previous saved copy is available.");
    return migrateWallet(JSON.parse(raw).data);
  }
  clear() {
    for (const key of [
      storageKey(this.mode),
      `${storageKey(this.mode)}:previous`,
      legacyKey(this.mode),
    ])
      this.storage.removeItem(key);
    this.revision = null;
    this.blocked = false;
  }
}
export function exportBackup(data: Persisted) {
  return JSON.stringify(
    {
      application: "CardWise",
      format: 2,
      exportedAt: new Date().toISOString(),
      data: parseWallet(data),
    },
    null,
    2,
  );
}
export function parseBackup(text: string): Persisted {
  if (text.length > 15_000_000) throw new Error("This backup is too large (15 MB maximum).");
  const input = JSON.parse(text);
  if (
    input?.format === 2 &&
    (input.application === "CardWise" || typeof input.revision === "string")
  )
    return migrateWallet(input.data);
  return migrateWallet(input);
}
