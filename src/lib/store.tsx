import { StoreCtx } from "./store-context";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { BonusRule, CapGroup, Card, Offer, Purchase } from "./rewards";
import { buildDemo, today } from "./demo";
import { PERSONAS, randomPurchases, type Persona } from "./randomizer";
import {
  emptyWallet,
  versionWallet,
  migrateWallet,
  parseWallet,
  WalletStorage,
  exportBackup,
  MODE_KEY,
  storageKey,
  type Mode,
  type Persisted,
  type Prefs,
} from "./persistence";
export { uid } from "./persistence";
export type { Mode, Prefs } from "./persistence";

export interface Ctx {
  ready: boolean;
  mode: Mode | null;
  state: Persisted;
  storageError: string | null;
  unsaved: boolean;
  recoveryRequired: boolean;
  start: (m: Mode) => void;
  exit: () => void;
  resetDemo: () => void;
  shuffleDemo: () => Persona;
  saveCard: (c: Card, rules: BonusRule[], caps: CapGroup[]) => boolean;
  updateCard: (c: Card) => boolean;
  removeCard: (id: string) => boolean;
  savePurchase: (p: Purchase, useCurrentTerms?: boolean) => boolean;
  removePurchase: (id: string) => boolean;
  saveOffer: (o: Offer) => boolean;
  removeOffer: (id: string) => boolean;
  setRuleActivated: (id: string, v: boolean) => boolean;
  dismiss: (id: string) => boolean;
  setPrefs: (p: Prefs) => boolean;
  undo: () => boolean;
  retrySave: () => void;
  reloadWallet: () => void;
  backup: () => string;
  storedCopy: () => string;
  restore: (data: Persisted) => boolean;
  restorePrevious: () => boolean;
  clearWallet: () => boolean;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false),
    [mode, setMode] = useState<Mode | null>(null),
    [state, setState] = useState<Persisted>(emptyWallet);
  const [storageError, setStorageError] = useState<string | null>(null),
    [unsaved, setUnsaved] = useState(false);
  const current = useRef(state),
    repository = useRef<WalletStorage | null>(null),
    previous = useRef<Persisted | null>(null);
  const display = useCallback((data: Persisted) => {
    current.current = data;
    setState(data);
  }, []);
  const persist = useCallback((data: Persisted, replace = false) => {
    try {
      if (!repository.current)
        throw new Error(
          "Browser storage is unavailable. Export your wallet before leaving this page.",
        );
      repository.current.save(data, replace);
      setStorageError(null);
      setUnsaved(false);
      return true;
    } catch (error) {
      setStorageError(
        error instanceof Error
          ? error.message
          : "Your changes could not be saved. Export a backup before leaving.",
      );
      setUnsaved(true);
      return false;
    }
  }, []);
  const load = useCallback(
    (m: Mode) => {
      setMode(m);
      previous.current = null;
      try {
        repository.current = new WalletStorage(window.localStorage, m);
        const loaded = repository.current.load(() =>
          m === "demo" ? { ...emptyWallet(), ...buildDemo() } : emptyWallet(),
        );
        display(loaded.data);
        setStorageError(loaded.error ?? null);
        setUnsaved(!!loaded.error);
        try {
          localStorage.setItem(MODE_KEY, m);
        } catch {
          setStorageError("Mode could not be remembered. Export a backup before leaving.");
          setUnsaved(true);
        }
      } catch {
        repository.current = null;
        display(migrateWallet(m === "demo" ? { ...emptyWallet(), ...buildDemo() } : emptyWallet()));
        setStorageError(
          "Browser storage is unavailable. You can use this session and export a backup.",
        );
        setUnsaved(true);
      }
    },
    [display],
  );
  useEffect(() => {
    try {
      const m = localStorage.getItem(MODE_KEY);
      if (m === "demo" || m === "local") load(m);
    } catch {
      setStorageError(
        "Browser storage is unavailable. Your wallet will need a backup before you leave.",
      );
    }
    setReady(true);
  }, [load]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (mode && event.key === storageKey(mode)) {
        setStorageError(
          "This wallet changed in another tab. Export any unsaved changes, then reload the saved copy.",
        );
      }
    };
    const onUnload = (event: BeforeUnloadEvent) => {
      if (unsaved) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [mode, unsaved]);
  const change = useCallback(
    (f: (s: Persisted) => Persisted) => {
      try {
        const before = current.current,
          next = parseWallet(versionWallet(f(before)));
        previous.current = before;
        display(next);
        return persist(next);
      } catch {
        setStorageError(
          "That change contains invalid values and was not applied. Check dates, amounts and card rules.",
        );
        return false;
      }
    },
    [display, persist],
  );
  const value = useMemo<Ctx>(
    () => ({
      ready,
      mode,
      state,
      storageError,
      unsaved,
      recoveryRequired: !!repository.current?.blocked,
      start: load,
      exit: () => {
        if (unsaved) {
          setStorageError("Export your unsaved wallet or retry saving before switching modes.");
          return;
        }
        try {
          localStorage.removeItem(MODE_KEY);
        } catch {
          /* mode can still change for this session */
        }
        setMode(null);
        display(emptyWallet());
        repository.current = null;
      },
      resetDemo: () => {
        if (mode === "demo") change(() => migrateWallet({ ...emptyWallet(), ...buildDemo() }));
      },
      shuffleDemo: () => {
        const choices = PERSONAS.filter((p) => p.label !== current.current.demoPersona),
          pick = choices[Math.floor(Math.random() * choices.length)]!;
        const { persona, purchases } = randomPurchases(
          current.current,
          today(),
          Math.floor(Math.random() * 2 ** 31),
          pick.id,
        );
        change((s) => ({
          ...s,
          purchases: purchases.map((p, i) => ({
            ...p,
            order: i,
            termsVersionId: s.versions?.at(-1)?.id,
          })),
          demoPersona: persona.label,
          dismissed: [],
        }));
        return persona;
      },
      saveCard: (c, rules, caps) =>
        change((s) => ({
          ...s,
          cards: s.cards.some((x) => x.id === c.id)
            ? s.cards.map((x) => (x.id === c.id ? c : x))
            : [...s.cards, c],
          rules: [...s.rules.filter((r) => r.cardId !== c.id), ...rules],
          capGroups: [...s.capGroups.filter((g) => g.cardId !== c.id), ...caps],
        })),
      updateCard: (c) =>
        change((s) => ({ ...s, cards: s.cards.map((x) => (x.id === c.id ? c : x)) })),
      removeCard: (id) =>
        change((s) => ({
          ...s,
          cards: s.cards.map((c) => (c.id === id ? { ...c, archived: true } : c)),
        })),
      savePurchase: (p, useCurrentTerms = false) =>
        change((s) => {
          const existing = s.purchases.find((x) => x.id === p.id);
          const dated =
            (s.versions ?? []).filter((v) => v.effectiveFrom <= p.date).at(-1) ??
            s.versions?.at(-1);
          const saved = {
            ...p,
            amount: p.amount,
            termsVersionId: useCurrentTerms
              ? s.versions?.at(-1)?.id
              : (existing?.termsVersionId ?? p.termsVersionId ?? dated?.id),
            order:
              existing?.order ??
              p.order ??
              Math.max(-1, ...s.purchases.map((x, i) => x.order ?? i)) + 1,
          };
          return {
            ...s,
            purchases: existing
              ? s.purchases.map((x) => (x.id === p.id ? saved : x))
              : [...s.purchases, saved],
          };
        }),
      removePurchase: (id) =>
        change((s) => ({ ...s, purchases: s.purchases.filter((p) => p.id !== id) })),
      saveOffer: (o) =>
        change((s) => ({
          ...s,
          offers: s.offers.some((x) => x.id === o.id)
            ? s.offers.map((x) => (x.id === o.id ? o : x))
            : [...s.offers, o],
        })),
      removeOffer: (id) => change((s) => ({ ...s, offers: s.offers.filter((o) => o.id !== id) })),
      setRuleActivated: (id, v) =>
        change((s) => ({
          ...s,
          rules: s.rules.map((r) => (r.id === id ? { ...r, activated: v } : r)),
        })),
      dismiss: (id) => change((s) => ({ ...s, dismissed: [...new Set([...s.dismissed, id])] })),
      setPrefs: (prefs) => change((s) => ({ ...s, prefs })),
      undo: () => {
        const data = previous.current;
        if (!data) return false;
        previous.current = null;
        display(data);
        return persist(data);
      },
      retrySave: () => {
        persist(current.current);
      },
      reloadWallet: () => {
        if (mode) load(mode);
      },
      backup: () => exportBackup(current.current),
      storedCopy: () => repository.current?.raw() ?? "",
      restore: (data) => {
        const migrated = migrateWallet(data);
        if (!persist(migrated, true)) return false;
        previous.current = current.current;
        display(migrated);
        return true;
      },
      restorePrevious: () => {
        try {
          const data = repository.current?.previous();
          if (!data) throw new Error("No saved copy is available.");
          if (!persist(data, true)) return false;
          display(data);
          return true;
        } catch (error) {
          setStorageError(
            error instanceof Error ? error.message : "Could not restore the previous copy.",
          );
          return false;
        }
      },
      clearWallet: () => {
        try {
          repository.current?.clear();
          localStorage.removeItem(MODE_KEY);
          display(emptyWallet());
          setMode(null);
          setStorageError(null);
          setUnsaved(false);
          previous.current = null;
          return true;
        } catch {
          setStorageError(
            "Some browser data could not be removed. Clear this site’s data in browser settings.",
          );
          return false;
        }
      },
    }),
    [ready, mode, state, storageError, unsaved, load, display, persist, change],
  );
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore outside StoreProvider");
  return c;
}
