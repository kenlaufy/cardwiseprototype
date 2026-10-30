import { describe, it, expect, beforeEach } from "vitest";
import {
  WalletStorage,
  emptyWallet,
  migrateWallet,
  parseWallet,
  exportBackup,
  parseBackup,
  storageKey,
  legacyKey,
  versionWallet,
} from "./persistence";
import { buildDemo } from "./demo";
import { earnedByPurchase } from "./analysis";
class MemoryStorage implements Storage {
  rows = new Map<string, string>();
  failRead = false;
  failWrite = false;
  get length() {
    return this.rows.size;
  }
  clear() {
    this.rows.clear();
  }
  key(i: number) {
    return [...this.rows.keys()][i] ?? null;
  }
  getItem(k: string) {
    if (this.failRead) throw new Error("Blocked");
    return this.rows.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.failWrite) throw new Error("Quota exceeded");
    this.rows.set(k, v);
  }
  removeItem(k: string) {
    this.rows.delete(k);
  }
}
const sample = () => ({ ...emptyWallet(), ...buildDemo("2026-10-29") });
let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
});
describe("wallet persistence and recovery", () => {
  it("migrates legacy records without erasing the original copy", () => {
    const legacy = JSON.stringify(sample());
    storage.setItem(legacyKey("local"), legacy);
    const repo = new WalletStorage(storage, "local"),
      result = repo.load(emptyWallet);
    expect(result.error).toBeUndefined();
    expect(result.data.purchases.every((p) => !!p.termsVersionId)).toBe(true);
    expect(storage.getItem(legacyKey("local"))).toBe(legacy);
    expect(storage.getItem(storageKey("local"))).not.toBeNull();
  });
  it("does not overwrite malformed storage", () => {
    storage.setItem(storageKey("local"), "{broken");
    const repo = new WalletStorage(storage, "local"),
      result = repo.load(emptyWallet);
    expect(result.error).toBeTruthy();
    expect(() => repo.save(emptyWallet())).toThrow();
    expect(storage.getItem(storageKey("local"))).toBe("{broken");
  });
  it("preserves invalid legacy JSON", () => {
    storage.setItem(legacyKey("local"), JSON.stringify({ ...sample(), cards: null }));
    const repo = new WalletStorage(storage, "local");
    expect(repo.load(emptyWallet).error).toBeTruthy();
    expect(storage.getItem(storageKey("local"))).toBeNull();
  });
  it("opens valid migrated data in memory when the first save fails", () => {
    storage.setItem(legacyKey("local"), JSON.stringify(sample()));
    storage.failWrite = true;
    const result = new WalletStorage(storage, "local").load(emptyWallet);
    expect(result.data.cards).toHaveLength(3);
    expect(result.error).toBeTruthy();
  });
  it("reports blocked storage and leaves data untouched", () => {
    storage.failRead = true;
    expect(new WalletStorage(storage, "local").load(emptyWallet).error).toBeTruthy();
    expect(storage.length).toBe(0);
  });
  it("retains a previous successful save and rejects stale tab writes", () => {
    const first = new WalletStorage(storage, "local"),
      initial = first.load(sample).data;
    const second = new WalletStorage(storage, "local");
    second.load(emptyWallet);
    first.save({ ...initial, dismissed: ["test"] });
    expect(first.previous().dismissed).toEqual([]);
    expect(() => second.save(initial)).toThrow(/another tab/);
    expect(new WalletStorage(storage, "local").load(emptyWallet).data.dismissed).toEqual(["test"]);
  });
  it("retains the last wallet when a save exceeds storage capacity", () => {
    const repo = new WalletStorage(storage, "local"),
      data = repo.load(sample).data,
      raw = repo.raw();
    storage.failWrite = true;
    expect(() => repo.save({ ...data, dismissed: ["changed"] })).toThrow();
    expect(repo.raw()).toBe(raw);
  });
  it("round trips purchases, historical terms and settings", () => {
    const data = migrateWallet(sample());
    const restored = parseBackup(exportBackup(data));
    expect(restored).toEqual(data);
    expect(earnedByPurchase(restored)).toEqual(earnedByPurchase(data));
  });
  it("accepts a validated stored recovery copy", () => {
    const repo = new WalletStorage(storage, "local"),
      data = repo.load(sample).data;
    expect(parseBackup(repo.raw())).toEqual(data);
  });
  it("rejects dangling versions, duplicate IDs, invalid dates and non-finite money", () => {
    const data = migrateWallet(sample());
    expect(() =>
      parseWallet({ ...data, purchases: [{ ...data.purchases[0], termsVersionId: "missing" }] }),
    ).toThrow();
    expect(() => parseWallet({ ...data, cards: [data.cards[0], data.cards[0]] })).toThrow();
    expect(() =>
      parseWallet({ ...data, purchases: [{ ...data.purchases[0], date: "2026-02-30" }] }),
    ).toThrow();
    expect(() =>
      parseWallet({ ...data, purchases: [{ ...data.purchases[0], amount: Infinity }] }),
    ).toThrow();
  });
  it("rejects cross-card cap references", () => {
    const data = sample();
    data.rules[0]!.capGroupId = data.capGroups[1]!.id;
    expect(() => parseWallet(data)).toThrow();
  });
  it("keeps catalog caveats and requests a review of legacy catalog cards", () => {
    const data = sample();
    data.cards[0] = {
      ...data.cards[0]!,
      source: "catalog",
      name: "Freedom Unlimited",
      issuer: "Chase",
    };
    const migrated = migrateWallet(data),
      card = migrated.cards[0]!;
    expect(card.catalogId).toBe("chase-freedom-unlimited");
    expect(card.sourceUrls?.length).toBeGreaterThan(0);
    expect(card.setupConfirmed).toBe(false);
    expect(parseBackup(exportBackup(migrated)).cards[0]?.notes).toEqual(card.notes);
  });
  it("creates a new rule version only when terms change", () => {
    const data = migrateWallet(sample());
    expect(versionWallet({ ...data, dismissed: ["new"] }).versions).toHaveLength(
      data.versions!.length,
    );
    const edited = versionWallet({
      ...data,
      cards: data.cards.map((c) => ({ ...c, baseRate: 3 })),
    });
    expect(edited.versions).toHaveLength(data.versions!.length + 1);
    expect(earnedByPurchase(edited)).toEqual(earnedByPurchase(data));
  });
  it("keeps demo, personal and recovery keys separate when deleting a wallet", () => {
    const demo = new WalletStorage(storage, "demo"),
      local = new WalletStorage(storage, "local");
    demo.load(sample);
    local.load(sample);
    local.clear();
    expect(storage.getItem(storageKey("demo"))).not.toBeNull();
    expect(storage.getItem(storageKey("local"))).toBeNull();
  });
});
