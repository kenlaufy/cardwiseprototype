import { addDays } from "./demo";
import { capUsed, nextReset, type WalletState } from "./rewards";
import type { Prefs } from "./store";

export interface Reminder {
  id: string;
  kind: "activation" | "expiring" | "caps" | "categoryChanges";
  title: string;
  detail: string;
}

export function buildReminders(s: WalletState, prefs: Prefs, dismissed: string[], now: string): Reminder[] {
  const out: Reminder[] = [];
  const cardName = (id: string) => s.cards.find((c) => c.id === id)?.name ?? "Card";
  for (const o of s.offers) {
    if (o.endDate < now) continue;
    if (o.requiresActivation && !o.activated && o.startDate <= now)
      out.push({ id: `act-${o.id}`, kind: "activation", title: `Activate "${o.title}"`, detail: `${cardName(o.cardId)} · activate by ${o.endDate}` });
    else if (o.endDate <= addDays(now, 7))
      out.push({ id: `exp-${o.id}-${o.endDate}`, kind: "expiring", title: `"${o.title}" ends soon`, detail: `${cardName(o.cardId)} · expires ${o.endDate}` });
  }
  for (const r of s.rules) {
    if (r.requiresActivation && !r.activated && (!r.endDate || r.endDate >= now) && (!r.startDate || r.startDate <= addDays(now, 30)))
      out.push({ id: `ract-${r.id}`, kind: "activation", title: `Activate ${r.rate}% on ${r.categories.join(" & ")}`, detail: `${cardName(r.cardId)}${r.startDate ? ` · starts ${r.startDate}` : ""}` });
    if (r.startDate && r.startDate > now && r.startDate <= addDays(now, 30))
      out.push({ id: `chg-${r.id}`, kind: "categoryChanges", title: `Categories change on ${r.startDate}`, detail: `${cardName(r.cardId)} → ${r.rate}% on ${r.categories.join(" & ")}` });
  }
  for (const g of s.capGroups) {
    const used = capUsed(s, g, now);
    if (used >= g.amount * 0.8)
      out.push({ id: `cap-${g.id}-${nextReset(now, g.period)}`, kind: "caps", title: `${g.label} cap ${used >= g.amount ? "reached" : "almost reached"}`, detail: `${cardName(g.cardId)} · $${(g.amount - used).toFixed(2)} left · resets ${nextReset(now, g.period)}` });
  }
  return out.filter((r) => prefs[r.kind] && !dismissed.includes(r.id));
}
