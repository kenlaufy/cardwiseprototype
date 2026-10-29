import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { BonusRule, CapGroup, Card, Offer, Purchase, WalletState } from "./rewards";
import { buildDemo, today } from "./demo";
import { PERSONAS, randomPurchases, type Persona } from "./randomizer";

export type Mode = "demo" | "local";
export interface Prefs {
  activation: boolean;
  expiring: boolean;
  caps: boolean;
  categoryChanges: boolean;
}
interface Persisted extends WalletState {
  dismissed: string[];
  prefs: Prefs;
  demoPersona?: string | undefined; // set when demo spending has been shuffled
}

const EMPTY: Persisted = {
  cards: [], rules: [], capGroups: [], offers: [], purchases: [], dismissed: [],
  prefs: { activation: true, expiring: true, caps: true, categoryChanges: true },
};
const key = (m: Mode) => `cardwise:${m}:v1`; // demo and personal data never share storage
const MODE_KEY = "cardwise:mode";

export const uid = () => Math.random().toString(36).slice(2, 10);

interface Ctx {
  ready: boolean;
  mode: Mode | null;
  state: Persisted;
  start: (m: Mode) => void;
  exit: () => void;
  resetDemo: () => void;
  shuffleDemo: () => Persona;
  saveCard: (c: Card, rules: BonusRule[], caps: CapGroup[]) => void;
  updateCard: (c: Card) => void;
  removeCard: (id: string) => void;
  savePurchase: (p: Purchase) => void;
  removePurchase: (id: string) => void;
  saveOffer: (o: Offer) => void;
  removeOffer: (id: string) => void;
  setRuleActivated: (id: string, v: boolean) => void;
  dismiss: (id: string) => void;
  setPrefs: (p: Prefs) => void;
}
const StoreCtx = createContext<Ctx | null>(null);

function load(m: Mode): Persisted {
  try {
    const raw = localStorage.getItem(key(m));
    if (raw) return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    /* corrupted storage falls back to fresh */
  }
  return m === "demo" ? { ...EMPTY, ...buildDemo() } : EMPTY;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [state, setState] = useState<Persisted>(EMPTY);

  useEffect(() => {
    const m = localStorage.getItem(MODE_KEY) as Mode | null;
    if (m === "demo" || m === "local") {
      setMode(m);
      setState(load(m));
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready && mode) localStorage.setItem(key(mode), JSON.stringify(state));
  }, [state, mode, ready]);

  const up = useCallback((f: (s: Persisted) => Persisted) => setState((s) => f(s)), []);

  const value = useMemo<Ctx>(
    () => ({
      ready, mode, state,
      start: (m) => { localStorage.setItem(MODE_KEY, m); setMode(m); setState(load(m)); },
      exit: () => { localStorage.removeItem(MODE_KEY); setMode(null); setState(EMPTY); },
      resetDemo: () => setState({ ...EMPTY, ...buildDemo() }),
      // New random purchase history on the demo's current cards, from a different persona each time.
      shuffleDemo: () => {
        const choices = PERSONAS.filter((p) => p.label !== state.demoPersona);
        const pick = choices[Math.floor(Math.random() * choices.length)]!;
        const { persona, purchases } = randomPurchases(state, today(), Math.floor(Math.random() * 2 ** 31), pick.id);
        setState({ ...state, purchases, demoPersona: persona.label, dismissed: [] });
        return persona;
      },
      saveCard: (c, rules, caps) =>
        up((s) => ({
          ...s,
          cards: s.cards.some((x) => x.id === c.id) ? s.cards.map((x) => (x.id === c.id ? c : x)) : [...s.cards, c],
          rules: [...s.rules.filter((r) => r.cardId !== c.id), ...rules],
          capGroups: [...s.capGroups.filter((g) => g.cardId !== c.id), ...caps],
        })),
      updateCard: (c) => up((s) => ({ ...s, cards: s.cards.map((x) => (x.id === c.id ? c : x)) })),
      removeCard: (id) =>
        up((s) => ({
          ...s,
          cards: s.cards.filter((c) => c.id !== id),
          rules: s.rules.filter((r) => r.cardId !== id),
          capGroups: s.capGroups.filter((g) => g.cardId !== id),
          offers: s.offers.filter((o) => o.cardId !== id),
          purchases: s.purchases.filter((p) => p.cardId !== id),
        })),
      savePurchase: (p) =>
        up((s) => ({
          ...s,
          purchases: s.purchases.some((x) => x.id === p.id) ? s.purchases.map((x) => (x.id === p.id ? p : x)) : [...s.purchases, p],
        })),
      removePurchase: (id) => up((s) => ({ ...s, purchases: s.purchases.filter((p) => p.id !== id) })),
      saveOffer: (o) =>
        up((s) => ({ ...s, offers: s.offers.some((x) => x.id === o.id) ? s.offers.map((x) => (x.id === o.id ? o : x)) : [...s.offers, o] })),
      removeOffer: (id) => up((s) => ({ ...s, offers: s.offers.filter((o) => o.id !== id) })),
      setRuleActivated: (id, v) => up((s) => ({ ...s, rules: s.rules.map((r) => (r.id === id ? { ...r, activated: v } : r)) })),
      dismiss: (id) => up((s) => ({ ...s, dismissed: [...s.dismissed, id] })),
      setPrefs: (prefs) => up((s) => ({ ...s, prefs })),
    }),
    [ready, mode, state, up],
  );
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore outside StoreProvider");
  return c;
}
